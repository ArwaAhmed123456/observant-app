import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { ShieldCheck, Clock, MapPin, AlertCircle } from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const CheckCallModal = () => {
  const { pendingCheckCall, respondCheckCall, activeShiftSession } = useSecurity();
  const [secondsRemaining, setSecondsRemaining] = useState(600);

  useEffect(() => {
    if (!pendingCheckCall) {
      setSecondsRemaining(600);
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingCheckCall]);

  if (!pendingCheckCall) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = secondsRemaining < 120;

  const handleConfirm = () => {
    respondCheckCall(pendingCheckCall.id, 'safe');
  };

  return (
    <Modal visible={!!pendingCheckCall} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.card, isUrgent && styles.cardUrgent]}>
          {/* Header Icon */}
          <View style={[styles.iconCircle, isUrgent && styles.iconCircleUrgent]}>
            <ShieldCheck color={isUrgent ? '#ef4444' : '#10b981'} size={38} />
          </View>

          <Text style={styles.title}>Safety Check-Call Prompt</Text>
          <Text style={styles.subtitle}>
            Scheduled welfare verification. Please confirm your status and on-site presence.
          </Text>

          {/* Countdown Timer */}
          <View style={[styles.timerBox, isUrgent && styles.timerBoxUrgent]}>
            <Clock color={isUrgent ? '#ef4444' : '#38bdf8'} size={20} />
            <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
              {timeFormatted}
            </Text>
            <Text style={styles.timerLabel}>Response Window</Text>
          </View>

          {/* GPS Info */}
          <View style={styles.gpsRow}>
            <MapPin color="#94a3b8" size={14} />
            <Text style={styles.gpsText}>
              {activeShiftSession?.gpsLocation || 'GPS Geofence: Active Site Verified'}
            </Text>
          </View>

          {/* Warning */}
          <View style={styles.warningBox}>
            <AlertCircle color="#f59e0b" size={16} />
            <Text style={styles.warningText}>
              Unacknowledged check-calls will trigger an automated dispatcher escalation alarm.
            </Text>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>I AM SAFE & ON PATROL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center'
  },
  cardUrgent: {
    borderColor: '#ef4444'
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  iconCircleUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)'
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16
  },
  timerBoxUrgent: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)'
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 1
  },
  timerTextUrgent: {
    color: '#ef4444'
  },
  timerLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginLeft: 4
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16
  },
  gpsText: {
    fontSize: 11,
    color: '#64748b'
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 10,
    marginBottom: 20
  },
  warningText: {
    fontSize: 11,
    color: '#f59e0b',
    flex: 1,
    lineHeight: 15
  },
  confirmButton: {
    backgroundColor: '#10b981',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
