/**
 * CheckCallModal — Overlay modal driven by AppContext.activeCheckCall
 * Shown whenever the guard has a pending check call to acknowledge.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { ShieldCheck, Clock, MapPin, Zap, AlertTriangle } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';

const WINDOW_SECS = 600;

export const CheckCallModal = () => {
  const { activeCheckCall, respondToCheckCall, currentUser, sites } = useApp();
  const [secondsRemaining, setSecondsRemaining] = useState(WINDOW_SECS);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeCheckCall) {
      setSecondsRemaining(WINDOW_SECS);
      return;
    }
    const start = activeCheckCall.firedAt
      ? new Date(activeCheckCall.firedAt).getTime()
      : Date.now();
    const tick = () => setSecondsRemaining(Math.max(0, WINDOW_SECS - Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeCheckCall?.id]);

  useEffect(() => {
    const isUrgent = secondsRemaining < 120 && secondsRemaining > 0;
    if (isUrgent) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [secondsRemaining < 120]);

  if (!activeCheckCall) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = secondsRemaining < 120;

  const site = sites?.find(s => s.id === currentUser?.siteId || s._id === currentUser?.siteId);

  const handleConfirm = async () => {
    await respondToCheckCall(activeCheckCall.id, 'yes');
  };

  return (
    <Modal visible={!!activeCheckCall} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, isUrgent && styles.cardUrgent]}>

          {/* Icon */}
          <Animated.View style={[
            styles.iconCircle,
            isUrgent && styles.iconCircleUrgent,
            { transform: [{ scale: pulseAnim }] },
          ]}>
            {isUrgent
              ? <AlertTriangle color={P.danger} size={36} />
              : <ShieldCheck color={P.ok} size={36} />
            }
          </Animated.View>

          <Text style={styles.title}>Safety Check-Call</Text>
          <Text style={styles.subtitle}>Confirm your status and on-site presence.</Text>

          {/* Countdown timer */}
          <View style={[styles.timerBox, isUrgent && styles.timerBoxUrgent]}>
            <Clock color={isUrgent ? P.danger : P.info} size={18} />
            <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
              {timeFormatted}
            </Text>
            <Text style={styles.timerLabel}>Response Window</Text>
          </View>

          {/* GPS / site row */}
          <View style={styles.gpsRow}>
            <MapPin color={P.t3} size={13} />
            <Text style={styles.gpsText}>
              {site?.name || 'Active site verified'}
            </Text>
          </View>

          {/* Warning banner */}
          <View style={styles.warningBox}>
            <Zap color={P.warn} size={14} />
            <Text style={styles.warningText}>
              Unacknowledged calls trigger an automated manager escalation.
            </Text>
          </View>

          {/* Confirm safe */}
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.confirmButton, isUrgent && styles.confirmButtonUrgent]}
          >
            <ShieldCheck color={P.white} size={18} />
            <Text style={styles.confirmButtonText}>I AM SAFE & ON PATROL</Text>
          </TouchableOpacity>

          <Text style={styles.issueHint}>
            To report an issue, dismiss this modal and use the Check Call tab.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: P.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP.px20,
  },
  card: {
    backgroundColor: P.bg2,
    borderRadius: BR.xl,
    borderWidth: 1.5,
    borderColor: P.b3,
    padding: SP.px24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...SH_TOKENS.lg,
  },
  cardUrgent: {
    borderColor: P.dangerBorder,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: P.okSubtle,
    borderWidth: 1.5,
    borderColor: P.okBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SP.px16,
  },
  iconCircleUrgent: {
    backgroundColor: P.dangerSubtle,
    borderColor: P.dangerBorder,
  },
  title: {
    ...FONT.h3,
    textAlign: 'center',
    marginBottom: SP.px8,
  },
  subtitle: {
    color: P.t2,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SP.px16,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderColor: P.infoBorder,
    paddingHorizontal: SP.px16,
    paddingVertical: 10,
    borderRadius: BR.md,
    marginBottom: SP.px16,
  },
  timerBoxUrgent: {
    borderColor: P.dangerBorder,
    backgroundColor: P.dangerSubtle,
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
    color: P.info,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: { color: P.danger },
  timerLabel: {
    fontSize: 10,
    color: P.t3,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginLeft: 4,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: SP.px16,
  },
  gpsText: { fontSize: 11, color: P.t3 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P.warnSubtle,
    borderRadius: BR.sm,
    borderWidth: 1,
    borderColor: P.warnBorder,
    padding: SP.px12,
    marginBottom: SP.px20,
    width: '100%',
  },
  warningText: { fontSize: 11, color: P.warn, flex: 1, lineHeight: 15 },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: P.ok,
    width: '100%',
    paddingVertical: 15,
    borderRadius: BR.md,
    ...SH_TOKENS.ok,
  },
  confirmButtonUrgent: {
    backgroundColor: P.danger,
    ...SH_TOKENS.danger,
  },
  confirmButtonText: {
    color: P.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  issueHint: {
    fontSize: 11,
    color: P.t4,
    textAlign: 'center',
    marginTop: SP.px12,
    lineHeight: 16,
  },
});
