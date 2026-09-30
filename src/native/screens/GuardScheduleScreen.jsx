import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp, formatDate } from '../../context/AppContext';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card } from '../../ds';

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
  return date.toISOString().slice(0,10);
}

export function GuardScheduleScreen() {
  const { currentUser, sites, getGuardRoster, shiftSessions, refreshRosters } = useApp();
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));

  useFocusEffect(useCallback(() => {
    refreshRosters?.().catch(error => console.warn('[Observant] Could not refresh guard rota:', error.message));
  }, [refreshRosters]));

  const site          = sites.find(s => s.id === currentUser.siteId);
  const weekKey       = toWeekKey(weekStart);
  const roster        = getGuardRoster(currentUser.id, weekKey);
  const today         = toWeekKey(new Date());
  const isCurrentWeek = toWeekKey(getMondayOfWeek(new Date())) === weekKey;

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
        <Text style={styles.screenTitle}>My Schedule</Text>

        {/* Week navigator */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
            <ChevronLeft color={P.t2} size={22} />
          </TouchableOpacity>
          <View style={styles.weekLabelBox}>
            <Text style={styles.weekText}>
              {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
            </Text>
            {isCurrentWeek && (
              <View style={styles.currentWeekBadge}>
                <Text style={styles.currentWeekTxt}>This Week</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
            <ChevronRight color={P.t2} size={22} />
          </TouchableOpacity>
        </View>

        {/* Site row */}
        {site && (
          <View style={styles.siteRow}>
            <MapPin color={P.info} size={13} />
            <Text style={styles.siteNameTxt}>{site.name}</Text>
          </View>
        )}

        {roster ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {DAY_KEYS.map((key, i) => {
              const dayDate = addDays(weekStart, i);
              const dayStr  = toWeekKey(dayDate);
              const shift   = roster.days?.[key];
              const isToday = dayStr === today;

              const session = shiftSessions.find(s =>
                s.guardId === currentUser.id && s.bookedOnAt?.startsWith(dayStr)
              );

              return (
                <View
                  key={key}
                  style={[
                    styles.dayCard,
                    isToday && styles.dayCardToday,
                    !shift && styles.dayCardOff,
                  ]}
                >
                  {/* Today accent bar */}
                  {isToday && <View style={styles.todayAccent} />}

                  <View style={styles.dayLeft}>
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {DAY_LABELS[i]}
                    </Text>
                    <Text style={styles.dayDate}>
                      {dayDate.getDate()}{' '}
                      {dayDate.toLocaleString('en-GB', { month: 'short' })}
                    </Text>
                  </View>

                  {shift ? (
                    <View style={styles.shiftBlock}>
                      <View style={styles.shiftTimeRow}>
                        <Clock color={P.ok} size={13} />
                        <Text style={styles.shiftTime}>{shift.start} – {shift.end}</Text>
                      </View>
                      {session && (
                        <View style={styles.sessionInfo}>
                          <Text style={styles.sessionBooked}>
                            Booked on{' '}
                            {new Date(session.bookedOnAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {session.bookedOffAt
                              ? ` · Off ${new Date(session.bookedOffAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                              : ' · Still on duty'}
                          </Text>
                          {session.punctuality && session.punctuality !== 'on_time' && session.punctuality !== 'unscheduled' && (
                            <Text style={styles.punctuality}>
                              ⚠ {session.punctuality.replace('_', ' ')}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.offLabel}>Day Off</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              variant="radar"
              title="No roster this week"
              message="Your manager hasn't published your schedule yet. You'll be notified when it's ready."
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: P.bg0 },
  content:          { flex: 1, padding: SP.px20 },
  screenTitle:      { ...FONT.h2, marginBottom: SP.px16 },

  weekNav:          { flexDirection: 'row', alignItems: 'center', marginBottom: SP.px12, gap: 8 },
  navBtn:           { padding: 8, backgroundColor: P.bg2, borderRadius: BR.sm, borderWidth: 1, borderColor: P.b2 },
  weekLabelBox:     { flex: 1, alignItems: 'center', gap: 6 },
  weekText:         { color: P.t1, fontSize: 13, fontWeight: '600' },
  currentWeekBadge: { backgroundColor: P.okSubtle, borderRadius: BR.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: P.okBorder },
  currentWeekTxt:   { color: P.ok, fontSize: 10, fontWeight: '700' },

  siteRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SP.px16, paddingHorizontal: 2 },
  siteNameTxt:      { color: P.t2, fontSize: 13 },

  dayCard:          {
    ...card,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: SP.px16,
    overflow: 'hidden',
  },
  dayCardToday:     { borderColor: P.okBorder },
  dayCardOff:       { opacity: 0.45 },
  todayAccent:      { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: P.ok, borderTopLeftRadius: BR.lg, borderBottomLeftRadius: BR.lg },

  dayLeft:          { width: 52 },
  dayLabel:         { color: P.t2, fontSize: 13, fontWeight: '700' },
  dayLabelToday:    { color: P.ok },
  dayDate:          { color: P.t3, fontSize: 11, marginTop: 2 },

  shiftBlock:       { flex: 1, paddingLeft: 14 },
  shiftTimeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftTime:        { color: P.t1, fontSize: 14, fontWeight: '700' },
  sessionInfo:      { marginTop: 6 },
  sessionBooked:    { color: P.t3, fontSize: 11 },
  punctuality:      { color: P.warn, fontSize: 11, marginTop: 2 },
  offLabel:         { flex: 1, color: P.t4, fontSize: 13, paddingLeft: 14 },
});
