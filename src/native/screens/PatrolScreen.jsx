import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { authorizedImageSource } from '../../services/api';
import { useApp, formatTime } from '../../context/AppContext';
import { Camera, CheckCircle2, AlertTriangle, Play, Square, Navigation, ScanLine, Radio, Clock3, ShieldCheck } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, btnPrimary, btnGold, btnDanger } from '../../ds';
import { readNfcTag } from '../../services/nfc';

const formatDuration = (milliseconds) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

export function PatrolScreen() {
  const {
    currentUser, sites, getGuardActiveSession, getSiteCheckpoints, getTodayRoster,
    activePatrol, startPatrol, captureCheckpoint, finishPatrol,
    getPatrolCaptures, getTodayPatrols, antiIdlePrompt, randomPromptLogs,
  } = useApp();

  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [incompleteModal, setIncompleteModal] = useState(null);
  const [workingCheckpoint, setWorkingCheckpoint] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeSession = getGuardActiveSession(currentUser.id);
  const site = sites.find(item => item.id === currentUser.siteId);
  const assignedIds = activePatrol?.assignedCheckpointIds?.length
    ? activePatrol.assignedCheckpointIds
    : getTodayRoster(currentUser.id)?.checkpointIds || [];
  const siteCheckpoints = getSiteCheckpoints(currentUser.siteId);
  const checkpoints = assignedIds.length
    ? siteCheckpoints.filter(checkpoint => assignedIds.includes(checkpoint.id))
    : siteCheckpoints;
  const todayPatrols = getTodayPatrols(currentUser.id);
  const savedCaptures = activePatrol ? getPatrolCaptures(activePatrol.id) : [];
  const captures = savedCaptures.length ? savedCaptures : activePatrol?.captures || [];
  const completedCount = checkpoints.filter(checkpoint => {
    const capture = captures.find(item => item.checkpointId === checkpoint.id);
    return (!checkpoint.required || Boolean(capture?.photoUri)) && (!checkpoint.nfcRequired || Boolean(capture?.nfcVerifiedAt));
  }).length;
  const progress = checkpoints.length > 0 ? completedCount / checkpoints.length : 0;
  const pendingPrompt = useMemo(() => [...(randomPromptLogs || [])].reverse().find(log =>
    !log.responded && !log.managerAlerted && log.sessionId === activeSession?.id
  ), [randomPromptLogs, activeSession?.id]);
  const promptSeconds = pendingPrompt?.expiresAt
    ? Math.max(0, Math.ceil((new Date(pendingPrompt.expiresAt).getTime() - now) / 1000))
    : 10 * 60;
  const patrolDuration = activePatrol?.startedAt
    ? formatDuration(now - new Date(activePatrol.startedAt).getTime())
    : '00:00:00';

  const handleStartPatrol = async () => {
    if (!activeSession) {
      Alert.alert('Book on required', 'Book on before starting a site patrol.');
      return;
    }
    setStarting(true);
    try {
      await startPatrol(currentUser.id, currentUser.siteId, activeSession.id);
    } catch (error) {
      Alert.alert('Could not start patrol', error.message || 'Check your connection and try again.');
    } finally { setStarting(false); }
  };

  const handleCheckpointProof = async (checkpoint, proofType) => {
    setWorkingCheckpoint(checkpoint.id);
    try {
      let photoUri = null;
      let nfcTagId = null;
      if (proofType === 'photo') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') throw new Error('Camera access is required to capture this manager-requested site photo.');
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'], quality: 0.6, allowsEditing: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        photoUri = result.assets[0].uri;
      }
      if (proofType === 'nfc') {
        Alert.alert('Scan assigned NFC card', `Hold the back of your phone against the card at ${checkpoint.name}.`);
        nfcTagId = await readNfcTag();
        const expected = String(checkpoint.nfcTagId || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
        if (!expected || nfcTagId.replace(/[^a-f0-9]/gi, '').toLowerCase() !== expected) {
          throw new Error('This NFC card does not match the checkpoint assigned by your manager.');
        }
      }
      let location = null;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch { /* Evidence remains valid when location is unavailable. */ }
      await captureCheckpoint(activePatrol.id, checkpoint.id, photoUri, nfcTagId, location);
    } catch (error) {
      Alert.alert('Checkpoint not recorded', error.message || 'Please try again.');
    } finally { setWorkingCheckpoint(null); }
  };

  const handleFinishPatrol = async () => {
    setFinishing(true);
    try {
      const result = await finishPatrol(activePatrol.id, false);
      if (result?.incomplete) {
        // Double-check if the guard actually completed all captures on this device
        const reallyMissing = (result.missing || []).filter(id => {
          const capture = captures.find(item => item.checkpointId === id);
          const cp = checkpoints.find(c => c.id === id);
          const photoDone = !cp?.required || Boolean(capture?.photoUri);
          const nfcDone = !cp?.nfcRequired || Boolean(capture?.nfcVerifiedAt);
          return !(photoDone && nfcDone);
        });

        if (reallyMissing.length === 0) {
          // All required captures were taken! Auto-finish so guard is not blocked by server sync timing
          await finishPatrol(activePatrol.id, true);
          Alert.alert('Patrol complete', 'All manager-required checkpoint evidence has been recorded. Your next surprise check may arrive at any time.');
          return;
        }

        const missingNames = reallyMissing
          .map(id => checkpoints.find(checkpoint => checkpoint.id === id)?.name || id)
          .join(', ');
        setIncompleteModal({ patrolId: activePatrol.id, missing: reallyMissing, missingNames });
      } else {
        Alert.alert('Patrol complete', 'All manager-required checkpoint evidence has been recorded. Your next surprise check may arrive at any time.');
      }
    } catch (error) {
      Alert.alert('Could not finish patrol', error.message || 'Check your connection and try again.');
    } finally { setFinishing(false); }
  };

  const handleForceFinish = async () => {
    setIncompleteModal(null);
    setFinishing(true);
    try {
      await finishPatrol(incompleteModal.patrolId, true);
      Alert.alert('Patrol submitted with exceptions', 'Your manager has been notified that required evidence is missing.');
    } catch (error) {
      Alert.alert('Could not finish patrol', error.message || 'Check your connection and try again.');
    } finally { setFinishing(false); }
  };

  const statusColor = patrol => patrol.status === 'complete' ? P.ok : patrol.status === 'incomplete' ? P.warn : P.info;

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>GUARD OPERATIONS</Text>
            <Text style={styles.screenTitle}>Patrol execution</Text>
            <Text style={styles.siteName}>{site?.name || 'No site assigned'}</Text>
          </View>
          <View style={styles.cpCountBadge}>
            <Navigation size={14} color={P.info} />
            <Text style={styles.cpCountTxt}>{checkpoints.length} tasks</Text>
          </View>
        </View>

        {!activeSession && (
          <View style={styles.warnCard}>
            <AlertTriangle color={P.warn} size={18} />
            <Text style={styles.warnTxt}>Book on to your shift before starting a patrol.</Text>
          </View>
        )}

        {(antiIdlePrompt || (pendingPrompt && promptSeconds > 0)) && !activePatrol && (
          <View style={styles.surpriseCard}>
            <View style={styles.surpriseIcon}><Radio color={P.danger} size={21} /></View>
            <View style={styles.surpriseCopy}>
              <Text style={styles.surpriseEyebrow}>SURPRISE PATROL CHECK</Text>
              <Text style={styles.surpriseTitle}>Respond within {Math.floor(promptSeconds / 60)}:{String(promptSeconds % 60).padStart(2, '0')}</Text>
              <Text style={styles.surpriseText}>Start the patrol now. If the response window expires, your manager receives an urgent alert.</Text>
            </View>
          </View>
        )}

        {activePatrol && !activePatrol.finishedAt ? (
          <View style={styles.activeCard}>
            <View style={styles.heroTop}>
              <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveLabel}>PATROL ACTIVE</Text></View>
              <Text style={styles.startedText}>Since {formatTime(activePatrol.startedAt)}</Text>
            </View>
            {/* Show resumed banner so guard knows this is a restored patrol, not auto-started */}
            {activePatrol.resumedFromServer && (
              <View style={styles.resumedBanner}>
                <Radio size={12} color={P.blue} />
                <Text style={styles.resumedTxt}>Patrol in progress — resumed from previous session</Text>
              </View>
            )}
            <View style={styles.timerRow}>
              <View>
                <Text style={styles.timerCaption}>ELAPSED TIME</Text>
                <Text style={styles.timerValue}>{patrolDuration}</Text>
              </View>
              <View style={styles.timerIcon}><Clock3 color={P.blue} size={22} /></View>
            </View>
            <View style={styles.progressHeader}>
              <View><Text style={styles.progressTitle}>Route progress</Text><Text style={styles.progressSub}>{completedCount} of {checkpoints.length} required checkpoints</Text></View>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>

            <View style={styles.taskSectionHeader}>
              <Text style={styles.taskSectionTitle}>Assigned checkpoint tasks</Text>
              <Text style={styles.taskSectionHint}>Evidence is checked before completion</Text>
            </View>
            {checkpoints.length === 0 ? (
              <View style={styles.noTasks}><ShieldCheck color={P.gold} size={22} /><Text style={styles.noTasksTitle}>No checkpoints assigned</Text><Text style={styles.noTasksText}>Ask your manager to add required patrol checkpoints to your shift.</Text></View>
            ) : checkpoints.map((checkpoint, index) => {
              const capture = captures.find(item => item.checkpointId === checkpoint.id);
              const photoDone = !checkpoint.required || Boolean(capture?.photoUri);
              const nfcDone = !checkpoint.nfcRequired || Boolean(capture?.nfcVerifiedAt);
              const complete = photoDone && nfcDone;
              const busy = workingCheckpoint === checkpoint.id;
              return (
                <View key={checkpoint.id} style={[styles.taskCard, complete && styles.taskCardDone]}>
                  <View style={[styles.taskIndex, complete && styles.taskIndexDone]}>
                    {complete ? <CheckCircle2 color={P.ok} size={19} /> : <Text style={styles.taskIndexText}>{String(index + 1).padStart(2, '0')}</Text>}
                  </View>
                  <View style={styles.taskBody}>
                    <Text style={styles.cpName}>{checkpoint.name}</Text>
                    <View style={styles.proofChips}>
                      {checkpoint.nfcRequired && <View style={[styles.proofChip, nfcDone && styles.proofChipDone]}><Radio size={12} color={nfcDone ? P.ok : P.blue} /><Text style={styles.proofChipText}>{nfcDone ? 'NFC verified' : 'NFC tag required'}</Text></View>}
                      {checkpoint.required && <View style={[styles.proofChip, photoDone && styles.proofChipDone]}><Camera size={12} color={photoDone ? P.ok : P.goldDark} /><Text style={styles.proofChipText}>{photoDone ? 'Photo captured' : 'Site photo required'}</Text></View>}
                      {!checkpoint.required && !checkpoint.nfcRequired && <Text style={styles.proofChipText}>Optional checkpoint</Text>}
                    </View>
                    {capture && <Text style={styles.captureMeta}>{capture.photoUri ? 'Photo captured' : ''}{capture.photoUri && capture.nfcVerifiedAt ? '  ·  ' : ''}{capture.nfcVerifiedAt ? 'NFC verified' : ''}  ·  {formatTime(capture.capturedAt)}</Text>}
                  </View>
                  {complete ? (
                    <View style={styles.completeBadge}><CheckCircle2 size={16} color={P.ok} /><Text style={styles.completeText}>Done</Text></View>
                  ) : (
                    <View style={styles.taskActions}>
                      {checkpoint.nfcRequired && !nfcDone && <TouchableOpacity style={[styles.taskAction, styles.nfcAction]} onPress={() => handleCheckpointProof(checkpoint, 'nfc')} disabled={busy}><Radio color={P.white} size={14} /><Text style={styles.taskActionText}>{busy ? 'Wait' : 'Scan NFC'}</Text></TouchableOpacity>}
                      {checkpoint.required && !photoDone && <TouchableOpacity style={styles.taskAction} onPress={() => handleCheckpointProof(checkpoint, 'photo')} disabled={busy}>{busy ? <ActivityIndicator color={P.white} size="small" /> : <Camera color={P.white} size={14} />}<Text style={styles.taskActionText}>{busy ? 'Wait' : 'Photo'}</Text></TouchableOpacity>}
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={[btnDanger, styles.finishButton, finishing && styles.disabled]} onPress={handleFinishPatrol} disabled={finishing}>
              {finishing ? <ActivityIndicator color={P.white} /> : <><Square color={P.white} size={16} /><Text style={styles.finishBtnTxt}>Finish patrol</Text></>}
            </TouchableOpacity>
          </View>
        ) : !activePatrol && activeSession ? (
          <View style={styles.startPanel}>
            <View style={styles.startGlow} />
            <View style={styles.startIcon}><Navigation size={21} color={P.blue} /></View>
            <Text style={styles.startHeading}>{antiIdlePrompt ? 'Surprise patrol requested' : 'Ready to patrol?'}</Text>
            <Text style={styles.startDescription}>Follow your assigned route, scan required NFC cards, and capture the site photos requested by your manager.</Text>
            <View style={styles.startMeta}><View style={styles.metaItem}><Radio size={14} color={P.blue} /><Text style={styles.metaText}>NFC verified</Text></View><View style={styles.metaItem}><Camera size={14} color={P.goldDark} /><Text style={styles.metaText}>Photo evidence</Text></View></View>
            <TouchableOpacity style={[btnPrimary, styles.startBtn, starting && styles.disabled]} onPress={handleStartPatrol} disabled={starting}>
              {starting ? <ActivityIndicator color={P.white} /> : <><Play color={P.white} size={18} /><Text style={styles.startBtnTxt}>{antiIdlePrompt ? 'Respond & start patrol' : 'Start patrol'}</Text></>}
            </TouchableOpacity>
          </View>
        ) : !activePatrol ? (
          <EmptyState variant="compass" title="Your route will appear here" message="Once you book on, start a patrol to follow your manager’s assigned checkpoints." />
        ) : null}

        {todayPatrols.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Today's patrol record</Text>
            {todayPatrols.map(patrol => (
              <View key={patrol.id} style={styles.historyRow}>
                <View style={[styles.histDot, { backgroundColor: statusColor(patrol) }]} />
                <View style={styles.historyCopy}>
                  <Text style={styles.histTime}>{formatTime(patrol.startedAt)}{patrol.finishedAt ? ` – ${formatTime(patrol.finishedAt)}` : ' · In progress'}</Text>
                  {patrol.missingCheckpoints?.length > 0 && <Text style={styles.histMissing}>{patrol.missingCheckpoints.length} required checkpoint(s) missing</Text>}
                </View>
                <Text style={[styles.histStatus, { color: statusColor(patrol) }]}>{patrol.status === 'complete' ? 'Complete' : patrol.status === 'incomplete' ? 'Incomplete' : 'Active'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!incompleteModal} transparent animationType="fade" onRequestClose={() => setIncompleteModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}><AlertTriangle color={P.warn} size={26} /></View>
            <Text style={styles.modalTitle}>Required evidence missing</Text>
            <Text style={styles.modalSub}>These manager-required checkpoints still need proof:{'\n\n'}<Text style={{ color: P.warn, fontWeight: '700' }}>{incompleteModal?.missingNames}</Text>{'\n\n'}Finishing anyway sends an exception alert to your manager.</Text>
            <TouchableOpacity style={[btnGold, styles.modalButton]} onPress={handleForceFinish} disabled={finishing}><Text style={styles.modalForceTxt}>{finishing ? 'Submitting…' : 'Finish with exception'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modalBack} onPress={() => setIncompleteModal(null)}><Text style={styles.modalBackTxt}>Return to checkpoints</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg0 },
  content: { padding: SP.px20, paddingBottom: SP.px40, gap: SP.px16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px4 },
  titleBlock: { flex: 1 },
  eyebrow: { color: P.goldDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  screenTitle: { ...FONT.h2, marginBottom: 2 },
  siteName: { color: P.t3, fontSize: 13 },
  cpCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.infoSubtle, borderRadius: BR.full, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: P.infoBorder },
  cpCountTxt: { color: P.info, fontSize: 11, fontWeight: '800' },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.warnSubtle, borderWidth: 1, borderColor: P.warnBorder, borderRadius: BR.md, padding: SP.px16 },
  warnTxt: { color: P.warnDark, fontSize: 13, flex: 1, fontWeight: '600' },
  surpriseCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: BR.lg, padding: SP.px16, backgroundColor: '#FFF5F5', borderColor: '#FECACA', borderWidth: 1 },
  surpriseIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  surpriseCopy: { flex: 1 },
  surpriseEyebrow: { color: P.red, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  surpriseTitle: { color: '#991B1B', fontSize: 16, fontWeight: '800', marginTop: 3 },
  surpriseText: { color: '#7F1D1D', fontSize: 12, lineHeight: 18, marginTop: 5 },
  activeCard: { ...card, padding: SP.px16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.px16 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: P.okSubtle, borderColor: P.okBorder, borderWidth: 1, borderRadius: BR.full, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok },
  liveLabel: { color: P.okDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  startedText: { color: P.t3, fontSize: 11 },
  timerRow: { padding: SP.px16, borderRadius: BR.md, borderWidth: 1, borderColor: P.blueBorder, backgroundColor: '#F4F8FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.px20 },
  timerCaption: { color: P.t3, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  timerValue: { color: P.t1, fontSize: 31, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 0.5, marginTop: 3 },
  timerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: P.white, borderWidth: 1, borderColor: P.b1, alignItems: 'center', justifyContent: 'center' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressTitle: { color: P.t1, fontSize: 15, fontWeight: '800' },
  progressSub: { color: P.t3, fontSize: 11, marginTop: 3 },
  progressPct: { color: P.okDark, fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 7, backgroundColor: P.b1, borderRadius: 4, overflow: 'hidden', marginBottom: SP.px20 },
  progressFill: { height: 7, backgroundColor: P.ok, borderRadius: 4 },
  taskSectionHeader: { marginBottom: SP.px8 },
  taskSectionTitle: { color: P.t1, fontSize: 15, fontWeight: '800' },
  taskSectionHint: { color: P.t3, fontSize: 11, marginTop: 3 },
  noTasks: { alignItems: 'center', padding: SP.px24, borderRadius: BR.md, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: P.goldBorder, marginBottom: SP.px12 },
  noTasksTitle: { color: P.t1, fontSize: 14, fontWeight: '800', marginTop: 8 },
  noTasksText: { color: P.t3, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: BR.md, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: P.b1, marginBottom: 9 },
  taskCardDone: { backgroundColor: '#F3FBF5', borderColor: P.okBorder },
  taskIndex: { width: 30, height: 30, borderRadius: 10, backgroundColor: P.infoSubtle, alignItems: 'center', justifyContent: 'center' },
  taskIndexDone: { backgroundColor: P.okSubtle },
  taskIndexText: { color: P.info, fontSize: 11, fontWeight: '800' },
  taskBody: { flex: 1 },
  cpName: { color: P.t1, fontSize: 13, fontWeight: '700' },
  proofChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  proofChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.white, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: P.b1 },
  proofChipDone: { backgroundColor: '#F0FDF4', borderColor: P.okBorder },
  proofChipText: { color: P.t2, fontSize: 10, fontWeight: '600' },
  captureMeta: { color: P.okDark, fontSize: 10, fontWeight: '600', marginTop: 6 },
  completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 3 },
  completeText: { color: P.okDark, fontSize: 11, fontWeight: '800' },
  taskAction: { minWidth: 76, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, backgroundColor: P.blue, borderRadius: BR.xs, paddingHorizontal: 9, paddingVertical: 9 },
  taskActions: { alignItems: 'flex-end', gap: 6 },
  nfcAction: { backgroundColor: P.goldDark },
  taskActionText: { color: P.white, fontSize: 11, fontWeight: '800' },
  finishButton: { marginTop: SP.px12 },
  finishBtnTxt: { color: P.white, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  resumedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.blueSubtle, borderRadius: BR.xs, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: P.blueBorder, marginBottom: SP.px12 },
  resumedTxt: { color: P.info, fontSize: 11, fontWeight: '600', flex: 1 },
  startPanel: { ...card, padding: SP.px24, alignItems: 'center', overflow: 'hidden' },
  startGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 100, backgroundColor: P.blueSubtle, top: -100, right: -40 },
  startIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: P.infoSubtle, borderWidth: 1, borderColor: P.infoBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SP.px12 },
  startHeading: { color: P.t1, fontSize: 19, fontWeight: '800' },
  startDescription: { color: P.t3, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  startMeta: { flexDirection: 'row', gap: 18, marginTop: SP.px16, marginBottom: SP.px20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: P.t2, fontSize: 11, fontWeight: '700' },
  startBtn: { width: '100%', marginBottom: 0 },
  startBtnTxt: { color: P.white, fontSize: 15, fontWeight: '800' },
  historySection: { marginTop: SP.px8 },
  historyTitle: { color: P.t3, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: SP.px8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1 },
  histDot: { width: 9, height: 9, borderRadius: 5 },
  historyCopy: { flex: 1 },
  histTime: { color: P.t1, fontSize: 12, fontWeight: '600' },
  histMissing: { color: P.warnDark, fontSize: 10, marginTop: 3 },
  histStatus: { fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', alignItems: 'center', padding: SP.px20 },
  modalCard: { backgroundColor: P.bg2, borderRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, alignItems: 'center', width: '100%', maxWidth: 390, ...SH_TOKENS.lg },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: P.warnSubtle, borderWidth: 1, borderColor: P.warnBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SP.px16 },
  modalTitle: { ...FONT.h3, marginBottom: SP.px8, textAlign: 'center' },
  modalSub: { color: P.t2, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: SP.px20 },
  modalButton: { width: '100%', marginBottom: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  modalForceTxt: { color: P.white, fontSize: 14, fontWeight: '800' },
  modalBack: { width: '100%', backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  modalBackTxt: { color: P.t2, fontSize: 14, fontWeight: '600' },
});
