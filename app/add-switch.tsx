import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HardwareService } from '@/services/HardwareService';
import { FontAwesome } from '@expo/vector-icons';

type WizardStep = 'SETUP' | 'MAPPING' | 'REVIEW';

type DraftSwitch = {
  name: string;
  placeholder?: string;
  on_x: number;
  on_y: number;
  off_x: number;
  off_y: number;
  skipped: boolean;
};

export default function MapScreen() {
  const { rooms, addDevice, connectionStatus, sendDeviceCommand } = useAppStore();

  // Navigation State
  const [step, setStep] = useState<WizardStep>('SETUP');
  const [isCatalogFlow, setIsCatalogFlow] = useState(false);

  // Phase 1: Setup State
  const [panelName, setPanelName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(rooms[0] || '');
  const [switchCount, setSwitchCount] = useState(1);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);

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
    let nextX = x;
    let nextY = y;
    if (axis === 'x') {
      nextX = x + amount;
      setX(nextX);
    }
    if (axis === 'y') {
      nextY = y + amount;
      setY(nextY);
    }

    if (connectionStatus === 'connected') {
      sendDeviceCommand({
        cmd: 'goto',
        x: nextX,
        y: nextY
      });
    }
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
    setX(truncatedDrafts[0]?.on_x || 0);
    setY(truncatedDrafts[0]?.on_y || 0);
    setTestComplete(false);
    setIsCatalogFlow(false);
    setStep('MAPPING');
  };

  const testPress = async () => {
    setTesting(true);
    try {
      if (connectionStatus === 'connected') {
        // First move the arm to the target coordinates
        sendDeviceCommand({
          cmd: 'goto',
          x,
          y
        });
        // Wait 1.5 seconds for mechanical arm movement before firing the actuator
        await new Promise(resolve => setTimeout(resolve, 1500));
        sendDeviceCommand({
          cmd: 'fire'
        });
      } else {
        // Simulate local offline delay
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
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
      on_x: x, 
      on_y: y + 5, // Simple offset for custom map
      off_x: x,
      off_y: y - 5,
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
      on_x: 0, 
      on_y: 0, 
      off_x: 0, 
      off_y: 0, 
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
      setX(draftSwitches[nextIndex]?.on_x || 0);
      setY(draftSwitches[nextIndex]?.on_y || 0);
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
      if (isCatalogFlow) {
        setStep('SETUP');
      } else {
        setStep('MAPPING');
        const prevIndex = switchCount - 1;
        setCurrentIndex(prevIndex);
        setCurrentSwitchName(draftSwitches[prevIndex]?.name || `Switch ${prevIndex + 1}`);
        setX(draftSwitches[prevIndex]?.on_x || 0);
        setY(draftSwitches[prevIndex]?.on_y || 0);
        setTestComplete(false);
      }
    } else if (step === 'MAPPING') {
      if (currentIndex === 0) {
        setStep('SETUP');
      } else {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        setCurrentSwitchName(draftSwitches[prevIndex]?.name || `Switch ${prevIndex + 1}`);
        setX(draftSwitches[prevIndex]?.on_x || 0);
        setY(draftSwitches[prevIndex]?.on_y || 0);
        setTestComplete(false);
      }
    }
  };

  const saveAll = () => {
    const unassigned = draftSwitches.find(d => !d.skipped && d.name.trim() === '');
    if (unassigned) {
      Alert.alert('Missing Info', 'Please assign a name to all buttons or disable them.');
      return;
    }

    let savedCount = 0;
    draftSwitches.forEach((draft) => {
      if (!draft.skipped) {
        addDevice({
          id: Math.random().toString(36).substring(2, 9),
          room: selectedRoom,
          group: panelName.trim(),
          switch_name: draft.name,
          status: 'off',
          on_x: draft.on_x,
          on_y: draft.on_y,
          off_x: draft.off_x,
          off_y: draft.off_y,
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

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <TouchableOpacity style={styles.primaryBtnFlex} onPress={startMapping}>
          <Text style={styles.primaryBtnText}>Start Mapping ({switchCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
          if (!panelName.trim()) {
            Alert.alert('Missing Info', 'Please enter a Panel Name before opening catalog.');
            return;
          }
          setCatalogModalVisible(true);
        }}>
          <Text style={styles.secondaryBtnText}>Catalog</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={catalogModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCatalogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Standard Layouts</Text>
            <Text style={styles.modalSubtitle}>Choose a predefined layout for {switchCount} buttons</Text>

            <ScrollView style={{ width: '100%', marginBottom: 20 }}>
              {switchCount === 5 && (
                <>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('5_quincunx')}>
                    <View style={styles.miniPreview}>
                      <View style={[styles.miniBtn, { top: 4, left: 4 }]} />
                      <View style={[styles.miniBtn, { top: 4, right: 4 }]} />
                      <View style={[styles.miniBtn, { top: 16, left: 16 }]} />
                      <View style={[styles.miniBtn, { bottom: 4, left: 4 }]} />
                      <View style={[styles.miniBtn, { bottom: 4, right: 4 }]} />
                    </View>
                    <Text style={styles.catalogItemTitle}>Quincunx (Dice)</Text>
                    <Text style={styles.catalogItemDesc}>5 buttons in dice pattern</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('5_horizontal')}>
                    <View style={[styles.miniPreview, { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3,4,5].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Horizontal</Text>
                    <Text style={styles.catalogItemDesc}>5 buttons side-by-side</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('5_vertical')}>
                    <View style={[styles.miniPreview, { flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3,4,5].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Vertical</Text>
                    <Text style={styles.catalogItemDesc}>5 buttons stacked</Text>
                  </TouchableOpacity>
                </>
              )}
              {switchCount === 4 && (
                <>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('4_square')}>
                    <View style={styles.miniPreview}>
                      <View style={[styles.miniBtn, { top: 6, left: 6 }]} />
                      <View style={[styles.miniBtn, { top: 6, right: 6 }]} />
                      <View style={[styles.miniBtn, { bottom: 6, left: 6 }]} />
                      <View style={[styles.miniBtn, { bottom: 6, right: 6 }]} />
                    </View>
                    <Text style={styles.catalogItemTitle}>Square 2x2</Text>
                    <Text style={styles.catalogItemDesc}>4 buttons in a square</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('4_horizontal')}>
                    <View style={[styles.miniPreview, { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3,4].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Horizontal</Text>
                    <Text style={styles.catalogItemDesc}>4 buttons side-by-side</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('4_vertical')}>
                    <View style={[styles.miniPreview, { flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3,4].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Vertical</Text>
                    <Text style={styles.catalogItemDesc}>4 buttons stacked</Text>
                  </TouchableOpacity>
                </>
              )}
              {switchCount === 3 && (
                <>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('3_triangle')}>
                    <View style={styles.miniPreview}>
                      <View style={[styles.miniBtn, { top: 6, left: 16 }]} />
                      <View style={[styles.miniBtn, { bottom: 6, left: 6 }]} />
                      <View style={[styles.miniBtn, { bottom: 6, right: 6 }]} />
                    </View>
                    <Text style={styles.catalogItemTitle}>Triangle</Text>
                    <Text style={styles.catalogItemDesc}>1 top, 2 bottom</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('3_inverse_triangle')}>
                    <View style={styles.miniPreview}>
                      <View style={[styles.miniBtn, { top: 6, left: 6 }]} />
                      <View style={[styles.miniBtn, { top: 6, right: 6 }]} />
                      <View style={[styles.miniBtn, { bottom: 6, left: 16 }]} />
                    </View>
                    <Text style={styles.catalogItemTitle}>Inverse Triangle</Text>
                    <Text style={styles.catalogItemDesc}>2 top, 1 bottom</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('3_horizontal')}>
                    <View style={[styles.miniPreview, { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Horizontal</Text>
                    <Text style={styles.catalogItemDesc}>3 buttons side-by-side</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('3_vertical')}>
                    <View style={[styles.miniPreview, { flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2,3].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Linear Vertical</Text>
                    <Text style={styles.catalogItemDesc}>3 buttons stacked</Text>
                  </TouchableOpacity>
                </>
              )}
              {switchCount === 2 && (
                <>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('2_horizontal')}>
                    <View style={[styles.miniPreview, { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Horizontal Compact</Text>
                    <Text style={styles.catalogItemDesc}>2 buttons side-by-side</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('2_vertical')}>
                    <View style={[styles.miniPreview, { flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }]}>
                      {[1,2].map(i => <View key={i} style={styles.miniBtnInline} />)}
                    </View>
                    <Text style={styles.catalogItemTitle}>Vertical Compact</Text>
                    <Text style={styles.catalogItemDesc}>2 buttons stacked</Text>
                  </TouchableOpacity>
                </>
              )}
              {switchCount === 1 && (
                  <TouchableOpacity style={styles.catalogItem} onPress={() => applyStandardLayout('1_single')}>
                    <View style={[styles.miniPreview, { justifyContent: 'center', alignItems: 'center' }]}>
                      <View style={styles.miniBtnInline} />
                    </View>
                    <Text style={styles.catalogItemTitle}>Single Standard</Text>
                    <Text style={styles.catalogItemDesc}>1 center button</Text>
                  </TouchableOpacity>
              )}
              {switchCount > 5 && (
                <Text style={{ textAlign: 'center', color: '#A3B1C6' }}>No standard layouts for {switchCount} buttons</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCatalogModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  const applyStandardLayout = (type: string) => {
    let newDrafts: DraftSwitch[] = [];
    
    switch (type) {
      case '5_quincunx':
        newDrafts = [
          { name: '1 (Top Left)', on_x: -22, on_y: 27, off_x: -22, off_y: 17, skipped: false },
          { name: '2 (Top Right)', on_x: 22, on_y: 27, off_x: 22, off_y: 17, skipped: false },
          { name: '3 (Center)', on_x: 0, on_y: 5, off_x: 0, off_y: -5, skipped: false },
          { name: '4 (Bottom Left)', on_x: -22, on_y: -17, off_x: -22, off_y: -27, skipped: false },
          { name: '5 (Bottom Right)', on_x: 22, on_y: -17, off_x: 22, off_y: -27, skipped: false }
        ];
        break;
      case '5_horizontal':
        newDrafts = [
          { name: '1 (Far Left)', on_x: -92, on_y: 8, off_x: -92, off_y: -8, skipped: false },
          { name: '2 (Mid Left)', on_x: -46, on_y: 8, off_x: -46, off_y: -8, skipped: false },
          { name: '3 (Center)', on_x: 0, on_y: 8, off_x: 0, off_y: -8, skipped: false },
          { name: '4 (Mid Right)', on_x: 46, on_y: 8, off_x: 46, off_y: -8, skipped: false },
          { name: '5 (Far Right)', on_x: 92, on_y: 8, off_x: 92, off_y: -8, skipped: false }
        ];
        break;
      case '5_vertical':
        newDrafts = [
          { name: '1 (Top)', on_x: 0, on_y: 100, off_x: 0, off_y: 84, skipped: false },
          { name: '2 (Upper Mid)', on_x: 0, on_y: 54, off_x: 0, off_y: 38, skipped: false },
          { name: '3 (Center)', on_x: 0, on_y: 8, off_x: 0, off_y: -8, skipped: false },
          { name: '4 (Lower Mid)', on_x: 0, on_y: -38, off_x: 0, off_y: -54, skipped: false },
          { name: '5 (Bottom)', on_x: 0, on_y: -84, off_x: 0, off_y: -100, skipped: false }
        ];
        break;
      case '4_square':
        newDrafts = [
          { name: '1 (Top Left)', on_x: -22, on_y: 27, off_x: -22, off_y: 17, skipped: false },
          { name: '2 (Top Right)', on_x: 22, on_y: 27, off_x: 22, off_y: 17, skipped: false },
          { name: '3 (Bottom Left)', on_x: -22, on_y: -17, off_x: -22, off_y: -27, skipped: false },
          { name: '4 (Bottom Right)', on_x: 22, on_y: -17, off_x: 22, off_y: -27, skipped: false }
        ];
        break;
      case '4_horizontal':
        newDrafts = [
          { name: '1 (Far Left)', on_x: -69, on_y: 8, off_x: -69, off_y: -8, skipped: false },
          { name: '2 (Mid Left)', on_x: -23, on_y: 8, off_x: -23, off_y: -8, skipped: false },
          { name: '3 (Mid Right)', on_x: 23, on_y: 8, off_x: 23, off_y: -8, skipped: false },
          { name: '4 (Far Right)', on_x: 69, on_y: 8, off_x: 69, off_y: -8, skipped: false }
        ];
        break;
      case '4_vertical':
        newDrafts = [
          { name: '1 (Top)', on_x: 0, on_y: 77, off_x: 0, off_y: 61, skipped: false },
          { name: '2 (Upper Mid)', on_x: 0, on_y: 31, off_x: 0, off_y: 15, skipped: false },
          { name: '3 (Lower Mid)', on_x: 0, on_y: -15, off_x: 0, off_y: -31, skipped: false },
          { name: '4 (Bottom)', on_x: 0, on_y: -61, off_x: 0, off_y: -77, skipped: false }
        ];
        break;
      case '3_triangle':
        newDrafts = [
          { name: '1 (Top Center)', on_x: 0, on_y: 27, off_x: 0, off_y: 17, skipped: false },
          { name: '2 (Bottom Left)', on_x: -22, on_y: -17, off_x: -22, off_y: -27, skipped: false },
          { name: '3 (Bottom Right)', on_x: 22, on_y: -17, off_x: 22, off_y: -27, skipped: false }
        ];
        break;
      case '3_inverse_triangle':
        newDrafts = [
          { name: '1 (Top Left)', on_x: -22, on_y: 27, off_x: -22, off_y: 17, skipped: false },
          { name: '2 (Top Right)', on_x: 22, on_y: 27, off_x: 22, off_y: 17, skipped: false },
          { name: '3 (Bottom Center)', on_x: 0, on_y: -17, off_x: 0, off_y: -27, skipped: false }
        ];
        break;
      case '3_horizontal':
        newDrafts = [
          { name: '1 (Left)', on_x: -46, on_y: 8, off_x: -46, off_y: -8, skipped: false },
          { name: '2 (Center)', on_x: 0, on_y: 8, off_x: 0, off_y: -8, skipped: false },
          { name: '3 (Right)', on_x: 46, on_y: 8, off_x: 46, off_y: -8, skipped: false }
        ];
        break;
      case '3_vertical':
        newDrafts = [
          { name: '1 (Top)', on_x: 0, on_y: 54, off_x: 0, off_y: 38, skipped: false },
          { name: '2 (Center)', on_x: 0, on_y: 8, off_x: 0, off_y: -8, skipped: false },
          { name: '3 (Bottom)', on_x: 0, on_y: -38, off_x: 0, off_y: -54, skipped: false }
        ];
        break;
      case '2_horizontal':
        newDrafts = [
          { name: '1 (Left)', on_x: -22, on_y: 5, off_x: -22, off_y: -5, skipped: false },
          { name: '2 (Right)', on_x: 22, on_y: 5, off_x: 22, off_y: -5, skipped: false }
        ];
        break;
      case '2_vertical':
        newDrafts = [
          { name: '1 (Top)', on_x: 0, on_y: 27, off_x: 0, off_y: 17, skipped: false },
          { name: '2 (Bottom)', on_x: 0, on_y: -17, off_x: 0, off_y: -27, skipped: false }
        ];
        break;
      case '1_single':
        newDrafts = [
          { name: '1 (Center)', on_x: 0, on_y: 5, off_x: 0, off_y: -5, skipped: false }
        ];
        break;
    }
    
    const finalDrafts = newDrafts.map(d => ({ ...d, placeholder: d.name, name: '' }));
    setDraftSwitches(finalDrafts);
    setCatalogModalVisible(false);
    setIsCatalogFlow(true);
    setStep('REVIEW');
  };

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

  const updateDraftName = (index: number, newName: string) => {
    const newDrafts = [...draftSwitches];
    newDrafts[index].name = newName;
    setDraftSwitches(newDrafts);
  };

  const toggleSkipDraft = (index: number) => {
    const newDrafts = [...draftSwitches];
    newDrafts[index].skipped = !newDrafts[index].skipped;
    setDraftSwitches(newDrafts);
  };

  const renderReviewPhase = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Review & Save</Text>
      
      <View style={styles.card}>
        <Text style={styles.reviewHeader}>{panelName} - {selectedRoom}</Text>
        
        {draftSwitches.map((draft, idx) => (
          <View key={idx} style={[styles.reviewItem, draft.skipped && styles.reviewItemSkipped]}>
            <View style={styles.reviewItemLeft}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.reviewItemNameInput, draft.skipped && styles.skippedText]}
                  value={draft.name}
                  onChangeText={(text) => updateDraftName(idx, text)}
                  editable={!draft.skipped}
                  placeholder={draft.placeholder || "Assign a name..."}
                  placeholderTextColor="#A3B1C6"
                />
                {!draft.skipped && <FontAwesome name="pencil" size={16} color="#A3B1C6" style={styles.editIcon} />}
              </View>
              <Text style={styles.reviewItemSubtitle}>
                {draft.skipped ? "Unassigned (will not be saved)" : `Position ${idx + 1}`}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => toggleSkipDraft(idx)} 
              style={[styles.disableBtn, draft.skipped && styles.enableBtn]}
            >
              <FontAwesome name={draft.skipped ? "plus-circle" : "ban"} size={16} color={draft.skipped ? "#34C759" : "#FF3B30"} />
              <Text style={[styles.disableBtnText, draft.skipped && styles.enableBtnText]}>
                {draft.skipped ? "Enable" : "Disable"}
              </Text>
            </TouchableOpacity>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: '#E0E5EC',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#A3B1C6',
    marginBottom: 20,
  },
  catalogItem: {
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  catalogItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8E8E93',
    marginTop: 10,
  },
  catalogItemDesc: {
    fontSize: 14,
    color: '#A3B1C6',
    marginTop: 5,
  },
  miniPreview: {
    width: 40,
    height: 40,
    backgroundColor: '#d1d9e6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c0c8d6',
    position: 'relative',
  },
  miniBtn: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#0A84FF',
    borderRadius: 2,
  },
  miniBtnInline: {
    width: 6,
    height: 6,
    backgroundColor: '#0A84FF',
    borderRadius: 1,
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
  reviewItemNameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A84FF',
    padding: 10,
    backgroundColor: '#E0E5EC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c0c8d6',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginRight: 15,
  },
  editIcon: {
    position: 'absolute',
    right: 12,
  },
  reviewItemSubtitle: {
    fontSize: 14,
    color: '#A3B1C6',
    marginLeft: 4,
  },
  reviewItemSkipped: {
    opacity: 0.6,
  },
  skippedText: {
    color: '#8E8E93',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  disableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebe9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 6,
  },
  enableBtn: {
    backgroundColor: '#e6ffe6',
    borderColor: '#34C759',
  },
  disableBtnText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 14,
  },
  enableBtnText: {
    color: '#34C759',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
