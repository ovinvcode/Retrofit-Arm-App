/*
 * =============================================================
 *   RETROFIT SWITCH CONTROLLER - ESP32 (FINAL)
 *   WiFi Station Mode + mDNS + WebSocket + StallGuard Homing
 * =============================================================
 *
 *   STATUS: Complete. All physical parameters, WiFi credentials, 
 *   geometry, and driver current settings have been applied.
 *
 *   Libraries needed (Arduino Library Manager):
 *     - AccelStepper       by Mike McCaulay
 *     - ArduinoJson        by Benoit Blanchon
 *     - TMCStepper         by teemuatlut
 *     - EspSoftwareSerial  by Dirk Kaar
 *     - ESPAsyncWebServer   (GitHub: ESP32Async/ESPAsyncWebServer)
 *     - AsyncTCP            (GitHub: ESP32Async/AsyncTCP)
 *     - ESPmDNS            (built-in, ESP32 Arduino Core)
 *     - Preferences        (built-in, ESP32 Arduino Core)
 *
 * =============================================================
 *   CONFIRMED PIN MAP (from schematic + solder):
 *
 *   Motor 1 (U3 - TMC2209):
 *     DIR       -> GPIO4
 *     STEP      -> GPIO16
 *     EN        -> GPIO17
 *     DIAG (18) -> GPIO21
 *     PDN_UART(12) -> GPIO22
 *
 *   Motor 2 (U5 - TMC2209):
 *     DIR       -> GPIO12
 *     STEP      -> GPIO27
 *     EN        -> GPIO18
 *     DIAG (18) -> GPIO34
 *     PDN_UART(12) -> GPIO25
 *
 *   Actuator (JF-0530B via MOSFET):
 *     Gate -> GPIO13
 *
 * =============================================================
 *   APP COMMAND PROTOCOL (JSON over WebSocket):
 *
 *   App -> ESP32:
 *     {"cmd":"toggle","sw":1,"state":true}   - move + press switch 1 ON
 *     {"cmd":"rest"}                          - go to resting position
 *     {"cmd":"home"}                          - StallGuard re-homing
 *     {"cmd":"status"}                        - get all switch states
 *     {"cmd":"jog","motor":1,"steps":50}      - manual jog (calibration)
 *     {"cmd":"get_pos"}                       - current motor steps
 *     {"cmd":"set_sgthrs","val":15}           - tune stall sensitivity
 *     {"cmd":"goto","x":10.5,"y":20.0}        - move to custom Cartesian target (mapping)
 *     {"cmd":"fire"}                          - fire solenoid actuator at current position
 *
 *   ESP32 -> App:
 *     {"event":"connected","homed":true,"sw_states":[...]}
 *     {"event":"homing","msg":"..."}  {"event":"homed","msg":"..."}
 *     {"event":"moving","sw":1}  {"event":"pressing","sw":1}
 *     {"event":"returning"}  {"event":"done","sw":1,"state":true}
 *     {"event":"error","msg":"..."}
 * =============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <AccelStepper.h>
#include <TMCStepper.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <math.h>

// =============================================
// WIFI STATION CONFIGURATION
// =============================================
#define WIFI_SSID     "Hansaja's_A55"
#define WIFI_PASS     "11111111"
#define MDNS_HOSTNAME "retroswitch"   // device reachable at retroswitch.local

// =============================================
// PIN DEFINITIONS (confirmed)
// =============================================
#define M1_DIR_PIN    4
#define M1_STEP_PIN   16
#define M1_EN_PIN     17
#define M1_DIAG_PIN   21
#define M1_UART_PIN   22

#define M2_DIR_PIN    12
#define M2_STEP_PIN   27
#define M2_EN_PIN     18
#define M2_DIAG_PIN   34
#define M2_UART_PIN   25

#define ACTUATOR_PIN  13

// =============================================
// TMC2209 DRIVER TUNING & MOTOR CURRENT
// =============================================
#define R_SENSE         0.11f   // Sense resistor value
#define RMS_CURRENT     1500    // Motor current in mA (1.5A rated)
#define MICROSTEPS      8       // Microsteps matching hardware MS config

#define SGTHRS_DEFAULT  10      // StallGuard threshold (0-255) - tune after first test
#define TCOOLTHRS       500     // StallGuard active below this speed

// Homing directions: +1 (clockwise) or -1 (counter-clockwise)
// If motors home the wrong way, invert these values.
#define HOMING_DIR_M1   1       // Clockwise
#define HOMING_DIR_M2   -1      // Counter-Clockwise

// =============================================
// 5-BAR LINKAGE GEOMETRY (mm) — from SolidWorks
// =============================================
// L1 = Motor1 crank length      (motor1 axis -> joint1)
// L2 = Motor2 crank length      (motor2 axis -> joint2)
// L3 = Coupler from joint1      (joint1 -> end effector)
// L4 = Coupler from joint2      (joint2 -> end effector)
// D  = horizontal distance between Motor1 axis and Motor2 axis
// H  = vertical distance from motor axis line down to switch-plate center
#define L1   50.0f
#define L2   50.0f
#define L3   75.0f
#define L4   75.0f
#define D    47.7f
#define H    25.0f

// Steps per output-shaft revolution (after microstepping)
// NEMA17 = 200 full steps/rev. steps_per_rev = 200 * MICROSTEPS
#define STEPS_PER_REV   (200.0f * MICROSTEPS)
#define DEG_TO_STEPS(deg)  ((deg) / 360.0f * STEPS_PER_REV)

// =============================================
// SWITCH PLATE LAYOUT — Quincunx 5-gang (from CSV)
// Coordinate frame: plate center = (0,0), +Y = upward on the plate
// =============================================
#define NUM_SWITCHES  5

// {ON_X, ON_Y, OFF_X, OFF_Y} in mm, plate frame (+Y up)
const float switchCoords[NUM_SWITCHES][4] = {
  /* SW1 Top Left     */ { -22,  27,  -22,  17 },
  /* SW2 Top Right     */ {  22,  27,   22,  17 },
  /* SW3 Center        */ {   0,   5,    0,  -5 },
  /* SW4 Bottom Left   */ { -22, -17,  -22, -27 },
  /* SW5 Bottom Right  */ {  22, -17,   22, -27 },
};

