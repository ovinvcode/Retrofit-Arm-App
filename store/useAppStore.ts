import { create } from 'zustand';

export type Device = {
  id: string;
  room: string;
  group?: string;
  switch_name: string;
  status: 'on' | 'off';
  x_coord: number;
  y_coord: number;
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
}

export const useAppStore = create<AppState>((set) => ({
  rooms: ['Bedroom', 'Living Room', 'Kitchen'],
  currentRoom: 'Bedroom',
  devices: [
    {
      id: 'd1',
      room: 'Bedroom',
      group: 'Bedside switch',
      switch_name: 'Fan',
      status: 'off',
      x_coord: 10,
      y_coord: 20,
      z_coord: 5,
    },
    {
      id: 'd2',
      room: 'Bedroom',
      group: 'Bedside switch',
      switch_name: 'Main light',
      status: 'off',
      x_coord: 30,
      y_coord: 40,
      z_coord: 5,
    },
    {
      id: 'd3',
      room: 'Bedroom',
      group: 'Bedside switch',
      switch_name: 'Bed side lamp',
      status: 'off',
      x_coord: 50,
      y_coord: 60,
      z_coord: 5,
    },
    {
      id: 'd4',
      room: 'Bedroom',
      group: 'Bedside switch',
      switch_name: 'AC',
      status: 'off',
      x_coord: 70,
      y_coord: 80,
      z_coord: 5,
    },
    {
      id: 'd5',
      room: 'Living Room',
      group: 'Main Panel',
      switch_name: 'Overhead Light',
      status: 'off',
      x_coord: 10,
      y_coord: 20,
      z_coord: 5,
    },
    {
      id: 'd6',
      room: 'Kitchen',
      group: 'Main Panel',
      switch_name: 'Sink Light',
      status: 'off',
      x_coord: 10,
      y_coord: 20,
      z_coord: 5,
    },
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
}));
