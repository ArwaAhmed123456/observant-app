import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { authorizedImageSource } from '../../services/api';
import { useApp, formatTime } from '../../context/AppContext';
import { Camera, CheckCircle, AlertTriangle, Play, Square, Navigation, ScanLine, Radio } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, btnPrimary, btnGold, btnDanger } from '../../ds';
import { readNfcTag } from '../../services/nfc';

export function PatrolScreen() {
  const {
    currentUser, sites, getGuardActiveSession, getSiteCheckpoints,
    activePatrol, startPatrol, captureCheckpoint, finishPatrol,
    getPatrolCaptures, getTodayPatrols,
  } = useApp();

  const [starting, setStarting]   = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [incompleteModal, setIncompleteModal] = useState(null);
  const [workingCheckpoint, setWorkingCheckpoint] = useState(null);

  const activeSession = getGuardActiveSession(currentUser.id);
  const site          = sites.find(s => s.id === currentUser.siteId);
  const checkpoints   = getSiteCheckpoints(currentUser.siteId);
  const todayPatrols  = getTodayPatrols(currentUser.id);
  const captures      = activePatrol ? getPatrolCaptures(activePatrol.id) : [];
  const capturedIds   = captures.map(c => c.checkpointId);
  const progress      = checkpoints.length > 0 ? capturedIds.length / checkpoints.length : 0;

  const handleStartPatrol = async () => {
    if (!activeSession) {
      Alert.alert('Not Booked On', 'Book on before starting a patrol.');
      return;
    }
    setStarting(true);
    await startPatrol(currentUser.id, currentUser.siteId, activeSession.id);
    setStarting(false);
  };

  const handleCheckpointProof = async (checkpoint) => {
    setWorkingCheckpoint(checkpoint.id);
    try {
      let photoUri = null;
      let nfcTagId = null;
      if (checkpoint.required) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') throw new Error('Camera access is required to capture this checkpoint photo.');
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false });
        if (result.canceled || !result.assets?.[0]) return;
        photoUri = result.assets[0].uri;
      }
      if (checkpoint.nfcRequired) {
        Alert.alert('Tap checkpoint card', 'Hold the back of your phone against the assigned NFC card.');
        nfcTagId = await readNfcTag();
        const expected = String(checkpoint.nfcTagId || '').toLowerCase();
        if (!expected || nfcTagId.toLowerCase() !== expected) throw new Error('That NFC card does not match this checkpoint. Ask your manager to pair the correct card.');
      }
      await captureCheckpoint(activePatrol.id, checkpoint.id, photoUri, nfcTagId);
    } catch (error) { Alert.alert('Checkpoint not recorded', error.message || 'Please try again.'); }
    finally { setWorkingCheckpoint(null); }
  };

  const handleFinishPatrol = async () => {
    setFinishing(true);
    const result = await finishPatrol(activePatrol.id, false);
    setFinishing(false);
    if (result?.incomplete) {
      const missingNames = result.missing
        .map(id => checkpoints.find(cp => cp.id === id)?.name || id)
        .join(', ');
      setIncompleteModal({ patrolId: activePatrol.id, missing: result.missing, missingNames });
    } else {
      Alert.alert('Patrol Complete', 'All checkpoints captured. Great work!');
    }
  };

  const handleForceFinish = async () => {
    setIncompleteModal(null);
    setFinishing(true);
    await finishPatrol(incompleteModal.patrolId, true);
    setFinishing(false);
    Alert.alert('Patrol Finished', 'Patrol finished with missing checkpoints. Your manager has been notified.');
  };

  const statusDot = (p) => {
    if (p.status === 'complete')   return P.ok;
    if (p.status === 'incomplete') return P.warn;
    return P.info;
  };

  const statusLabel = (p) => {
    if (p.status === 'complete')   return 'Complete';
    if (p.status === 'incomplete') return 'Incomplete';
    return 'In Progress';
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
        {/* Screen header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Patrol</Text>
            <Text style={styles.siteName}>{site?.name || 'No site assigned'}</Text>
          </View>
          <View style={styles.cpCountBadge}>
            <Navigation size={12} color={P.info} />
            <Text style={styles.cpCountTxt}>{checkpoints.length} checkpoints</Text>
          </View>
        </View>

        {/* Not booked on warning */}
        {!activeSession && (
          <View style={styles.warnCard}>
            <AlertTriangle color={P.warn} size={18} />
            <Text style={styles.warnTxt}>Book on first before starting a patrol.</Text>
          </View>
        )}

        {/* Active patrol card */}
        {activePatrol && !activePatrol.finishedAt ? (
          <View style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.activeTitle}>Patrol in Progress</Text>
              <Text style={styles.activeTime}>Started {formatTime(activePatrol.startedAt)}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>
                {capturedIds.length} / {checkpoints.length} checkpoints
              </Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            {/* Checkpoint list */}
            <ScrollView style={styles.cpList} showsVerticalScrollIndicator={false}>
              {checkpoints.map(cp => {
                const captured = capturedIds.includes(cp.id);
                const capture  = captures.find(c => c.checkpointId === cp.id);
                return (
                  <View key={cp.id} style={styles.cpRow}>
                    <View style={[styles.cpOrderDot, { backgroundColor: captured ? P.ok : P.b3 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cpName}>{cp.name}</Text>
                      {capture && (
                        <Text style={styles.cpCapturedAt}>
                          {capture.photoUri ? 'Photo' : ''}{capture.photoUri && capture.nfcVerifiedAt ? ' + ' : ''}{capture.nfcVerifiedAt ? 'NFC' : ''} verified · {formatTime(capture.capturedAt)}
                        </Text>
                      )}
                    </View>
                    {captured ? (
                      <View style={styles.capturedBadge}>
                        <CheckCircle color={P.ok} size={18} />
                        {capture?.photoUri && (
                          <Image source={authorizedImageSource(capture.photoUri)} style={styles.thumb} />
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.photoBtn} onPress={() => handleCheckpointProof(cp)} disabled={workingCheckpoint === cp.id}>
                        {workingCheckpoint === cp.id ? <ActivityIndicator color={P.white} size="small" /> : cp.required && cp.nfcRequired ? <><Camera color={P.white} size={13} /><Radio color={P.white} size={13} /></> : cp.required ? <Camera color={P.white} size={14} /> : <ScanLine color={P.white} size={14} />}
                        <Text style={styles.photoBtnTxt}>{workingCheckpoint === cp.id ? 'Wait' : cp.required && cp.nfcRequired ? 'Verify' : cp.required ? 'Photo' : 'Tap NFC'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[btnDanger, finishing && styles.disabled]}
              onPress={handleFinishPatrol}
              disabled={finishing}
            >
              {finishing
                ? <ActivityIndicator color={P.white} />
                : <>
                    <Square color={P.white} size={16} />
                    <Text style={styles.finishBtnTxt}>Finish Patrol</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        ) : !activePatrol && activeSession ? (
          <TouchableOpacity
            style={[btnPrimary, styles.startBtn, starting && styles.disabled]}
            onPress={handleStartPatrol}
            disabled={starting}
          >
            {starting
              ? <ActivityIndicator color={P.white} />
              : <>
                  <Play color={P.white} size={20} />
                  <Text style={styles.startBtnTxt}>Start Patrol</Text>
                </>
            }
          </TouchableOpacity>
        ) : null}

        {/* Today's patrol history */}
        {todayPatrols.length === 0 && !activePatrol ? (
          <View style={{ marginTop: 24 }}>
            <EmptyState
              variant="compass"
              title="No patrols today"
              message="Start your first patrol tour above to begin recording checkpoints."
            />
          </View>
        ) : (
          todayPatrols.length > 0 && (
            <>
              <Text style={styles.historyTitle}>Today's Patrols</Text>
              <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
                {todayPatrols.map(p => (
                  <View key={p.id} style={styles.historyRow}>
                    <View style={[styles.histDot, { backgroundColor: statusDot(p) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTime}>
                        {formatTime(p.startedAt)}{p.finishedAt ? ` – ${formatTime(p.finishedAt)}` : ' (in progress)'}
                      </Text>
                      {p.missingCheckpoints?.length > 0 && (
                        <Text style={styles.histMissing}>
                          {p.missingCheckpoints.length} checkpoint(s) missing
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.histStatus, { color: statusDot(p) }]}>
                      {statusLabel(p)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )
        )}

        {/* Incomplete patrol modal */}
        <Modal visible={!!incompleteModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconCircle}>
                <AlertTriangle color={P.warn} size={26} />
              </View>
              <Text style={styles.modalTitle}>Missing Checkpoints</Text>
              <Text style={styles.modalSub}>
              These checkpoints are missing required proof:{'\n\n'}
                <Text style={{ color: P.warn }}>{incompleteModal?.missingNames}</Text>
                {'\n\n'}Finishing now will notify your manager.
              </Text>
              <TouchableOpacity style={[btnGold, { width: '100%', marginBottom: 10 }]} onPress={handleForceFinish}>
                <Text style={styles.modalForceTxt}>Finish Anyway</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBack} onPress={() => setIncompleteModal(null)}>
                <Text style={styles.modalBackTxt}>Go Back & Capture</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: P.bg0 },
  content:         { flex: 1, padding: SP.px20 },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SP.px16 },
  screenTitle:     { ...FONT.h2, marginBottom: 2 },
  siteName:        { color: P.t3, fontSize: 13 },
  cpCountBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.infoSubtle, borderRadius: BR.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: P.infoBorder },
  cpCountTxt:      { color: P.info, fontSize: 11, fontWeight: '700' },

  warnCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.warnSubtle, borderWidth: 1, borderColor: P.warnBorder, borderRadius: BR.md, padding: SP.px16, marginBottom: SP.px16 },
  warnTxt:         { color: P.warn, fontSize: 13, flex: 1 },

  activeCard:      { ...card, padding: SP.px16, flex: 1 },
  activeCardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SP.px12 },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: P.ok },
  activeTitle:     { color: P.t1, fontSize: 15, fontWeight: '800', flex: 1 },
  activeTime:      { color: P.t3, fontSize: 12 },

  progressMeta:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:   { color: P.t2, fontSize: 12 },
  progressPct:     { color: P.ok, fontSize: 12, fontWeight: '700' },
  progressTrack:   { height: 5, backgroundColor: P.b2, borderRadius: 3, marginBottom: SP.px16, overflow: 'hidden' },
  progressFill:    { height: 5, backgroundColor: P.ok, borderRadius: 3 },

  cpList:          { flex: 1, marginBottom: SP.px16 },
  cpRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1, gap: 10 },
  cpOrderDot:      { width: 8, height: 8, borderRadius: 4 },
  cpName:          { color: P.t1, fontSize: 14, fontWeight: '600' },
  cpCapturedAt:    { color: P.t3, fontSize: 11, marginTop: 2 },
  capturedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb:           { width: 34, height: 34, borderRadius: BR.xs },
  photoBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.blue, borderRadius: BR.xs, paddingHorizontal: 10, paddingVertical: 7 },
  photoBtnTxt:     { color: P.white, fontSize: 12, fontWeight: '700' },

  finishBtnTxt:    { color: P.white, fontSize: 15, fontWeight: '800' },
  startBtn:        { marginBottom: SP.px20 },
  startBtnTxt:     { color: P.white, fontSize: 17, fontWeight: '800' },
  disabled:        { opacity: 0.6 },

  historyTitle:    { color: P.t3, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: SP.px20, marginBottom: SP.px12 },
  historyScroll:   { maxHeight: 200 },
  historyRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.b1 },
  histDot:         { width: 9, height: 9, borderRadius: 5 },
  histTime:        { color: P.t1, fontSize: 13 },
  histMissing:     { color: P.warn, fontSize: 11, marginTop: 2 },
  histStatus:      { fontSize: 11, fontWeight: '700' },

  modalOverlay:    { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, alignItems: 'center', ...SH_TOKENS.lg },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: P.warnSubtle, borderWidth: 1, borderColor: P.warnBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SP.px16 },
  modalTitle:      { ...FONT.h3, marginBottom: SP.px8 },
  modalSub:        { color: P.t2, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: SP.px24 },
  modalForceTxt:   { color: P.black, fontSize: 15, fontWeight: '800' },
  modalBack:       { width: '100%', backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: P.b2 },
  modalBackTxt:    { color: P.t2, fontSize: 14, fontWeight: '600' },
});
