import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Modal, ActivityIndicator,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { P, SP, BR, FONT, SH_TOKENS, card, input, btnPrimary, btnDanger } from '../../ds';
import {
  User, Lock, Bell, LogOut, ChevronRight, Shield,
  MapPin, Eye, EyeOff, CheckCircle, AlertCircle,
} from 'lucide-react-native';

export function ProfileScreen() {
  const { currentUser, sites, logout, shiftSessions, checkCalls, patrolSessions, updatePassword } = useApp();
  const site = sites.find(s => s.id === currentUser?.siteId || s._id === currentUser?.siteId);

  const [pwModal, setPwModal]     = useState(false);
  const [oldPw, setOldPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError]     = useState('');

  const [notifCheckCall, setNotifCheckCall] = useState(true);
  const [notifPatrol, setNotifPatrol]       = useState(true);
  const [notifShift, setNotifShift]         = useState(true);

  const [logoutModal, setLogoutModal] = useState(false);

  const myCC       = checkCalls?.filter(cc => cc.guardId === currentUser?.id) || [];
  const myPatrols  = patrolSessions?.filter(p => p.guardId === currentUser?.id) || [];
  const mySessions = shiftSessions?.filter(s => s.guardId === currentUser?.id) || [];
  const completedCC = myCC.filter(cc => cc.response === 'yes').length;
  const missedCC    = myCC.filter(cc => cc.response === 'missed').length;

  const handleChangePassword = async () => {
    setPwError('');
    if (!oldPw || !newPw || !confirmPw) { setPwError('Please fill in all fields.'); return; }
    if (newPw !== confirmPw)             { setPwError('New passwords do not match.'); return; }
    if (newPw.length < 8)               { setPwError('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    const res = await updatePassword(currentUser.id, oldPw, newPw);
    setPwLoading(false);
    if (!res.success) { setPwError(res.error || 'Unable to update password.'); return; }
    setPwModal(false);
    setOldPw(''); setNewPw(''); setConfirmPw('');
  };

  const initials = currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '??';

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{currentUser?.name}</Text>
          <View style={styles.rolePill}>
            <Shield size={11} color={P.blue} />
            <Text style={styles.roleText}>
              {currentUser?.role === 'manager' ? 'Operations Manager' : 'Security Officer'}
            </Text>
          </View>
          {site && (
            <View style={styles.siteRow}>
              <MapPin size={12} color={P.t3} />
              <Text style={styles.siteText}>{site.name}</Text>
            </View>
          )}
        </View>

        {/* Info card */}
        <Text style={styles.sectionLabel}>Identity</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Badge Number" value={currentUser?.badgeNumber || '—'} />
          <InfoRow label="Email"        value={currentUser?.email || '—'} />
          <InfoRow label="Phone"        value={currentUser?.phone || '—'} />
          <InfoRow label="Organisation" value="Observant Security Group UK" last />
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>Performance (All Time)</Text>
        <View style={styles.statsRow}>
          <StatBox value={mySessions.length}  label="Shifts"     />
          <StatBox value={myCC.length}        label="Check Calls"/>
          <StatBox value={completedCC}        label="Completed"  color={P.ok}     />
          <StatBox value={missedCC}           label="Missed"     color={P.danger} />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notification Preferences</Text>
        <View style={styles.infoCard}>
          <NotifRow label="Check Call reminders" value={notifCheckCall} onChange={setNotifCheckCall} />
          <NotifRow label="Patrol prompts"        value={notifPatrol}   onChange={setNotifPatrol}   />
          <NotifRow label="Shift reminders"       value={notifShift}    onChange={setNotifShift} last/>
        </View>

        {/* Account actions */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.actionRow} onPress={() => setPwModal(true)}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: P.blueSubtle }]}>
                <Lock size={15} color={P.blue} />
              </View>
              <Text style={styles.actionLabel}>Change Password</Text>
            </View>
            <ChevronRight size={16} color={P.t3} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, styles.actionLast]} onPress={() => setLogoutModal(true)}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: P.dangerSubtle }]}>
                <LogOut size={15} color={P.danger} />
              </View>
              <Text style={[styles.actionLabel, { color: P.danger }]}>Sign Out</Text>
            </View>
            <ChevronRight size={16} color={P.t3} />
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
                style={[input, { flex: 1, marginBottom: 0, color: P.t1 }]}
                value={oldPw} onChangeText={setOldPw}
                secureTextEntry={!showOld} placeholder="Current password"
                placeholderTextColor={P.t4}
              />
              <TouchableOpacity onPress={() => setShowOld(v => !v)} style={styles.eyeBtn}>
                {showOld ? <EyeOff size={17} color={P.t3}/> : <Eye size={17} color={P.t3}/>}
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[input, { flex: 1, marginBottom: 0, color: P.t1 }]}
                value={newPw} onChangeText={setNewPw}
                secureTextEntry={!showNew} placeholder="Min 8 characters"
                placeholderTextColor={P.t4}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                {showNew ? <EyeOff size={17} color={P.t3}/> : <Eye size={17} color={P.t3}/>}
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={[input, { color: P.t1, marginBottom: SP.px16 }]}
              value={confirmPw} onChangeText={setConfirmPw}
              secureTextEntry placeholder="Repeat new password"
              placeholderTextColor={P.t4}
            />

            {!!pwError && (
              <View style={styles.errorBox}>
                <AlertCircle size={14} color={P.danger} />
                <Text style={styles.errorTxt}>{pwError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[btnPrimary, { marginTop: SP.px8, opacity: pwLoading ? 0.6 : 1 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading
                ? <ActivityIndicator color={P.white} />
                : <><CheckCircle size={16} color={P.white} /><Text style={styles.saveBtnTxt}>Update Password</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPwModal(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout confirmation modal */}
      <Modal visible={logoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { alignItems: 'center' }]}>
            <View style={[styles.actionIcon, { width: 56, height: 56, borderRadius: 28, backgroundColor: P.dangerSubtle, borderWidth: 1, borderColor: P.dangerBorder, marginBottom: SP.px16 }]}>
              <LogOut size={24} color={P.danger} />
            </View>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalSubTxt}>
              You'll need to sign back in to access your shift.
            </Text>
            <TouchableOpacity style={[btnDanger, { width: '100%', marginBottom: 10 }]} onPress={logout}>
              <Text style={styles.saveBtnTxt}>Yes, Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { width: '100%' }]} onPress={() => setLogoutModal(false)}>
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
    <View style={[styles.infoRow, last && styles.infoRowLast, { paddingVertical: SP.px12 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ true: P.blue, false: P.b3 }}
        thumbColor={P.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: P.bg0 },
  scroll:        { flex: 1 },
  scrollContent: { padding: SP.px20, paddingTop: SP.px12 },

  avatarSection: { alignItems: 'center', paddingVertical: SP.px32 },
  avatarRing:    { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: P.blueBorder, backgroundColor: P.blueSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: SP.px12, ...SH_TOKENS.blue },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: P.bg3, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: P.blue, fontSize: 28, fontWeight: '800' },
  name:          { ...FONT.h3, marginBottom: SP.px8 },
  rolePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.blueSubtle, borderRadius: BR.full, paddingHorizontal: SP.px12, paddingVertical: SP.px4, borderWidth: 1, borderColor: P.blueBorder, marginBottom: SP.px8 },
  roleText:      { color: P.blue, fontSize: 11, fontWeight: '700' },
  siteRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  siteText:      { color: P.t3, fontSize: 12 },

  sectionLabel:  { color: P.t3, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: SP.px8, marginTop: SP.px20 },
  infoCard:      { backgroundColor: P.bg2, borderRadius: BR.lg, borderWidth: 1, borderColor: P.b2, marginBottom: SP.px8, overflow: 'hidden', ...SH_TOKENS.xs },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.px16, paddingVertical: SP.px16, borderBottomWidth: 1, borderBottomColor: P.b1 },
  infoRowLast:   { borderBottomWidth: 0 },
  infoLabel:     { color: P.t3, fontSize: 13 },
  infoValue:     { color: P.t1, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  statsRow:      { flexDirection: 'row', gap: SP.px8, marginBottom: SP.px8 },
  statBox:       { flex: 1, backgroundColor: P.bg2, borderRadius: BR.md, borderWidth: 1, borderColor: P.b2, padding: SP.px12, alignItems: 'center', ...SH_TOKENS.xs },
  statVal:       { color: P.t1, fontSize: 20, fontWeight: '800' },
  statLabel:     { color: P.t3, fontSize: 10, marginTop: 2, textAlign: 'center' },

  actionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.px16, paddingVertical: SP.px16, borderBottomWidth: 1, borderBottomColor: P.b1 },
  actionLast:    { borderBottomWidth: 0 },
  actionLeft:    { flexDirection: 'row', alignItems: 'center', gap: SP.px12 },
  actionIcon:    { width: 32, height: 32, borderRadius: BR.xs, alignItems: 'center', justifyContent: 'center' },
  actionLabel:   { color: P.t1, fontSize: 14 },

  version:       { color: P.t4, fontSize: 11, textAlign: 'center', paddingVertical: SP.px24 },

  modalOverlay:  { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, ...SH_TOKENS.lg },
  modalTitle:    { ...FONT.h3, marginBottom: SP.px16 },
  modalSubTxt:   { color: P.t2, fontSize: 13, textAlign: 'center', marginBottom: SP.px24, lineHeight: 20 },
  fieldLabel:    { color: P.t2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.px4, marginTop: SP.px16 },
  pwRow:         { flexDirection: 'row', alignItems: 'center', gap: SP.px8 },
  eyeBtn:        { padding: SP.px8 },
  errorBox:      { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: P.dangerSubtle, borderRadius: BR.sm, padding: SP.px12, marginBottom: SP.px8, borderWidth: 1, borderColor: P.dangerBorder },
  errorTxt:      { color: P.danger, fontSize: 13, flex: 1 },
  saveBtnTxt:    { color: P.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:     { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', marginTop: SP.px8, borderWidth: 1, borderColor: P.b2 },
  cancelBtnTxt:  { color: P.t2, fontSize: 14, fontWeight: '600' },
});
