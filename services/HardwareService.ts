export const HardwareService = {
  connect: async (): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: 'Connected to Hardware Service' });
      }, 2000);
    });
  },

  homeArm: async (): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: 'Arm homed successfully' });
      }, 2000);
    });
  },

  triggerSwitch: async (
    device_id: string,
    action: 'on' | 'off'
  ): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `Switch ${device_id} turned ${action}`,
        });
      }, 2000);
    });
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
      }, 2000);
    });
  },
};