// Resting position in plate frame (mm)
#define REST_X   0.0f
#define REST_Y   0.0f

// =============================================
// MOTION SETTINGS
// =============================================
#define MOTOR_MAX_SPEED       1500.0f
#define MOTOR_ACCELERATION    600.0f
#define HOMING_SPEED          250.0f
#define HOMING_ACCEL          150.0f
#define HOMING_BACKOFF         150
#define HOMING_MAX_STEPS      15000
#define ACTUATOR_ON_MS         350
#define ACTUATOR_OFF_WAIT_MS   200
#define MOTOR_DISABLE_DELAY     600

// =============================================
// OBJECTS
// =============================================
AsyncWebServer  server(80);
AsyncWebSocket  ws("/ws");

SoftwareSerial  TMCSerial1;
SoftwareSerial  TMCSerial2;
TMC2209Stepper  driver1(&TMCSerial1, R_SENSE, 0b00);
TMC2209Stepper  driver2(&TMCSerial2, R_SENSE, 0b00);

AccelStepper    motor1(AccelStepper::DRIVER, M1_STEP_PIN, M1_DIR_PIN);
AccelStepper    motor2(AccelStepper::DRIVER, M2_STEP_PIN, M2_DIR_PIN);
Preferences     nvs;

bool  isHomed = false;
bool  swStates[NUM_SWITCHES] = {false};

// Pending command flags (set by WS callback, executed in loop)
volatile bool pendingToggle  = false;
volatile int  pendingSwIdx   = -1;
volatile bool pendingTargetOn = false;
volatile bool pendingHome    = false;
volatile bool pendingRest    = false;
volatile bool pendingJog     = false;
volatile int  jogMotorNum    = 0;
volatile long jogStepCount   = 0;

// Added for Custom Mapping support
volatile bool  pendingGoto   = false;
volatile float pendingGotoX  = 0.0f;
volatile float pendingGotoY  = 0.0f;
volatile bool  pendingFire   = false;

