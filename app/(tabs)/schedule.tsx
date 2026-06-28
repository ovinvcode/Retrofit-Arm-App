import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, SafeAreaView } from 'react-native';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HardwareService } from '@/services/HardwareService';
import { FontAwesome } from '@expo/vector-icons';
import { WheelPicker } from '../../components/WheelPicker';

// --- Neumorphic Building Blocks ---
const NeoView = ({ children, style, radius = 16, padding = 20 }: any) => (
  <View style={[styles.neoOuter, { borderRadius: radius }, style]}>
    <View style={[styles.neoInner, { borderRadius: radius, padding }]}>
      {children}
    </View>
  </View>
);

const NeoButton = ({ onPress, disabled, children, active = false, style, innerStyle }: any) => (
  <TouchableOpacity 
    activeOpacity={0.7} 
    onPress={onPress} 
    disabled={disabled}
    style={[
      styles.neoOuter, 
      active ? styles.neoOuterActive : null, 
      style
    ]}
  >
    <View style={[
      styles.neoInner, 
      styles.neoButtonInner, 
      active ? styles.neoInnerActive : null,
      innerStyle
    ]}>
      {children}
    </View>
  </TouchableOpacity>
);

const NeoToggle = ({ value, onValueChange, labelLeft = 'ON', labelRight = 'OFF' }: any) => (
  <View style={styles.neoToggleContainer}>
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => onValueChange(value === 'on' ? 'off' : 'on')}
      style={styles.neoToggleTrack}
    >
      <View style={[styles.neoToggleThumb, value === 'on' ? styles.neoToggleThumbOn : styles.neoToggleThumbOff]} />
      <View style={styles.neoToggleLabels}>
        <Text style={[styles.neoToggleLabelText, value === 'on' ? styles.neoToggleLabelActive : null]}>{labelLeft}</Text>
        <Text style={[styles.neoToggleLabelText, value === 'off' ? styles.neoToggleLabelActive : null]}>{labelRight}</Text>
      </View>
    </TouchableOpacity>
  </View>
);

// New Type Toggle for Timer vs Schedule
const NeoSegmentedControl = ({ value, onValueChange, labelLeft, labelRight }: any) => (
  <View style={styles.segmentedContainer}>
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={() => onValueChange(labelLeft)}
      style={[styles.segmentedButton, value === labelLeft ? styles.segmentedActive : null]}
    >
      <Text style={[styles.segmentedText, value === labelLeft ? styles.segmentedTextActive : null]}>{labelLeft}</Text>
    </TouchableOpacity>
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={() => onValueChange(labelRight)}
      style={[styles.segmentedButton, value === labelRight ? styles.segmentedActive : null]}
    >
      <Text style={[styles.segmentedText, value === labelRight ? styles.segmentedTextActive : null]}>{labelRight}</Text>
    </TouchableOpacity>
  </View>
);

