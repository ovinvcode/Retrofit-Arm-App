import { useAppStore } from '@/store/useAppStore';

export const HardwareService = {
  connect: async (): Promise<{ success: boolean; message: string }> => {
    const store = useAppStore.getState();
    store.connectToDevice(store.deviceIp, store.devicePort);
    return { success: true, message: 'Initiating WebSocket connection' };
  },

  homeArm: async (): Promise<{ success: boolean; message: string }> => {
    const store = useAppStore.getState();
    if (store.connectionStatus === 'connected') {
      store.sendDeviceCommand({ cmd: 'home' });
      return { success: true, message: 'Homing command sent' };
    }
    return { success: false, message: 'Not connected to robot arm' };
  },

  restArm: async (): Promise<{ success: boolean; message: string }> => {
    const store = useAppStore.getState();
    if (store.connectionStatus === 'connected') {
      store.sendDeviceCommand({ cmd: 'rest' });
      return { success: true, message: 'Rest command sent' };
    }
    return { success: false, message: 'Not connected to robot arm' };
  },

  triggerSwitch: async (
    device_id: string,
    action: 'on' | 'off'
  ): Promise<{ success: boolean; message: string }> => {
    const store = useAppStore.getState();
    const device = store.devices.find((d) => d.id === device_id);

    if (store.connectionStatus === 'connected' && device) {
      // Extract numeric index from device_id, e.g. "d1" -> 1
      const match = device_id.match(/^d(\d+)$/);
      const swNumber = match ? parseInt(match[1], 10) : 1;

      store.sendDeviceCommand({
        cmd: 'toggle',
        sw: swNumber,
        state: action === 'on',
      });
      return { success: true, message: `Command sent to toggle switch ${swNumber}` };
    }
    return { success: false, message: 'Not connected or invalid device' };
  },

  setStallGuardThreshold: async (
    val: number
  ): Promise<{ success: boolean; message: string }> => {
    const store = useAppStore.getState();
    if (store.connectionStatus === 'connected') {
      store.sendDeviceCommand({
        cmd: 'set_sgthrs',
        val: val,
      });
      return { success: true, message: 'StallGuard threshold updated' };
    }
    return { success: false, message: 'Not connected' };
  },

  syncSchedule: async (
    schedule_id: string
  ): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `Schedule ${schedule_id} synced successfully`,
        });
      }, 500);
    });
  },
};