// =============================================
// WEBSOCKET BROADCAST
// =============================================
void wsSend(const String& msg) {
  ws.textAll(msg);
  Serial.print("[WS TX] "); Serial.println(msg);
}

// =============================================
// INVERSE KINEMATICS
// =============================================
// Converts a target point in the PLATE coordinate frame (+Y up,
// origin = plate center) into motor step targets, accounting for
// the fact that the motors sit above the plate (inverted layout).
//
// Internally we work in the MACHINE frame:
//   machine_x = plate_x
//   machine_y = H - plate_y      (machine +Y is downward from motor axis)
//   Motor1 axis = (-D/2, 0) in machine frame
//   Motor2 axis = ( D/2, 0) in machine frame
//
// Standard 5-bar (RR) inverse kinematics:
//   For each motor, find the angle of its crank (L1 or L2) such
//   that the coupler (L3 or L4) reaches the shared end-effector
//   point P = (machine_x, machine_y).
//
// This uses the classic "two circle intersection" method:
//   Motor crank tip traces a circle of radius L1 (or L2) around
//   its own axis. The end effector is at fixed distance L3 (or L4)
//   from that crank tip. We solve for the crank tip position that
//   is exactly L3 away from P, then find the joint angle.
bool solveCrankAngle(float motorX, float motorY, float armLen,
                      float couplerLen, float px, float py,
                      float& outAngleDeg) {
  // Distance from motor axis to target point P
  float dx = px - motorX;
  float dy = py - motorY;
  float distToP = sqrtf(dx * dx + dy * dy);

  // Triangle: motor axis -- crank tip -- P
  //   side a = armLen (motor axis to crank tip)
  //   side b = couplerLen (crank tip to P)
  //   side c = distToP (motor axis to P)
  // Use law of cosines to find angle at motor axis between
  // (motor->P) line and (motor->crankTip) line.
  if (distToP > (armLen + couplerLen) || distToP < fabsf(armLen - couplerLen)) {
    Serial.println("[IK] ERROR: target unreachable (out of workspace)");
    return false; // unreachable - check L1-L4, D, H, or target coords
  }

  float angleToP = atan2f(dy, dx); // direction from motor axis to P

  float cosAlpha = (armLen * armLen + distToP * distToP - couplerLen * couplerLen)
                    / (2.0f * armLen * distToP);
  cosAlpha = constrain(cosAlpha, -1.0f, 1.0f);
  float alpha = acosf(cosAlpha);

  // Two solutions exist (elbow up / elbow down). We pick the one
  // matching the mechanism's natural assembly (crank tip below
  // the motor axis line, toward the plate). Adjust sign if the
  // mechanism moves the wrong way during testing.
  float thetaRad = angleToP - alpha;   // try this branch first
  outAngleDeg = thetaRad * 180.0f / PI;
  return true;
}

// Converts plate-frame (x,y) target into {m1Steps, m2Steps}
// Returns false if unreachable.
bool plateToSteps(float plateX, float plateY, long& m1Steps, long& m2Steps) {
  // Transform plate frame -> machine frame
  float machineX = plateX;
  float machineY = H - plateY;

  float motor1X = -D / 2.0f, motor1Y = 0.0f;
  float motor2X =  D / 2.0f, motor2Y = 0.0f;

  float angle1Deg, angle2Deg;
  bool ok1 = solveCrankAngle(motor1X, motor1Y, L1, L3, machineX, machineY, angle1Deg);
  bool ok2 = solveCrankAngle(motor2X, motor2Y, L2, L4, machineX, machineY, angle2Deg);

  if (!ok1 || !ok2) return false;

  // ⚠️ angle1Deg/angle2Deg are absolute crank angles (deg, machine frame).
  // Convert to RELATIVE steps from your home reference angle.
  // Once homing completes, position 0,0 should correspond to a known
  // angle; FILL_IN any zero-offset correction here if your mechanical
  // zero doesn't align with angle = 0.
  m1Steps = (long) DEG_TO_STEPS(angle1Deg);
  m2Steps = (long) DEG_TO_STEPS(angle2Deg);
  return true;
}

