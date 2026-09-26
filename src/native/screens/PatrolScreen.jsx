import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, Modal, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, formatTime } from '../../context/AppContext';
import { Camera, CheckCircle, AlertTriangle, Play, Square, ChevronRight } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { T } from '../../theme';

export function PatrolScreen() {
  const {
    currentUser, sites, getGuardActiveSession, getSiteCheckpoints,
    activePatrol, startPatrol, captureCheckpoint, finishPatrol,
    getPatrolCaptures, getTodayPatrols, patrolSessions,
  } = useApp();

  const [starting, setStarting]     = useState(false);
  const [finishing, setFinishing]   = useState(false);
  const [incompleteModal, setIncompleteModal] = useState(null);

  const activeSession = getGuardActiveSession(currentUser.id);
  const site = sites.find(s => s.id === currentUser.siteId);
  const checkpoints = getSiteCheckpoints(currentUser.siteId);
  const todayPatrols = getTodayPatrols(currentUser.id);
  const captures = activePatrol ? getPatrolCaptures(activePatrol.id) : [];
  const capturedIds = captures.map(c => c.checkpointId);

  const handleStartPatrol = async () => {
    if (!activeSession) {
      Alert.alert('Not Booked On', 'You must be booked on before starting a patrol.');
      return;
    }
    setStarting(true);
    await startPatrol(currentUser.id, currentUser.siteId, activeSession.id);
    setStarting(false);
  };

  const handleCapturePhoto = async (checkpoint) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required to capture checkpoint photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      await captureCheckpoint(activePatrol.id, checkpoint.id, result.assets[0].uri);
    }
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

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
      <Text style={styles.screenTitle}>Patrol</Text>

      {/* Site info */}
      <View style={styles.siteRow}>
        <Text style={styles.siteName}>{site?.name || 'No site assigned'}</Text>
        <Text style={styles.checkpointCount}>{checkpoints.length} checkpoints</Text>
      </View>

      {!activeSession && (
        <View style={styles.notBookedCard}>
          <AlertTriangle color="#f59e0b" size={20} />
          <Text style={styles.notBookedTxt}>Book on first before starting a patrol.</Text>
        </View>
      )}

      {/* Active Patrol */}
      {activePatrol && !activePatrol.finishedAt ? (
        <View style={styles.activePatrolCard}>
          <View style={styles.activePatrolHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.activePatrolTitle}>Patrol in progress</Text>
            <Text style={styles.activePatrolTime}>Started {formatTime(activePatrol.startedAt)}</Text>
          </View>

          <Text style={styles.progressLabel}>
            {capturedIds.length} / {checkpoints.length} checkpoints captured
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: checkpoints.length > 0
                ? `${Math.round((capturedIds.length / checkpoints.length) * 100)}%`
                : '0%'
            }]} />
          </View>

          <ScrollView style={styles.cpList} showsVerticalScrollIndicator={false}>
            {checkpoints.map(cp => {
              const captured = capturedIds.includes(cp.id);
              const capture  = captures.find(c => c.checkpointId === cp.id);
              return (
                <View key={cp.id} style={styles.cpRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cpName}>{cp.name}</Text>
                    {capture && (
                      <Text style={styles.cpCapturedAt}>Captured at {formatTime(capture.capturedAt)}</Text>
                    )}
                  </View>
                  {captured ? (
                    <View style={styles.capturedBadge}>
                      <CheckCircle color="#10b981" size={18} />
                      {capture?.photoUri && (
                        <Image source={{ uri: capture.photoUri }} style={styles.thumb} />
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.photoBtn} onPress={() => handleCapturePhoto(cp)}>
                      <Camera color="#fff" size={16} />
                      <Text style={styles.photoBtnTxt}>Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.finishBtn, finishing && styles.disabled]}
            onPress={handleFinishPatrol}
            disabled={finishing}
          >
            {finishing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Square color="#fff" size={18} />
                  <Text style={styles.finishBtnTxt}>Finish Patrol</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      ) : !activePatrol && activeSession ? (
        <TouchableOpacity
          style={[styles.startBtn, starting && styles.disabled]}
          onPress={handleStartPatrol}
          disabled={starting}
        >
          {starting
            ? <ActivityIndicator color="#fff" />
            : <>
                <Play color="#fff" size={20} />
                <Text style={styles.startBtnTxt}>Start Patrolling</Text>
              </>
          }
        </TouchableOpacity>
      ) : null}

      {/* Today's patrol history */}
      {todayPatrols.length > 0 && (
        <>
          <Text style={styles.historyTitle}>Today's Patrols</Text>
          <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
            {todayPatrols.map(p => (
              <View key={p.id} style={styles.historyRow}>
                <View style={[styles.dot, {
                  backgroundColor: p.status === 'complete' ? '#10b981' :
                                   p.status === 'incomplete' ? '#f59e0b' : '#64748b'
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyRowTitle}>
                    {formatTime(p.startedAt)}{p.finishedAt ? ` – ${formatTime(p.finishedAt)}` : ' (in progress)'}
                  </Text>
                  {p.missingCheckpoints?.length > 0 && (
                    <Text style={styles.historyMissing}>
                      {p.missingCheckpoints.length} checkpoint(s) missing
                    </Text>
                  )}
                </View>
                <Text style={[styles.historyStatus, {
                  color: p.status === 'complete' ? '#10b981' :
                         p.status === 'incomplete' ? '#f59e0b' : '#64748b'
                }]}>
                  {p.status === 'complete' ? 'Complete' :
                   p.status === 'incomplete' ? 'Incomplete' : 'In progress'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Incomplete patrol modal */}
      <Modal visible={!!incompleteModal} transparent animationType="slide">        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <AlertTriangle color="#f59e0b" size={28} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Missing Checkpoints</Text>
            <Text style={styles.modalSub}>
              The following checkpoints have no photo:{'\n\n'}
              <Text style={{ color: '#f59e0b' }}>{incompleteModal?.missingNames}</Text>
              {'\n\n'}Finish anyway? Your manager will be notified.
            </Text>
            <TouchableOpacity style={styles.modalForce} onPress={handleForceFinish}>
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
  root:        { flex: 1, backgroundColor: T.bgRoot },
  content:     { flex: 1, padding: 20 },
  screenTitle: { color: T.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  siteRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  siteName:    { color: '#94a3b8', fontSize: 14 },
  checkpointCount:{ color: '#64748b', fontSize: 12 },
  notBookedCard:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 12, padding: 14, marginBottom: 16 },
  notBookedTxt:{ color: '#f59e0b', fontSize: 13 },
  activePatrolCard:{ backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', padding: 16, flex: 1 },
  activePatrolHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  activePatrolTitle:{ color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  activePatrolTime:{ color: '#64748b', fontSize: 12 },
  progressLabel:{ color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill:{ height: 6, backgroundColor: '#10b981', borderRadius: 3 },
  cpList:      { flex: 1, marginBottom: 16 },
  cpRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 10 },
  cpName:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  cpCapturedAt:{ color: '#64748b', fontSize: 11, marginTop: 2 },
  capturedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb:       { width: 36, height: 36, borderRadius: 6 },
  photoBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1d4ed8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  photoBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  finishBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14 },
  finishBtnTxt:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  startBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 18, marginBottom: 20 },
  startBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  disabled:    { opacity: 0.6 },
  historyTitle:{ color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  historyScroll:{ maxHeight: 200 },
  historyRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  historyRowTitle:{ color: '#fff', fontSize: 13 },
  historyMissing:{ color: '#f59e0b', fontSize: 11, marginTop: 2 },
  historyStatus:{ fontSize: 12, fontWeight: '700' },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  modalTitle:  { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub:    { color: '#94a3b8', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  modalForce:  { width: '100%', backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalForceTxt:{ color: '#000', fontSize: 15, fontWeight: '800' },
  modalBack:   { width: '100%', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBackTxt:{ color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
