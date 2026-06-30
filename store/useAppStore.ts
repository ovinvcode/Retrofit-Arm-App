import { create } from 'zustand';

export type Device = {
  id: string;
  room: string;
  group?: string;
  switch_name: string;
  status: 'on' | 'off';
  on_x: number;
  on_y: number;
  off_x: number;
  off_y: number;
  z_coord: number;
};

export type Schedule = {
  id: string;
  device_id: string;
  action: 'on' | 'off';
  time: string; // e.g., '08:00 AM'
  days: string[]; // e.g., ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
};

interface AppState {
  rooms: string[];
  currentRoom: string;
  devices: Device[];
  schedules: Schedule[];
  setCurrentRoom: (room: string) => void;
  setDevices: (devices: Device[]) => void;
  setSchedules: (schedules: Schedule[]) => void;
  updateDeviceStatus: (id: string, status: 'on' | 'off') => void;
  addDevice: (device: Device) => void;
  addSchedule: (schedule: Schedule) => void;
  deleteSchedule: (id: string) => void;
  
  // WebSocket Connection State
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  isHomed: boolean;
  robotStatus: string;
  deviceIp: string;
  devicePort: string;
  wsConnection: WebSocket | null;
  setDeviceIp: (ip: string) => void;
  setDevicePort: (port: string) => void;
  connectToDevice: (ip: string, port: string) => void;
  disconnectDevice: () => void;
  sendDeviceCommand: (command: object) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  rooms: ['Bedroom', 'Living Room', 'Kitchen'],
  currentRoom: 'Living Room',
  devices: [
    {
      id: 'd1',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: '1 (Top Left)',
      status: 'off',
      on_x: -22,
      on_y: 27,
      off_x: -22,
      off_y: 17,
      z_coord: 5,
    },
    {
      id: 'd2',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: '2 (Top Right)',
      status: 'off',
      on_x: 22,
      on_y: 27,
      off_x: 22,
      off_y: 17,
      z_coord: 5,
    },
    {
      id: 'd3',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: '3 (Center)',
      status: 'off',
      on_x: 0,
      on_y: 5,
      off_x: 0,
      off_y: -5,
      z_coord: 5,
    },
    {
      id: 'd4',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: '4 (Bottom Left)',
      status: 'off',
      on_x: -22,
      on_y: -17,
      off_x: -22,
      off_y: -27,
      z_coord: 5,
    },
    {
      id: 'd5',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: '5 (Bottom Right)',
      status: 'off',
      on_x: 22,
      on_y: -17,
      off_x: 22,
      off_y: -27,
      z_coord: 5,
    }
  ],
  schedules: [
    {
      id: 's1',
      device_id: 'd1',
      action: 'on',
      time: '18:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  ],
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setDevices: (devices) => set({ devices }),
  setSchedules: (schedules) => set({ schedules }),
  updateDeviceStatus: (id, status) =>
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === id ? { ...device, status } : device
      ),
    })),
  addDevice: (device) => set((state) => ({ devices: [...state.devices, device] })),
  addSchedule: (schedule) => set((state) => ({ schedules: [...state.schedules, schedule] })),
  deleteSchedule: (id) => set((state) => ({ schedules: state.schedules.filter(s => s.id !== id) })),

  // WebSocket Connection Implementation
  connectionStatus: 'disconnected',
  isHomed: false,
  robotStatus: 'Idle',
  deviceIp: '10.112.201.230',
  devicePort: '80',
  wsConnection: null,

  setDeviceIp: (ip) => set({ deviceIp: ip }),
  setDevicePort: (port) => set({ devicePort: port }),

  connectToDevice: (ip, port) => {
    const ws = new WebSocket(`ws://${ip}:${port}/ws`);
    set({ connectionStatus: 'connecting', deviceIp: ip, devicePort: port, wsConnection: ws, robotStatus: 'Connecting...' });

    ws.onopen = () => {
      set({ connectionStatus: 'connected', robotStatus: 'Connected. Waiting for state...' });
      console.log('Connected to ESP32');
    };

    ws.onmessage = (e) => {
      console.log('Received: ', e.data);
      try {
        const data = JSON.parse(e.data);
        if (!data || typeof data !== 'object') return;

        const event = data.event || '';

        switch (event) {
          case 'connected':
            set({ 
              isHomed: !!data.homed, 
              robotStatus: data.homed ? 'Ready' : 'Need Homing' 
            });
            if (data.sw_states && Array.isArray(data.sw_states)) {
              const updated = get().devices.map((device) => {
                const match = device.id.match(/^d(\d+)$/);
                if (match) {
                  const devIdx = parseInt(match[1], 10) - 1;
                  if (devIdx >= 0 && devIdx < data.sw_states.length) {
                    return { ...device, status: data.sw_states[devIdx] ? 'on' as const : 'off' as const };
                  }
                }
                return device;
              });
              set({ devices: updated });
            }
            break;

          case 'homing':
            set({ robotStatus: 'Homing...' });
            break;

          case 'homed':
            set({ isHomed: true, robotStatus: 'Homed / Ready' });
            break;

          case 'moving':
            set({ robotStatus: `Moving to Switch ${data.sw}...` });
            break;

          case 'pressing':
            set({ robotStatus: `Pressing Switch ${data.sw}...` });
            break;

          case 'returning':
            set({ robotStatus: 'Returning to Rest...' });
            break;

          case 'done':
            set({ robotStatus: 'Ready' });
            if (data.sw) {
              const devId = `d${data.sw}`;
              get().updateDeviceStatus(devId, data.state ? 'on' : 'off');
            }
            break;

          case 'status':
            set({ isHomed: !!data.homed });
            if (data.sw_states && Array.isArray(data.sw_states)) {
              const updated = get().devices.map((device) => {
                const match = device.id.match(/^d(\d+)$/);
                if (match) {
                  const devIdx = parseInt(match[1], 10) - 1;
                  if (devIdx >= 0 && devIdx < data.sw_states.length) {
                    return { ...device, status: data.sw_states[devIdx] ? 'on' as const : 'off' as const };
                  }
                }
                return device;
              });
              set({ devices: updated });
            }
            break;

          case 'pos':
            set({ robotStatus: `Position: M1=${data.m1}, M2=${data.m2}` });
            break;

          case 'ok':
            set({ robotStatus: data.msg || 'OK' });
            break;

          case 'error':
            set({ robotStatus: `Error: ${data.msg || 'Unknown'}` });
            break;

          default:
            console.log('Unhandled WebSocket event:', event);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message JSON:', err);
      }
    };

    ws.onclose = () => {
      set({ connectionStatus: 'disconnected', wsConnection: null, isHomed: false, robotStatus: 'Disconnected' });
      console.log('Disconnected from ESP32');
    };

    ws.onerror = (e) => {
      console.log('WebSocket Error: ', e);
      set({ connectionStatus: 'disconnected', wsConnection: null, isHomed: false, robotStatus: 'Connection Error' });
    };
  },

  disconnectDevice: () => {
    const { wsConnection, connectionStatus } = get();
    if (wsConnection && connectionStatus === 'connected') {
      wsConnection.close();
    }
  },

  sendDeviceCommand: (command) => {
    const { wsConnection, connectionStatus } = get();
    if (wsConnection && connectionStatus === 'connected') {
      wsConnection.send(JSON.stringify(command));
    }
  }
}));
