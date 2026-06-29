import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

// Mock data for switches
const MOCK_SWITCHES = [
  { id: '1', name: 'Living Room Lights', room: 'Living Room' },
  { id: '2', name: 'Bedroom Fan', room: 'Bedroom' },
  { id: '3', name: 'Kitchen AC', room: 'Kitchen' },
];

// Mock data for paired devices removed - using global connection state

export default function ManagerScreen() {
  const [switches] = useState(MOCK_SWITCHES);
  const { connectionStatus, deviceIp, connectToDevice, disconnectDevice } = useAppStore();

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
            {switches.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemTitle}>{item.name}</Text>
                  <Text style={styles.listItemSubtitle}>{item.room}</Text>
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
            {switches.length === 0 && (
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
            <View>
              <Text style={styles.deviceSwitchName}>5-Bar Linkage Arm</Text>
              <Text style={styles.listItemSubtitle}>IP: {deviceIp}</Text>
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

          <TouchableOpacity 
            style={[
              styles.addButton, 
              { marginTop: 10, backgroundColor: connectionStatus === 'connected' ? '#ff3b30' : '#34C759', borderColor: 'transparent' }
            ]}
            onPress={() => {
              if (connectionStatus === 'connected') {
                disconnectDevice();
              } else {
                connectToDevice(deviceIp);
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
              {connectionStatus === 'connected' ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
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
});
