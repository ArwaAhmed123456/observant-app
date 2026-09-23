import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import {
  Shield,
  ShieldAlert,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Flame,
  Radio
} from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const GuardDashboardScreen = ({
  onNavigateToPatrol,
  onOpenIncidentModal,
  onOpenSchedule,
  onOpenNotifications
}) => {
  const {
    currentUser,
    sites,
    activeShiftSession,
    activePatrolSession,
    bookOn,
    bookOff,
    triggerPanicAlert,
    triggerCheckCall,
    notifications
  } = useSecurity();

  const assignedSiteId = activeShiftSession?.siteId || currentUser.assignedSiteId || 'site-1';
  const site = sites.find((s) => s.id === assignedSiteId) || sites[0];

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleBookOn = () => {
    Alert.alert(
      'Confirm Book On',
      `Begin active security shift at ${site.name}?\n\nGPS geofence and anti-idle welfare timers will activate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm & Book On', onPress: () => bookOn(site.id) }
      ]
    );
  };

  const handleBookOff = () => {
    Alert.alert(
      'Confirm Book Off',
      `End current shift session at ${site.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete Shift', style: 'destructive', onPress: () => bookOff() }
      ]
    );
  };

  const handlePanic = () => {
    Alert.alert(
      '🚨 TRIGGER EMERGENCY SOS 🚨',
      'This will immediately sound alarms, dispatch GPS coordinates, and escalate to the 24/7 Security Operations Center.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM EMERGENCY',
          style: 'destructive',
          onPress: () => triggerPanicAlert('Duress Alert: Guard triggered immediate emergency SOS via mobile device.')
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.guardProfile}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.guardName}>{currentUser.name}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeText}>{currentUser.badgeNumber}</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.roleText}>Security Officer</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={onOpenNotifications} style={styles.iconButton}>
          <Bell color="#94a3b8" size={20} />
          {unreadNotifs > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadNotifs}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Shift Card */}
      <View style={styles.shiftCard}>
        <View style={styles.shiftHeader}>
          <View style={styles.siteInfo}>
            <MapPin color="#38bdf8" size={16} />
            <Text style={styles.siteName}>{site.name}</Text>
          </View>
          <View
            style={[
              styles.shiftStatusPill,
              activeShiftSession ? styles.pillActive : styles.pillInactive
            ]}
          >
            <View
              style={[
                styles.statusDot,
                activeShiftSession ? styles.dotActive : styles.dotInactive
              ]}
            />
            <Text
              style={[
                styles.shiftStatusText,
                activeShiftSession ? styles.statusTextActive : styles.statusTextInactive
              ]}
            >
              {activeShiftSession ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
          </View>
        </View>

        {activeShiftSession ? (
          <View style={styles.activeShiftDetails}>
            <View style={styles.shiftStatRow}>
              <View style={styles.shiftStat}>
                <Clock color="#94a3b8" size={14} />
                <Text style={styles.statLabel}>Booked On</Text>
                <Text style={styles.statValue}>
                  {new Date(activeShiftSession.bookedOnAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={styles.shiftStat}>
                <CheckCircle2 color="#10b981" size={14} />
                <Text style={styles.statLabel}>Punctuality</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>
                  {activeShiftSession.punctualityStatus}
                </Text>
              </View>
              <View style={styles.shiftStat}>
                <Radio color="#38bdf8" size={14} />
                <Text style={styles.statLabel}>GPS Status</Text>
                <Text style={[styles.statValue, { color: '#38bdf8' }]}>Active Lock</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleBookOff} style={styles.bookOffButton}>
              <Text style={styles.bookOffButtonText}>BOOK OFF SHIFT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inactiveShiftDetails}>
            <Text style={styles.inactiveDesc}>
              Scheduled Shift: 18:00 - 06:00 (12 hrs) • Zone Alpha
            </Text>
            <TouchableOpacity onPress={handleBookOn} style={styles.bookOnButton}>
              <Text style={styles.bookOnButtonText}>BOOK ON SHIFT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Emergency SOS Button */}
      <TouchableOpacity onPress={handlePanic} style={styles.panicButton}>
        <View style={styles.panicInner}>
          <ShieldAlert color="#ffffff" size={26} />
          <View style={styles.panicTextCol}>
            <Text style={styles.panicTitle}>EMERGENCY PANIC ALERT (SOS)</Text>
            <Text style={styles.panicSubtitle}>
              Tap to trigger instant priority duress signal to command center
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Patrol Tour Action Card */}
      <TouchableOpacity
        onPress={onNavigateToPatrol}
        style={styles.patrolCard}
      >
        <View style={styles.patrolIconWrap}>
          <Shield color="#38bdf8" size={24} />
        </View>
        <View style={styles.patrolCol}>
          <Text style={styles.patrolTitle}>
            {activePatrolSession ? 'Resume Patrol Tour' : 'Start Checkpoint Patrol'}
          </Text>
          <Text style={styles.patrolSubtitle}>
            {site.requiredCheckpoints?.length || 5} Waypoints • QR / NFC Geofence Scanning
          </Text>
        </View>
        <ChevronRight color="#64748b" size={20} />
      </TouchableOpacity>

      {/* Quick Action Grid */}
      <Text style={styles.sectionTitle}>Guard Operations</Text>
      <View style={styles.grid}>
        {/* Report Incident */}
        <TouchableOpacity onPress={onOpenIncidentModal} style={styles.gridItem}>
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <AlertTriangle color="#ef4444" size={22} />
          </View>
          <Text style={styles.gridLabel}>Log Incident</Text>
          <Text style={styles.gridSub}>Report hazard / breach</Text>
        </TouchableOpacity>

        {/* Safety Check Call */}
        <TouchableOpacity
          onPress={() => triggerCheckCall(false)}
          style={styles.gridItem}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Clock color="#10b981" size={22} />
          </View>
          <Text style={styles.gridLabel}>Check-Call</Text>
          <Text style={styles.gridSub}>Verify welfare status</Text>
        </TouchableOpacity>

        {/* Roster / Schedule */}
        <TouchableOpacity onPress={onOpenSchedule} style={styles.gridItem}>
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
            <Calendar color="#38bdf8" size={22} />
          </View>
          <Text style={styles.gridLabel}>Roster</Text>
          <Text style={styles.gridSub}>Weekly shift schedule</Text>
        </TouchableOpacity>

        {/* Random Patrol Prompt */}
        <TouchableOpacity
          onPress={() => triggerCheckCall(true)}
          style={styles.gridItem}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Flame color="#f59e0b" size={22} />
          </View>
          <Text style={styles.gridLabel}>Test Check-In</Text>
          <Text style={styles.gridSub}>Anti-idle compliance</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 16
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 45,
    paddingBottom: 16
  },
  guardProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#38bdf8'
  },
  appLogo: {
    width: 110,
    height: 36
  },
  guardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2
  },
  badgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700'
  },
  dot: {
    color: '#64748b'
  },
  roleText: {
    fontSize: 11,
    color: '#94a3b8'
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  shiftCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 16
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  siteName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc'
  },
  shiftStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  pillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  pillInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  dotActive: {
    backgroundColor: '#10b981'
  },
  dotInactive: {
    backgroundColor: '#94a3b8'
  },
  shiftStatusText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusTextActive: {
    color: '#10b981'
  },
  statusTextInactive: {
    color: '#94a3b8'
  },
  activeShiftDetails: {
    gap: 14
  },
  shiftStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12
  },
  shiftStat: {
    alignItems: 'center',
    gap: 4
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b'
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  bookOffButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center'
  },
  bookOffButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5
  },
  inactiveShiftDetails: {
    gap: 12
  },
  inactiveDesc: {
    fontSize: 12,
    color: '#94a3b8'
  },
  bookOnButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  bookOnButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5
  },
  panicButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    padding: 16,
    marginBottom: 16
  },
  panicInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  panicTextCol: {
    flex: 1
  },
  panicTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  panicSubtitle: {
    color: '#fca5a5',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14
  },
  patrolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0284c7',
    padding: 16,
    marginBottom: 20
  },
  patrolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  patrolCol: {
    flex: 1
  },
  patrolTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc'
  },
  patrolSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14
  },
  gridIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc'
  },
  gridSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  }
});
