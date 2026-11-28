import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Modal, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { authorizedImageSource } from '../../services/api';
import { useApp, formatTime, getDistanceFromLatLonInMeters } from '../../context/AppContext';
import { Camera, CheckCircle2, AlertTriangle, Play, Square, Navigation, ScanLine, Radio, Clock3, ShieldCheck, Footprints } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { GuardLogoutButton } from '../components/GuardLogoutButton';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, btnPrimary, btnGold, btnDanger } from '../../ds';
import { readNfcTag } from '../../services/nfc';
import { getWhat3WordsSync } from '../../utils/what3words';

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
  const [exceptionDescription, setExceptionDescription] = useState('');
  const [workingCheckpoint, setWorkingCheckpoint] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [patrolSteps, setPatrolSteps] = useState(0);
  const [patrolDistanceMeters, setPatrolDistanceMeters] = useState(0);

  const initialSensorStepsRef = useRef(null);
  const lastReportedStepsRef = useRef(0);
  const accumulatedGpsDistanceRef = useRef(0);
  const lastGpsCoordRef = useRef(null);
  const patrolStartEpochRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calibrated Footsteps & Ground-Truth Movement Tracking
  useEffect(() => {
    if (!activePatrol || activePatrol.finishedAt) {
      setPatrolSteps(0);
      setPatrolDistanceMeters(0);
      initialSensorStepsRef.current = null;
      lastReportedStepsRef.current = 0;
      accumulatedGpsDistanceRef.current = 0;
      lastGpsCoordRef.current = null;
      patrolStartEpochRef.current = null;
      return;
    }

    const patrolStartTime = activePatrol.startedAt
      ? new Date(activePatrol.startedAt).getTime()
      : Date.now();
    patrolStartEpochRef.current = patrolStartTime;
    initialSensorStepsRef.current = null;
    lastReportedStepsRef.current = 0;
    accumulatedGpsDistanceRef.current = 0;
    lastGpsCoordRef.current = null;

    let isMounted = true;
    let pedometerSub = null;
    let locationSub = null;
    let queryInterval = null;

    (async () => {
      // 1. Hardware Pedometer with baseline offset deduction
      try {
        const Sensors = require('expo-sensors');
        const Pedometer = Sensors?.Pedometer;
        if (Pedometer) {
          const isAvailable = await Pedometer.isAvailableAsync().catch(() => false);
          if (isAvailable) {
            const perm = await Pedometer.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
            if (perm.status === 'granted') {
              // Real-time step counter listener: deduct initial baseline to prevent reporting lifetime/daily device counts
              pedometerSub = Pedometer.watchStepCount(result => {
                if (!isMounted || result?.steps == null) return;
                const raw = result.steps;
                if (initialSensorStepsRef.current === null) {
                  initialSensorStepsRef.current = raw;
                  return;
                }
                const delta = raw - initialSensorStepsRef.current;
                if (delta >= 0) {
                  const elapsedSec = Math.max(1, (Date.now() - (patrolStartEpochRef.current || patrolStartTime)) / 1000);
                  // Plausibility check: human walking speed is max ~3.5 steps/sec (210 steps/min)
                  const maxPossible = Math.ceil(elapsedSec * 3.5);
                  const valid = Math.min(delta, maxPossible);
                  if (valid > lastReportedStepsRef.current) {
                    lastReportedStepsRef.current = valid;
                    setPatrolSteps(valid);
                  }
                }
              });

              // Periodic query for the verified time window (from patrol start until now)
              if (typeof Pedometer.getStepCountAsync === 'function') {
                const pollSteps = async () => {
                  try {
                    const startWindow = new Date(patrolStartEpochRef.current || patrolStartTime);
                    const countRes = await Pedometer.getStepCountAsync(startWindow, new Date());
                    if (isMounted && countRes && typeof countRes.steps === 'number' && countRes.steps >= 0) {
                      const elapsedSec = Math.max(1, (Date.now() - startWindow.getTime()) / 1000);
                      const maxPossible = Math.ceil(elapsedSec * 3.5);
                      const verified = Math.min(countRes.steps, maxPossible);
                      if (verified > lastReportedStepsRef.current) {
                        lastReportedStepsRef.current = verified;
                        setPatrolSteps(verified);
                      }
                    }
                  } catch (_) {}
                };
                pollSteps();
                queryInterval = setInterval(pollSteps, 8000);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[PatrolScreen] Pedometer init warning:', err?.message);
      }

      // 2. High-Accuracy GPS Distance & Movement Verification
      try {
        let locPerm = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (locPerm?.status !== 'granted') {
          locPerm = await Location.requestForegroundPermissionsAsync().catch(() => null);
        }
        if (locPerm?.status === 'granted') {
          locationSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 4,
              timeInterval: 3000,
            },
            position => {
              if (!isMounted || !position?.coords) return;
              const { latitude, longitude, accuracy } = position.coords;
              if (accuracy > 30) return; // filter low-accuracy fixes

              if (lastGpsCoordRef.current) {
                const d = getDistanceFromLatLonInMeters(
                  lastGpsCoordRef.current.latitude,
                  lastGpsCoordRef.current.longitude,
                  latitude,
                  longitude
                );
                // Filter GPS noise (< 2.5m) and extreme teleportation jumps (> 60m in 3s)
                if (d && d >= 2.5 && d <= 60) {
                  accumulatedGpsDistanceRef.current += d;
                  const totalDist = Math.round(accumulatedGpsDistanceRef.current);
                  setPatrolDistanceMeters(totalDist);

                  // Average human stride length is ~0.762m (2.5ft) -> ~1,312 steps/km
                  const gpsEstimatedSteps = Math.round(totalDist / 0.762);

                  // If hardware pedometer is asleep, unsupported, or under-reporting:
                  if (lastReportedStepsRef.current === 0 || lastReportedStepsRef.current < gpsEstimatedSteps * 0.6) {
                    const elapsedSec = Math.max(1, (Date.now() - (patrolStartEpochRef.current || patrolStartTime)) / 1000);
                    const maxPossible = Math.ceil(elapsedSec * 3.5);
                    const safeSteps = Math.min(gpsEstimatedSteps, maxPossible);
                    if (safeSteps > lastReportedStepsRef.current) {
                      lastReportedStepsRef.current = safeSteps;
                      setPatrolSteps(safeSteps);
                    }
                  }
                }
              }
              lastGpsCoordRef.current = { latitude, longitude };
            }
          ).catch(() => null);
        }
      } catch (err) {
        console.warn('[PatrolScreen] GPS movement tracking warning:', err?.message);
      }
    })();

    return () => {
      isMounted = false;
      if (pedometerSub && typeof pedometerSub.remove === 'function') pedometerSub.remove();
      if (locationSub && typeof locationSub.remove === 'function') locationSub.remove();
      if (queryInterval) clearInterval(queryInterval);
    };
  }, [activePatrol?.id]);

  const currentGuardId = currentUser?.id || currentUser?._id;
  const activeSession = getGuardActiveSession(currentGuardId);
  // A patrol is pinned to the site it started at. The active shift or profile
  // site can be empty (or change after a multi-site assignment), so prefer the
  // site stored on the active patrol when rendering its checkpoints.
  const patrolSiteId = activePatrol?.siteId || activeSession?.siteId || currentUser?.siteId;
  const site = (sites || []).find(item => String(item.id || item._id) === String(patrolSiteId));
  const assignedIds = activePatrol
    ? (activePatrol.assignedCheckpointIds || [])
    : (getTodayRoster(currentGuardId, patrolSiteId)?.checkpointIds || []);
  const siteCheckpoints = getSiteCheckpoints(patrolSiteId);
  const assignedSet = new Set((assignedIds || []).map(id => String(id?.id || id?._id || id || '')));
  let checkpoints = assignedSet.size > 0
    ? siteCheckpoints.filter(cp => assignedSet.has(String(cp.id || cp._id || '')))
    : siteCheckpoints;
  // If assignedSet filtered everything out (e.g. outdated IDs from rota or newly added checkpoints), fall back to all site checkpoints!
  if (checkpoints.length === 0 && siteCheckpoints.length > 0) {
    checkpoints = siteCheckpoints;
  }
  const requiredCheckpointCount = checkpoints.length > 0
    ? checkpoints.length
    : siteCheckpoints.length;
  const todayPatrols = getTodayPatrols(currentGuardId);
  const savedCaptures = activePatrol ? getPatrolCaptures(activePatrol.id) : [];
  const captures = savedCaptures.length ? savedCaptures : activePatrol?.captures || [];
  const completedCount = checkpoints.filter(checkpoint => {
    const cpId = String(checkpoint.id || checkpoint._id || '');
    const capture = captures.find(item => {
      const itemCpId = String(item.checkpointId?._id || item.checkpointId?.id || item.checkpointId || '');
      return itemCpId === cpId;
    });
    const hasPhoto = Boolean(capture?.photoUri || capture?.photoUrl || capture?.publicId);
    const hasNfc = Boolean(capture?.nfcVerifiedAt);
    return (!checkpoint.required || hasPhoto) && (!checkpoint.nfcRequired || hasNfc);
  }).length;
  const progress = checkpoints.length > 0 ? completedCount / checkpoints.length : 0;
  const currentHour = new Date(now).getHours();
  const completedThisHour = todayPatrols.some(p => {
    if (!p.finishedAt) return false;
    const d = new Date(p.finishedAt);
    return d.toDateString() === new Date(now).toDateString() && d.getHours() === currentHour;
  });
  const nextHourDate = new Date(now);
  nextHourDate.setHours(currentHour + 1, 0, 0, 0);
  const nextHourStr = nextHourDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    if (!site) {
      Alert.alert('Site assignment required', 'Your active shift has no active site assigned. Ask your manager to assign a site before starting a patrol.');
      return;
    }
    if (!requiredCheckpointCount) {
      Alert.alert('No patrol checkpoints assigned', 'Ask your manager to assign at least one photo or NFC checkpoint to this site and shift before starting a patrol.');
      return;
    }
    setStarting(true);
    try {
      await startPatrol(currentGuardId, activeSession?.siteId || currentUser?.siteId, activeSession?.id);
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
        if (status !== 'granted') throw new Error('Camera access is required to capture site photos. Please enable Camera permissions in iOS Settings.');
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.6, allowsEditing: false,
        });
        if (result.canceled || !result.assets?.[0]) return;
        photoUri = result.assets[0].uri;
      }
      if (proofType === 'nfc') {
        nfcTagId = await readNfcTag({ promptTitle: `Checkpoint: ${checkpoint.name}` });
        const expected = String(checkpoint.nfcTagId || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
        const scanned = String(nfcTagId || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
        if (expected && scanned && scanned !== expected) {
          throw new Error('This NFC card does not match the checkpoint assigned by your manager.');
        }
      }
      let location = null;
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude != null ? Math.round(position.coords.altitude * 10) / 10 : null,
            accuracy: position.coords.accuracy != null ? Math.round(position.coords.accuracy) : null,
            what3words: getWhat3WordsSync(position.coords.latitude, position.coords.longitude),
          };
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
      const result = await finishPatrol(activePatrol.id, false, '', patrolSteps);
      if (result?.incomplete) {
        // Double-check if the guard actually completed all captures on this device
        const proofCaptures = result.serverAuthoritative ? (result.patrol?.captures || []) : captures;
        const reallyMissing = (result.missing || []).filter(id => {
          const capture = proofCaptures.find(item => String(item.checkpointId?._id || item.checkpointId?.id || item.checkpointId || '') === String(id));
          const cp = checkpoints.find(c => String(c.id || c._id) === String(id));
          if (!cp) return true;
          const photoDone = !cp?.required || Boolean(capture?.photoUri || capture?.photoUrl || capture?.publicId);
          const nfcDone = !cp?.nfcRequired || Boolean(capture?.nfcVerifiedAt);
          return !(photoDone && nfcDone);
        });

        const serverNames = new Map((result.missing || []).map((id, index) => [String(id), result.missingNames?.[index]]));
        const missingNames = reallyMissing.length
          ? reallyMissing.map(id => checkpoints.find(checkpoint => String(checkpoint.id || checkpoint._id) === String(id))?.name || serverNames.get(String(id)) || 'Assigned checkpoint').join(', ')
          : result.missingNames?.join(', ') || 'The server could not verify one or more checkpoint records.';
        setExceptionDescription('');
        setIncompleteModal({ patrolId: activePatrol.id, missing: reallyMissing.length ? reallyMissing : result.missing || [], missingNames });
      } else {
        Alert.alert('Patrol complete', `All manager-required checkpoint evidence has been recorded.${patrolSteps > 0 ? ` Total footsteps recorded: ${patrolSteps.toLocaleString()}${patrolDistanceMeters > 0 ? ` (${patrolDistanceMeters}m walked)` : ''}.` : ''} Your next surprise check may arrive at any time.`);
      }
    } catch (error) {
      Alert.alert('Could not finish patrol', error.message || 'Check your connection and try again.');
    } finally { setFinishing(false); }
  };

  const handleForceFinish = async () => {
    const description = exceptionDescription.trim();
    if (description.length < 5) {
      Alert.alert('Description required', 'Explain why the required checkpoint evidence is missing (at least 5 characters).');
      return;
    }
    setIncompleteModal(null);
    setFinishing(true);
    try {
      await finishPatrol(incompleteModal.patrolId, true, description, patrolSteps);
      setExceptionDescription('');
      Alert.alert('Patrol submitted with exceptions', 'Your manager has been notified that required evidence is missing.');
    } catch (error) {
      Alert.alert('Could not finish patrol', error.message || 'Check your connection and try again.');
    } finally { setFinishing(false); }
  };

  const statusColor = patrol => patrol.status === 'complete' ? P.ok : patrol.status === 'incomplete' ? P.warn : P.info;

  return (
    <View style={styles.root}>
      <AppHeader right={<GuardLogoutButton />} />
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

        {(!activeSession || !site) && (
          <View style={styles.warnCard}>
            <AlertTriangle color={P.warn} size={18} />
            <Text style={styles.warnTxt}>{!activeSession ? 'Book on to your shift before starting a patrol.' : 'Your active shift has no active site assignment. Ask your manager to assign a site.'}</Text>
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

            {activePatrol && !activePatrol.finishedAt && (
              <View style={styles.stepsCard}>
                <View style={styles.stepsCardLeft}>
                  <View style={styles.stepsIconBadge}>
                    <Footprints size={20} color={P.ok} />
                  </View>
                  <View>
                    <Text style={styles.stepsLabel}>PATROL FOOTSTEPS</Text>
                    <Text style={styles.stepsValue}>
                      {patrolSteps.toLocaleString()} <Text style={styles.stepsUnit}>steps</Text>
                      {patrolDistanceMeters > 0 && (
                        <Text style={styles.stepsSubUnit}> · {patrolDistanceMeters >= 1000 ? `${(patrolDistanceMeters / 1000).toFixed(2)} km` : `${patrolDistanceMeters} m`}</Text>
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.stepsStatusBadge}>
                  <View style={styles.stepsLiveDot} />
                  <Text style={styles.stepsStatusText}>LIVE TRACKING</Text>
                </View>
              </View>
            )}
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
              <View style={styles.noTasks}><ShieldCheck color={P.gold} size={22} /><Text style={styles.noTasksTitle}>No checkpoints assigned to this patrol</Text><Text style={styles.noTasksText}>This patrol has no assigned evidence tasks. New patrols are blocked until a site and required checkpoints are assigned.</Text></View>
            ) : checkpoints.map((checkpoint, index) => {
              const cpId = String(checkpoint.id || checkpoint._id || '');
              const capture = captures.find(item => {
                const itemCpId = String(item.checkpointId?._id || item.checkpointId?.id || item.checkpointId || '');
                return itemCpId === cpId;
              });
              const hasPhoto = Boolean(capture?.photoUri || capture?.photoUrl || capture?.publicId);
              const hasNfc = Boolean(capture?.nfcVerifiedAt);
              const photoSatisfied = !checkpoint.required || hasPhoto;
              const nfcSatisfied = !checkpoint.nfcRequired || hasNfc;
              const complete = photoSatisfied && nfcSatisfied;
              const busy = workingCheckpoint === checkpoint.id;
              return (
                <View key={checkpoint.id || checkpoint._id || index} style={[styles.taskCard, complete && styles.taskCardDone]}>
                  <View style={styles.taskMainRow}>
                    <View style={[styles.taskIndex, complete && styles.taskIndexDone]}>
                      {complete ? <CheckCircle2 color={P.ok} size={19} /> : <Text style={styles.taskIndexText}>{String(index + 1).padStart(2, '0')}</Text>}
                    </View>
                    <View style={styles.taskBody}>
                      <Text style={styles.cpName}>{checkpoint.name}</Text>
                      <View style={styles.proofChips}>
                        {checkpoint.nfcRequired && (
                          <View style={[styles.proofChip, hasNfc && styles.proofChipDone]}>
                            <Radio size={12} color={hasNfc ? P.ok : P.blue} />
                            <Text style={styles.proofChipText}>{hasNfc ? 'NFC verified' : 'NFC tag required'}</Text>
                          </View>
                        )}
                        <View style={[styles.proofChip, hasPhoto && styles.proofChipDone]}>
                          <Camera size={12} color={hasPhoto ? P.ok : checkpoint.required ? P.goldDark : P.t3} />
                          <Text style={styles.proofChipText}>
                            {hasPhoto ? 'Photo captured' : checkpoint.required ? 'Photo required' : 'Photo option'}
                          </Text>
                        </View>
                      </View>
                      {capture && (
                        <Text style={styles.captureMeta}>
                          {capture.photoUri ? 'Photo captured' : ''}{capture.photoUri && capture.nfcVerifiedAt ? ' · ' : ''}{capture.nfcVerifiedAt ? 'NFC verified' : ''} · {formatTime(capture.capturedAt)}
                          {capture.what3words ? ` · ${capture.what3words}` : ''}
                          {capture.altitude != null ? ` · Alt: ${Math.round(capture.altitude)}m` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.taskActions}>
                    {checkpoint.nfcRequired && !hasNfc && (
                      <TouchableOpacity style={[styles.taskAction, styles.nfcAction]} onPress={() => handleCheckpointProof(checkpoint, 'nfc')} disabled={busy}>
                        <Radio color={P.white} size={14} />
                        <Text style={styles.taskActionText}>{busy ? 'Wait' : 'Scan NFC'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.taskAction, hasPhoto && styles.taskActionDone]}
                      onPress={() => handleCheckpointProof(checkpoint, 'photo')}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator color={P.white} size="small" /> : <Camera color={P.white} size={14} />}
                      <Text style={styles.taskActionText}>{busy ? 'Wait' : hasPhoto ? 'Retake' : 'Photo'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={[btnDanger, styles.finishButton, finishing && styles.disabled]} onPress={handleFinishPatrol} disabled={finishing}>
              {finishing ? <ActivityIndicator color={P.white} /> : <><Square color={P.white} size={16} /><Text style={styles.finishBtnTxt}>Finish patrol</Text></>}
            </TouchableOpacity>
          </View>
        ) : !activePatrol && activeSession && (!site || requiredCheckpointCount === 0) ? (
          <View style={styles.warnCard}>
            <AlertTriangle color={P.warn} size={18} />
            <Text style={styles.warnTxt}>{!site ? 'No active site is assigned to this shift. Ask your manager to fix the site assignment.' : 'No required photo or NFC checkpoints are assigned. Ask your manager to configure the patrol route first.'}</Text>
          </View>
        ) : !activePatrol && activeSession ? (
          <View style={styles.startPanel}>
            <View style={styles.startGlow} />
            <View style={styles.startIcon}><Navigation size={21} color={P.blue} /></View>
            <Text style={styles.startHeading}>{antiIdlePrompt ? 'Surprise patrol requested' : 'Ready to patrol?'}</Text>
            <View style={[styles.hourlyScheduleBadge, completedThisHour && styles.hourlyScheduleDone]}>
              <Clock3 size={13} color={completedThisHour ? P.ok : P.gold} />
              <Text style={[styles.hourlyScheduleTxt, completedThisHour && styles.hourlyScheduleTxtDone]}>
                {completedThisHour
                  ? `Current hour complete · Next patrol starts at ${nextHourStr}`
                  : `Hourly patrol due for current hour (${String(currentHour).padStart(2, '0')}:00 – ${nextHourStr})`}
              </Text>
            </View>
            <Text style={styles.startDescription}>Follow your assigned route, scan required NFC cards, and capture the site photos requested by your manager.</Text>
            <View style={styles.startMeta}><View style={styles.metaItem}><Radio size={14} color={P.blue} /><Text style={styles.metaText}>NFC verified</Text></View><View style={styles.metaItem}><Camera size={14} color={P.goldDark} /><Text style={styles.metaText}>Photo evidence</Text></View></View>

            {checkpoints.length > 0 && (
              <View style={styles.previewRouteCard}>
                <Text style={styles.previewRouteTitle}>Assigned checkpoints ({checkpoints.length})</Text>
                {checkpoints.map((cp, idx) => (
                  <View key={cp.id || cp._id || idx} style={styles.previewRouteItem}>
                    <Text style={styles.previewRouteIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                    <Text style={styles.previewRouteTxt}>{cp.name}</Text>
                    <View style={styles.previewRouteIcons}>
                      <Camera size={12} color={cp.required ? P.goldDark : P.t3} />
                      {cp.nfcRequired && <Radio size={12} color={P.blue} />}
                    </View>
                  </View>
                ))}
              </View>
            )}

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
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}><AlertTriangle color={P.warn} size={26} /></View>
            <Text style={styles.modalTitle}>Required evidence missing</Text>
            <Text style={styles.modalSub}>These manager-required checkpoints still need proof:{'\n\n'}<Text style={{ color: P.warn, fontWeight: '700' }}>{incompleteModal?.missingNames}</Text>{'\n\n'}Explain why evidence is missing. This note will be included in the manager alert.</Text>
            <TextInput
              style={styles.exceptionInput}
              value={exceptionDescription}
              onChangeText={setExceptionDescription}
              placeholder="Describe the issue (required)"
              placeholderTextColor={P.t3}
              multiline
              maxLength={500}
              textAlignVertical="top"
              returnKeyType="default"
            />
            <Text style={styles.exceptionCounter}>{exceptionDescription.trim().length}/500 · minimum 5 characters</Text>
            <TouchableOpacity style={[btnGold, styles.modalButton]} onPress={handleForceFinish} disabled={finishing}><Text style={styles.modalForceTxt}>{finishing ? 'Submitting…' : 'Finish with exception'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modalBack} onPress={() => setIncompleteModal(null)}><Text style={styles.modalBackTxt}>Return to checkpoints</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  stepsCard: { padding: SP.px14, borderRadius: BR.md, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.px20 },
  stepsCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepsIconBadge: { width: 42, height: 42, borderRadius: 13, backgroundColor: P.white, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center' },
  stepsLabel: { color: '#065F46', fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  stepsValue: { color: '#064E3B', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  stepsUnit: { fontSize: 13, fontWeight: '700', color: '#047857' },
  stepsSubUnit: { fontSize: 12, fontWeight: '700', color: '#047857' },
  stepsStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.white, paddingHorizontal: 9, paddingVertical: 5, borderRadius: BR.sm, borderWidth: 1, borderColor: '#A7F3D0' },
  stepsLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok },
  stepsStatusText: { color: '#065F46', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
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
  taskCard: { gap: 10, padding: 12, borderRadius: BR.md, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: P.b1, marginBottom: 9 },
  taskCardDone: { backgroundColor: '#F3FBF5', borderColor: P.okBorder },
  taskMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  taskActionDone: { backgroundColor: '#059669' },
  taskActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, paddingLeft: 40 },
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
  hourlyScheduleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.goldSubtle, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BR.full, borderWidth: 1, borderColor: P.goldBorder, marginTop: 8 },
  hourlyScheduleDone: { backgroundColor: P.okSubtle, borderColor: P.okBorder },
  hourlyScheduleTxt: { color: P.goldDark, fontSize: 11, fontWeight: '700' },
  hourlyScheduleTxtDone: { color: P.ok },
  startDescription: { color: P.t3, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  startMeta: { flexDirection: 'row', gap: 18, marginTop: SP.px16, marginBottom: SP.px16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: P.t2, fontSize: 11, fontWeight: '700' },
  previewRouteCard: { width: '100%', backgroundColor: P.bg2, borderRadius: BR.md, padding: SP.px12, borderWidth: 1, borderColor: P.b1, marginBottom: SP.px16 },
  previewRouteTitle: { color: P.t3, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  previewRouteItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: P.b1 },
  previewRouteIdx: { color: P.info, fontSize: 10, fontWeight: '800', width: 18 },
  previewRouteTxt: { color: P.t1, fontSize: 12, fontWeight: '600', flex: 1 },
  previewRouteIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  exceptionInput: { width: '100%', minHeight: 86, borderWidth: 1, borderColor: P.b2, borderRadius: BR.md, backgroundColor: P.white, padding: 12, color: P.t1, fontSize: 13, marginBottom: 5 },
  exceptionCounter: { alignSelf: 'flex-end', color: P.t3, fontSize: 10, marginBottom: SP.px12 },
});