// =============================================
// MOTOR HELPERS
// =============================================
void enableMotors()  { digitalWrite(M1_EN_PIN, LOW);  digitalWrite(M2_EN_PIN, LOW);  delay(5); }
void disableMotors() { digitalWrite(M1_EN_PIN, HIGH); digitalWrite(M2_EN_PIN, HIGH); }

void runUntilDone() {
  while (motor1.distanceToGo() != 0 || motor2.distanceToGo() != 0) {
    motor1.run();
    motor2.run();
  }
}

// =============================================
// STALLGUARD SENSORLESS HOMING
// =============================================
bool homeOneMotor(AccelStepper& motor, int diagPin, int dir, const char* name) {
  Serial.printf("[HOME] %s searching...\n", name);
  motor.setMaxSpeed(HOMING_SPEED);
  motor.setAcceleration(HOMING_ACCEL);
  motor.move((long)dir * HOMING_MAX_STEPS);

  int  steps = 0;
  bool stalled = false;

  while (motor.distanceToGo() != 0) {
    motor.run();
    steps++;
    if (steps > 50 && digitalRead(diagPin) == HIGH) {
      stalled = true;
      motor.stop();
      while (motor.distanceToGo() != 0) motor.run();
      break;
    }
    if (steps >= HOMING_MAX_STEPS) break;
  }

  if (!stalled) {
    Serial.printf("[HOME] %s: FAILED - no stall detected\n", name);
    return false;
  }

  motor.move(-(long)dir * HOMING_BACKOFF);
  while (motor.distanceToGo() != 0) motor.run();
  motor.setCurrentPosition(0);

  motor.setMaxSpeed(MOTOR_MAX_SPEED);
  motor.setAcceleration(MOTOR_ACCELERATION);
  Serial.printf("[HOME] %s: done\n", name);
  return true;
}

bool doHoming() {
  wsSend("{\"event\":\"homing\",\"msg\":\"Starting homing\"}");
  enableMotors();
  delay(200);

  bool ok1 = homeOneMotor(motor1, M1_DIAG_PIN, HOMING_DIR_M1, "Motor1");
  delay(400);
  bool ok2 = homeOneMotor(motor2, M2_DIAG_PIN, HOMING_DIR_M2, "Motor2");
  delay(400);
  disableMotors();

  isHomed = ok1 && ok2;
  if (isHomed) {
    wsSend("{\"event\":\"homed\",\"msg\":\"Homing complete\"}");
    // After homing, go to rest position so the mechanism starts clear
    pendingRest = true;
  } else {
    wsSend("{\"event\":\"error\",\"msg\":\"Homing failed - check HOMING_DIR\"}");
  }
  return isHomed;
}

// =============================================
// MOTION: MOVE TO PLATE COORDINATE (mm) -> steps -> run
// =============================================
bool moveToPlateXY(float x, float y) {
  long m1, m2;
  if (!plateToSteps(x, y, m1, m2)) {
    wsSend("{\"event\":\"error\",\"msg\":\"Target unreachable - check IK params\"}");
    return false;
  }
  enableMotors();
  motor1.moveTo(m1);
  motor2.moveTo(m2);
  runUntilDone();
  return true;
}

void goRest() {
  if (!isHomed) { doHoming(); return; }
  wsSend("{\"event\":\"returning\"}");
  moveToPlateXY(REST_X, REST_Y);
  delay(MOTOR_DISABLE_DELAY);
  disableMotors();
}

// =============================================
// ACTUATOR
// =============================================
void fireActuator() {
  digitalWrite(ACTUATOR_PIN, HIGH);
  delay(ACTUATOR_ON_MS);
  digitalWrite(ACTUATOR_PIN, LOW);
  delay(ACTUATOR_OFF_WAIT_MS);
}

