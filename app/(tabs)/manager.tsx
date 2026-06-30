import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { HardwareService } from '@/services/HardwareService';

// Mock data for switches
const MOCK_SWITCHES = [
  { id: '1', name: 'Living Room Lights', room: 'Living Room' },
  { id: '2', name: 'Bedroom Fan', room: 'Bedroom' },
  { id: '3', name: 'Kitchen AC', room: 'Kitchen' },
];

// Mock data for paired devices removed - using global connection state

export default function ManagerScreen() {
  const { 
    devices,
    connectionStatus, 
    robotStatus,
    isHomed,
    deviceIp, 
    devicePort, 
    setDeviceIp, 
    setDevicePort, 
    connectToDevice, 
    disconnectDevice 
  } = useAppStore();

  const [tempIp, setTempIp] = useState(deviceIp);
  const [tempPort, setTempPort] = useState(devicePort);
  const [sgThreshold, setSgThreshold] = useState('10');

  React.useEffect(() => {
    setTempIp(deviceIp);
    setTempPort(devicePort);
  }, [deviceIp, devicePort]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Switch Manager Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Switch Manager</Text>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/add-switch')}
          >
            <FontAwesome name="plus-circle" size={20} color="#0A84FF" style={styles.addButtonIcon} />
            <Text style={styles.addButtonText}>Add Switch</Text>
          </TouchableOpacity>

          <View style={styles.listContainer}>
            {devices.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemTitle}>{item.switch_name}</Text>
                  <Text style={styles.listItemSubtitle}>{item.room} - {item.group || 'No Group'}</Text>
                </View>
                <View style={styles.listItemActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <FontAwesome name="edit" size={18} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <FontAwesome name="refresh" size={18} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <FontAwesome name="trash" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {devices.length === 0 && (
              <Text style={styles.emptyText}>No switches added yet.</Text>
            )}
          </View>
        </View>

        {/* Device Manager Section */}
        <View style={styles.section}>
          <View style={styles.deviceHeaderRow}>
            <Text style={styles.sectionHeader}>Robot Arm</Text>
          </View>

          <View style={[
            styles.deviceCard,
            connectionStatus === 'connected' ? styles.deviceCardActive : styles.deviceCardInactive
          ]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceSwitchName}>5-Bar Linkage Arm</Text>
              <Text style={styles.listItemSubtitle}>
                IP: {deviceIp}:{devicePort} {connectionStatus === 'connected' ? `| Status: ${robotStatus}` : ''}
              </Text>
            </View>
            
            <View style={[
              styles.statusBadge, 
              connectionStatus === 'connected' ? styles.statusBadgeActive : styles.statusBadgeInactive
            ]}>
              <Text style={[
                styles.statusBadgeText,
                connectionStatus === 'connected' ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive
              ]}>
                {connectionStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          {connectionStatus !== 'connected' && connectionStatus !== 'connecting' ? (
            <View style={styles.configCard}>
              <Text style={styles.configHeader}>Configuration</Text>
              <View style={styles.inputsRow}>
                <View style={[styles.inputWrapper, { flex: 3 }]}>
                  <Text style={styles.inputLabel}>IP Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempIp}
                    onChangeText={setTempIp}
                    placeholder="e.g. 10.112.201.230"
                    placeholderTextColor="#A3B1C6"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputWrapper, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Port</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempPort}
                    onChangeText={setTempPort}
                    placeholder="80"
                    placeholderTextColor="#A3B1C6"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.activeConnectionInfo}>
              <FontAwesome name="check-circle" size={16} color="#34C759" style={{ marginRight: 6 }} />
              <Text style={styles.activeConnectionText}>
                Active session at {deviceIp}:{devicePort}
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.addButton, 
              { marginTop: 10, backgroundColor: connectionStatus === 'connected' ? '#ff3b30' : '#34C759', borderColor: 'transparent' }
            ]}
            onPress={() => {
              if (connectionStatus === 'connected') {
                disconnectDevice();
              } else {
                if (!tempIp.trim()) {
                  Alert.alert('Invalid IP', 'Please enter a valid IP address.');
                  return;
                }
                if (!tempPort.trim()) {
                  Alert.alert('Invalid Port', 'Please enter a valid Port number.');
                  return;
                }
                setDeviceIp(tempIp.trim());
                setDevicePort(tempPort.trim());
                connectToDevice(tempIp.trim(), tempPort.trim());
              }
            }}
          >
            <FontAwesome 
              name={connectionStatus === 'connected' ? 'power-off' : 'link'} 
              size={20} 
              color="#FFF" 
              style={styles.addButtonIcon} 
            />
            <Text style={[styles.addButtonText, { color: '#FFF' }]}>
              {connectionStatus === 'connected' ? 'Disconnect' : connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
            </Text>
          </TouchableOpacity>

          {/* Homing & Calibration controls visible only when connected */}
          {connectionStatus === 'connected' && (
            <View style={styles.calibrationCard}>
              <Text style={styles.configHeader}>Arm Control & Calibration</Text>
              
              <View style={styles.controlButtonsRow}>
                <TouchableOpacity 
                  style={[styles.controlBtn, isHomed ? styles.controlBtnSuccess : styles.controlBtnAlert]} 
                  onPress={() => HardwareService.homeArm()}
                >
                  <FontAwesome name="home" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.controlBtnText}>
                    {isHomed ? 'Re-Home Arm' : 'Home Arm'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.controlBtn} 
                  onPress={() => HardwareService.restArm()}
                >
                  <FontAwesome name="undo" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.controlBtnText}>Go to Rest</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stallGuardSection}>
                <Text style={styles.inputLabel}>StallGuard Sensitivity (0-255)</Text>
                <View style={styles.stallGuardRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, marginRight: 10 }]}
                    value={sgThreshold}
                    onChangeText={setSgThreshold}
                    placeholder="10"
                    placeholderTextColor="#A3B1C6"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.applyBtn}
                    onPress={() => {
                      const val = parseInt(sgThreshold, 10);
                      if (isNaN(val) || val < 0 || val > 255) {
                        Alert.alert('Invalid Value', 'Threshold must be between 0 and 255.');
                        return;
                      }
                      HardwareService.setStallGuardThreshold(val);
                      Alert.alert('Success', `StallGuard sensitivity set to ${val}`);
                    }}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  Note: Lower values make StallGuard less sensitive (requires more force to stall). Default is 10.
                </Text>
              </View>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0E5EC', // Neumorphic background
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  smallAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1d9e6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  smallAddButtonText: {
    color: '#0A84FF',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d9e6',
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: 20,
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A84FF',
  },
  toggleContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  toggleTrack: {
    width: 200,
    height: 44,
    backgroundColor: '#d1d9e6',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  toggleThumb: {
    width: 100,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleThumbLeft: {
    left: 4,
  },
  toggleThumbRight: {
    right: 4,
  },
  toggleThumbText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  listContainer: {
    backgroundColor: '#d1d9e6',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#c0c8d6',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  listItemSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
    backgroundColor: '#E0E5EC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    padding: 20,
  },
  roomGroup: {
    marginBottom: 20,
  },
  roomGroupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
    marginLeft: 5,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  deviceCardActive: {
    borderColor: '#34C759', // Green border for active
  },
  deviceCardInactive: {
    borderColor: '#0A84FF', // Blue/grey border for disconnected
  },
  deviceSwitchName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeActive: {
    borderColor: '#34C759',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  statusBadgeInactive: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#34C759',
  },
  statusBadgeTextInactive: {
    color: '#8E8E93',
  },
  configCard: {
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  configHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputsRow: {
    flexDirection: 'row',
  },
  inputWrapper: {
    flexDirection: 'column',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#E0E5EC',
    color: '#555',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#c0c8d6',
  },
  activeConnectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  activeConnectionText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '600',
  },
  calibrationCard: {
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  controlButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    paddingVertical: 12,
    borderRadius: 12,
  },
  controlBtnSuccess: {
    backgroundColor: '#34C759',
  },
  controlBtnAlert: {
    backgroundColor: '#FF9F0A',
  },
  controlBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stallGuardSection: {
    borderTopWidth: 1,
    borderTopColor: '#c0c8d6',
    paddingTop: 15,
  },
  stallGuardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applyBtn: {
    backgroundColor: '#d1d9e6',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#0A84FF',
    fontWeight: '600',
    fontSize: 14,
  },
  helperText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 8,
    lineHeight: 14,
  },
});
