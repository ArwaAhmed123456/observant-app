import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Alert
} from 'react-native';
import { useApp, formatTime } from '../../context/AppContext';
import { Bell, CheckCircle, AlertTriangle, Clock } from 'lucide-react-native';

export function CheckCallScreen() {
  const {
    currentUser, activeCheckCall, respondToCheckCall, checkCalls,
  } = useApp();

  const [note, setNote]           = useState('');
  const [showNote, setShowNote]   = useState(false);
  const [responding, setResponding] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(600); // 10 min in seconds

  // Countdown timer
  useEffect(() => {
    if (!activeCheckCall) { setTimeLeft(600); return; }
    const start = new Date(activeCheckCall.firedAt).getTime();
    const update = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, 600 - elapsed);
      setTimeLeft(remaining);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeCheckCall]);

  const guardCC = checkCalls
    .filter(cc => cc.guardId === currentUser.id)
    .sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt));

  const handleRespond = async (response) => {
    if (!activeCheckCall) return;
    if (response === 'no' && !showNote) {
      setShowNote(true);
      return;
    }
    setResponding(true);
    await respondToCheckCall(activeCheckCall.id, response, note || null);
    setResponding(false);
    setShowNote(false);
    setNote('');
    if (response === 'yes') {
      Alert.alert('✓ Recorded', 'Thank you, your check call has been recorded successfully.');
    }
  };

  const timerColor = timeLeft < 120 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#10b981';
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <View style={styles.root}>
      <Text style={styles.screenTitle}>Check Calls</Text>

      {/* Active Check Call */}
      {activeCheckCall ? (
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <Bell color="#fff" size={22} />
            <Text style={styles.activeTitle}>Is everything okay on site?</Text>
          </View>

          {/* Countdown */}
          <View style={styles.countdownRow}>
            <Clock color={timerColor} size={16} />
            <Text style={[styles.countdown, { color: timerColor }]}>
              Respond within {mins}:{secs.toString().padStart(2, '0')}
            </Text>
          </View>

          {!showNote ? (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.yesBtn, responding && styles.disabled]}
                onPress={() => handleRespond('yes')}
                disabled={responding}
              >
                <CheckCircle color="#fff" size={20} />
                <Text style={styles.yesBtnTxt}>Yes, all okay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noBtn, responding && styles.disabled]}
                onPress={() => handleRespond('no')}
                disabled={responding}
              >
                <AlertTriangle color="#fff" size={20} />
                <Text style={styles.noBtnTxt}>No, issue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.noteLabel}>Describe the issue (optional):</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Suspicious person at main gate..."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.submitBtn, responding && styles.disabled]}
                onPress={() => handleRespond('no')}
                disabled={responding}
              >
                <Text style={styles.submitBtnTxt}>Report Issue to Manager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => setShowNote(false)}>
                <Text style={styles.backLinkTxt}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noActiveCard}>
          <CheckCircle color="#10b981" size={32} />
          <Text style={styles.noActiveTitle}>No active check call</Text>
          <Text style={styles.noActiveSub}>
            Check calls are triggered automatically every hour while you are booked on.
          </Text>
        </View>
      )}

      {/* History */}
      <Text style={styles.historyTitle}>History</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {guardCC.length === 0 && (
          <Text style={styles.emptyHint}>No check calls recorded yet.</Text>
        )}
        {guardCC.map(cc => (
          <View key={cc.id} style={styles.historyRow}>
            <View style={[styles.dot, {
              backgroundColor:
                cc.response === 'yes'    ? '#10b981' :
                cc.response === 'missed' ? '#ef4444' :
                cc.response === 'no'     ? '#f59e0b' : '#334155'
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTime}>{formatTime(cc.firedAt)}</Text>
              {cc.note && <Text style={styles.historyNote}>{cc.note}</Text>}
            </View>
            <Text style={[styles.historyStatus, {
              color:
                cc.response === 'yes'    ? '#10b981' :
                cc.response === 'missed' ? '#ef4444' :
                cc.response === 'no'     ? '#f59e0b' : '#64748b'
            }]}>
              {cc.response === 'yes'    ? '✓ All okay'     :
               cc.response === 'missed' ? '✗ Missed'       :
               cc.response === 'no'     ? '⚠ Issue'        : '⏳ Pending'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#090d16', padding: 20, paddingTop: 60 },
  screenTitle:  { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 },
  activeCard:   { backgroundColor: '#1e3a5f', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#3b82f6', marginBottom: 20 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  activeTitle:  { color: '#fff', fontSize: 17, fontWeight: '800', flex: 1 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  countdown:    { fontSize: 14, fontWeight: '700' },
  btnRow:       { flexDirection: 'row', gap: 12 },
  yesBtn:       { flex: 1, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  yesBtnTxt:    { color: '#fff', fontSize: 15, fontWeight: '800' },
  noBtn:        { flex: 1, backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noBtnTxt:     { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled:     { opacity: 0.6 },
  noteLabel:    { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  noteInput:    { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, minHeight: 80, marginBottom: 12 },
  submitBtn:    { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  submitBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  backLink:     { alignItems: 'center', paddingVertical: 8 },
  backLinkTxt:  { color: '#64748b', fontSize: 13 },
  noActiveCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 28, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', marginBottom: 24, gap: 12 },
  noActiveTitle:{ color: '#fff', fontSize: 17, fontWeight: '800' },
  noActiveSub:  { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  historyTitle: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  scroll:       { flex: 1 },
  emptyHint:    { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 16 },
  historyRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  historyTime:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyNote:  { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  historyStatus:{ fontSize: 12, fontWeight: '700' },
});