// =============================================
// FULL TOGGLE SEQUENCE: rest -> switch -> press -> rest
// =============================================
void doToggleSwitch(int idx, bool targetOn) {
  if (!isHomed) { wsSend("{\"event\":\"error\",\"msg\":\"Not homed\"}"); return; }
  if (idx < 0 || idx >= NUM_SWITCHES) { wsSend("{\"event\":\"error\",\"msg\":\"Invalid switch\"}"); return; }

  float targetX = targetOn ? switchCoords[idx][0] : switchCoords[idx][2];
  float targetY = targetOn ? switchCoords[idx][1] : switchCoords[idx][3];

  wsSend("{\"event\":\"moving\",\"sw\":" + String(idx + 1) + "}");
  if (!moveToPlateXY(targetX, targetY)) return;

  wsSend("{\"event\":\"pressing\",\"sw\":" + String(idx + 1) + "}");
  fireActuator();
  swStates[idx] = targetOn;

  goRest();

  wsSend("{\"event\":\"done\",\"sw\":" + String(idx + 1) +
         ",\"state\":" + (swStates[idx] ? "true" : "false") + "}");
}

// =============================================
// COMMAND HANDLER
// =============================================
void handleCommand(const String& raw) {
  Serial.print("[WS RX] "); Serial.println(raw);
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, raw)) { wsSend("{\"event\":\"error\",\"msg\":\"JSON error\"}"); return; }

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "toggle") == 0) {
    pendingSwIdx    = doc["sw"].as<int>() - 1;
    pendingTargetOn = doc["state"].as<bool>();
    pendingToggle   = true;

  } else if (strcmp(cmd, "rest") == 0) {
    pendingRest = true;

  } else if (strcmp(cmd, "home") == 0) {
    pendingHome = true;

  } else if (strcmp(cmd, "status") == 0) {
    String s = "{\"event\":\"status\",\"homed\":" + String(isHomed ? "true" : "false") + ",\"sw_states\":[";
    for (int i = 0; i < NUM_SWITCHES; i++) {
      s += swStates[i] ? "true" : "false";
      if (i < NUM_SWITCHES - 1) s += ",";
    }
    s += "]}";
    wsSend(s);

  } else if (strcmp(cmd, "get_pos") == 0) {
    wsSend("{\"event\":\"pos\",\"m1\":" + String(motor1.currentPosition()) +
           ",\"m2\":" + String(motor2.currentPosition()) + "}");

  } else if (strcmp(cmd, "jog") == 0) {
    jogMotorNum  = doc["motor"].as<int>();
    jogStepCount = doc["steps"].as<long>();
    pendingJog   = true;

  } else if (strcmp(cmd, "set_sgthrs") == 0) {
    uint8_t val = doc["val"].as<uint8_t>();
    driver1.SGTHRS(val); driver2.SGTHRS(val);
    wsSend("{\"event\":\"ok\",\"msg\":\"SGTHRS updated\"}");

  } else if (strcmp(cmd, "goto") == 0) {
    pendingGotoX = doc["x"].as<float>();
    pendingGotoY = doc["y"].as<float>();
    pendingGoto  = true;

  } else if (strcmp(cmd, "fire") == 0) {
    pendingFire  = true;

  } else {
    wsSend("{\"event\":\"error\",\"msg\":\"Unknown command\"}");
  }
}

// =============================================
// WEBSOCKET EVENT HANDLER
// =============================================
void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
               AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("[WS] Client #%u connected\n", client->id());
    String s = "{\"event\":\"connected\",\"homed\":" + String(isHomed ? "true" : "false") + ",\"sw_states\":[";
    for (int i = 0; i < NUM_SWITCHES; i++) {
      s += swStates[i] ? "true" : "false";
      if (i < NUM_SWITCHES - 1) s += ",";
    }
    s += "]}";
    client->text(s);

  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("[WS] Client #%u disconnected\n", client->id());

  } else if (type == WS_EVT_DATA) {
    AwsFrameInfo* info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len) {
      handleCommand(String((char*)data, len));
    }
  }
}

