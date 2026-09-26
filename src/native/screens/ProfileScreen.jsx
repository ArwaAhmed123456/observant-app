import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, Modal, ActivityIndicator
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { COLORS, S, R, TYPE, shadows, cardStyle, inputStyle } from '../../theme';
import {
  User, Lock, Bell, LogOut, ChevronRight, Shield,
  MapPin, Eye, EyeOff, CheckCircle
} from 'lucide-react-native';

export function ProfileScreen() {
  const { currentUser, sites, logout, shiftSessions, checkCalls, patrolSessions, updatePassword } = useApp();
  const site = sites.find(s => s.id === currentUser?.siteId || s._id === currentUser?.siteId);

  // ── Password change ────────────────────────────────────────────────────────
  const [pwModal, setPwModal]   = useState(false);
  const [oldPw, setOldPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // ── Notification prefs (local) ─────────────────────────────────────────────
  const [notifCheckCall, setNotifCheckCall] = useState(true);
  const [notifPatrol, setNotifPatrol]       = useState(true);
  const [notifShift, setNotifShift]         = useState(true);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const myCC      = checkCalls?.filter(cc => cc.guardId === currentUser?.id) || [];
  const myPatrols = patrolSessions?.filter(p => p.guardId === currentUser?.id) || [];
  const mySessions= shiftSessions?.filter(s => s.guardId === currentUser?.id) || [];
  const completedCC = myCC.filter(cc => cc.response === 'yes').length;
  const missedCC    = myCC.filter(cc => cc.response === 'missed').length;

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw)
      return Alert.alert('Missing fields', 'Please fill in all password fields.');
    if (newPw !== confirmPw)
      return Alert.alert('Mismatch', 'New passwords do not match.');
    if (newPw.length < 8)
      return Alert.alert('Too short', 'Password must be at least 8 characters.');
    setPwLoading(true);
    const res = await updatePassword(currentUser.id, oldPw, newPw);
    setPwLoading(false);
    if (!res.success) {
      return Alert.alert('Update Failed', res.error || 'Unable to update password.');
    }
    setPwModal(false);
    setOldPw(''); setNewPw(''); setConfirmPw('');
    Alert.alert('Updated', 'Your password has been changed successfully.');
  };

  const initials = currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '??';

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{currentUser?.name}</Text>
          <View style={styles.rolePill}>
            <Shield size={12} color={COLORS.brand} />
            <Text style={styles.roleText}>
              {currentUser?.role === 'manager' ? 'Operations Manager' : 'Security Officer'}
            </Text>
          </View>
          {site && (
            <View style={styles.siteRow}>
              <MapPin size={13} color={COLORS.textMuted} />
              <Text style={styles.siteText}>{site.name}</Text>
            </View>
          )}
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <InfoRow label="Badge Number"  value={currentUser?.badgeNumber || '—'} />
          <InfoRow label="Email"         value={currentUser?.email || '—'} />
          <InfoRow label="Phone"         value={currentUser?.phone || '—'} />
          <InfoRow label="Organisation"  value="Observant Security Group UK" last />
        </View>

        {/* My stats */}
        <Text style={styles.sectionLabel}>My Stats (All Time)</Text>
        <View style={styles.statsRow}>
          <StatBox value={mySessions.length}  label="Shifts"     />
          <StatBox value={myCC.length}        label="Check Calls"/>
          <StatBox value={completedCC}        label="Completed"  color={COLORS.ok}     />
          <StatBox value={missedCC}           label="Missed"     color={COLORS.missed} />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notification Preferences</Text>
        <View style={styles.infoCard}>
          <NotifRow label="Check Call reminders" value={notifCheckCall} onChange={setNotifCheckCall} />
          <NotifRow label="Patrol prompts"        value={notifPatrol}   onChange={setNotifPatrol}   />
          <NotifRow label="Shift reminders"       value={notifShift}    onChange={setNotifShift} last/>
        </View>

        {/* Actions */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.actionRow} onPress={() => setPwModal(true)}>
            <View style={styles.actionLeft}>
              <Lock size={18} color={COLORS.brand} />
              <Text style={styles.actionLabel}>Change Password</Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.actionLast]}
            onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
          >
            <View style={styles.actionLeft}>
              <LogOut size={18} color={COLORS.missed} />
              <Text style={[styles.actionLabel, { color: COLORS.missed }]}>Sign Out</Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Observant Guard v1.0.0</Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={pwModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                value={oldPw} onChangeText={setOldPw}
                secureTextEntry={!showOld} placeholder="Current password"
                placeholderTextColor={COLORS.textDisabled}
              />
              <TouchableOpacity onPress={() => setShowOld(v => !v)} style={styles.eyeBtn}>
                {showOld ? <EyeOff size={18} color={COLORS.textMuted}/> : <Eye size={18} color={COLORS.textMuted}/>}
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                value={newPw} onChangeText={setNewPw}
                secureTextEntry={!showNew} placeholder="Min 8 characters"
                placeholderTextColor={COLORS.textDisabled}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                {showNew ? <EyeOff size={18} color={COLORS.textMuted}/> : <Eye size={18} color={COLORS.textMuted}/>}
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={[inputStyle, { marginBottom: S.xl }]}
              value={confirmPw} onChangeText={setConfirmPw}
              secureTextEntry={true} placeholder="Repeat new password"
              placeholderTextColor={COLORS.textDisabled}
            />

            <TouchableOpacity
              style={[styles.saveBtn, pwLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword} disabled={pwLoading}
            >
              {pwLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <><CheckCircle size={16} color={COLORS.white} /><Text style={styles.saveBtnTxt}>Update Password</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPwModal(false); setOldPw(''); setNewPw(''); setConfirmPw(''); }}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatBox({ value, label, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statVal, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NotifRow({ label, value, onChange, last }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast, { paddingVertical: S.md }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ true: COLORS.brand, false: COLORS.borderMid }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bgRoot },
  scroll:       { flex: 1 },
  scrollContent:{ padding: S.xl, paddingTop: S.md },
  avatarSection:{ alignItems: 'center', paddingVertical: S.xxl },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.brandGlow, borderWidth: 2, borderColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', marginBottom: S.md, ...shadows.brand },
  avatarText:   { color: COLORS.brand, fontSize: 28, fontWeight: '800' },
  name:         { ...TYPE.subtitle, marginBottom: S.xs },
  rolePill:     { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: COLORS.brandSubtle, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, borderWidth: 1, borderColor: COLORS.brandBorder, marginBottom: S.sm },
  roleText:     { color: COLORS.brand, fontSize: 12, fontWeight: '700' },
  siteRow:      { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  siteText:     { color: COLORS.textMuted, fontSize: 13 },
  sectionLabel: { ...TYPE.label, marginBottom: S.sm, marginTop: S.lg },
  infoCard:     { ...cardStyle, padding: 0, marginBottom: S.lg, overflow: 'hidden' },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  infoRowLast:  { borderBottomWidth: 0 },
  infoLabel:    { color: COLORS.textMuted, fontSize: 13 },
  infoValue:    { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  statsRow:     { flexDirection: 'row', gap: S.sm, marginBottom: S.lg },
  statBox:      { flex: 1, ...cardStyle, padding: S.md, alignItems: 'center' },
  statVal:      { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel:    { color: COLORS.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
  actionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  actionLast:   { borderBottomWidth: 0 },
  actionLeft:   { flexDirection: 'row', alignItems: 'center', gap: S.md },
  actionLabel:  { color: COLORS.textPrimary, fontSize: 15 },
  version:      { color: COLORS.textDisabled, fontSize: 11, textAlign: 'center', paddingVertical: S.xl },
  modalOverlay: { flex: 1, backgroundColor: COLORS.bgOverlay, justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle, ...shadows.lg },
  modalTitle:   { ...TYPE.subtitle, marginBottom: S.lg },
  fieldLabel:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs, marginTop: S.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  pwRow:        { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.xs },
  eyeBtn:       { padding: S.sm },
  saveBtn:      { backgroundColor: COLORS.brand, borderRadius: R.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.md, ...shadows.brand },
  saveBtnTxt:   { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:    { backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', marginTop: S.sm },
  cancelBtnTxt: { color: COLORS.textSecondary, fontSize: 14 },
});
