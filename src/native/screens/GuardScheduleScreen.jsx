import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity
} from 'react-native';
import { useApp, formatDate } from '../../context/AppContext';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { T } from '../../theme';

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toWeekKey(date) {
  return date.toISOString().slice(0, 10);
}

export function GuardScheduleScreen() {
  const { currentUser, sites, getGuardRoster, shiftSessions } = useApp();
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));

  const site = sites.find(s => s.id === currentUser.siteId);
  const weekKey = toWeekKey(weekStart);
  const roster = getGuardRoster(currentUser.id, weekKey);
  const today = toWeekKey(new Date());

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const isCurrentWeek = toWeekKey(getMondayOfWeek(new Date())) === weekKey;

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
      <Text style={styles.screenTitle}>My Schedule</Text>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <ChevronLeft color="#94a3b8" size={22} />
        </TouchableOpacity>
        <View style={styles.weekLabel}>
          <Text style={styles.weekText}>
            {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
          </Text>
          {isCurrentWeek && <Text style={styles.currentWeekBadge}>This Week</Text>}
        </View>
        <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
          <ChevronRight color="#94a3b8" size={22} />
        </TouchableOpacity>
      </View>

      {roster ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Site */}
          <View style={styles.siteRow}>
            <MapPin color="#38bdf8" size={14} />
            <Text style={styles.siteName}>{site?.name || 'Site not assigned'}</Text>
          </View>

          {/* Day cards */}
          {DAY_KEYS.map((key, i) => {
            const dayDate  = addDays(weekStart, i);
            const dayStr   = toWeekKey(dayDate);
            const shift    = roster.days?.[key];
            const isToday  = dayStr === today;

            // Check if guard had a session on this day
            const session  = shiftSessions.find(s =>
              s.guardId === currentUser.id &&
              s.bookedOnAt?.startsWith(dayStr)
            );

            return (
              <View key={key} style={[styles.dayCard, isToday && styles.dayCardToday, !shift && styles.dayCardOff]}>
                <View style={styles.dayLeft}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                    {DAY_LABELS[i]}
                  </Text>
                  <Text style={styles.dayDate}>
                    {dayDate.getDate()} {dayDate.toLocaleString('en-GB', { month: 'short' })}
                  </Text>
                </View>

                {shift ? (
                  <View style={styles.shiftBlock}>
                    <View style={styles.shiftTimeRow}>
                      <Clock color="#10b981" size={13} />
                      <Text style={styles.shiftTime}>{shift.start} – {shift.end}</Text>
                    </View>
                    {session && (
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionBooked}>
                          Booked on {new Date(session.bookedOnAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {session.bookedOffAt ? ` · Off ${new Date(session.bookedOffAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ' · Still on duty'}
                        </Text>
                        {session.punctuality && session.punctuality !== 'on_time' && session.punctuality !== 'unscheduled' && (
                          <Text style={styles.punctuality}>⚠ {session.punctuality.replace('_', ' ')}</Text>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.offLabel}>Day Off</Text>
                )}

                {isToday && shift && (
                  <View style={styles.todayDot} />
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Calendar color="#334155" size={48} />
          <Text style={styles.emptyTitle}>No roster for this week</Text>
          <Text style={styles.emptySub}>
            Your manager hasn't published your schedule for this week yet.
            You'll receive a notification when it's ready.
          </Text>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bgRoot },
  content:      { flex: 1, padding: 20 },
  screenTitle:  { color: T.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  weekNav:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  navBtn:       { padding: 8 },
  weekLabel:    { flex: 1, alignItems: 'center' },
  weekText:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  currentWeekBadge:{ backgroundColor: '#10b981', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, color: '#fff', fontWeight: '700', marginTop: 4 },
  siteRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  siteName:     { color: '#94a3b8', fontSize: 13 },
  dayCard:      { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center' },
  dayCardToday: { borderColor: '#10b981' },
  dayCardOff:   { opacity: 0.5 },
  dayLeft:      { width: 52 },
  dayLabel:     { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  dayLabelToday:{ color: '#10b981' },
  dayDate:      { color: '#475569', fontSize: 11, marginTop: 2 },
  shiftBlock:   { flex: 1, paddingLeft: 14 },
  shiftTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftTime:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  sessionInfo:  { marginTop: 6 },
  sessionBooked:{ color: '#64748b', fontSize: 11 },
  punctuality:  { color: '#f59e0b', fontSize: 11, marginTop: 2 },
  offLabel:     { flex: 1, color: '#334155', fontSize: 13, paddingLeft: 14 },
  todayDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyTitle:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptySub:     { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
