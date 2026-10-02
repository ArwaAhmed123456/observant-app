/**
 * CheckCallScreen — Tactical Command Center
 * Countdown arc ring, issue category + photo, offline queue banner, history.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView,
  ScrollView, Alert, Modal, Image, Animated, Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp, formatTime } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { P, SP, BR, FONT, SH_TOKENS, TAB_H, statusToken } from '../../ds';
import { enqueue } from '../../services/offlineQueue';

const WINDOW_SECS  = 600; // 10 min
const CATEGORIES   = ['Intruder / Suspicious Person', 'Equipment Fault', 'Medical Emergency', 'Fire / Safety Hazard', 'Perimeter Breach', 'Other'];
const RING_R       = 54;
const RING_CIRC    = 2 * Math.PI * RING_R;

export function CheckCallScreen() {
  const { currentUser, activeCheckCall, respondToCheckCall, recordManualGuardCheckCall, checkCalls, shiftSessions } = useApp();

  const [timeLeft, setTimeLeft]           = useState(WINDOW_SECS);
  const [responding, setResponding]       = useState(false);
  const [isOnline, setIsOnline]           = useState(true);
  const [pendingSync, setPendingSync]     = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [category, setCategory]           = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [note, setNote]                   = useState('');
  const [issuePhoto, setIssuePhoto]       = useState(null);
  const [detailCC, setDetailCC]           = useState(null);
  const [successAnim, setSuccessAnim]     = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  const successScale  = useRef(new Animated.Value(0)).current;
  const successOpacity= useRef(new Animated.Value(0)).current;

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCheckCall) { setTimeLeft(WINDOW_SECS); return; }
    const start = new Date(activeCheckCall.firedAt).getTime();
    const tick  = () => setTimeLeft(Math.max(0, WINDOW_SECS - Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeCheckCall]);

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOnline(!!(s.isConnected && s.isInternetReachable)));
    return unsub;
  }, []);

  // ── Success animation ─────────────────────────────────────────────────────
  const showSuccess = () => {
    setSuccessAnim(true);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.delay(1200),
      Animated.timing(successOpacity,   { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setSuccessAnim(false));
  };

  const gId    = currentUser?.id || currentUser?._id;
  const myCCs  = [...(checkCalls||[])].filter(cc => cc.guardId === gId).sort((a,b) => new Date(b.firedAt) - new Date(a.firedAt));

  // Ring arc math
  const progress   = timeLeft / WINDOW_SECS;
  const ringColor  = timeLeft < 120 ? P.danger : timeLeft < 300 ? P.warn : P.ok;
  const strokeDash = RING_CIRC * (1 - progress);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  // ── Respond YES ────────────────────────────────────────────────────────────
  const handleYes = async () => {
    if (!activeCheckCall) {
      setManualSaving(true);
      try { await recordManualGuardCheckCall('yes'); showSuccess(); }
      catch (error) { Alert.alert('Check call not recorded', error.message || 'Please try again.'); }
      finally { setManualSaving(false); }
      return;
    }
    setResponding(true);
    const ccId = activeCheckCall.id || activeCheckCall._id;

    if (!isOnline) {
      await enqueue({ url: `/api/check-calls/${ccId}/respond`, method: 'POST', body: { response: 'yes' }, label: 'Check call YES' });
      setPendingSync(true);
      setResponding(false);
      showSuccess();
      return;
    }
    await respondToCheckCall(ccId, 'yes');
    setResponding(false);
    showSuccess();
  };

  // ── Submit issue ──────────────────────────────────────────────────────────
  const handleSubmitIssue = async () => {
    if (!category) { Alert.alert('Select Category', 'Please choose an issue category before submitting.'); return; }
    // Build note text early so it's available for both manual and automated paths
    const noteText = `[${category}]${note ? ' ' + note : ''}`;
    setResponding(true);
    if (!activeCheckCall) {
      try {
        await recordManualGuardCheckCall('no', noteText, category);
        setShowIssueForm(false);
        resetForm();
        showSuccess();
      } catch (error) {
        Alert.alert('Issue not recorded', error.message || 'Please try again.');
      } finally {
        setResponding(false);
      }
      return;
    }
    const ccId = activeCheckCall.id || activeCheckCall._id;

    if (!isOnline) {
      await enqueue({ url: `/api/check-calls/${ccId}/respond`, method: 'POST', body: { response: 'no', note: noteText }, label: 'Check call issue' });
      setPendingSync(true);
      setResponding(false);
      setShowIssueForm(false);
      resetForm();
      return;
    }
    await respondToCheckCall(ccId, 'no', noteText, { category, photoUri: issuePhoto });
    setResponding(false);
    setShowIssueForm(false);
    resetForm();
  };

  const resetForm = () => { setCategory(''); setNote(''); setIssuePhoto(null); };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera required', 'Enable camera access in your device settings.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (!result.canceled && result.assets?.[0]) setIssuePhoto(result.assets[0].uri);
  };

  return (
    <View style={s.root}>
      <AppHeader title="Check Calls" subtitle={`${myCCs.length} logged today`} />

      {/* Offline / pending sync banner */}
      {(!isOnline || pendingSync) && (
        <View style={s.offlineBanner}>
          <View style={s.offlineStripe} />
          <Text style={s.offlineTxt}>
            {!isOnline
              ? '⚡  No connection — responses queued locally'
              : '⏳  Syncing queued responses…'}
          </Text>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: TAB_H + SP.px32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Active check call ── */}
        {activeCheckCall ? (
          <View style={s.activeCard}>
            <LinearGradient colors={['#1B3A8C', '#0F2060']} style={StyleSheet.absoluteFillObject} />
            <View style={s.activeCardBorderTop} />

            {/* Countdown ring */}
            <View style={s.ringWrap}>
              <Svg width={130} height={130}>
                {/* Track */}
                <Circle cx={65} cy={65} r={RING_R} stroke={P.bg3} strokeWidth={8} fill="none" />
                {/* Progress */}
                <Circle
                  cx={65} cy={65} r={RING_R}
                  stroke={ringColor}
                  strokeWidth={8}
                  fill="none"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={strokeDash}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="65,65"
                />
              </Svg>
              {/* Time text inside ring */}
              <View style={s.ringCenter}>
                <Text style={[s.ringTime, { color: ringColor }]}>
                  {mins}:{secs.toString().padStart(2,'0')}
                </Text>
                <Text style={s.ringLabel}>RESPOND</Text>
              </View>
            </View>

            <Text style={s.activeTitle}>Is everything okay on site?</Text>
            <Text style={s.activeSub}>Respond before the window closes to log this check call.</Text>

            <View style={s.activeButtons}>
              <TouchableOpacity
                style={[s.yesBtn, responding && s.btnDisabled]}
                onPress={handleYes}
                disabled={responding}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[P.ok, P.okDark]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGrad}>
                  <Text style={s.yesTxt}>✓  ALL OKAY</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.noBtn, responding && s.btnDisabled]}
                onPress={() => setShowIssueForm(true)}
                disabled={responding}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[P.warn, P.warnDark]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGrad}>
                  <Text style={s.noTxt}>⚠  REPORT ISSUE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.noActiveCard}>
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <View style={s.noActiveIconWrap}>
              <Text style={s.noActiveIcon}>✓</Text>
            </View>
            <Text style={s.noActiveTitle}>No Active Check Call</Text>
            <Text style={s.noActiveSub}>{shiftSessions.some(session => session.guardId === gId && !session.bookedOffAt)
              ? 'No call is waiting. You can submit this hour’s check call now; otherwise your next automatic call arrives on the hour.'
              : 'Book on to your shift to submit check calls and receive hourly reminders.'}</Text>
            {shiftSessions.some(session => session.guardId === gId && !session.bookedOffAt) && (
              <View style={s.manualActions}>
                <TouchableOpacity style={s.manualOkayBtn} onPress={handleYes} disabled={manualSaving}>
                  <Text style={s.manualOkayTxt}>{manualSaving ? 'RECORDING…' : '✓  EVERYTHING OK'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.manualIssueBtn} onPress={() => setShowIssueForm(true)}>
                  <Text style={s.manualIssueTxt}>REPORT ISSUE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── History ── */}
        <Text style={s.historyTitle}>CALL HISTORY</Text>

        {myCCs.length === 0 && (
          <View style={s.emptyHistory}>
            <Text style={s.emptyHistoryTxt}>No check calls recorded yet this shift.</Text>
          </View>
        )}

        {myCCs.map(cc => {
          const tok = statusToken(cc.response || 'upcoming');
          return (
            <TouchableOpacity key={cc.id||cc._id} style={s.histRow} onPress={() => setDetailCC(cc)} activeOpacity={0.8}>
              <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
              <View style={[s.histAccent, { backgroundColor: tok.color }]} />
              <View style={s.histContent}>
                <View style={s.histTop}>
                  <Text style={s.histTime}>{formatTime(cc.firedAt)}</Text>
                  <View style={[s.histPill, { backgroundColor: tok.bg, borderColor: tok.border }]}>
                    <Text style={[s.histPillTxt, { color: tok.color }]}>
                      {cc.response === 'yes' ? 'OKAY' : cc.response === 'missed' ? 'MISSED' : cc.response === 'no' ? 'ISSUE' : 'PENDING'}
                    </Text>
                  </View>
                </View>
                {cc.note && <Text style={s.histNote} numberOfLines={1}>{cc.note}</Text>}
              </View>
              <Text style={s.histArrow}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Success overlay ── */}
      {successAnim && (
        <Animated.View pointerEvents="none" style={[s.successOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[s.successBadge, { transform: [{ scale: successScale }] }]}>
            <LinearGradient colors={[P.ok, P.okDark]} style={s.successGrad}>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.successTxt}>CHECK CALL RECORDED</Text>
              <Text style={s.successSub}>Thank you — all okay noted.</Text>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Issue Form Modal ── */}
      <Modal visible={showIssueForm} transparent animationType="slide">
        <KeyboardAvoidingView style={s.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={s.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <View style={s.sheetHandle} />
            <View style={s.sheetTitleRow}>
              <View style={s.issueDot} />
              <Text style={s.sheetTitle}>Report an Issue</Text>
            </View>
            <Text style={s.sheetSub}>Describe what you observed. Your manager will be alerted immediately.</Text>

            {/* Category */}
            <Text style={s.fieldLabel}>ISSUE CATEGORY  *</Text>
            <TouchableOpacity style={s.catBtn} onPress={() => setShowCatPicker(true)}>
              <Text style={category ? s.catBtnTxt : s.catBtnPlaceholder}>
                {category || 'Select a category…'}
              </Text>
              <Text style={s.catArrow}>▾</Text>
            </TouchableOpacity>

            {/* Note */}
            <Text style={s.fieldLabel}>NOTES (optional)</Text>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Describe what you observed…"
              placeholderTextColor={P.t4}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Photo */}
            <Text style={s.fieldLabel}>PHOTO (optional)</Text>
            <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
              <Text style={s.photoBtnTxt}>{issuePhoto ? '📷  Retake photo' : '📷  Take photo'}</Text>
            </TouchableOpacity>
            {issuePhoto && (
              <View style={s.photoPreviewWrap}>
                <Image source={{ uri: issuePhoto }} style={s.photoPreview} resizeMode="cover" />
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (!category || responding) && s.btnDisabled]}
              onPress={handleSubmitIssue}
              disabled={!category || responding}
            >
              <LinearGradient colors={[P.warn, P.warnDark]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGrad}>
                <Text style={s.submitTxt}>{responding ? 'SENDING…' : 'SUBMIT ISSUE REPORT'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowIssueForm(false); resetForm(); }}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Category Picker ── */}
      <Modal visible={showCatPicker} transparent animationType="slide">
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <LinearGradient colors={['#FFFFFF', '#F4F6FA']} style={StyleSheet.absoluteFillObject} />
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Category</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.catOption, cat === category && s.catOptionActive]}
                onPress={() => { setCategory(cat); setShowCatPicker(false); }}
              >
                {cat === category && <View style={s.catOptionCheck}><Text style={{ color: P.blue, fontSize: 14 }}>✓</Text></View>}
                <Text style={[s.catOptionTxt, cat === category && { color: P.blueLight }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCatPicker(false)}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal (Tactical Centered HUD) ── */}
      <Modal visible={!!detailCC} transparent animationType="fade" onRequestClose={() => setDetailCC(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.detailCard}>
            {detailCC && (() => {
              const tok = statusToken(detailCC.response || 'upcoming');
              return (
                <>
                  <View style={s.detailCardHeader}>
                    <View style={s.detailHeaderLeft}>
                      <View style={[s.detailDot, { backgroundColor: tok.color }]} />
                      <Text style={s.detailCardTitle}>Check Call Summary</Text>
                    </View>
                    <View style={[s.histPill, { backgroundColor: tok.bg, borderColor: tok.border }]}>
                      <Text style={[s.histPillTxt, { color: tok.color }]}>
                        {detailCC.response === 'yes' ? 'VERIFIED SAFE' : detailCC.response === 'missed' ? 'MISSED SLA' : detailCC.response === 'no' ? 'ISSUE LOGGED' : 'PENDING'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.detailTelemetryBox}>
                    <DetailRow label="Scheduled / Fired" value={formatTime(detailCC.firedAt || detailCC.scheduledFor)} />
                    {detailCC.respondedAt && <DetailRow label="Officer Responded" value={formatTime(detailCC.respondedAt)} />}
                    <DetailRow
                      label="Response Status"
                      value={detailCC.response === 'yes' ? '✓ All okay on site' : detailCC.response === 'missed' ? '✗ Response window expired' : detailCC.response === 'no' ? '⚠️ Issue reported' : 'Awaiting officer response'}
                      valueColor={tok.color}
                    />
                    {detailCC.isManualLog && (
                      <DetailRow label="Submission Mode" value="Direct Officer Check-In" />
                    )}
                  </View>

                  {detailCC.note && (
                    <View style={s.detailNoteBox}>
                      <View style={[s.detailNoteStripe, { backgroundColor: tok.color }]} />
                      <View style={{ flex: 1, padding: SP.px12 }}>
                        <Text style={s.detailNoteLabel}>OFFICER NOTE</Text>
                        <Text style={s.detailNoteTxt}>{detailCC.note}</Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={s.detailCloseBtn} onPress={() => setDetailCC(null)} activeOpacity={0.85}>
                    <Text style={s.detailCloseBtnTxt}>Close Details</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, valueColor }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: P.bg0 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingHorizontal: SP.px16, paddingTop: SP.px16 },

  offlineBanner:   { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  offlineStripe:   { width: 4, alignSelf: 'stretch', backgroundColor: P.warn },
  offlineTxt:      { flex: 1, color: P.warn, fontSize: 12, fontWeight: '600', paddingVertical: SP.px12, paddingHorizontal: SP.px12, backgroundColor: P.warnSubtle },

  // Active card
  activeCard:      { borderRadius: BR.xl, borderWidth: 1, borderColor: P.blueBorder, overflow: 'hidden', marginBottom: SP.px20, padding: SP.px24, alignItems: 'center', ...SH_TOKENS.blue },
  activeCardBorderTop: { height: 3, backgroundColor: P.blue, width: 60, borderRadius: 2, marginBottom: SP.px20 },

  ringWrap:        { position: 'relative', width: 130, height: 130, marginBottom: SP.px16 },
  ringCenter:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringTime:        { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLabel:       { fontSize: 9, fontWeight: '800', color: P.t3, letterSpacing: 1.5, marginTop: 2 },

  activeTitle:     { fontSize: 17, fontWeight: '700', color: P.t1, textAlign: 'center', marginBottom: SP.px8 },
  activeSub:       { fontSize: 13, color: P.t2, textAlign: 'center', lineHeight: 20, marginBottom: SP.px24 },

  activeButtons:   { flexDirection: 'row', gap: SP.px12, width: '100%' },
  yesBtn:          { flex: 1, borderRadius: BR.md, overflow: 'hidden', ...SH_TOKENS.ok },
  noBtn:           { flex: 1, borderRadius: BR.md, overflow: 'hidden', ...SH_TOKENS.warn },
  btnGrad:         { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  yesTxt:          { color: P.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  noTxt:           { color: P.bg0, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  btnDisabled:     { opacity: 0.55 },

  // No active
  noActiveCard:    { borderRadius: BR.xl, borderWidth: 1, borderColor: P.b2, overflow: 'hidden', padding: SP.px32, alignItems: 'center', marginBottom: SP.px20 },
  noActiveIconWrap:{ width: 64, height: 64, borderRadius: 32, backgroundColor: P.okSubtle, borderWidth: 1, borderColor: P.okBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SP.px16 },
  noActiveIcon:    { fontSize: 28, color: P.ok },
  noActiveTitle:   { fontSize: 17, fontWeight: '700', color: P.t1, marginBottom: SP.px8 },
  noActiveSub:     { fontSize: 13, color: P.t3, textAlign: 'center', lineHeight: 20 },
  manualActions:   { flexDirection: 'row', gap: SP.px8, width: '100%', marginTop: SP.px20 },
  manualOkayBtn:   { flex: 1, backgroundColor: P.ok, borderRadius: BR.md, paddingVertical: SP.px14, alignItems: 'center' },
  manualOkayTxt:   { color: P.white, fontSize: 12, fontWeight: '800' },
  manualIssueBtn:  { flex: 1, backgroundColor: P.danger, borderRadius: BR.md, paddingVertical: SP.px14, alignItems: 'center' },
  manualIssueTxt:  { color: P.white, fontSize: 12, fontWeight: '800' },

  // History
  historyTitle:    { fontSize: 9, fontWeight: '800', color: P.t4, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SP.px12 },
  emptyHistory:    { paddingVertical: SP.px24, alignItems: 'center' },
  emptyHistoryTxt: { color: P.t4, fontSize: 13 },

  histRow:         { borderRadius: BR.md, borderWidth: 1, borderColor: P.b2, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', marginBottom: SP.px8, ...SH_TOKENS.xs },
  histAccent:      { width: 4, alignSelf: 'stretch' },
  histContent:     { flex: 1, padding: SP.px16 },
  histTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histTime:        { fontSize: 15, fontWeight: '700', color: P.t1, fontVariant: ['tabular-nums'] },
  histPill:        { borderRadius: BR.xs, paddingHorizontal: SP.px8, paddingVertical: SP.px4, borderWidth: 1 },
  histPillTxt:     { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  histNote:        { fontSize: 12, color: P.t3, marginTop: SP.px4 },
  histArrow:       { color: P.t4, fontSize: 18, paddingRight: SP.px16 },

  // Success overlay
  successOverlay:  { position: 'absolute', top: 82, left: 18, right: 18, alignItems: 'center', zIndex: 100 },
  successBadge:    { borderRadius: BR.xxl, overflow: 'hidden', ...SH_TOKENS.ok },
  successGrad:     { paddingHorizontal: SP.px24, paddingVertical: SP.px16, alignItems: 'center' },
  successIcon:     { fontSize: 48, color: P.white, marginBottom: SP.px12 },
  successTxt:      { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 1 },
  successSub:      { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: SP.px8 },

  // Sheets / Centered Modals
  sheetOverlay:    { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', alignItems: 'center', padding: SP.px16 },
  sheet:           { width: '100%', maxWidth: 400, borderRadius: BR.xl, padding: SP.px20, borderWidth: 1.5, borderColor: P.b3, backgroundColor: P.bg0, overflow: 'hidden', maxHeight: '90%', ...SH_TOKENS.lg },
  sheetHandle:     { display: 'none' },
  sheetTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: SP.px12, marginBottom: SP.px4 },
  issueDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: P.warn },
  sheetTitle:      { fontSize: 18, fontWeight: '800', color: P.t1, marginBottom: SP.px4 },
  sheetSub:        { fontSize: 13, color: P.t3, lineHeight: 20, marginBottom: SP.px16 },
  fieldLabel:      { fontSize: 9, fontWeight: '800', color: P.t4, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SP.px8, marginTop: SP.px12 },

  catBtn:          { backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b2, borderRadius: BR.sm, padding: SP.px16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catBtnTxt:       { color: P.t1, fontSize: 14 },
  catBtnPlaceholder:{ color: P.t4, fontSize: 14 },
  catArrow:        { color: P.t3, fontSize: 14 },

  noteInput:       { backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b2, borderRadius: BR.sm, padding: SP.px16, color: P.t1, fontSize: 14, minHeight: 80 },
  photoBtn:        { backgroundColor: P.infoSubtle, borderWidth: 1, borderColor: P.infoBorder, borderRadius: BR.sm, padding: SP.px16, alignItems: 'center' },
  photoBtnTxt:     { color: P.info, fontSize: 14, fontWeight: '600' },
  photoPreviewWrap:{ marginTop: SP.px8, borderRadius: BR.sm, overflow: 'hidden', borderWidth: 1, borderColor: P.b2 },
  photoPreview:    { width: '100%', height: 160 },

  submitBtn:       { borderRadius: BR.md, overflow: 'hidden', marginTop: SP.px20, ...SH_TOKENS.warn },
  submitTxt:       { color: P.bg0, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
  cancelBtn:       { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', marginTop: SP.px12, borderWidth: 1, borderColor: P.b2 },
  cancelTxt:       { color: P.t2, fontSize: 14 },

  catOption:       { paddingVertical: SP.px16, borderBottomWidth: 1, borderBottomColor: P.b1, flexDirection: 'row', alignItems: 'center', gap: SP.px12 },
  catOptionActive: { borderBottomColor: P.blueBorder },
  catOptionCheck:  { width: 20 },
  catOptionTxt:    { color: P.t1, fontSize: 14, flex: 1 },

  // Detail modal
  modalBackdrop:   { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', alignItems: 'center', padding: SP.px20 },
  detailCard:      { width: '100%', maxWidth: 380, backgroundColor: P.bg2, borderRadius: BR.xl, borderWidth: 1.5, borderColor: P.b3, padding: SP.px20, ...SH_TOKENS.lg },
  detailCardHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px16 },
  detailHeaderLeft:{ flexDirection: 'row', alignItems: 'center', gap: SP.px8 },
  detailDot:       { width: 10, height: 10, borderRadius: 5 },
  detailCardTitle: { fontSize: 16, fontWeight: '800', color: P.t1 },
  detailTelemetryBox:{ backgroundColor: P.bg3, borderRadius: BR.md, borderWidth: 1, borderColor: P.b2, paddingHorizontal: SP.px12, paddingVertical: SP.px4, marginBottom: SP.px12 },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SP.px8, borderBottomWidth: 1, borderBottomColor: P.b1 },
  detailLabel:     { fontSize: 12, color: P.t3, fontWeight: '600' },
  detailValue:     { fontSize: 13, color: P.t1, fontWeight: '700' },
  detailNoteBox:   { flexDirection: 'row', backgroundColor: P.warnSubtle, borderRadius: BR.sm, borderWidth: 1, borderColor: P.warnBorder, overflow: 'hidden', marginBottom: SP.px16 },
  detailNoteStripe:{ width: 4 },
  detailNoteLabel: { fontSize: 9, fontWeight: '800', color: P.warn, letterSpacing: 0.8, marginBottom: 2 },
  detailNoteTxt:   { color: P.t1, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  detailCloseBtn:  { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: P.b2 },
  detailCloseBtnTxt:{ color: P.t1, fontSize: 14, fontWeight: '700' },
});
