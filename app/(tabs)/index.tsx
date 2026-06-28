import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { HardwareService } from '@/services/HardwareService';
import { FontAwesome } from '@expo/vector-icons';
import { NeumorphicButton } from '@/components/NeumorphicButton';

export default function HomeScreen() {
  const { devices, updateDeviceStatus, rooms, currentRoom, setCurrentRoom } = useAppStore();

  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [loadingDevices, setLoadingDevices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    HardwareService.connect().then(() => {
      if (mounted) setConnectionStatus('Ready');
    });
    return () => { mounted = false; };
  }, []);

  const toggleDevice = async (id: string, currentStatus: 'on' | 'off') => {
    const newStatus = currentStatus === 'on' ? 'off' : 'on';
    setLoadingDevices((prev) => ({ ...prev, [id]: true }));
    setConnectionStatus('Moving');
    
    try {
      await HardwareService.triggerSwitch(id, newStatus);
      updateDeviceStatus(id, newStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDevices((prev) => ({ ...prev, [id]: false }));
      setConnectionStatus('Ready');
    }
  };



  const currentDevices = devices.filter(d => d.room === currentRoom);

  // Group devices by their `group` property
  const groupedDevices = currentDevices.reduce((acc, device) => {
    const groupName = device.group || 'Other';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(device);
    return acc;
  }, {} as Record<string, typeof devices>);

  // Determine an icon based on device name
  const getIconName = (name: string): React.ComponentProps<typeof FontAwesome>['name'] => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('light') || lowerName.includes('lamp')) return 'lightbulb-o';
    if (lowerName.includes('fan')) return 'superpowers'; // closest to fan
    if (lowerName.includes('ac')) return 'snowflake-o';
    return 'power-off';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusBadge}>
          <FontAwesome 
            name="circle" 
            size={12} 
            color={connectionStatus === 'Ready' ? '#34C759' : '#FF9F0A'} 
            style={styles.statusIcon} 
          />
          <Text style={styles.statusText}>Status: {connectionStatus}</Text>
        </View>
      </View>

      {/* Room Selector */}
      <View style={styles.roomSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomScrollContent}>
          {rooms.map((room) => (
            <TouchableOpacity 
              key={room} 
              onPress={() => setCurrentRoom(room)}
              style={[styles.roomTab, currentRoom === room && styles.roomTabActive]}
            >
              <Text style={[styles.roomTabText, currentRoom === room && styles.roomTabTextActive]}>{room}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {Object.keys(groupedDevices).length === 0 ? (
          <Text style={styles.noDevicesText}>No devices in this room.</Text>
        ) : (
          Object.entries(groupedDevices).map(([groupName, groupDevices]) => (
            <View key={groupName} style={styles.groupContainer}>
              <Text style={styles.groupHeader}>{groupName}</Text>
              
              <View style={styles.gridContainer}>
                {groupDevices.map(device => (
                  <NeumorphicButton
                    key={device.id}
                    label={device.switch_name}
                    isOn={device.status === 'on'}
                    isLoading={!!loadingDevices[device.id]}
                    onPress={() => toggleDevice(device.id, device.status)}
                    iconName={getIconName(device.switch_name)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0E5EC', // Neumorphic background
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1d9e6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  statusIcon: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  roomSelector: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  roomScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  roomTab: {
    paddingVertical: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  roomTabTextActive: {
    color: '#0A84FF',
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  noDevicesText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 40,
    fontSize: 16,
  },
  groupContainer: {
    marginBottom: 30,
  },
  groupHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 15,
    marginLeft: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
});
