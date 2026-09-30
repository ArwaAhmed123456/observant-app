/**
 * GuardHomeScreen — Tactical Command Center
 * Live clock as visual centrepiece with blue glow pulse while on shift.
 * Next-Up card, SOS pulsing FAB, offline indicator.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Modal, Animated, Vibration, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import {
  AlertOctagon, PhoneCall, ShieldCheck, MapPin, Clock,
  Calendar, CheckCircle2, ChevronRight, AlertTriangle, Radio
} from 'lucide-react-native';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import {
  P, SP, BR, FONT, SH_TOKENS, GR, card, SCREEN, TAB_H, statusToken,
} from '../../ds';
import { enqueue } from '../../services/offlineQueue';

export function GuardHomeScreen({ navigation }) {
  const {
    currentUser, sites, logout,
    getGuardActiveSession, bookOn, bookOff,
    getTodayCheckCalls, getTodayPatrols,
    activeCheckCall, shiftEndWarning, setShiftEndWarning,
    antiIdlePrompt,
    rosters, addAlert, checkCalls,
  } = useApp();

  const [now, setNow]                       = useState(new Date());
  const [isOnline, setIsOnline]             = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookOff, setShowBookOff]       = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosLoading, setSosLoading]         = useState(false);
  const [sosSent, setSosSent]               = useState(false);

  // Animations
  const clockGlow   = useRef(new Animated.Value(0)).current;
  const sosPulse    = useRef(new Animated.Value(1)).current;
  const sosShake    = useRef(new Animated.Value(0)).current;
  const checkBanner = useRef(new Animated.Value(0)).current;

  const gId = currentUser?.id || currentUser?._id;
  const activeSession = getGuardActiveSession(gId);
  const site          = sites.find(s => s.id === currentUser?.siteId || s._id === currentUser?.siteId);
  const todayCC       = getTodayCheckCalls(gId);
  const todayPatrols  = getTodayPatrols(gId);
  const completedCC   = todayCC.filter(c => c.response === 'yes').length;
  const missedCC      = todayCC.filter(c => c.response === 'missed').length;
  const donePatrols   = todayPatrols.filter(p => p.finishedAt).length;

  // Today's roster shift
  const dayKeys     = ['sun','mon','tue','wed','thu','fri','sat'];
  const todayKey    = dayKeys[new Date().getDay()];
  const todayRoster = (rosters||[]).find(r => {
    if ((r.guardId !== gId)) return false;
    const diff = (new Date() - new Date(r.weekStartDate)) / 86400000;
    return diff >= 0 && diff < 7 && r.days?.[todayKey];
  });
  const shiftToday = todayRoster?.days?.[todayKey];

  // Next check call time
  const nextCheckCallTime = (() => {
    if (!activeSession) return null;
    const bookedOn = new Date(activeSession.bookedOnAt);
    const msElapsed = Date.now() - bookedOn.getTime();
    const nextMs = Math.ceil(msElapsed / 3600000) * 3600000;
    return new Date(bookedOn.getTime() + nextMs);
  })();

  // ── Clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Clock glow pulse while on shift ──────────────────────────────────────
  useEffect(() => {
    if (!activeSession) { clockGlow.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(clockGlow, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(clockGlow, { toValue: 0.3, duration: 1800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [!!activeSession]);

  // ── SOS FAB pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sosPulse, { toValue: 1.10, duration: 800, useNativeDriver: true }),
        Animated.timing(sosPulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Check call banner slide-in ────────────────────────────────────────────
  useEffect(() => {
    if (activeCheckCall) {
      Animated.spring(checkBanner, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }).start();
    } else {
      Animated.timing(checkBanner, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [!!activeCheckCall]);

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOnline(!!(s.isConnected && s.isInternetReachable)));
    return unsub;
  }, []);

  const handleBookOn = async () => {
    if (!currentUser?.siteId) {
      Alert.alert('No Site Assigned', 'Contact your manager to be assigned to a site.');
      return;
    }
    setBookingLoading(true);
    await bookOn(gId, currentUser.siteId);
    setBookingLoading(false);
  };

  const handleBookOff = async () => {
    if (!activeSession) return;
    setShowBookOff(false);
    setBookingLoading(true);
    await bookOff(activeSession.id || activeSession._id);
    setBookingLoading(false);
  };

  const triggerSosShake = () => {
    sosShake.setValue(0);
    Animated.sequence([
      Animated.timing(sosShake, { toValue: 14, duration: 50, useNativeDriver: true }),
      Animated.timing(sosShake, { toValue: -14, duration: 50, useNativeDriver: true }),
      Animated.timing(sosShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(sosShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(sosShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSos = async () => {
    setShowSosConfirm(false);
    setSosLoading(true);
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    triggerSosShake();

    if (!isOnline) {
      await enqueue({ url: '/api/sos/trigger', method: 'POST', body: { note: 'SOS offline' }, label: 'SOS' });
      setSosLoading(false);
      setSosSent(true);
      return;
    }
    await addAlert?.({
      type: 'sos', siteId: currentUser?.siteId, guardId: gId,
      title: `🚨 SOS — ${currentUser?.name}`,
      message: `URGENT: ${currentUser?.name} (${currentUser?.badgeNumber}) triggered emergency alert.`,
    });
    setSosLoading(false);
    setSosSent(true);
  };

  const greeting = () => {
    const h = now.getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  const glowOpacity = clockGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={s.root}>
      <StatusBar style={showSosConfirm || sosSent ? 'light' : 'dark'} />
      <AppHeader
        right={
          !isOnline ? (
            <View style={s.offlinePill}>
              <View style={s.offlineDot} />
              <Text style={s.offlineTxt}>OFFLINE</Text>
            </View>
          ) : null
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: TAB_H + SP.px64 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting ── */}
        <Text style={s.greeting}>{greeting()}</Text>
        <Text style={s.name}>{currentUser?.name}</Text>
        <Text style={s.badge}>{currentUser?.badgeNumber}  ·  {site?.name || 'No site assigned'}</Text>

        {/* ── LIVE CLOCK (centrepiece) ── */}
        <View style={s.clockWrap}>
          {/* Radial glow — only visible when on shift */}
          <Animated.View style={[s.clockGlowRing, { opacity: glowOpacity }]}>
            <LinearGradient
              colors={['rgba(27,79,190,0.0)', 'rgba(27,79,190,0.30)', 'rgba(27,79,190,0.0)']}
              style={s.clockGlowInner}
            />
          </Animated.View>

          <Text style={[s.clock, activeSession && s.clockActive]}>
            {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
          <Text style={s.clockDate}>{formatDate(now)}</Text>

          {activeSession && (
            <View style={s.onShiftBadge}>
              <View style={s.onShiftDot} />
              <Text style={s.onShiftTxt}>ON SHIFT</Text>
            </View>
          )}
        </View>

        {/* ── Shift end warning ── */}
        {shiftEndWarning && (
          <TouchableOpacity style={s.warnBanner} onPress={() => setShiftEndWarning(false)}>
            <LinearGradient colors={[P.warnSubtle, 'transparent']} style={StyleSheet.absoluteFillObject} />
            <View style={s.warnStripe} />
            <Text style={s.warnTxt}>⏰  Shift ending soon — remember to Book Off.</Text>
          </TouchableOpacity>
        )}

        {/* ── Anti-idle prompt ── */}
        {antiIdlePrompt && activeSession && (
          <View style={s.antiIdleCard}>
            <LinearGradient colors={[P.warnSubtle, 'transparent']} style={StyleSheet.absoluteFillObject} />
            <View style={s.antiIdleLeft}>
              <Text style={s.antiIdleTitle}>Surprise Patrol Check</Text>
              <Text style={s.antiIdleSub}>Start patrolling now to stay ahead of schedule.</Text>
            </View>
            <TouchableOpacity style={s.antiIdleGoBtn} onPress={() => navigation.navigate('Patrol')}>
              <Text style={s.antiIdleGoBtnTxt}>GO →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Active check call banner ── */}
        {activeCheckCall && (
          <Animated.View style={[s.checkCallBanner, {
            transform: [{ scale: checkBanner.interpolate({ inputRange: [0,1], outputRange: [0.95,1] }) }],
            opacity: checkBanner,
          }]}>
            <LinearGradient colors={['#1B3A8C', '#122870']} style={StyleSheet.absoluteFillObject} />
            <View style={s.checkCallPulse} />
            <View style={s.checkCallContent}>
              <Text style={s.checkCallTitle}>CHECK CALL</Text>
              <Text style={s.checkCallSub}>Is everything okay on site? Tap to respond.</Text>
            </View>
            <TouchableOpacity style={s.checkCallArrow} onPress={() => navigation.navigate('Check Call')}>
              <Text style={s.checkCallArrowTxt}>→</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Shift status card ── */}
        {activeSession ? (
          <View style={s.shiftCard}>
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <View style={s.shiftCardInner}>
              <View style={s.shiftRow}>
                <View style={[s.shiftAccent, { backgroundColor: P.ok }]} />
                <View>
                  <Text style={s.shiftLabel}>BOOKED ON</Text>
                  <Text style={s.shiftTime}>{formatTime(activeSession.bookedOnAt)}</Text>
                </View>
              </View>
              {shiftToday && (
                <View style={s.shiftRow}>
                  <View style={[s.shiftAccent, { backgroundColor: P.blue }]} />
                  <View>
                    <Text style={s.shiftLabel}>SCHEDULED</Text>
                    <Text style={s.shiftTime}>{shiftToday.start} – {shiftToday.end}</Text>
                  </View>
                </View>
              )}
              {activeSession.punctuality && !['on_time','unscheduled'].includes(activeSession.punctuality) && (
                <View style={s.punctualityPill}>
                  <Text style={s.punctualityTxt}>⚠  {activeSession.punctuality.replace(/_/g,' ').toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={s.offDutyCard}>
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <Text style={s.offDutyLabel}>CURRENTLY OFF DUTY</Text>
            {shiftToday
              ? <Text style={s.offDutyTime}>Next shift: {shiftToday.start} – {shiftToday.end}</Text>
              : <Text style={s.offDutyTime}>No shift scheduled today</Text>
            }
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          <StatTile
            value={`${completedCC}/${todayCC.length}`}
            label="Check Calls"
            accent={missedCC > 0 ? P.danger : P.ok}
            sub={missedCC > 0 ? `${missedCC} missed` : 'All clear'}
          />
          <StatTile value={donePatrols} label="Patrols Done" accent={P.blue} />
          <StatTile
            value={todayCC.filter(c => c.response === 'no').length}
            label="Issues"
            accent={todayCC.filter(c => c.response === 'no').length > 0 ? P.warn : P.t3}
          />
        </View>

        {/* ── Book On / Book Off CTA ── */}
        <TouchableOpacity
          style={[s.bookBtn, activeSession ? s.bookOffBtn : s.bookOnBtn, bookingLoading && s.btnDisabled]}
          onPress={activeSession ? () => setShowBookOff(true) : handleBookOn}
          disabled={bookingLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={activeSession ? [P.red, P.redDark] : [P.ok, P.okDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.bookBtnGrad}
          >
            <Text style={s.bookBtnTxt}>{activeSession ? 'BOOK OFF DUTY' : 'BOOK ON DUTY'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── NEXT UP OPERATIONS CARD (always populated) ── */}
        <View style={s.nextUpCard}>
          <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
          <View style={s.nextUpAccentLine} />
          {activeSession ? (
            <View style={s.nextUpContent}>
              <View style={s.nextUpHeader}>
                <View style={s.nextUpBadge}>
                  <Radio size={12} color={P.blueLight} />
                  <Text style={s.nextUpBadgeTxt}>NEXT OPERATIONAL EVENT</Text>
                </View>
                <Text style={s.nextUpCountdown}>
                  {nextCheckCallTime ? `Due ${formatTime(nextCheckCallTime)}` : 'On schedule'}
                </Text>
              </View>

              <View style={s.nextUpGrid}>
                <View style={s.nextUpCol}>
                  <View style={s.nextUpIconTitle}>
                    <Clock size={13} color={P.blueLight} />
                    <Text style={s.nextUpLabel}>CHECK CALL</Text>
                  </View>
                  <Text style={s.nextUpValue}>{nextCheckCallTime ? formatTime(nextCheckCallTime) : 'Pending'}</Text>
                  <Text style={s.nextUpSub}>10m response SLA</Text>
                </View>

                <View style={s.nextUpDivider} />

                <View style={s.nextUpCol}>
                  <View style={s.nextUpIconTitle}>
                    <ShieldCheck size={13} color={P.gold} />
                    <Text style={s.nextUpLabel}>PATROL TOUR</Text>
                  </View>
                  <Text style={s.nextUpValue}>
                    {donePatrols === 0 ? 'Now Due' : `~${Math.max(5, 60 - Math.floor((Date.now() - new Date(todayPatrols[todayPatrols.length-1]?.startedAt||Date.now()).getTime()) / 60000))}m`}
                  </Text>
                  <Text style={s.nextUpSub}>{site?.name ? `${site.name.slice(0, 14)}…` : 'Active site'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.nextUpContent}>
              <View style={s.nextUpHeader}>
                <View style={[s.nextUpBadge, { backgroundColor: P.goldSubtle, borderColor: P.goldBorder }]}>
                  <Calendar size={12} color={P.gold} />
                  <Text style={[s.nextUpBadgeTxt, { color: P.gold }]}>NEXT SCHEDULED SHIFT</Text>
                </View>
                <Text style={s.nextUpCountdown}>Standby</Text>
              </View>

              <View style={s.nextUpOffDutyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nextUpValue}>{shiftToday ? `${shiftToday.start} – ${shiftToday.end}` : 'No shift today'}</Text>
                  <Text style={s.nextUpSub}>{site?.name || 'Awaiting site dispatch'}</Text>
                </View>
                <TouchableOpacity
                  style={s.viewRosterBtn}
                  onPress={() => navigation.navigate('Shifts')}
                  activeOpacity={0.8}
                >
                  <Text style={s.viewRosterBtnTxt}>View Roster →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Recent check calls ── */}
        {todayCC.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>TODAY'S OPERATIONS LOG</Text>
              <Text style={s.sectionSubBadge}>{todayCC.length} logged</Text>
            </View>
            {todayCC.slice().reverse().slice(0, 5).map(cc => {
              const tok = statusToken(cc.response || 'upcoming');
              return (
                <View key={cc.id||cc._id} style={s.ccRow}>
                  <View style={[s.ccAccent, { backgroundColor: tok.color }]} />
                  <Text style={s.ccTime}>{formatTime(cc.firedAt)}</Text>
                  <View style={s.ccContent}>
                    <Text style={[s.ccStatus, { color: tok.color }]}>
                      {cc.response === 'yes' ? '✓  All verified safe'
                      : cc.response === 'missed' ? '✗  Missed response SLA'
                      : cc.response === 'no' ? '⚠  Issue reported'
                      : '·  Response pending'}
                    </Text>
                    {cc.note ? <Text style={s.ccNoteText} numberOfLines={1}>{cc.note}</Text> : null}
                  </View>
                  <ChevronRight size={14} color={P.t4} />
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="shield"
            title="Command Operations Standby"
            message="Check calls and patrol verification logs will appear here automatically throughout your shift."
            style={{ marginTop: SP.px16 }}
          />
        )}
      </ScrollView>

      {/* ── SOS Floating Button ── */}
      <Animated.View style={[s.sosFabWrap, { transform: [{ scale: sosPulse }, { translateX: sosShake }] }]}>
        <TouchableOpacity style={s.sosFab} onPress={() => setShowSosConfirm(true)} activeOpacity={0.9}>
          <LinearGradient colors={[P.redLight, P.red]} style={s.sosFabGrad}>
            <AlertOctagon size={24} color={P.white} />
            <Text style={s.sosFabTxt}>SOS</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* ── FULL SCREEN SOS TAKEOVER — CONFIRMATION & TRIGGER ── */}
      <Modal visible={showSosConfirm} transparent={false} animationType="fade">
        <View style={s.sosFullscreen}>
          <LinearGradient
            colors={['#7F111B', '#5A0B12', '#3B070A']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={s.sosTakeoverBody}>
            {/* Pulsing Emergency Beacon */}
            <Animated.View style={{ transform: [{ scale: sosPulse }] }}>
              <View style={s.sosHeroBeacon}>
                <LinearGradient
                  colors={['rgba(255,45,85,0.4)', 'rgba(200,35,44,0.15)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <AlertOctagon size={64} color={P.white} strokeWidth={2.2} />
              </View>
            </Animated.View>

            <Text style={s.sosTakeoverTitle}>EMERGENCY SOS</Text>
            <Text style={s.sosTakeoverSubtitle}>
              IMMEDIATE DURESS & THREAT BROADCAST
            </Text>

            <View style={s.sosTelemetryCard}>
              <View style={s.sosTelemetryRow}>
                <Text style={s.sosTelemetryKey}>OFFICER:</Text>
                <Text style={s.sosTelemetryVal}>{currentUser?.name} ({currentUser?.badgeNumber || 'SG-900'})</Text>
              </View>
              <View style={s.sosTelemetryRow}>
                <Text style={s.sosTelemetryKey}>LOCATION:</Text>
                <Text style={s.sosTelemetryVal}>{site?.name || 'On Site Active Geofence'}</Text>
              </View>
              <View style={s.sosTelemetryRow}>
                <Text style={s.sosTelemetryKey}>ESCALATION:</Text>
                <Text style={[s.sosTelemetryVal, { color: P.redLight }]}>Priority 1 Tactical Dispatch</Text>
              </View>
            </View>

            <Text style={s.sosTakeoverWarning}>
              Triggering this alert will dispatch an immediate high-priority alarm to your operations manager and security monitoring console.
            </Text>

            {/* Big Tactical Trigger Button */}
            <TouchableOpacity
              style={[s.sosTakeoverCta, sosLoading && { opacity: 0.6 }]}
              onPress={handleSos}
              disabled={sosLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FF2D55', '#C8232C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.sosTakeoverCtaGrad}
              >
                <AlertOctagon size={24} color={P.white} />
                <Text style={s.sosTakeoverCtaTxt}>
                  {sosLoading ? 'DISPATCHING ALERT…' : 'TRANSMIT EMERGENCY SOS'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.sosTakeoverCancelBtn}
              onPress={() => setShowSosConfirm(false)}
            >
              <Text style={s.sosTakeoverCancelTxt}>Cancel — I am Safe & Secure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── FULL SCREEN SOS TAKEOVER — "HELP IS ON THE WAY" REASSURANCE STATE ── */}
      <Modal visible={sosSent} transparent={false} animationType="fade">
        <View style={s.sosFullscreen}>
          <LinearGradient
            colors={['#7F111B', '#5A0B12', '#3B070A']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={s.sosTakeoverBody}>
            {/* Pulsing Beacon */}
            <Animated.View style={{ transform: [{ scale: sosPulse }] }}>
              <View style={[s.sosHeroBeacon, { borderColor: P.okBorder }]}>
                <LinearGradient
                  colors={['rgba(34,197,94,0.3)', 'rgba(34,197,94,0.1)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <ShieldCheck size={64} color={P.ok} strokeWidth={2.2} />
              </View>
            </Animated.View>

            <View style={s.reassuranceBadge}>
              <View style={s.reassuranceDot} />
              <Text style={s.reassuranceBadgeTxt}>DISPATCH NOTIFIED & CONFIRMED</Text>
            </View>

            <Text style={s.sosSentHeroTitle}>HELP IS ON THE WAY</Text>
            <Text style={s.sosSentReassurance}>
              Your distress signal has been received at the central operations console. Emergency dispatch protocol has been initiated for your site.
            </Text>

            <View style={s.sosGuidanceCard}>
              <View style={s.sosGuidanceItem}>
                <Text style={s.sosGuidanceNum}>1</Text>
                <Text style={s.sosGuidanceTxt}>Remain in the safest possible position.</Text>
              </View>
              <View style={s.sosGuidanceItem}>
                <Text style={s.sosGuidanceNum}>2</Text>
                <Text style={s.sosGuidanceTxt}>Keep your device powered on and visible.</Text>
              </View>
              <View style={s.sosGuidanceItem}>
                <Text style={s.sosGuidanceNum}>3</Text>
                <Text style={s.sosGuidanceTxt}>Dispatch supervisor will establish voice contact.</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.sosSentResolveBtn}
              onPress={() => setSosSent(false)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[P.ok, P.okDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.sosSentResolveGrad}
              >
                <CheckCircle2 size={20} color={P.white} />
                <Text style={s.sosSentResolveTxt}>ALL CLEAR — I AM SAFE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Book Off Confirm ── */}
      <Modal visible={showBookOff} transparent animationType="slide">
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>End Shift?</Text>
            <Text style={s.sheetSub}>
              Duration: {activeSession ? getShiftDuration(activeSession.bookedOnAt) : '—'}
            </Text>
            <TouchableOpacity style={s.sheetConfirmBtn} onPress={handleBookOff}>
              <LinearGradient colors={[P.red, P.redDark]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.sheetBtnGrad}>
                <Text style={s.sheetBtnTxt}>YES, BOOK OFF</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowBookOff(false)}>
              <Text style={s.sheetCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatTile({ value, label, accent, sub }) {
  return (
    <View style={st.wrap}>
      <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
      <View style={[st.accent, { backgroundColor: accent }]} />
      <Text style={st.value}>{value}</Text>
      <Text style={st.label}>{label}</Text>
      {sub && <Text style={[st.sub, { color: accent }]}>{sub}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  wrap:   { flex: 1, borderRadius: BR.lg, borderWidth: 1, borderColor: P.b2, overflow: 'hidden', paddingTop: SP.px8, paddingHorizontal: SP.px12, paddingBottom: SP.px12, ...SH_TOKENS.xs, position: 'relative' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  value:  { fontSize: 24, fontWeight: '800', color: P.t1, marginTop: SP.px8, fontVariant: ['tabular-nums'] },
  label:  { fontSize: 10, fontWeight: '700', color: P.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 2 },
  sub:    { fontSize: 10, fontWeight: '600', marginTop: 2 },
});

function getShiftDuration(bookedOnAt) {
  const diff = Date.now() - new Date(bookedOnAt).getTime();
  return `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: P.bg0 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingHorizontal: SP.px16, paddingTop: SP.px8 },

  offlinePill:     { flexDirection: 'row', alignItems: 'center', gap: SP.px4, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: BR.full, paddingHorizontal: SP.px8, paddingVertical: SP.px4, borderWidth: 1, borderColor: P.warnBorder },
  offlineDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: P.warn },
  offlineTxt:      { fontSize: 9, fontWeight: '800', color: P.warn, letterSpacing: 0.8 },

  greeting:        { fontSize: 13, color: P.t3, marginTop: SP.px12 },
  name:            { fontSize: 24, fontWeight: '800', color: P.t1, marginTop: 2, letterSpacing: -0.3 },
  badge:           { fontSize: 12, color: P.t3, marginTop: SP.px4, letterSpacing: 0.3 },

  // Live clock
  clockWrap:       { alignItems: 'center', paddingVertical: SP.px24, position: 'relative' },
  clockGlowRing:   { position: 'absolute', width: 280, height: 140, top: 10 },
  clockGlowInner:  { flex: 1, borderRadius: 140 },
  clock:           { fontSize: 52, fontWeight: '800', color: P.t3, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  clockActive:     { color: P.t1 },
  clockDate:       { fontSize: 13, color: P.t3, marginTop: SP.px4, letterSpacing: 0.5 },
  onShiftBadge:    { flexDirection: 'row', alignItems: 'center', gap: SP.px8, backgroundColor: P.okSubtle, borderRadius: BR.full, paddingHorizontal: SP.px12, paddingVertical: SP.px4, borderWidth: 1, borderColor: P.okBorder, marginTop: SP.px12 },
  onShiftDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok },
  onShiftTxt:      { fontSize: 10, fontWeight: '800', color: P.ok, letterSpacing: 1 },

  // Banners
  warnBanner:      { flexDirection: 'row', alignItems: 'center', borderRadius: BR.md, borderWidth: 1, borderColor: P.warnBorder, marginBottom: SP.px12, overflow: 'hidden', paddingVertical: SP.px12 },
  warnStripe:      { width: 4, alignSelf: 'stretch', backgroundColor: P.warn, marginRight: SP.px12 },
  warnTxt:         { color: P.warn, fontSize: 13, fontWeight: '600', flex: 1, paddingRight: SP.px12 },

  antiIdleCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: BR.md, borderWidth: 1, borderColor: P.warnBorder, marginBottom: SP.px12, overflow: 'hidden', padding: SP.px16 },
  antiIdleLeft:    { flex: 1 },
  antiIdleTitle:   { color: P.t1, fontSize: 14, fontWeight: '800' },
  antiIdleSub:     { color: P.t3, fontSize: 12, marginTop: 2 },
  antiIdleGoBtn:   { backgroundColor: P.warn, borderRadius: BR.sm, paddingHorizontal: SP.px16, paddingVertical: SP.px8 },
  antiIdleGoBtnTxt:{ color: P.bg0, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  checkCallBanner: { borderRadius: BR.lg, overflow: 'hidden', marginBottom: SP.px12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: P.blueBorder, ...SH_TOKENS.blue },
  checkCallPulse:  { width: 4, alignSelf: 'stretch', backgroundColor: P.blueLight },
  checkCallContent:{ flex: 1, padding: SP.px16 },
  checkCallTitle:  { fontSize: 12, fontWeight: '800', color: P.gold, letterSpacing: 1.5 },
  checkCallSub:    { fontSize: 13, color: P.t1, marginTop: SP.px4 },
  checkCallArrow:  { paddingHorizontal: SP.px16 },
  checkCallArrowTxt:{ fontSize: 22, color: P.blueLight, fontWeight: '300' },

  // Shift status
  shiftCard:       { borderRadius: BR.lg, borderWidth: 1, borderColor: P.b2, marginBottom: SP.px12, overflow: 'hidden', ...SH_TOKENS.sm },
  shiftCardInner:  { padding: SP.px16, flexDirection: 'row', gap: SP.px24 },
  shiftRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: SP.px12 },
  shiftAccent:     { width: 3, height: '100%', borderRadius: 2, marginTop: 2 },
  shiftLabel:      { fontSize: 9, fontWeight: '800', color: P.t3, letterSpacing: 1, textTransform: 'uppercase' },
  shiftTime:       { fontSize: 16, fontWeight: '700', color: P.t1, marginTop: 2, fontVariant: ['tabular-nums'] },
  punctualityPill: { backgroundColor: P.warnSubtle, borderRadius: BR.xs, paddingHorizontal: SP.px8, paddingVertical: SP.px4, borderWidth: 1, borderColor: P.warnBorder, alignSelf: 'flex-start', marginTop: SP.px8 },
  punctualityTxt:  { color: P.warn, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  offDutyCard:     { borderRadius: BR.lg, borderWidth: 1, borderColor: P.b1, marginBottom: SP.px12, overflow: 'hidden', padding: SP.px16, alignItems: 'center' },
  offDutyLabel:    { fontSize: 11, fontWeight: '800', color: P.t3, letterSpacing: 1.5 },
  offDutyTime:     { fontSize: 14, color: P.t2, marginTop: SP.px4 },

  // Stats
  statsRow:        { flexDirection: 'row', gap: SP.px8, marginBottom: SP.px12 },

  // Next up operations card
  nextUpCard:      { borderRadius: BR.lg, borderWidth: 1, borderColor: P.blueBorder, overflow: 'hidden', marginBottom: SP.px16, ...SH_TOKENS.blue, position: 'relative' },
  nextUpAccentLine:{ height: 2.5, backgroundColor: P.blueLight, width: '100%' },
  nextUpContent:   { padding: SP.px16 },
  nextUpHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px12 },
  nextUpBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.blueSubtle, borderRadius: BR.sm, borderWidth: 1, borderColor: P.blueBorder, paddingHorizontal: SP.px8, paddingVertical: 4 },
  nextUpBadgeTxt:  { fontSize: 10, fontWeight: '800', color: P.blueLight, letterSpacing: 0.8 },
  nextUpCountdown: { fontSize: 11, fontWeight: '700', color: P.t3, letterSpacing: 0.3 },
  nextUpGrid:      { flexDirection: 'row', alignItems: 'center' },
  nextUpCol:       { flex: 1 },
  nextUpIconTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  nextUpLabel:     { fontSize: 10, fontWeight: '700', color: P.t3, letterSpacing: 0.6 },
  nextUpValue:     { fontSize: 18, fontWeight: '800', color: P.t1, fontVariant: ['tabular-nums'] },
  nextUpSub:       { fontSize: 11, color: P.t3, marginTop: 2 },
  nextUpDivider:   { width: 1, height: 36, backgroundColor: P.b2, marginHorizontal: SP.px16 },
  nextUpOffDutyRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.px12 },
  viewRosterBtn:   { backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b3, borderRadius: BR.md, paddingHorizontal: SP.px12, paddingVertical: SP.px8 },
  viewRosterBtnTxt:{ color: P.blueLight, fontSize: 12, fontWeight: '700' },

  // Book button
  bookBtn:         { borderRadius: BR.lg, overflow: 'hidden', marginBottom: SP.px16, ...SH_TOKENS.md },
  bookOnBtn:       {},
  bookOffBtn:      {},
  bookBtnGrad:     { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  bookBtnTxt:      { color: P.white, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  btnDisabled:     { opacity: 0.55 },

  // Recent calls section
  section:         { marginBottom: SP.px24 },
  sectionHeaderRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px12 },
  sectionTitle:    { fontSize: 10, fontWeight: '800', color: P.t3, letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionSubBadge: { fontSize: 11, fontWeight: '600', color: P.t4 },
  ccRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.px12, borderBottomWidth: 1, borderBottomColor: P.b1 },
  ccAccent:        { width: 3, height: 22, borderRadius: 2, marginRight: SP.px12 },
  ccTime:          { fontSize: 13, color: P.t2, width: 56, fontVariant: ['tabular-nums'], fontWeight: '600' },
  ccContent:       { flex: 1, paddingRight: SP.px8 },
  ccStatus:        { fontSize: 13, fontWeight: '600' },
  ccNoteText:      { fontSize: 11, color: P.t3, marginTop: 2, fontStyle: 'italic' },

  // SOS FAB
  sosFabWrap:      { position: 'absolute', bottom: TAB_H + SP.px16, right: SP.px20, ...SH_TOKENS.danger },
  sosFab:          { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  sosFabGrad:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  sosFabTxt:       { color: P.white, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },

  // Fullscreen SOS Takeover
  sosFullscreen:   { flex: 1, backgroundColor: '#5A0B12' },
  sosTakeoverBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SP.px24, paddingVertical: SP.px48 },
  sosHeroBeacon:   { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: P.dangerBorder, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: SP.px24, ...SH_TOKENS.danger },
  sosTakeoverTitle:{ ...FONT.h1, color: P.white, textAlign: 'center', letterSpacing: 2, fontSize: 26 },
  sosTakeoverSubtitle:{ fontSize: 12, fontWeight: '800', color: P.redLight, letterSpacing: 1.5, marginTop: 4, marginBottom: SP.px20 },
  sosTelemetryCard:{ width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: BR.lg, borderWidth: 1, borderColor: P.dangerBorder, padding: SP.px16, marginBottom: SP.px20 },
  sosTelemetryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  sosTelemetryKey: { fontSize: 11, fontWeight: '800', color: P.t3, letterSpacing: 1 },
  sosTelemetryVal: { fontSize: 13, fontWeight: '700', color: P.t1 },
  sosTakeoverWarning:{ fontSize: 13, color: P.t2, textAlign: 'center', lineHeight: 19, marginBottom: SP.px24, paddingHorizontal: SP.px12 },
  sosTakeoverCta:  { width: '100%', borderRadius: BR.md, overflow: 'hidden', marginBottom: SP.px12, ...SH_TOKENS.danger },
  sosTakeoverCtaGrad:{ paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sosTakeoverCtaTxt:{ color: P.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  sosTakeoverCancelBtn:{ width: '100%', backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: P.b3 },
  sosTakeoverCancelTxt:{ color: P.t2, fontSize: 14, fontWeight: '700' },

  // Reassurance State
  reassuranceBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.okSubtle, borderRadius: BR.full, borderWidth: 1, borderColor: P.okBorder, paddingHorizontal: SP.px12, paddingVertical: 6, marginBottom: SP.px16 },
  reassuranceDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: P.ok },
  reassuranceBadgeTxt:{ fontSize: 11, fontWeight: '800', color: P.ok, letterSpacing: 1 },
  sosSentHeroTitle:{ ...FONT.h1, color: P.white, textAlign: 'center', letterSpacing: 1, fontSize: 26, marginBottom: SP.px8 },
  sosSentReassurance:{ fontSize: 14, color: P.t2, textAlign: 'center', lineHeight: 21, marginBottom: SP.px24, paddingHorizontal: SP.px16 },
  sosGuidanceCard: { width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: BR.lg, borderWidth: 1, borderColor: P.b2, padding: SP.px16, marginBottom: SP.px24, gap: SP.px12 },
  sosGuidanceItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sosGuidanceNum:  { width: 24, height: 24, borderRadius: 12, backgroundColor: P.bg3, color: P.gold, fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 24, overflow: 'hidden' },
  sosGuidanceTxt:  { fontSize: 13, color: P.t1, flex: 1 },
  sosSentResolveBtn:{ width: '100%', borderRadius: BR.md, overflow: 'hidden', ...SH_TOKENS.ok },
  sosSentResolveGrad:{ paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sosSentResolveTxt:{ color: P.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  // Sheet (book-off)
  sheetOverlay:    { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  sheet:           { borderTopLeftRadius: BR.xxl, borderTopRightRadius: BR.xxl, padding: SP.px32, borderWidth: 1, borderColor: P.b3, overflow: 'hidden' },
  sheetHandle:     { width: 40, height: 4, backgroundColor: P.b3, borderRadius: 2, alignSelf: 'center', marginBottom: SP.px20 },
  sheetTitle:      { fontSize: 20, fontWeight: '800', color: P.t1, marginBottom: SP.px8 },
  sheetSub:        { fontSize: 14, color: P.t3, marginBottom: SP.px24 },
  sheetConfirmBtn: { borderRadius: BR.md, overflow: 'hidden', marginBottom: SP.px12, ...SH_TOKENS.danger },
  sheetBtnGrad:    { paddingVertical: 15, alignItems: 'center' },
  sheetBtnTxt:     { color: P.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  sheetCancelBtn:  { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: P.b2 },
  sheetCancelTxt:  { color: P.t2, fontSize: 14 },
});
