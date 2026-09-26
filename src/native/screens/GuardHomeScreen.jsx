import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Modal, Animated, Vibration
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { MapPin, Clock, CheckCircle, AlertTriangle, LogIn, LogOut, Bell, Zap, User } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { COLORS, S, R, TYPE, shadows, cardStyle } from '../../theme';
import { enqueue } from '../../services/offlineQueue';

export function GuardHomeScreen({ navigation }) {
  const {
    currentUser, sites, logout,
    getGuardActiveSession, bookOn, bookOff,
    getTodayCheckCalls, getTodayPatrols,
    activeCheckCall, shiftEndWarning, setShiftEndWarning,
    antiIdlePrompt, dismissAntiIdlePrompt,
    rosters, addAlert, triggerSOS,
  } = useApp();

  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookOff, setShowBookOff]       = useState(false);
  const [now, setNow]                       = useState(new Date());
  const [isOnline, setIsOnline]             = useState(true);
  const [showSOSConfirm, setShowSOSConfirm] = useState(false);
  const [sosLoading, setSosLoading]         = useState(false);

  // SOS pulse animation
  const sosPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosPulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(sosPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });
    return unsub;
  }, []);

  const activeSession  = getGuardActiveSession(currentUser?.id || currentUser?._id);
  const site           = sites.find(s => s.id === currentUser?.siteId || s._id === currentUser?.siteId);
  const todayCC        = getTodayCheckCalls(currentUser?.id || currentUser?._id);
  const todayPatrols   = getTodayPatrols(currentUser?.id || currentUser?._id);
  const completedCC    = todayCC.filter(cc => cc.response === 'yes').length;
  const missedCC       = todayCC.filter(cc => cc.response === 'missed').length;
  const completedPatrols = todayPatrols.filter(p => p.finishedAt).length;

  // Today's roster
  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  const todayKey = dayKeys[new Date().getDay()];
  const todayRoster = (rosters || []).find(r => {
    if (r.guardId !== (currentUser?.id || currentUser?._id)) return false;
    if (!r.weekStartDate) return false;
    const diff = (new Date() - new Date(r.weekStartDate)) / 86400000;
    return diff >= 0 && diff < 7 && r.days?.[todayKey];
  });
  const shiftToday = todayRoster?.days?.[todayKey];

  const greeting = () => {
    const h = now.getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  const handleBookOn = async () => {
    if (!currentUser?.siteId && !currentUser?.siteId) {
      Alert.alert('No Site Assigned', 'Contact your manager to be assigned to a site.');
      return;
    }
    setBookingLoading(true);
    await bookOn(currentUser.id || currentUser._id, currentUser.siteId);
    setBookingLoading(false);
  };

  const handleBookOff = async () => {
    if (!activeSession) return;
    setShowBookOff(false);
    setBookingLoading(true);
    await bookOff(activeSession.id || activeSession._id);
    setBookingLoading(false);
  };

  // ── SOS ────────────────────────────────────────────────────────────────────
  const handleSOS = async () => {
    setShowSOSConfirm(false);
    setSosLoading(true);
    Vibration.vibrate([0, 400, 200, 400]);

    let coords = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch {}

    if (!coords && site?.latitude) {
      coords = { latitude: site.latitude, longitude: site.longitude };
    }

    if (!isOnline) {
      await enqueue({
        action: 'SOS_TRIGGER',
        guardId: currentUser?.id || currentUser?._id,
        siteId: currentUser?.siteId,
        location: coords,
        label: 'Emergency SOS Alert',
      });
      setSosLoading(false);
      Alert.alert('SOS Queued Offline', 'Your SOS emergency flag and location coordinates have been stored locally. It will transmit immediately when connection is restored.');
      return;
    }

    await triggerSOS({ location: coords, note: 'Urgent assistance requested by officer' });
    setSosLoading(false);
    Alert.alert('🚨 Emergency SOS Sent', 'Your operations manager has been immediately alerted with your live location. Help is on the way. Stay safe.');
  };

  return (
    <View style={styles.root}>
      <AppHeader right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          {!isOnline && (
            <View style={styles.offlinePill}>
              <Text style={styles.offlinePillTxt}>Offline</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.profileHeaderBtn}
            onPress={() => navigation.navigate('Profile')}
            title="Profile & Settings"
          >
            <User color={COLORS.brand} size={20} />
          </TouchableOpacity>
        </View>
      } />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Text style={styles.greeting}>{greeting()},</Text>
        <Text style={styles.name}>{currentUser?.name}</Text>
        <Text style={styles.badge}>{currentUser?.badgeNumber} · {site?.name || 'No site assigned'}</Text>

        {/* Clock */}
        <Text style={styles.clock}>{now.toLocaleTimeString('en-GB')}</Text>
        <Text style={styles.date}>{formatDate(now)}</Text>

        {/* Shift end warning */}
        {shiftEndWarning && (
          <TouchableOpacity style={styles.warnBanner} onPress={() => setShiftEndWarning(false)}>
            <Bell color={COLORS.issue} size={16} />
            <Text style={styles.warnText}>Your shift is ending soon — don't forget to Book Off.</Text>
          </TouchableOpacity>
        )}

        {/* Anti-idle prompt */}
        {antiIdlePrompt && activeSession && (
          <View style={styles.antiIdleCard}>
            <AlertTriangle color={COLORS.issue} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.antiIdleTitle}>Surprise Patrol Check!</Text>
              <Text style={styles.antiIdleSub}>Start patrolling now to stay ahead of schedule.</Text>
            </View>
            <TouchableOpacity style={styles.antiIdleGoBtn} onPress={() => { dismissAntiIdlePrompt(); navigation.navigate('Patrol'); }}>
              <Text style={styles.antiIdleGoBtnTxt}>Go</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissAntiIdlePrompt} style={{ paddingLeft: S.sm }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Later</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active check call banner */}
        {activeCheckCall && (
          <TouchableOpacity style={styles.checkCallBanner} onPress={() => navigation.navigate('Check Call')}>
            <Bell color={COLORS.white} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.checkCallTitle}>Check Call — is everything okay?</Text>
              <Text style={styles.checkCallSub}>Tap to respond within 10 minutes</Text>
            </View>
            <Text style={styles.checkCallArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Shift status card */}
        {activeSession ? (
          <View style={[cardStyle, styles.shiftCard]}>
            <View style={styles.shiftActive}>
              <CheckCircle color={COLORS.ok} size={18} />
              <Text style={styles.shiftActiveText}>Booked on since {formatTime(activeSession.bookedOnAt)}</Text>
            </View>
            <View style={styles.shiftRow}>
              <MapPin color={COLORS.info} size={14} />
              <Text style={styles.shiftSite}>{site?.name}</Text>
            </View>
            {shiftToday && (
              <Text style={styles.shiftTime}>Scheduled: {shiftToday.start} – {shiftToday.end}</Text>
            )}
            {activeSession.punctuality && !['on_time','unscheduled'].includes(activeSession.punctuality) && (
              <View style={styles.punctualityBadge}>
                <Text style={styles.punctualityText}>⚠ Booked on {activeSession.punctuality.replace('_',' ')}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[cardStyle, styles.offDutyCard]}>
            <Clock color={COLORS.textMuted} size={18} />
            <View>
              <Text style={styles.offDutyText}>Currently off duty</Text>
              {shiftToday && <Text style={styles.shiftTime}>Scheduled: {shiftToday.start} – {shiftToday.end}</Text>}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[cardStyle, styles.statCard]}>
            <Text style={styles.statValue}>{completedCC}/{todayCC.length}</Text>
            <Text style={styles.statLabel}>Check Calls</Text>
            {missedCC > 0 && <Text style={styles.statMissed}>{missedCC} missed</Text>}
          </View>
          <View style={[cardStyle, styles.statCard]}>
            <Text style={styles.statValue}>{completedPatrols}</Text>
            <Text style={styles.statLabel}>Patrols Done</Text>
          </View>
        </View>

        {/* Book on/off */}
        {!activeSession ? (
          <TouchableOpacity
            style={[styles.bookBtn, styles.bookOnBtn, bookingLoading && styles.btnDisabled]}
            onPress={handleBookOn} disabled={bookingLoading}
          >
            <LogIn color={COLORS.white} size={20} />
            <Text style={styles.bookBtnTxt}>Book On</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bookBtn, styles.bookOffBtn, bookingLoading && styles.btnDisabled]}
            onPress={() => setShowBookOff(true)} disabled={bookingLoading}
          >
            <LogOut color={COLORS.white} size={20} />
            <Text style={styles.bookBtnTxt}>Book Off</Text>
          </TouchableOpacity>
        )}

        {/* Recent check calls */}
        {todayCC.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Check Calls</Text>
            {todayCC.slice(-5).reverse().map(cc => (
              <View key={cc.id || cc._id} style={styles.ccRow}>
                <View style={[styles.ccDot, { backgroundColor:
                  cc.response === 'yes' ? COLORS.ok :
                  cc.response === 'missed' ? COLORS.missed :
                  cc.response === 'no' ? COLORS.issue : COLORS.borderMid
                }]} />
                <Text style={styles.ccTime}>{formatTime(cc.firedAt)}</Text>
                <Text style={styles.ccStatus}>
                  {cc.response === 'yes' ? '✓ All okay' : cc.response === 'missed' ? '✗ Missed' : cc.response === 'no' ? '⚠ Issue' : '⏳ Pending'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── SOS Floating Button ── */}
      <Animated.View style={[styles.sosFabWrap, { transform: [{ scale: sosPulse }] }]}>
        <TouchableOpacity
          style={styles.sosFab}
          onPress={() => setShowSOSConfirm(true)}
          activeOpacity={0.85}
        >
          <Zap color={COLORS.white} size={22} fill={COLORS.white} />
          <Text style={styles.sosFabTxt}>SOS</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* SOS Confirm Modal */}
      <Modal visible={showSOSConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.sosModal}>
            <View style={styles.sosIconWrap}>
              <Zap color={COLORS.sos} size={36} />
            </View>
            <Text style={styles.sosModalTitle}>Send Emergency SOS?</Text>
            <Text style={styles.sosModalSub}>
              This will immediately alert your manager with your name, badge, and site.
              Only use in a genuine emergency.
            </Text>
            <TouchableOpacity
              style={[styles.sosConfirmBtn, sosLoading && styles.btnDisabled]}
              onPress={handleSOS} disabled={sosLoading}
            >
              <Text style={styles.sosConfirmBtnTxt}>{sosLoading ? 'Sending…' : '🚨 Yes, Send SOS'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sosCancelBtn} onPress={() => setShowSOSConfirm(false)}>
              <Text style={styles.sosCancelBtnTxt}>Cancel — I'm okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Book Off Modal */}
      <Modal visible={showBookOff} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book Off?</Text>
            <Text style={styles.modalSub}>
              End your shift?{activeSession ? `\nDuration: ${getShiftDuration(activeSession.bookedOnAt)}` : ''}
            </Text>
            <TouchableOpacity style={styles.bookOffConfirm} onPress={handleBookOff}>
              <Text style={styles.bookOffConfirmTxt}>Yes, Book Off</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBookOff(false)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
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
  root:          { flex: 1, backgroundColor: COLORS.bgRoot },
  scroll:        { flex: 1 },
  scrollContent: { padding: S.xl, paddingTop: S.sm, paddingBottom: 120 },
  greeting:      { color: COLORS.textSecondary, fontSize: 14, marginTop: S.xs },
  name:          { ...TYPE.title, marginTop: 2 },
  badge:         { color: COLORS.textMuted, fontSize: 13, marginTop: S.xs },
  clock:         { color: COLORS.brand, fontSize: 36, fontWeight: '800', marginTop: S.lg, letterSpacing: 1 },
  date:          { color: COLORS.textMuted, fontSize: 13, marginBottom: S.lg },
  offlinePill:   { backgroundColor: COLORS.issueBg, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, borderWidth: 1, borderColor: COLORS.issueBorder },
  offlinePillTxt:{ color: COLORS.issue, fontSize: 11, fontWeight: '700' },
  warnBanner:    { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: COLORS.issueBg, borderWidth: 1, borderColor: COLORS.issueBorder, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  warnText:      { color: COLORS.issue, fontSize: 13, fontWeight: '600', flex: 1 },
  antiIdleCard:  { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: COLORS.issueBg, borderWidth: 1, borderColor: COLORS.issueBorder, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  antiIdleTitle: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  antiIdleSub:   { color: COLORS.textSecondary, fontSize: 11 },
  antiIdleGoBtn: { backgroundColor: COLORS.issue, borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: S.sm },
  antiIdleGoBtnTxt:{ color: COLORS.black, fontWeight: '800', fontSize: 13 },
  checkCallBanner:{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: '#1d4ed8', borderRadius: R.md, padding: S.lg, marginBottom: S.md, ...shadows.md },
  checkCallTitle: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  checkCallSub:   { color: '#bfdbfe', fontSize: 12 },
  checkCallArrow: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  shiftCard:     { marginBottom: S.lg },
  shiftActive:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  shiftActiveText:{ color: COLORS.ok, fontSize: 15, fontWeight: '700' },
  shiftRow:      { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs },
  shiftSite:     { color: COLORS.textSecondary, fontSize: 13 },
  shiftTime:     { color: COLORS.textMuted, fontSize: 12, marginTop: S.xs },
  punctualityBadge:{ backgroundColor: COLORS.issueBg, borderRadius: R.xs, paddingHorizontal: S.sm, paddingVertical: S.xs, alignSelf: 'flex-start', marginTop: S.sm },
  punctualityText:{ color: COLORS.issue, fontSize: 11, fontWeight: '700' },
  offDutyCard:   { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  offDutyText:   { color: COLORS.textMuted, fontSize: 14 },
  statsRow:      { flexDirection: 'row', gap: S.md, marginBottom: S.lg },
  statCard:      { flex: 1, alignItems: 'center', padding: S.md },
  statValue:     { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  statLabel:     { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  statMissed:    { color: COLORS.missed, fontSize: 10, marginTop: 2 },
  bookBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.md, borderRadius: R.lg, paddingVertical: 16, marginBottom: S.xl, ...shadows.md },
  bookOnBtn:     { backgroundColor: COLORS.ok, ...shadows.brand },
  bookOffBtn:    { backgroundColor: COLORS.missed },
  btnDisabled:   { opacity: 0.6 },
  bookBtnTxt:    { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  section:       { marginBottom: S.xl },
  sectionTitle:  { ...TYPE.label, marginBottom: S.md },
  ccRow:         { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  ccDot:         { width: 8, height: 8, borderRadius: 4 },
  ccTime:        { color: COLORS.textSecondary, fontSize: 13, width: 50 },
  ccStatus:      { color: COLORS.textPrimary, fontSize: 13 },
  // SOS FAB
  sosFabWrap:    { position: 'absolute', bottom: 80, right: S.xl, ...shadows.sos },
  sosFab:        { backgroundColor: COLORS.sos, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  sosFabTxt:     { color: COLORS.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  // Modals
  modalOverlay:  { flex: 1, backgroundColor: COLORS.bgOverlay, justifyContent: 'flex-end' },
  sosModal:      { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.sosBorder, alignItems: 'center', ...shadows.sos },
  sosIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.sosBg, borderWidth: 2, borderColor: COLORS.sosBorder, alignItems: 'center', justifyContent: 'center', marginBottom: S.lg },
  sosModalTitle: { ...TYPE.subtitle, marginBottom: S.sm, textAlign: 'center' },
  sosModalSub:   { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: S.xxl },
  sosConfirmBtn: { width: '100%', backgroundColor: COLORS.sos, borderRadius: R.md, paddingVertical: 16, alignItems: 'center', marginBottom: S.sm },
  sosConfirmBtnTxt:{ color: COLORS.white, fontSize: 16, fontWeight: '800' },
  sosCancelBtn:  { width: '100%', backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 14, alignItems: 'center' },
  sosCancelBtnTxt:{ color: COLORS.textSecondary, fontSize: 14 },
  modalCard:     { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle },
  modalTitle:    { ...TYPE.subtitle, marginBottom: S.sm },
  modalSub:      { color: COLORS.textMuted, fontSize: 14, marginBottom: S.xxl, lineHeight: 22 },
  bookOffConfirm:{ backgroundColor: COLORS.missed, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', marginBottom: S.sm },
  bookOffConfirmTxt:{ color: COLORS.white, fontSize: 16, fontWeight: '800' },
  cancelBtn:     { backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  cancelBtnTxt:  { color: COLORS.textSecondary, fontSize: 14 },
  profileHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
