import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput
} from 'react-native';
import { useApp, formatTime } from '../../context/AppContext';
import { LogOut, Bell, MapPin, CheckCircle, AlertTriangle, Clock, Users, Zap, ClipboardList } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { COLORS, S, R, TYPE, shadows, cardStyle } from '../../theme';

const TABS = ['overview', 'alerts'];

export function ManagerDashboardScreen({ navigation }) {
  const {
    currentUser, users, sites, logout,
    shiftSessions, checkCalls, patrolSessions,
    alerts, markAlertRead, markAllAlertsRead, getUnreadAlerts,
    addAlert, addManualCheckCall, addManualPatrol,
  } = useApp();

  const [tab, setTab] = useState('overview');

  // Manual log modal
  const [manualGuard, setManualGuard]   = useState(null);
  const [manualType, setManualType]     = useState('check_call'); // check_call | patrol
  const [manualResponse, setManualResponse] = useState('yes');
  const [manualNote, setManualNote]     = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const guards   = (users || []).filter(u => u.role === 'guard' && currentUser?.siteIds?.includes(u.siteId));
  const unread   = getUnreadAlerts(currentUser?.id || currentUser?._id);
  const todayStr = new Date().toISOString().slice(0,10);

  const todayStats = {
    activeGuards:    guards.filter(g => (shiftSessions || []).some(s => (s.guardId === g.id || s.guardId === g._id) && !s.bookedOffAt)).length,
    totalCheckCalls: (checkCalls || []).filter(cc => cc.firedAt?.startsWith(todayStr) && guards.some(g => g.id === cc.guardId || g._id === cc.guardId)).length,
    missedCheckCalls:(checkCalls || []).filter(cc => cc.firedAt?.startsWith(todayStr) && cc.response === 'missed' && guards.some(g => g.id === cc.guardId || g._id === cc.guardId)).length,
    completedPatrols:(patrolSessions || []).filter(ps => ps.startedAt?.startsWith(todayStr) && ps.finishedAt && guards.some(g => g.id === ps.guardId || g._id === ps.guardId)).length,
    sosAlerts:       (alerts || []).filter(a => a.type === 'sos' && !a.read).length,
  };

  const getGuardStatus = g => {
    const session = (shiftSessions || []).find(s => (s.guardId === g.id || s.guardId === g._id) && !s.bookedOffAt);
    return { active: !!session, session };
  };

  // ── Manual Log ─────────────────────────────────────────────────────────────
  const handleSubmitManualLog = async () => {
    if (!manualGuard) return;
    setManualLoading(true);
    if (manualType === 'check_call') {
      await addManualCheckCall({
        guardId: manualGuard.id || manualGuard._id,
        siteId: manualGuard.siteId,
        response: manualResponse,
        note: manualNote,
      });
    } else {
      await addManualPatrol({
        guardId: manualGuard.id || manualGuard._id,
        siteId: manualGuard.siteId,
        note: manualNote,
      });
    }
    setManualLoading(false);
    setManualGuard(null);
    setManualNote('');
    Alert.alert(
      'Manual Log Recorded',
      `${manualType === 'check_call' ? 'Check call' : 'Patrol'} manually logged on behalf of ${manualGuard.name}.\n\nThis is clearly flagged as "Manually logged by Manager" in Reports.`
    );
  };

  // ── Alert severity ─────────────────────────────────────────────────────────
  const alertSeverity = (type) => {
    if (type === 'sos') {
      return { color: '#ff2d55', bg: 'rgba(255,45,85,0.18)', border: '#ff2d55', icon: '🚨', label: 'URGENT SOS', isUrgent: true };
    }
    if (type === 'check_call_missed') {
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: '#f59e0b', icon: '✗',  label: 'MISSED CALL' };
    }
    if (type === 'check_call_issue') {
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '#d97706', icon: '⚠',  label: 'ISSUE REPORTED' };
    }
    if (type === 'geofence_warning') {
      return { color: '#ea580c', bg: 'rgba(234,88,12,0.14)', border: '#ea580c', icon: '📍', label: 'OUT OF BOUNDS' };
    }
    if (type === 'patrol_incomplete') {
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', icon: '⚠',  label: 'PATROL INCOMPLETE' };
    }
    return { color: COLORS.info, bg: COLORS.infoBg, border: COLORS.info, icon: 'ℹ', label: 'OPERATIONAL INFO' };
  };

  const mgrAlerts = [...(alerts || [])]
    .filter(a => {
      const mgr = (users || []).find(u => u.id === (currentUser?.id || currentUser?._id));
      return mgr?.siteIds?.includes(a.siteId) || (currentUser?.siteIds || []).includes(a.siteId);
    })
    .sort((a, b) => {
      // SOS always first
      if (a.type === 'sos' && b.type !== 'sos') return -1;
      if (b.type === 'sos' && a.type !== 'sos') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <View style={styles.root}>
      <AppHeader right={
        <>
          {todayStats.sosAlerts > 0 && (
            <View style={styles.sosBadge}>
              <Zap color={COLORS.white} size={14} />
              <Text style={styles.sosBadgeTxt}>SOS</Text>
            </View>
          )}
          <TouchableOpacity style={styles.alertIconBtn} onPress={() => setTab('alerts')}>
            <Bell color={unread.length > 0 ? COLORS.missed : COLORS.textMuted} size={22} />
            {unread.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread.length > 9 ? '9+' : unread.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
          ])}>
            <LogOut color={COLORS.textMuted} size={20} />
          </TouchableOpacity>
        </>
      } />

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === 'overview' ? 'Overview' : `Alerts${unread.length > 0 ? ` (${unread.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'overview' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.greeting}>
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {currentUser?.name?.split(' ')[0]}
          </Text>

          {/* SOS alert banner if any */}
          {todayStats.sosAlerts > 0 && (
            <TouchableOpacity style={styles.sosBanner} onPress={() => setTab('alerts')}>
              <Zap color={COLORS.white} size={18} fill={COLORS.white} />
              <Text style={styles.sosBannerTxt}>{todayStats.sosAlerts} active SOS alert{todayStats.sosAlerts > 1 ? 's' : ''} — tap to view</Text>
            </TouchableOpacity>
          )}

          {/* KPI row */}
          <View style={styles.kpiRow}>
            <KPICard value={todayStats.activeGuards}    label="On Duty"   />
            <KPICard value={todayStats.totalCheckCalls} label="Calls"     />
            <KPICard value={todayStats.missedCheckCalls} label="Missed"   color={todayStats.missedCheckCalls > 0 ? COLORS.missed : undefined} />
            <KPICard value={todayStats.completedPatrols} label="Patrols"  />
          </View>

          <Text style={styles.sectionTitle}>Guards ({guards.length})</Text>
          {guards.length === 0 && <Text style={styles.emptyHint}>No guards assigned to your sites.</Text>}

          {guards.map(guard => {
            const { active, session } = getGuardStatus(guard);
            const site         = sites.find(s => s.id === guard.siteId || s._id === guard.siteId);
            const todayCC      = (checkCalls || []).filter(cc => (cc.guardId === guard.id || cc.guardId === guard._id) && cc.firedAt?.startsWith(todayStr));
            const missedCC     = todayCC.filter(cc => cc.response === 'missed');
            const lastCC       = [...todayCC].sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt))[0];
            const todayPatrols = (patrolSessions || []).filter(ps => (ps.guardId === guard.id || ps.guardId === guard._id) && ps.startedAt?.startsWith(todayStr));

            return (
              <TouchableOpacity
                key={guard.id || guard._id}
                style={[cardStyle, styles.guardCard, active && styles.guardCardActive]}
                onPress={() => navigation?.navigate('GuardCheckCallPath', { guardId: guard.id || guard._id })}
                activeOpacity={0.85}
              >
                <View style={styles.guardTop}>
                  <View style={styles.guardInfo}>
                    <View style={[styles.statusDot, { backgroundColor: active ? COLORS.ok : COLORS.borderMid }]} />
                    <View>
                      <Text style={styles.guardName}>{guard.name}</Text>
                      <Text style={styles.guardBadge}>{guard.badgeNumber}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, active ? styles.pillOn : styles.pillOff]}>
                    <Text style={[styles.pillTxt, active ? styles.pillTxtOn : styles.pillTxtOff]}>
                      {active ? 'ON DUTY' : 'OFF DUTY'}
                    </Text>
                  </View>
                </View>

                <View style={styles.siteRow}>
                  <MapPin color={COLORS.info} size={12} />
                  <Text style={styles.siteTxt}>{site?.name || 'No site'}</Text>
                </View>

                {active && session && (
                  <Text style={styles.sessionDetail}>
                    <Clock size={11} color={COLORS.textMuted} /> Booked on {formatTime(session.bookedOnAt)}
                    {session.punctuality && !['on_time','unscheduled'].includes(session.punctuality) && (
                      <Text style={{ color: COLORS.issue }}> · {session.punctuality.replace('_',' ')}</Text>
                    )}
                  </Text>
                )}

                <View style={styles.guardStatsRow}>
                  <Text style={styles.guardStat}>
                    <CheckCircle size={11} color={missedCC.length > 0 ? COLORS.missed : COLORS.ok} />
                    {' '}{todayCC.filter(cc => cc.response === 'yes').length}/{todayCC.length} calls{missedCC.length > 0 ? ` · ${missedCC.length} missed` : ''}
                  </Text>
                  <Text style={styles.guardStat}>{todayPatrols.filter(p => p.finishedAt).length} patrols</Text>
                </View>

                {lastCC && (
                  <Text style={styles.lastCC}>
                    Last check call: {formatTime(lastCC.firedAt)} —{' '}
                    <Text style={{ color: lastCC.response === 'yes' ? COLORS.ok : lastCC.response === 'missed' ? COLORS.missed : COLORS.issue }}>
                      {lastCC.response === 'yes' ? 'OK' : lastCC.response === 'missed' ? 'Missed' : lastCC.response === 'no' ? 'Issue' : 'Pending'}
                    </Text>
                  </Text>
                )}

                <View style={styles.guardCardFooter}>
                  <Text style={styles.tapHint}>Tap to view check call path →</Text>
                  <TouchableOpacity
                    style={styles.manualLogBtn}
                    onPress={(e) => { e.stopPropagation?.(); setManualGuard(guard); }}
                  >
                    <ClipboardList size={14} color={COLORS.info} />
                    <Text style={styles.manualLogBtnTxt}>Manual Log</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.alertsHeader}>
            <Text style={styles.sectionTitle}>Alerts</Text>
            {unread.length > 0 && (
              <TouchableOpacity onPress={markAllAlertsRead}>
                <Text style={styles.markAll}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {mgrAlerts.length === 0 && (
            <View style={styles.emptyAlerts}>
              <Bell color={COLORS.borderMid} size={40} />
              <Text style={styles.emptyAlertsTxt}>No alerts yet</Text>
            </View>
          )}

          {mgrAlerts.map(alert => {
            const sev = alertSeverity(alert.type);
            const isUnread = !alert.read && !(alert.readBy || []).includes(currentUser?.id || currentUser?._id);
            return (
              <TouchableOpacity
                key={alert.id || alert._id}
                style={[styles.alertCard, { borderColor: sev.border, backgroundColor: sev.bg }]}
                onPress={() => markAlertRead(alert.id || alert._id)}
              >
                <View style={[styles.alertSevBadge, { backgroundColor: sev.color }]}>
                  <Text style={styles.alertSevTxt}>{sev.label}</Text>
                </View>
                <View style={{ flex: 1, paddingLeft: S.sm }}>
                  <Text style={[styles.alertMsg, { color: sev.color }]}>{alert.title || alert.message}</Text>
                  {alert.message && alert.title && <Text style={styles.alertDetail} numberOfLines={2}>{alert.message}</Text>}
                  {alert.note && <Text style={styles.alertNote}>"{alert.note}"</Text>}
                  <Text style={styles.alertTime}>{formatTime(alert.createdAt)}</Text>
                </View>
                {isUnread && <View style={[styles.unreadDot, { backgroundColor: sev.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Manual Log Modal */}
      <Modal visible={!!manualGuard} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manual Log</Text>
            <Text style={styles.modalSub}>
              Logging on behalf of: <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{manualGuard?.name}</Text>
              {'\n'}This will be flagged as "Manually logged by Manager" in all reports.
            </Text>

            <Text style={styles.fieldLabel}>Log Type</Text>
            <View style={styles.typeRow}>
              {['check_call','patrol'].map(t => (
                <TouchableOpacity key={t} style={[styles.typePill, manualType === t && styles.typePillActive]} onPress={() => setManualType(t)}>
                  <Text style={[styles.typePillTxt, manualType === t && styles.typePillTxtActive]}>
                    {t === 'check_call' ? 'Check Call' : 'Patrol'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {manualType === 'check_call' && (
              <>
                <Text style={styles.fieldLabel}>Response</Text>
                <View style={styles.typeRow}>
                  {['yes','no','missed'].map(r => (
                    <TouchableOpacity key={r} style={[styles.typePill, manualResponse === r && styles.typePillActive]} onPress={() => setManualResponse(r)}>
                      <Text style={[styles.typePillTxt, manualResponse === r && styles.typePillTxtActive]}>
                        {r === 'yes' ? '✓ Okay' : r === 'no' ? '⚠ Issue' : '✗ Missed'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={manualNote} onChangeText={setManualNote}
              placeholder="Reason or context for manual log…"
              placeholderTextColor={COLORS.textDisabled}
              multiline numberOfLines={2} textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, manualLoading && styles.btnDisabled]}
              onPress={handleSubmitManualLog} disabled={manualLoading}
            >
              <Text style={styles.submitBtnTxt}>{manualLoading ? 'Saving…' : 'Save Manual Log'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setManualGuard(null); setManualNote(''); }}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function KPICard({ value, label, color }) {
  return (
    <View style={[cardStyle, styles.kpiCard]}>
      <Text style={[styles.kpiVal, color && { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bgRoot },
  tabs:          { flexDirection: 'row', marginHorizontal: S.xl, marginBottom: S.sm, backgroundColor: COLORS.bgCard, borderRadius: R.md, padding: 4 },
  tab:           { flex: 1, paddingVertical: S.sm, alignItems: 'center', borderRadius: R.sm },
  tabActive:     { backgroundColor: COLORS.bgInput },
  tabTxt:        { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  tabTxtActive:  { color: COLORS.textPrimary },
  scroll:        { flex: 1, paddingHorizontal: S.xl },
  greeting:      { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginTop: S.sm, marginBottom: S.sm },
  sosBanner:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: COLORS.sos, borderRadius: R.md, padding: S.lg, marginBottom: S.md, ...shadows.sos },
  sosBannerTxt:  { color: COLORS.white, fontSize: 14, fontWeight: '800', flex: 1 },
  kpiRow:        { flexDirection: 'row', gap: S.sm, marginBottom: S.lg },
  kpiCard:       { flex: 1, padding: S.md, alignItems: 'center' },
  kpiVal:        { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  kpiLabel:      { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  sectionTitle:  { ...TYPE.label, marginBottom: S.md },
  emptyHint:     { color: COLORS.textDisabled, fontSize: 13, textAlign: 'center', marginTop: S.xl },
  guardCard:     { marginBottom: S.md },
  guardCardActive:{ borderColor: COLORS.brand },
  guardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  guardInfo:     { flexDirection: 'row', alignItems: 'center', gap: S.md },
  statusDot:     { width: 10, height: 10, borderRadius: 5 },
  guardName:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  guardBadge:    { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  statusPill:    { borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs },
  pillOn:        { backgroundColor: COLORS.okBg },
  pillOff:       { backgroundColor: COLORS.upcomingBg },
  pillTxt:       { fontSize: 10, fontWeight: '800' },
  pillTxtOn:     { color: COLORS.ok },
  pillTxtOff:    { color: COLORS.textDisabled },
  siteRow:       { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs },
  siteTxt:       { color: COLORS.textMuted, fontSize: 12 },
  sessionDetail: { color: COLORS.textMuted, fontSize: 12, marginBottom: S.xs },
  guardStatsRow: { flexDirection: 'row', gap: S.lg, marginBottom: S.xs },
  guardStat:     { color: COLORS.textSecondary, fontSize: 12 },
  lastCC:        { color: COLORS.textDisabled, fontSize: 11, marginBottom: S.xs },
  guardCardFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.sm, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
  tapHint:       { color: COLORS.brand, fontSize: 11, fontWeight: '600' },
  manualLogBtn:  { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: COLORS.infoBg, borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: S.xs },
  manualLogBtnTxt:{ color: COLORS.info, fontSize: 12, fontWeight: '700' },
  alertsHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.sm, marginBottom: S.md },
  markAll:       { color: COLORS.info, fontSize: 13 },
  emptyAlerts:   { alignItems: 'center', marginTop: S.huge, gap: S.md },
  emptyAlertsTxt:{ color: COLORS.textDisabled, fontSize: 14 },
  alertCard:     { borderRadius: R.md, padding: S.md, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', marginBottom: S.sm, ...shadows.sm },
  alertSevBadge: { borderRadius: R.xs, paddingHorizontal: S.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  alertSevTxt:   { color: COLORS.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  alertMsg:      { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  alertDetail:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  alertNote:     { color: COLORS.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  alertTime:     { color: COLORS.textDisabled, fontSize: 11, marginTop: S.xs },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, alignSelf: 'center', marginLeft: S.sm },
  sosBadge:      { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: COLORS.sos, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs },
  sosBadgeTxt:   { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  alertIconBtn:  { position: 'relative', padding: S.xs },
  badge:         { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.missed, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText:     { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  modalOverlay:  { flex: 1, backgroundColor: COLORS.bgOverlay, justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle, ...shadows.lg },
  modalTitle:    { ...TYPE.subtitle, marginBottom: S.xs },
  modalSub:      { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: S.lg },
  fieldLabel:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeRow:       { flexDirection: 'row', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' },
  typePill:      { backgroundColor: COLORS.bgInput, borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, borderWidth: 1, borderColor: COLORS.borderMid },
  typePillActive:{ backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  typePillTxt:   { color: COLORS.textMuted, fontSize: 13 },
  typePillTxtActive:{ color: COLORS.white, fontWeight: '700' },
  noteInput:     { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, padding: S.md, color: COLORS.textPrimary, fontSize: 14, minHeight: 60 },
  submitBtn:     { backgroundColor: COLORS.brand, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', marginTop: S.lg },
  submitBtnTxt:  { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  cancelBtn:     { backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', marginTop: S.sm },
  cancelBtnTxt:  { color: COLORS.textSecondary, fontSize: 14 },
  btnDisabled:   { opacity: 0.6 },
});
