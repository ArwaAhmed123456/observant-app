import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, Modal
} from 'react-native';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { MapPin, Clock, CheckCircle, AlertTriangle, LogIn, LogOut, Bell } from 'lucide-react-native';

export function GuardHomeScreen({ navigation }) {
  const {
    currentUser, sites, logout,
    getGuardActiveSession, bookOn, bookOff,
    getTodayCheckCalls, getTodayPatrols,
    activeCheckCall, shiftEndWarning, setShiftEndWarning,
    antiIdlePrompt, dismissAntiIdlePrompt,
    rosters,
  } = useApp();

  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookOff, setShowBookOff] = useState(false);
  const [now, setNow] = useState(new Date());

  const activeSession = getGuardActiveSession(currentUser.id);
  const site = sites.find(s => s.id === currentUser.siteId);
  const todayCC = getTodayCheckCalls(currentUser.id);
  const todayPatrols = getTodayPatrols(currentUser.id);
  const completedCC = todayCC.filter(cc => cc.response === 'yes').length;
  const missedCC = todayCC.filter(cc => cc.response === 'missed').length;
  const completedPatrols = todayPatrols.filter(p => p.finishedAt).length;

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Today's roster for shift time display
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const todayKey = days[new Date().getDay()];
  const todayRoster = rosters.find(r => {
    if (r.guardId !== currentUser.id) return false;
    if (!r.weekStartDate) return false;
    const start = new Date(r.weekStartDate);
    const diff = (new Date() - start) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7 && r.days?.[todayKey];
  });
  const shiftToday = todayRoster?.days?.[todayKey];

  const handleBookOn = async () => {
    if (!currentUser.siteId) {
      Alert.alert('No Site Assigned', 'Contact your manager to be assigned to a site.');
      return;
    }
    setBookingLoading(true);
    await bookOn(currentUser.id, currentUser.siteId);
    setBookingLoading(false);
  };

  const handleBookOff = async () => {
    if (!activeSession) return;
    setShowBookOff(false);
    setBookingLoading(true);
    await bookOff(activeSession.id);
    setBookingLoading(false);
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={require('../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: logout },
        ])}>
          <LogOut color="#64748b" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Text style={styles.greeting}>{greeting()}</Text>
        <Text style={styles.name}>{currentUser.name}</Text>
        <Text style={styles.badge}>{currentUser.badgeNumber} · {site?.name || 'No site assigned'}</Text>

        {/* Live Clock */}
        <Text style={styles.clock}>{now.toLocaleTimeString('en-GB')}</Text>
        <Text style={styles.date}>{formatDate(now)}</Text>

        {/* Shift End Warning Banner */}
        {shiftEndWarning && (
          <TouchableOpacity style={styles.warnBanner} onPress={() => setShiftEndWarning(false)}>
            <Bell color="#f59e0b" size={16} />
            <Text style={styles.warnText}>
              Your shift is ending soon — don't forget to Book Off.
            </Text>
          </TouchableOpacity>
        )}

        {/* Anti-Idle Patrol Prompt */}
        {antiIdlePrompt && !activeSession?.bookedOffAt && (
          <View style={styles.antiIdleCard}>
            <AlertTriangle color="#f59e0b" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.antiIdleTitle}>Surprise Patrol Check!</Text>
              <Text style={styles.antiIdleSub}>Start patrolling now to stay ahead of schedule.</Text>
            </View>
            <TouchableOpacity style={styles.antiIdleBtn} onPress={() => {
              dismissAntiIdlePrompt();
              navigation.navigate('Patrol');
            }}>
              <Text style={styles.antiIdleBtnTxt}>Go</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissAntiIdlePrompt} style={{ paddingLeft: 8 }}>
              <Text style={{ color: '#64748b', fontSize: 12 }}>Ignore</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active Check Call Banner */}
        {activeCheckCall && (
          <TouchableOpacity
            style={styles.checkCallBanner}
            onPress={() => navigation.navigate('CheckCall')}
          >
            <Bell color="#fff" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.checkCallTitle}>Check Call — is everything okay?</Text>
              <Text style={styles.checkCallSub}>Respond within 10 minutes</Text>
            </View>
            <Text style={styles.checkCallArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Shift Status Card */}
        {activeSession ? (
          <View style={styles.shiftCard}>
            <View style={styles.shiftActive}>
              <CheckCircle color="#10b981" size={18} />
              <Text style={styles.shiftActiveText}>Booked on since {formatTime(activeSession.bookedOnAt)}</Text>
            </View>
            <View style={styles.shiftRow}>
              <MapPin color="#38bdf8" size={14} />
              <Text style={styles.shiftSite}>{site?.name}</Text>
            </View>
            {shiftToday && (
              <Text style={styles.shiftTime}>
                Shift: {shiftToday.start} – {shiftToday.end}
              </Text>
            )}
            {activeSession.punctuality && activeSession.punctuality !== 'on_time' && activeSession.punctuality !== 'unscheduled' && (
              <View style={styles.punctualityBadge}>
                <Text style={styles.punctualityText}>
                  {activeSession.punctuality === 'late' ? '⚠ Booked on late' : '⚠ Slightly late'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.offDutyCard}>
            <Clock color="#64748b" size={18} />
            <Text style={styles.offDutyText}>You are currently off duty</Text>
            {shiftToday && (
              <Text style={styles.shiftTime}>Scheduled: {shiftToday.start} – {shiftToday.end}</Text>
            )}
          </View>
        )}

        {/* Today Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedCC}/{todayCC.length}</Text>
            <Text style={styles.statLabel}>Check Calls</Text>
            {missedCC > 0 && <Text style={styles.statMissed}>{missedCC} missed</Text>}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedPatrols}</Text>
            <Text style={styles.statLabel}>Patrols Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayPatrols.filter(p => p.status === 'incomplete').length}</Text>
            <Text style={styles.statLabel}>Incomplete</Text>
          </View>
        </View>

        {/* Book On / Book Off */}
        {!activeSession ? (
          <TouchableOpacity
            style={[styles.bookBtn, styles.bookOnBtn, bookingLoading && styles.btnDisabled]}
            onPress={handleBookOn}
            disabled={bookingLoading}
          >
            <LogIn color="#fff" size={20} />
            <Text style={styles.bookBtnTxt}>Book On</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bookBtn, styles.bookOffBtn, bookingLoading && styles.btnDisabled]}
            onPress={() => setShowBookOff(true)}
            disabled={bookingLoading}
          >
            <LogOut color="#fff" size={20} />
            <Text style={styles.bookBtnTxt}>Book Off</Text>
          </TouchableOpacity>
        )}

        {/* Recent check calls */}
        {todayCC.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Check Calls</Text>
            {todayCC.slice(-5).reverse().map(cc => (
              <View key={cc.id} style={styles.ccRow}>
                <View style={[styles.ccDot, {
                  backgroundColor: cc.response === 'yes' ? '#10b981' : cc.response === 'missed' ? '#ef4444' : '#f59e0b'
                }]} />
                <Text style={styles.ccTime}>{formatTime(cc.firedAt)}</Text>
                <Text style={styles.ccStatus}>
                  {cc.response === 'yes' ? '✓ All okay' : cc.response === 'missed' ? '✗ Missed' : cc.response === 'no' ? '⚠ Issue reported' : '⏳ Pending'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Book Off Confirm Modal */}
      <Modal visible={showBookOff} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book Off?</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to end your shift?{'\n'}
              Duration: {activeSession ? getShiftDuration(activeSession.bookedOnAt) : ''}
            </Text>
            <TouchableOpacity style={styles.modalConfirm} onPress={handleBookOff}>
              <Text style={styles.modalConfirmTxt}>Yes, Book Off</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowBookOff(false)}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getShiftDuration(bookedOnAt) {
  const diff = Date.now() - new Date(bookedOnAt).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#090d16' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  logo:    { width: 120, height: 38 },
  scroll:  { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 8 },
  greeting:{ color: '#94a3b8', fontSize: 14, marginTop: 4 },
  name:    { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
  badge:   { color: '#64748b', fontSize: 13, marginTop: 4 },
  clock:   { color: '#10b981', fontSize: 36, fontWeight: '800', marginTop: 16, letterSpacing: 1 },
  date:    { color: '#64748b', fontSize: 13, marginBottom: 16 },
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 10, padding: 12, marginBottom: 12 },
  warnText:{ color: '#f59e0b', fontSize: 13, fontWeight: '600', flex: 1 },
  antiIdleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 12, padding: 14, marginBottom: 12 },
  antiIdleTitle:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  antiIdleSub:{ color: '#94a3b8', fontSize: 12 },
  antiIdleBtn:{ backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  antiIdleBtnTxt:{ color: '#000', fontWeight: '800', fontSize: 13 },
  checkCallBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1d4ed8', borderRadius: 12, padding: 16, marginBottom: 12 },
  checkCallTitle:{ color: '#fff', fontSize: 15, fontWeight: '800' },
  checkCallSub:{ color: '#bfdbfe', fontSize: 12 },
  checkCallArrow:{ color: '#fff', fontSize: 20, fontWeight: '800' },
  shiftCard: { backgroundColor: '#0f172a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 16 },
  shiftActive:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shiftActiveText:{ color: '#10b981', fontSize: 15, fontWeight: '700' },
  shiftRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  shiftSite:{ color: '#94a3b8', fontSize: 13 },
  shiftTime:{ color: '#64748b', fontSize: 12, marginTop: 4 },
  punctualityBadge:{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 8 },
  punctualityText:{ color: '#f59e0b', fontSize: 11, fontWeight: '700' },
  offDutyCard:{ backgroundColor: '#0f172a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  offDutyText:{ color: '#64748b', fontSize: 14 },
  statsRow:{ flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:{ flex: 1, backgroundColor: '#0f172a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  statValue:{ color: '#fff', fontSize: 22, fontWeight: '800' },
  statLabel:{ color: '#64748b', fontSize: 11, marginTop: 2 },
  statMissed:{ color: '#ef4444', fontSize: 10, marginTop: 2 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 16, marginBottom: 20 },
  bookOnBtn: { backgroundColor: '#10b981' },
  bookOffBtn:{ backgroundColor: '#ef4444' },
  btnDisabled:{ opacity: 0.6 },
  bookBtnTxt:{ color: '#fff', fontSize: 18, fontWeight: '800' },
  section:{ marginBottom: 20 },
  sectionTitle:{ color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  ccRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  ccDot:{ width: 8, height: 8, borderRadius: 4 },
  ccTime:{ color: '#94a3b8', fontSize: 13, width: 50 },
  ccStatus:{ color: '#fff', fontSize: 13 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:{ backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle:{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub:{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 20 },
  modalConfirm:{ backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalConfirmTxt:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  modalCancel:{ backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelTxt:{ color: '#94a3b8', fontSize: 16, fontWeight: '600' },
});