export default function SchedulesScreen() {
  const devices = useAppStore((state) => state.devices);
  const schedules = useAppStore((state) => state.schedules);
  const addSchedule = useAppStore((state) => state.addSchedule);
  const deleteSchedule = useAppStore((state) => state.deleteSchedule);

  const [modalVisible, setModalVisible] = useState(false);
  const [scheduleType, setScheduleType] = useState('Timer'); // Timer | Schedule

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [action, setAction] = useState<'on' | 'off'>('on');
  
  // Picker values
  const [hoursIndex, setHoursIndex] = useState(0);
  const [minutesIndex, setMinutesIndex] = useState(0);
  const [secondsIndex, setSecondsIndex] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [repeatDropdownOpen, setRepeatDropdownOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState('Don\'t repeat');

  const hoursOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')), []);
  const minutesOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
  const secondsOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
  
  const repeatOptions = ['Don\'t repeat', 'Every day', 'Every week', 'Every month'];

  const resetForm = () => {
    setSelectedDevice(null);
    setHoursIndex(0);
    setMinutesIndex(0);
    setSecondsIndex(0);
    setAction('on');
    setScheduleType('Timer');
    setRepeatMode('Don\'t repeat');
  };

  const handleAddSchedule = async () => {
    if (!selectedDevice) return;
    setLoading(true);
    
    const h = hoursOptions[hoursIndex];
    const m = minutesOptions[minutesIndex];
    const s = secondsOptions[secondsIndex];
    
    const newSchedule = {
      id: Math.random().toString(36).substring(2, 9),
      device_id: selectedDevice,
      action,
      time: `${h}:${m}:${s}`,
      days: repeatMode === 'Don\'t repeat' ? [] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      type: scheduleType.toLowerCase(),
    };
    
    try {
      // @ts-ignore
      await HardwareService.syncSchedule(newSchedule.id);
      addSchedule(newSchedule);
      setModalVisible(false);
      resetForm();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedDeviceName = devices.find(d => d.id === selectedDevice)?.switch_name || 'Select Switch';

  const renderSchedule = ({ item }: { item: typeof schedules[0] }) => {
    const device = devices.find(d => d.id === item.device_id);
    return (
      <NeoView radius={20} padding={20} style={{ marginBottom: 20, marginHorizontal: 20 }}>
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleDetailsTop}>
            <Text style={styles.scheduleDevice}>{device ? device.switch_name : item.device_id}</Text>
          </View>
          <TouchableOpacity onPress={() => deleteSchedule(item.id)} style={styles.iconBtn}>
            <NeoView radius={12} padding={10} style={styles.iconBtnNeo}>
              <FontAwesome name="times" size={16} color="#8E8E93" />
            </NeoView>
          </TouchableOpacity>
        </View>
        <View style={styles.scheduleDetails}>
          <Text style={styles.scheduleTime}>{item.time}</Text>
          <View style={styles.actionBadgeWrapper}>
            <View style={[styles.statusIndicator, item.action === 'on' ? styles.statusOn : styles.statusOff]} />
            <Text style={styles.scheduleActionText}>{item.action.toUpperCase()}</Text>
          </View>
        </View>
      </NeoView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedules</Text>
      </View>

      <FlatList
        data={schedules}
        keyExtractor={item => item.id}
        renderItem={renderSchedule}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No active schedules.</Text>
          </View>
        }
      />
      
      <View style={styles.addButtonWrapper}>
        <NeoButton 
          style={{ borderRadius: 30, marginHorizontal: 40 }} 
          innerStyle={{ padding: 18, alignItems: 'center' }}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addBtnTextActive}>Add Schedule</Text>
        </NeoButton>
      </View>

      {/* Add Schedule Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView style={styles.modalContent} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New</Text>
              <View style={{ width: 50 }} />
            </View>

            <NeoSegmentedControl 
              value={scheduleType} 
              onValueChange={setScheduleType} 
              labelLeft="Timer" 
              labelRight="Schedule" 
            />

            <View style={{ zIndex: 10, marginTop: 30 }}>
              <NeoButton 
                style={{ borderRadius: 16 }} 
                innerStyle={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => setDropdownOpen(!dropdownOpen)}
              >
                <Text style={styles.dropdownText}>{selectedDeviceName}</Text>
                <FontAwesome name={dropdownOpen ? "angle-up" : "angle-down"} size={20} color="#8E8E93" />
              </NeoButton>
              
              {dropdownOpen && (
                <NeoView style={{ marginTop: 10, borderRadius: 16 }} padding={10}>
                  {devices.map(device => (
                    <TouchableOpacity 
                      key={device.id} 
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedDevice(device.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText, 
                        selectedDevice === device.id && styles.dropdownItemTextActive
                      ]}>
                        {device.switch_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {devices.length === 0 && (
                    <Text style={styles.dropdownItemText}>No devices found.</Text>
                  )}
                </NeoView>
              )}
            </View>

            <View style={{ marginTop: 30, alignItems: 'center' }}>
              <View style={{ width: '80%' }}>
                <NeoToggle value={action} onValueChange={setAction} />
              </View>
            </View>

            <View style={styles.pickerWrapper}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hours</Text>
                <WheelPicker items={hoursOptions} selectedIndex={hoursIndex} onChange={setHoursIndex} width={70} />
              </View>
              <Text style={styles.pickerColon}>:</Text>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Min</Text>
                <WheelPicker items={minutesOptions} selectedIndex={minutesIndex} onChange={setMinutesIndex} width={70} />
              </View>
              {scheduleType === 'Timer' && (
                <>
                  <Text style={styles.pickerColon}>:</Text>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Sec</Text>
                    <WheelPicker items={secondsOptions} selectedIndex={secondsIndex} onChange={setSecondsIndex} width={70} />
                  </View>
                </>
              )}
            </View>

            {scheduleType === 'Schedule' && (
              <View style={{ zIndex: 9, marginTop: 20 }}>
                <NeoButton 
                  style={{ borderRadius: 16 }} 
                  innerStyle={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => setRepeatDropdownOpen(!repeatDropdownOpen)}
                >
                  <Text style={styles.dropdownText}>{repeatMode}</Text>
                  <FontAwesome name={repeatDropdownOpen ? "angle-up" : "angle-down"} size={20} color="#8E8E93" />
                </NeoButton>
                
                {repeatDropdownOpen && (
                  <NeoView style={{ marginTop: 10, borderRadius: 16, position: 'absolute', top: 60, left: 0, right: 0 }} padding={10}>
                    {repeatOptions.map(opt => (
                      <TouchableOpacity 
                        key={opt} 
                        style={styles.dropdownItem}
                        onPress={() => {
                          setRepeatMode(opt);
                          setRepeatDropdownOpen(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownItemText, 
                          repeatMode === opt && styles.dropdownItemTextActive
                        ]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </NeoView>
                )}
              </View>
            )}

            <View style={{ marginTop: 'auto', marginBottom: 30 }}>
              <NeoButton 
                style={{ borderRadius: 30 }} 
                innerStyle={{ padding: 18, alignItems: 'center', backgroundColor: !selectedDevice ? 'transparent' : '#0A84FF' }}
                onPress={handleAddSchedule}
                disabled={!selectedDevice || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.addBtnText, !selectedDevice ? styles.addBtnTextDisabled : null]}>
                    SET
                  </Text>
                )}
              </NeoButton>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  addButtonWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  addBtnTextActive: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  
  // --- Neumorphism Styles ---
  neoOuter: {
    backgroundColor: '#E0E5EC',
    shadowColor: '#ffffff',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  neoInner: {
    backgroundColor: '#E0E5EC',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  neoButtonInner: {
    padding: 16,
  },
  neoOuterActive: {
    shadowOffset: { width: -2, height: -2 },
    shadowRadius: 4,
  },
  neoInnerActive: {
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 4,
    backgroundColor: '#d1d9e6',
  },
  
  // Custom Controls
  dropdownText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d9e6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  dropdownItemTextActive: {
    color: '#0A84FF',
    fontWeight: 'bold',
  },
  
  neoToggleContainer: {
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E5EC',
    shadowColor: '#ffffff',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  neoToggleTrack: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#E0E5EC',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  neoToggleThumb: {
    position: 'absolute',
    width: '50%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0E5EC',
    shadowColor: '#ffffff',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    top: 4,
  },
  neoToggleThumbOn: {
    left: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderBottomColor: '#c0c8d6',
    borderRightColor: '#c0c8d6',
  },
  neoToggleThumbOff: {
    right: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderBottomColor: '#c0c8d6',
    borderRightColor: '#c0c8d6',
  },
  neoToggleLabels: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    zIndex: 2,
  },
  neoToggleLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#A3B1C6',
    width: '50%',
    textAlign: 'center',
  },
  neoToggleLabelActive: {
    color: '#0A84FF',
  },

  // Segmented Control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E5EC',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#a3b1c6',
    shadowOffset: { width: insetShadow(true), height: insetShadow(true) }, // simulated inset
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 2,
    marginTop: 20,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  segmentedActive: {
    backgroundColor: '#E0E5EC',
    shadowColor: '#ffffff',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#A3B1C6',
  },
  segmentedTextActive: {
    color: '#0A84FF',
  },

  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  addBtnTextDisabled: {
    color: '#A3B1C6',
  },
  
  // Card
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  scheduleDetailsTop: {
    flex: 1,
  },
  scheduleDevice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5B697A',
  },
  scheduleTime: {
    fontSize: 28,
    fontWeight: '300',
    color: '#8E8E93',
  },
  iconBtn: {
    padding: 0,
    marginLeft: 10,
  },
  iconBtnNeo: {
    backgroundColor: '#E0E5EC',
  },
  scheduleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  actionBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E5EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#ffffff',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOn: {
    backgroundColor: '#34C759',
  },
  statusOff: {
    backgroundColor: '#FF3B30',
  },
  scheduleActionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#A3B1C6',
    fontSize: 16,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#E0E5EC',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5B697A',
  },
  
  // Picker Styles
  pickerWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    height: 150,
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#A3B1C6',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  pickerColon: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#A3B1C6',
    marginHorizontal: 15,
    marginTop: 20,
  }
});

// Helper for faux inset shadow
function insetShadow(isInset: boolean) {
  return isInset ? 2 : -2;
}
