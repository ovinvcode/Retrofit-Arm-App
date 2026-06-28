import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HardwareService } from '@/services/HardwareService';
import { FontAwesome } from '@expo/vector-icons';

type WizardStep = 'SETUP' | 'MAPPING' | 'REVIEW';

type DraftSwitch = {
  name: string;
  x_coord: number;
  y_coord: number;
  skipped: boolean;
};

export default function MapScreen() {
  const { rooms, addDevice } = useAppStore();

  // Navigation State
  const [step, setStep] = useState<WizardStep>('SETUP');

  // Phase 1: Setup State
  const [panelName, setPanelName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(rooms[0] || '');
  const [switchCount, setSwitchCount] = useState(1);

  // Phase 2: Mapping State
  const [draftSwitches, setDraftSwitches] = useState<DraftSwitch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSwitchName, setCurrentSwitchName] = useState('');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [homing, setHoming] = useState(false);
  const [controlMode, setControlMode] = useState<'dpad' | 'joystick'>('dpad');

  // Hardware Controls
  const jog = (axis: 'x' | 'y', amount: number) => {
    if (axis === 'x') setX(prev => prev + amount);
    if (axis === 'y') setY(prev => prev + amount);
  };

  const homeArm = async () => {
    setHoming(true);
    try {
      await HardwareService.homeArm();
      setX(0);
      setY(0);
    } catch (e) {
      console.error(e);
    } finally {
      setHoming(false);
    }
  };

  const startMapping = () => {
    if (!panelName.trim()) {
      Alert.alert('Missing Info', 'Please enter a Panel Name.');
      return;
    }
    const truncatedDrafts = draftSwitches.slice(0, switchCount);
    setDraftSwitches(truncatedDrafts);
    
    setCurrentIndex(0);
    setCurrentSwitchName(truncatedDrafts[0]?.name || `Switch 1`);
    setX(truncatedDrafts[0]?.x_coord || 0);
    setY(truncatedDrafts[0]?.y_coord || 0);
    setTestComplete(false);
    setStep('MAPPING');
  };

  const testPress = async () => {
    setTesting(true);
    try {
      // Simulate moving to X,Y and physically pressing the switch
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestComplete(true);
    } catch(e) {
      console.error(e);
      Alert.alert('Error', 'Failed to test hardware.');
    } finally {
      setTesting(false);
    }
  };

  const saveCurrentSwitch = () => {
    const newDraft = { 
      name: currentSwitchName.trim() || `Switch ${currentIndex + 1}`, 
      x_coord: x, 
      y_coord: y, 
      skipped: false 
    };
    const newDrafts = [...draftSwitches];
    newDrafts[currentIndex] = newDraft;
    setDraftSwitches(newDrafts);
    setTestComplete(false);
    advanceMapping(currentIndex + 1);
  };

  const handleRecalibrate = () => {
    setTestComplete(false);
  };

  const skipCurrentSwitch = () => {
    const newDraft = { 
      name: `Skipped ${currentIndex + 1}`, 
      x_coord: 0, 
      y_coord: 0, 
      skipped: true 
    };
    const newDrafts = [...draftSwitches];
    newDrafts[currentIndex] = newDraft;
    setDraftSwitches(newDrafts);
    setTestComplete(false);
    advanceMapping(currentIndex + 1);
  };

  const advanceMapping = (nextIndex: number) => {
    if (nextIndex >= switchCount) {
      setStep('REVIEW');
    } else {
      setCurrentIndex(nextIndex);
      setCurrentSwitchName(draftSwitches[nextIndex]?.name || `Switch ${nextIndex + 1}`);
      setX(draftSwitches[nextIndex]?.x_coord || 0);
      setY(draftSwitches[nextIndex]?.y_coord || 0);
    }
  };

  const handleNext = () => {
    if (step === 'MAPPING' && currentIndex < draftSwitches.length) {
      setTestComplete(false);
      advanceMapping(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (step === 'REVIEW') {
      setStep('MAPPING');
      const prevIndex = switchCount - 1;
      setCurrentIndex(prevIndex);
      setCurrentSwitchName(draftSwitches[prevIndex]?.name || `Switch ${prevIndex + 1}`);
      setX(draftSwitches[prevIndex]?.x_coord || 0);
      setY(draftSwitches[prevIndex]?.y_coord || 0);
      setTestComplete(false);
    } else if (step === 'MAPPING') {
      if (currentIndex === 0) {
        setStep('SETUP');
      } else {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        setCurrentSwitchName(draftSwitches[prevIndex]?.name || `Switch ${prevIndex + 1}`);
        setX(draftSwitches[prevIndex]?.x_coord || 0);
        setY(draftSwitches[prevIndex]?.y_coord || 0);
        setTestComplete(false);
      }
    }
  };

  const saveAll = () => {
    let savedCount = 0;
    draftSwitches.forEach((draft) => {
      if (!draft.skipped) {
        addDevice({
          id: Math.random().toString(36).substring(2, 9),
          room: selectedRoom,
          group: panelName.trim(),
          switch_name: draft.name,
          status: 'off',
          x_coord: draft.x_coord,
          y_coord: draft.y_coord,
          z_coord: 0,
        });
        savedCount++;
      }
    });
    
    Alert.alert('Success', `Saved ${savedCount} switches to ${panelName}!`);
    
    // Reset to Setup
    setPanelName('');
    setSwitchCount(1);
    setDraftSwitches([]);
    setStep('SETUP');
  };

  // --- UI Renderers ---

  const renderSetupPhase = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Panel Setup</Text>
      
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Panel Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bedside Panel"
          placeholderTextColor="#A3B1C6"
          value={panelName}
          onChangeText={setPanelName}
        />

        <Text style={styles.inputLabel}>Assign Room</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroller}>
          {rooms.map((room) => (
            <TouchableOpacity 
              key={room} 
              onPress={() => setSelectedRoom(room)}
              style={[styles.roomTab, selectedRoom === room && styles.roomTabActive]}
            >
              <Text style={[styles.roomTabText, selectedRoom === room && styles.roomTabTextActive]}>{room}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.inputLabel}>Number of Switches</Text>
        <View style={styles.stepperContainer}>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setSwitchCount(Math.max(1, switchCount - 1))}>
            <FontAwesome name="minus" size={16} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{switchCount}</Text>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setSwitchCount(Math.min(10, switchCount + 1))}>
            <FontAwesome name="plus" size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Standard Layouts</Text>
        <View style={styles.layoutsContainer}>
          <View style={styles.layoutPreviewBox}>
            <FontAwesome name={switchCount > 1 ? "th-large" : "stop"} size={32} color="#0A84FF" />
            <Text style={styles.layoutPreviewText}>{switchCount}-Gang Plate</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={startMapping}>
        <Text style={styles.primaryBtnText}>Start Mapping ({switchCount})</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderMappingPhase = () => (
    <KeyboardAvoidingView 
      style={styles.mappingContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.joystickArea}>
        <View style={styles.coordDisplay}>
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>X</Text>
            <Text style={styles.coordValue}>{x}</Text>
          </View>

          <TouchableOpacity style={styles.homeBtnSmall} onPress={homeArm} disabled={homing}>
            {homing ? <ActivityIndicator color="#0A84FF" /> : <Text style={styles.homeBtnSmallText}>Home</Text>}
          </TouchableOpacity>

          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>Y</Text>
            <Text style={styles.coordValue}>{y}</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, controlMode === 'dpad' && styles.tabBtnActive]} 
            onPress={() => setControlMode('dpad')}
          >
            <Text style={[styles.tabText, controlMode === 'dpad' && styles.tabTextActive]}>D-Pad</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, controlMode === 'joystick' && styles.tabBtnActive]} 
            onPress={() => setControlMode('joystick')}
          >
            <Text style={[styles.tabText, controlMode === 'joystick' && styles.tabTextActive]}>Joystick</Text>
          </TouchableOpacity>
        </View>

        {controlMode === 'dpad' ? (
          <View style={styles.joystickContainer}>
            <TouchableOpacity style={[styles.joystickBtn, styles.btnUp]} onPress={() => jog('y', 1)}>
              <FontAwesome name="arrow-up" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.joystickBtn, styles.btnLeft]} onPress={() => jog('x', -1)}>
              <FontAwesome name="arrow-left" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.joystickBtn, styles.btnRight]} onPress={() => jog('x', 1)}>
              <FontAwesome name="arrow-right" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.joystickBtn, styles.btnDown]} onPress={() => jog('y', -1)}>
              <FontAwesome name="arrow-down" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.analogStickContainer}>
            <View style={styles.analogStickTrack}>
              <TouchableOpacity style={[styles.quadrant, styles.quadUp]} onPress={() => jog('y', 1)} />
              <TouchableOpacity style={[styles.quadrant, styles.quadDown]} onPress={() => jog('y', -1)} />
              <TouchableOpacity style={[styles.quadrant, styles.quadLeft]} onPress={() => jog('x', -1)} />
              <TouchableOpacity style={[styles.quadrant, styles.quadRight]} onPress={() => jog('x', 1)} />
              <View style={styles.analogStickThumb} />
            </View>
          </View>
        )}
      </View>

      {/* Floating Bottom Panel */}
      <View style={styles.floatingPanel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.mappingProgress}>Mapping {currentIndex + 1} of {switchCount}</Text>
          <TouchableOpacity onPress={skipCurrentSwitch} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.floatingInput}
          placeholder="Switch Name (e.g. Fan)"
          placeholderTextColor="#A3B1C6"
          value={currentSwitchName}
          onChangeText={setCurrentSwitchName}
        />
        
        {testComplete ? (
          <View style={styles.testResultRow}>
            <TouchableOpacity style={styles.recalibrateBtn} onPress={handleRecalibrate}>
              <Text style={styles.recalibrateBtnText}>Recalibrate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveSwitchBtn} onPress={saveCurrentSwitch}>
              <Text style={styles.saveSwitchBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.testBtn} onPress={testPress} disabled={testing}>
            {testing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.testBtnText}>Test Press</Text>}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  const renderReviewPhase = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Review & Save</Text>
      
      <View style={styles.card}>
        <Text style={styles.reviewHeader}>{panelName} - {selectedRoom}</Text>
        
        {draftSwitches.map((draft, idx) => (
          <View key={idx} style={styles.reviewItem}>
            <View style={styles.reviewItemLeft}>
              <Text style={styles.reviewItemName}>{draft.name}</Text>
              {draft.skipped ? (
                <Text style={styles.skippedText}>Skipped</Text>
              ) : (
                <Text style={styles.reviewItemCoords}>X: {draft.x_coord} | Y: {draft.y_coord}</Text>
              )}
            </View>
            <FontAwesome name={draft.skipped ? "ban" : "check-circle"} size={24} color={draft.skipped ? "#FF3B30" : "#34C759"} />
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setStep('SETUP'); setDraftSwitches([]); }}>
          <Text style={styles.secondaryBtnText}>Cancel Mapping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtnFlex} onPress={saveAll}>
          <Text style={styles.primaryBtnText}>Save All</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {step !== 'SETUP' && (
          <TouchableOpacity style={styles.headerBackBtn} onPress={handleBack}>
            <FontAwesome name="chevron-left" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Switch Mapper</Text>
        {step === 'MAPPING' && currentIndex < draftSwitches.length && (
          <TouchableOpacity style={styles.headerNextBtn} onPress={handleNext}>
            <FontAwesome name="chevron-right" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>
      
      {step === 'SETUP' && renderSetupPhase()}
      {step === 'MAPPING' && renderMappingPhase()}
      {step === 'REVIEW' && renderReviewPhase()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0E5EC',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E5EC',
    borderBottomWidth: 1,
    borderBottomColor: '#c0c8d6',
    flexDirection: 'row',
  },
  headerBackBtn: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 10,
    zIndex: 10,
  },
  headerNextBtn: {
    position: 'absolute',
    right: 20,
    top: 60,
    padding: 10,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8E8E93',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#E0E5EC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  inputLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#E0E5EC',
    color: '#8E8E93',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#c0c8d6',
  },
  roomScroller: {
    marginBottom: 25,
  },
  roomTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#E0E5EC',
    borderWidth: 1,
    borderColor: '#c0c8d6',
  },
  roomTabActive: {
    backgroundColor: '#d1d9e6',
    borderColor: '#0A84FF',
  },
  roomTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  roomTabTextActive: {
    color: '#0A84FF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: '#E0E5EC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c0c8d6',
    alignSelf: 'flex-start',
  },
  stepperBtn: {
    padding: 15,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
    paddingHorizontal: 20,
  },
  layoutsContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  layoutPreviewBox: {
    width: 120,
    height: 100,
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  layoutPreviewText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#0A84FF',
  },
  primaryBtn: {
    backgroundColor: '#0A84FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnFlex: {
    flex: 1,
    backgroundColor: '#0A84FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#d1d9e6',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 10,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryBtnText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Mapping Phase Styles
  mappingContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  joystickArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 30,
    position: 'absolute',
    top: 0,
  },
  coordBox: {
    alignItems: 'center',
    backgroundColor: '#E0E5EC',
    padding: 15,
    borderRadius: 16,
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  coordLabel: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 5,
    fontWeight: '600',
  },
  coordValue: {
    color: '#0A84FF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  homeBtnSmall: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E0E5EC',
    borderWidth: 1,
    borderColor: '#c0c8d6',
    alignSelf: 'center',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    justifyContent: 'center',
  },
  homeBtnSmallText: {
    color: '#0A84FF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  joystickContainer: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  joystickBtn: {
    position: 'absolute',
    width: 70,
    height: 70,
    backgroundColor: '#E0E5EC',
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  btnUp: { top: 0, left: 75 },
  btnDown: { bottom: 0, left: 75 },
  btnLeft: { top: 75, left: 0 },
  btnRight: { top: 75, right: 0 },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E5EC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c0c8d6',
    padding: 4,
    marginBottom: 30,
    marginTop: 100, // pushed down to clear coords
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  tabBtnActive: {
    backgroundColor: '#d1d9e6',
    borderColor: '#0A84FF',
    borderWidth: 1,
  },
  tabText: {
    color: '#8E8E93',
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#0A84FF',
  },
  analogStickContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analogStickTrack: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E0E5EC',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  analogStickThumb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E5EC',
    position: 'absolute',
    top: 58,
    left: 58,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    pointerEvents: 'none',
  },
  quadrant: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  quadUp: { top: 0, left: 50, right: 50, height: 80 },
  quadDown: { bottom: 0, left: 50, right: 50, height: 80 },
  quadLeft: { top: 50, bottom: 50, left: 0, width: 80 },
  quadRight: { top: 50, bottom: 50, right: 0, width: 80 },
  
  floatingPanel: {
    backgroundColor: '#E0E5EC',
    padding: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderTopColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  mappingProgress: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  skipBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#d1d9e6',
    borderRadius: 12,
  },
  skipBtnText: {
    color: '#FF9F0A',
    fontWeight: 'bold',
  },
  floatingInput: {
    backgroundColor: '#E0E5EC',
    color: '#8E8E93',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c0c8d6',
  },
  testBtn: {
    backgroundColor: '#0A84FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  testBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  recalibrateBtn: {
    flex: 1,
    backgroundColor: '#d1d9e6',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveSwitchBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  recalibrateBtnText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveSwitchBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Review Phase Styles
  reviewHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A84FF',
    marginBottom: 20,
    textAlign: 'center',
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#c0c8d6',
  },
  reviewItemLeft: {
    flex: 1,
  },
  reviewItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginBottom: 4,
  },
  reviewItemCoords: {
    fontSize: 14,
    color: '#A3B1C6',
  },
  skippedText: {
    fontSize: 14,
    color: '#FF9F0A',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