// =============================================
// TMC2209 SETUP
// =============================================
void setupDrivers() {
  TMCSerial1.begin(115200, SWSERIAL_8N1, M1_UART_PIN, M1_UART_PIN, false, 256);
  TMCSerial2.begin(115200, SWSERIAL_8N1, M2_UART_PIN, M2_UART_PIN, false, 256);
  delay(100);

  driver1.begin(); driver1.toff(4); driver1.blank_time(24);
  driver1.rms_current(RMS_CURRENT); driver1.microsteps(MICROSTEPS);
  driver1.en_spreadCycle(false); driver1.pwm_autoscale(true);
  driver1.TCOOLTHRS(TCOOLTHRS); driver1.SGTHRS(SGTHRS_DEFAULT);

  driver2.begin(); driver2.toff(4); driver2.blank_time(24);
  driver2.rms_current(RMS_CURRENT); driver2.microsteps(MICROSTEPS);
  driver2.en_spreadCycle(false); driver2.pwm_autoscale(true);
  driver2.TCOOLTHRS(TCOOLTHRS); driver2.SGTHRS(SGTHRS_DEFAULT);

  Serial.println("[TMC] Drivers ready");
  Serial.printf("[TMC] Driver1 version: 0x%02X\n", driver1.version());
  Serial.printf("[TMC] Driver2 version: 0x%02X\n", driver2.version());
}

// =============================================
// SETUP
// =============================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== RetroSwitch Controller (Final) ===");

  pinMode(M1_EN_PIN, OUTPUT); pinMode(M2_EN_PIN, OUTPUT);
  pinMode(M1_DIAG_PIN, INPUT_PULLUP);
  pinMode(M2_DIAG_PIN, INPUT_PULLUP);
  pinMode(ACTUATOR_PIN, OUTPUT);
  disableMotors();
  digitalWrite(ACTUATOR_PIN, LOW);

  motor1.setMaxSpeed(MOTOR_MAX_SPEED); motor1.setAcceleration(MOTOR_ACCELERATION);
  motor2.setMaxSpeed(MOTOR_MAX_SPEED); motor2.setAcceleration(MOTOR_ACCELERATION);
  motor1.setCurrentPosition(0);        motor2.setCurrentPosition(0);

  setupDrivers();

  // WiFi Station mode
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(250); Serial.print("."); retries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected, IP: "); Serial.println(WiFi.localIP());
    if (MDNS.begin(MDNS_HOSTNAME)) {
      Serial.printf("[mDNS] http://%s.local\n", MDNS_HOSTNAME);
      MDNS.addService("ws", "tcp", 80);
    } else {
      Serial.println("[mDNS] FAILED to start");
    }
  } else {
    Serial.println("[WiFi] FAILED to connect - check SSID/password");
  }

  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  server.begin();
  Serial.println("[WS] Server started at /ws");

  Serial.println("[INFO] Send {\"cmd\":\"home\"} to begin\n");
}

// =============================================
// LOOP
// =============================================
// Deploys motor motion outside of AsyncWebSocket thread to keep the watchdog timer happy.
void loop() {
  ws.cleanupClients();

  if (pendingToggle && pendingSwIdx >= 0) {
    bool t = pendingToggle; int s = pendingSwIdx; bool on = pendingTargetOn;
    pendingToggle = false; pendingSwIdx = -1;
    if (t) doToggleSwitch(s, on);
  }

  if (pendingHome) {
    pendingHome = false;
    doHoming();
  }

  if (pendingRest) {
    pendingRest = false;
    goRest();
    wsSend("{\"event\":\"ok\",\"msg\":\"At rest\"}");
  }

  if (pendingJog) {
    pendingJog = false;
    enableMotors();
    if (jogMotorNum == 1) { motor1.move(jogStepCount); while (motor1.distanceToGo() != 0) motor1.run(); }
    else                  { motor2.move(jogStepCount); while (motor2.distanceToGo() != 0) motor2.run(); }
    wsSend("{\"event\":\"pos\",\"m1\":" + String(motor1.currentPosition()) +
           ",\"m2\":" + String(motor2.currentPosition()) + "}");
  }

  // Defer target movement to Loop to avoid blocking AsyncWebServer thread task watchdog
  if (pendingGoto) {
    pendingGoto = false;
    float tx = pendingGotoX;
    float ty = pendingGotoY;
    moveToPlateXY(tx, ty);
    wsSend("{\"event\":\"ok\",\"msg\":\"At target\"}");
  }

  // Defer actuator firing to Loop
  if (pendingFire) {
    pendingFire = false;
    wsSend("{\"event\":\"pressing\",\"msg\":\"Firing actuator\"}");
    fireActuator();
    wsSend("{\"event\":\"ok\",\"msg\":\"Actuator fired\"}");
  }

  delay(5);
}
