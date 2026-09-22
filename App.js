import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Shield, MapPin, Users, Calendar } from 'lucide-react-native';

import { SecurityProvider, useSecurity } from './src/context/SecurityContext';
import { GuardDashboardScreen } from './src/native/screens/GuardDashboardScreen';
import { PatrolTourScreen } from './src/native/screens/PatrolTourScreen';
import { ManagerDashboardScreen } from './src/native/screens/ManagerDashboardScreen';
import { ScheduleScreen } from './src/native/screens/ScheduleScreen';
import { IncidentModal } from './src/native/screens/IncidentModal';
import { CheckCallModal } from './src/native/screens/CheckCallModal';
import { NotificationsModal } from './src/native/screens/NotificationsModal';

function AppContent() {
  const [activeTab, setActiveTab] = useState('guard'); // 'guard' | 'patrol' | 'manager' | 'schedule'
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);

  const { guardToast, clearGuardToast } = useSecurity();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#090d16" />

      {/* Optional Top Toast */}
      {guardToast && (
        <TouchableOpacity
          onPress={clearGuardToast}
          style={styles.toastWrap}
        >
          <Text style={styles.toastTitle}>{guardToast.title}</Text>
          <Text style={styles.toastMsg}>{guardToast.message}</Text>
        </TouchableOpacity>
      )}

      {/* Main Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === 'guard' && (
          <GuardDashboardScreen
            onNavigateToPatrol={() => setActiveTab('patrol')}
            onOpenIncidentModal={() => setIncidentModalVisible(true)}
            onOpenSchedule={() => setActiveTab('schedule')}
            onOpenNotifications={() => setNotifsVisible(true)}
          />
        )}

        {activeTab === 'patrol' && (
          <PatrolTourScreen onBack={() => setActiveTab('guard')} />
        )}

        {activeTab === 'manager' && (
          <ManagerDashboardScreen />
        )}

        {activeTab === 'schedule' && (
          <ScheduleScreen onBack={() => setActiveTab('guard')} />
        )}
      </View>

      {/* Global Safety Welfare Check-Call Modal */}
      <CheckCallModal />

      {/* Incident Reporting Modal */}
      <IncidentModal
        visible={incidentModalVisible}
        onClose={() => setIncidentModalVisible(false)}
      />

      {/* Notifications Inbox Modal */}
      <NotificationsModal
        visible={notifsVisible}
        onClose={() => setNotifsVisible(false)}
      />

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={() => setActiveTab('guard')}
          style={[styles.navItem, activeTab === 'guard' && styles.navItemActive]}
        >
          <Shield color={activeTab === 'guard' ? '#10b981' : '#64748b'} size={20} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'guard' && styles.navLabelActive
            ]}
          >
            Guard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('patrol')}
          style={[styles.navItem, activeTab === 'patrol' && styles.navItemActive]}
        >
          <MapPin color={activeTab === 'patrol' ? '#38bdf8' : '#64748b'} size={20} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'patrol' && { color: '#38bdf8' }
            ]}
          >
            Patrol
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('manager')}
          style={[styles.navItem, activeTab === 'manager' && styles.navItemActive]}
        >
          <Users color={activeTab === 'manager' ? '#a855f7' : '#64748b'} size={20} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'manager' && { color: '#a855f7' }
            ]}
          >
            Supervisor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('schedule')}
          style={[styles.navItem, activeTab === 'schedule' && styles.navItemActive]}
        >
          <Calendar color={activeTab === 'schedule' ? '#f59e0b' : '#64748b'} size={20} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'schedule' && { color: '#f59e0b' }
            ]}
          >
            Roster
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SecurityProvider>
        <AppContent />
      </SecurityProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16'
  },
  screenContainer: {
    flex: 1
  },
  toastWrap: {
    backgroundColor: '#065f46',
    borderWidth: 1,
    borderColor: '#10b981',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    zIndex: 99
  },
  toastTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  toastMsg: {
    color: '#d1fae5',
    fontSize: 11,
    marginTop: 2
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'space-around'
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  navLabelActive: {
    color: '#10b981',
    fontWeight: '700'
  }
});
