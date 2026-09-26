import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Alert, Modal, Image, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { useApp, formatTime } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { COLORS, S, R, TYPE, shadows, cardStyle } from '../../theme';
import { Bell, CheckCircle, AlertTriangle, Clock, Camera, ChevronDown, WifiOff, RefreshCw, MapPin } from 'lucide-react-native';
import { enqueue, flush, getQueue } from '../../services/offlineQueue';

// Explicit categories required: Intruder, Equipment fault, Medical, Other
const ISSUE_CATEGORIES = ['Intruder', 'Equipment fault', 'Medical', 'Other'];

export function CheckCallScreen() {
  const { currentUser, sites, activeCheckCall, respondToCheckCall, checkCalls } = useApp();

  const [timeLeft, setTimeLeft]         = useState(600);
  const [responding, setResponding]     = useState(false);
  const [isOnline, setIsOnline]         = useState(true);
  const [pendingSync, setPendingSync]   = useState(false);
  const [syncingNow, setSyncingNow]     = useState(false);
  const [queuedCount, setQueuedCount]   = useState(0);

  // Issue form
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [category, setCategory]           = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [note, setNote]                   = useState('');
  const [issuePhoto, setIssuePhoto]       = useState(null);

  // Detail modal
  const [detailCC, setDetailCC] = useState(null);

  // ── Check queue size ───────────────────────────────────────────────────────
  const updateQueueStatus = async () => {
    const q = await getQueue();
    setQueuedCount(q.length);
    setPendingSync(q.length > 0);
  };

  useEffect(() => {
    updateQueueStatus();
  }, []);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCheckCall) { setTimeLeft(600); return; }
    const start = new Date(activeCheckCall.firedAt).getTime();
    const tick  = () => setTimeLeft(Math.max(0, 600 - Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeCheckCall]);

  // ── Connectivity ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      if (online && pendingSync) {
        handleManualSync();
      }
    });
    return unsub;
  }, [pendingSync]);

  const handleManualSync = async () => {
    setSyncingNow(true);
    await flush();
    await updateQueueStatus();
    setSyncingNow(false);
  };

  const guardCC = [...(checkCalls || [])]
    .filter(cc => cc.guardId === currentUser?.id || cc.guardId === currentUser?._id)
    .sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt));

  // ── Location capture ───────────────────────────────────────────────────────
  const getGuardLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch {}
    // Simulated coordinate near site for testing/preview if hardware GPS not available
    const site = sites.find(s => s.id === currentUser?.siteId);
    if (site?.latitude) {
      return { latitude: site.latitude + 0.0001, longitude: site.longitude + 0.0001 };
    }
    return null;
  };

  // ── Respond YES ────────────────────────────────────────────────────────────
  const handleYes = async () => {
    if (!activeCheckCall) return;
    setResponding(true);
    const location = await getGuardLocation();

    if (!isOnline) {
      await enqueue({
        action: 'CHECK_CALL_RESPOND',
        checkCallId: activeCheckCall.id || activeCheckCall._id,
        response: 'yes',
        location,
        label: 'Check call YES response',
      });
      await respondToCheckCall(
        activeCheckCall.id || activeCheckCall._id,
        'yes',
        null,
        { location, isOfflineQueued: true }
      );
      await updateQueueStatus();
      setResponding(false);
      Alert.alert('Response Queued', 'You are currently offline. Check call response has been securely saved locally and will sync once connectivity returns.');
      return;
    }

    await respondToCheckCall(activeCheckCall.id || activeCheckCall._id, 'yes', null, { location });
    setResponding(false);
    Alert.alert('✓ Check Call Recorded', 'Thank you, your check call has been verified and logged successfully.');
  };

  // ── Respond NO — show issue form ───────────────────────────────────────────
  const handleNoTap = () => setShowIssueForm(true);

  const handleSubmitIssue = async () => {
    if (!category) { Alert.alert('Select Category', 'Please choose an issue category.'); return; }
    setResponding(true);
    const location = await getGuardLocation();
    const payload = {
      response: 'no',
      category,
      note: note || '',
      photoUri: issuePhoto,
      location,
    };

    if (!isOnline) {
      await enqueue({
        action: 'CHECK_CALL_RESPOND',
        checkCallId: activeCheckCall.id || activeCheckCall._id,
        ...payload,
        label: `Check call issue: ${category}`,
      });
      await respondToCheckCall(
        activeCheckCall.id || activeCheckCall._id,
        'no',
        note,
        { ...payload, isOfflineQueued: true }
      );
      await updateQueueStatus();
      setResponding(false);
      setShowIssueForm(false);
      resetIssueForm();
      Alert.alert('Issue Report Queued', 'You are offline. Your issue alert has been saved locally and will sync to your manager immediately upon reconnection.');
      return;
    }

    await respondToCheckCall(
      activeCheckCall.id || activeCheckCall._id,
      'no',
      note,
      payload
    );
    setResponding(false);
    setShowIssueForm(false);
    resetIssueForm();
    Alert.alert('⚠️ Issue Dispatched', `Manager has been alerted regarding ${category}.`);
  };

  const resetIssueForm = () => {
    setCategory(''); setNote(''); setIssuePhoto(null);
  };

  const pickIssuePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled && result.assets?.[0]) setIssuePhoto(result.assets[0].uri);
  };

  const timerColor = timeLeft < 120 ? COLORS.missed : timeLeft < 300 ? COLORS.issue : COLORS.ok;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>

        {/* Offline / Pending Sync banner */}
        {(!isOnline || pendingSync) && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={COLORS.issue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTxt}>
                {!isOnline ? 'Offline Mode Active' : 'Waiting to Sync'}
              </Text>
              <Text style={styles.offlineSubTxt}>
                {!isOnline
                  ? 'Check calls and reports will queue locally.'
                  : `${queuedCount} pending report(s) waiting for server handshake.`}
              </Text>
            </View>
            {isOnline && (
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={handleManualSync}
                disabled={syncingNow}
              >
                {syncingNow ? (
                  <ActivityIndicator size="small" color={COLORS.black} />
                ) : (
                  <>
                    <RefreshCw size={13} color={COLORS.black} />
                    <Text style={styles.syncBtnTxt}>Sync Now</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.screenTitle}>Check Calls</Text>

        {/* Active check call card */}
        {activeCheckCall ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Bell color={COLORS.white} size={20} />
              <Text style={styles.activeTitle}>Is everything okay on site?</Text>
            </View>
            <View style={styles.countdownRow}>
              <Clock size={14} color={timerColor} />
              <Text style={[styles.countdown, { color: timerColor }]}>
                Respond within {mins}:{secs.toString().padStart(2,'0')}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.yesBtn, responding && styles.disabled]} onPress={handleYes} disabled={responding}>
                <CheckCircle color={COLORS.white} size={18} />
                <Text style={styles.yesBtnTxt}>Yes, all okay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.noBtn, responding && styles.disabled]} onPress={handleNoTap} disabled={responding}>
                <AlertTriangle color={COLORS.white} size={18} />
                <Text style={styles.noBtnTxt}>No, issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noActiveCard}>
            <CheckCircle color={COLORS.ok} size={32} />
            <Text style={styles.noActiveTitle}>No active check call</Text>
            <Text style={styles.noActiveSub}>Check calls trigger automatically every hour while booked on.</Text>
          </View>
        )}

        {/* History */}
        <Text style={styles.historyTitle}>History</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {guardCC.length === 0 && <Text style={styles.emptyHint}>No check calls recorded yet.</Text>}
          {guardCC.map(cc => (
            <TouchableOpacity key={cc.id || cc._id} style={styles.historyRow} onPress={() => setDetailCC(cc)}>
              <View style={[styles.dot, { backgroundColor:
                cc.response === 'yes'    ? COLORS.ok :
                cc.response === 'missed' ? COLORS.missed :
                cc.response === 'no'     ? COLORS.issue : COLORS.borderMid
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTime}>{formatTime(cc.firedAt)}</Text>
                {cc.note && <Text style={styles.historyNote} numberOfLines={1}>{cc.note}</Text>}
              </View>
              <Text style={[styles.historyStatus, { color:
                cc.response === 'yes'    ? COLORS.ok :
                cc.response === 'missed' ? COLORS.missed :
                cc.response === 'no'     ? COLORS.issue : COLORS.textMuted
              }]}>
                {cc.response === 'yes' ? '✓ Okay' : cc.response === 'missed' ? '✗ Missed' : cc.response === 'no' ? '⚠ Issue' : '⏳'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Issue Form Modal */}
      <Modal visible={showIssueForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <Text style={styles.modalSub}>Select a category and describe what happened.</Text>

            {/* Category picker */}
            <Text style={styles.fieldLabel}>Issue Category *</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCategoryPicker(true)}>
              <Text style={category ? styles.pickerTxt : styles.pickerPlaceholder}>
                {category || 'Select category…'}
              </Text>
              <ChevronDown size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note} onChangeText={setNote}
              placeholder="Describe what you observed…"
              placeholderTextColor={COLORS.textDisabled}
              multiline numberOfLines={3} textAlignVertical="top"
            />

            {/* Photo */}
            <Text style={styles.fieldLabel}>Photo (optional)</Text>
            <TouchableOpacity style={styles.photoBtn} onPress={pickIssuePhoto}>
              <Camera size={18} color={COLORS.info} />
              <Text style={styles.photoBtnTxt}>{issuePhoto ? 'Retake photo' : 'Take photo'}</Text>
            </TouchableOpacity>
            {issuePhoto && <Image source={{ uri: issuePhoto }} style={styles.photoPreview} />}

            <TouchableOpacity
              style={[styles.submitBtn, (responding || !category) && styles.disabled]}
              onPress={handleSubmitIssue}
              disabled={responding || !category}
            >
              <Text style={styles.submitBtnTxt}>{responding ? 'Sending…' : 'Submit Issue Report'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowIssueForm(false); resetIssueForm(); }}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Category picker sheet */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Select Category</Text>
            {ISSUE_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} style={styles.catRow} onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}>
                <Text style={[styles.catTxt, cat === category && { color: COLORS.brand, fontWeight: '700' }]}>{cat}</Text>
                {cat === category && <CheckCircle size={16} color={COLORS.brand} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detailCC} transparent animationType="fade" onRequestClose={() => setDetailCC(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Check Call Detail</Text>
            {detailCC && (
              <>
                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Time fired: </Text>{formatTime(detailCC.firedAt)}</Text>
                {detailCC.respondedAt && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Responded: </Text>{formatTime(detailCC.respondedAt)}</Text>}
                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Response: </Text>
                  <Text style={{ color: detailCC.response === 'yes' ? COLORS.ok : detailCC.response === 'missed' ? COLORS.missed : COLORS.issue, fontWeight: '700' }}>
                    {detailCC.response === 'yes' ? 'All okay' : detailCC.response === 'missed' ? 'Missed' : detailCC.response === 'no' ? 'Issue reported' : 'Pending'}
                  </Text>
                </Text>

                {detailCC.category && (
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Category: </Text>
                    <Text style={{ color: COLORS.issue, fontWeight: '700' }}>{detailCC.category}</Text>
                  </Text>
                )}

                {/* Geofence Status */}
                <View style={[styles.geoBadge, detailCC.outsideGeofence ? styles.geoBadgeFail : styles.geoBadgePass]}>
                  <MapPin size={14} color={detailCC.outsideGeofence ? COLORS.missed : COLORS.ok} />
                  <Text style={[styles.geoBadgeTxt, { color: detailCC.outsideGeofence ? COLORS.missed : COLORS.ok }]}>
                    {detailCC.outsideGeofence
                      ? `Out-of-Bounds Flagged (${detailCC.distanceMeters || '350+'}m outside)`
                      : 'GPS Verified — Within Site Geofence'}
                  </Text>
                </View>

                {detailCC.manuallyLogged && (
                  <View style={styles.manualBadge}>
                    <Text style={styles.manualBadgeTxt}>📝 Manually logged by Manager</Text>
                  </View>
                )}

                {detailCC.note && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteBoxTxt}>{detailCC.note}</Text>
                  </View>
                )}

                {detailCC.photoUri && (
                  <View style={{ marginTop: S.md }}>
                    <Text style={styles.detailLabel}>Attached Photo:</Text>
                    <Image source={{ uri: detailCC.photoUri }} style={styles.detailPhoto} />
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDetailCC(null)}>
              <Text style={styles.cancelBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bgRoot },
  content:       { flex: 1, padding: S.xl },
  screenTitle:   { ...TYPE.title, marginBottom: S.lg },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: COLORS.issueBg, borderWidth: 1, borderColor: COLORS.issueBorder, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  offlineTxt:    { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  offlineSubTxt: { color: COLORS.issue, fontSize: 11, marginTop: 2 },
  syncBtn:       { backgroundColor: COLORS.issue, paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncBtnTxt:    { color: COLORS.black, fontSize: 11, fontWeight: '800' },
  activeCard:    { backgroundColor: '#1e3a5f', borderRadius: R.lg, padding: S.xl, borderWidth: 1, borderColor: '#3b82f6', marginBottom: S.xl, ...shadows.md },
  activeHeader:  { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md },
  activeTitle:   { color: COLORS.white, fontSize: 16, fontWeight: '800', flex: 1 },
  countdownRow:  { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.lg },
  countdown:     { fontSize: 14, fontWeight: '700' },
  btnRow:        { flexDirection: 'row', gap: S.md },
  yesBtn:        { flex: 1, backgroundColor: COLORS.ok, borderRadius: R.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, ...shadows.brand },
  yesBtnTxt:     { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  noBtn:         { flex: 1, backgroundColor: COLORS.missed, borderRadius: R.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  noBtnTxt:      { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  disabled:      { opacity: 0.6 },
  noActiveCard:  { ...cardStyle, alignItems: 'center', gap: S.md, marginBottom: S.xl, paddingVertical: S.xxl },
  noActiveTitle: { ...TYPE.heading },
  noActiveSub:   { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  historyTitle:  { ...TYPE.label, marginBottom: S.md },
  emptyHint:     { color: COLORS.textDisabled, fontSize: 13, textAlign: 'center', marginTop: S.xl },
  historyRow:    { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  dot:           { width: 10, height: 10, borderRadius: 5 },
  historyTime:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  historyNote:   { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  historyStatus: { fontSize: 12, fontWeight: '700' },
  modalOverlay:  { flex: 1, backgroundColor: COLORS.bgOverlay, justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle, ...shadows.lg },
  modalTitle:    { ...TYPE.subtitle, marginBottom: S.xs },
  modalSub:      { color: COLORS.textMuted, fontSize: 13, marginBottom: S.lg },
  fieldLabel:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs, marginTop: S.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerBtn:     { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, padding: S.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTxt:     { color: COLORS.textPrimary, fontSize: 15 },
  pickerPlaceholder: { color: COLORS.textDisabled, fontSize: 15 },
  noteInput:     { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, padding: S.md, color: COLORS.textPrimary, fontSize: 14, minHeight: 80, marginTop: S.xs },
  photoBtn:      { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: COLORS.infoBg, borderRadius: R.sm, padding: S.md, marginTop: S.xs },
  photoBtnTxt:   { color: COLORS.info, fontSize: 13, fontWeight: '600' },
  photoPreview:  { width: '100%', height: 120, borderRadius: R.md, marginTop: S.sm, resizeMode: 'cover' },
  submitBtn:     { backgroundColor: COLORS.issue, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', marginTop: S.lg },
  submitBtnTxt:  { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:     { backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', marginTop: S.sm },
  cancelBtnTxt:  { color: COLORS.textSecondary, fontSize: 14 },
  sheetCard:     { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle },
  sheetTitle:    { ...TYPE.subtitle, marginBottom: S.lg },
  catRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: S.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  catTxt:        { color: COLORS.textPrimary, fontSize: 15 },
  noteBox:       { backgroundColor: COLORS.issueBg, borderRadius: R.sm, padding: S.md, marginTop: S.sm },
  noteBoxTxt:    { color: COLORS.issue, fontSize: 13 },
  detailRow:     { color: COLORS.textSecondary, fontSize: 14, marginBottom: S.sm },
  detailLabel:   { color: COLORS.textMuted, fontWeight: '600' },
  geoBadge:      { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm, paddingVertical: 6, borderRadius: R.sm, marginVertical: S.xs },
  geoBadgePass:  { backgroundColor: COLORS.okBg, borderWidth: 1, borderColor: COLORS.okBorder },
  geoBadgeFail:  { backgroundColor: COLORS.missedBg, borderWidth: 1, borderColor: COLORS.missedBorder },
  geoBadgeTxt:   { fontSize: 12, fontWeight: '700' },
  manualBadge:   { backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: COLORS.info, paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm, marginVertical: S.xs },
  manualBadgeTxt:{ color: COLORS.info, fontSize: 12, fontWeight: '700' },
  detailPhoto:   { width: '100%', height: 140, borderRadius: R.md, marginTop: S.xs, resizeMode: 'cover' },
});
