import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView
} from 'react-native';
import { ArrowLeft, Calendar, Clock, MapPin, CheckCircle2 } from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const ScheduleScreen = ({ onBack }) => {
  const { rosters, sites, currentUser } = useSecurity();

  const currentRoster = rosters[0];
  const guardShifts = currentRoster?.shifts?.filter((s) => s.guardId === currentUser.id) || [];

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft color="#94a3b8" size={20} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Officer Duty Schedule</Text>
          <Text style={styles.headerSubtitle}>{currentRoster?.name || 'Current Week Roster'}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guard summary banner */}
        <View style={styles.summaryBanner}>
          <Calendar color="#38bdf8" size={22} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryTitle}>{currentUser.name}</Text>
            <Text style={styles.summarySub}>
              Badge: {currentUser.badgeNumber} • Primary: Apex Tower
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Assigned Shifts</Text>

        {daysOfWeek.map((day) => {
          const shift = guardShifts.find((s) => s.dayName === day);
          const isOff = !shift || shift.status === 'off';
          const site = sites.find((s) => s.id === shift?.siteId) || sites[0];

          return (
            <View
              key={day}
              style={[
                styles.shiftCard,
                isOff && styles.shiftCardOff
              ]}
            >
              <View style={styles.dayCol}>
                <Text style={[styles.dayText, isOff && styles.dayTextOff]}>{day}</Text>
              </View>

              <View style={styles.shiftDetails}>
                {isOff ? (
                  <Text style={styles.offText}>Scheduled Rest Day / Off Duty</Text>
                ) : (
                  <>
                    <View style={styles.siteRow}>
                      <MapPin color="#38bdf8" size={13} />
                      <Text style={styles.siteName}>{site?.name}</Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Clock color="#94a3b8" size={13} />
                      <Text style={styles.timeText}>
                        {shift.startTime} - {shift.endTime} (12h Guard Shift)
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isOff ? styles.statusBadgeOff : styles.statusBadgeActive
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isOff ? styles.statusTextOff : styles.statusTextActive
                  ]}
                >
                  {isOff ? 'OFF' : 'BOOKED'}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a'
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b'
  },
  headerCenter: {
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  content: {
    flex: 1,
    padding: 16
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0284c7',
    padding: 16,
    marginBottom: 20
  },
  summaryCol: {
    flex: 1
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc'
  },
  summarySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 10
  },
  shiftCardOff: {
    opacity: 0.6
  },
  dayCol: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  dayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38bdf8'
  },
  dayTextOff: {
    color: '#64748b'
  },
  shiftDetails: {
    flex: 1,
    gap: 4
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  siteName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8'
  },
  offText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  statusBadgeOff: {
    backgroundColor: '#1e293b'
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusTextActive: {
    color: '#10b981'
  },
  statusTextOff: {
    color: '#64748b'
  }
});
