import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image
} from 'react-native';
import { useApp, formatTime } from '../../context/AppContext';
import { LogOut, Bell, MapPin, CheckCircle, AlertTriangle, Clock, Users } from 'lucide-react-native';

export function ManagerDashboardScreen({ navigation }) {
  const {
    currentUser, users, sites, logout,
    shiftSessions, checkCalls, patrolSessions,
    alerts, markAlertRead, markAllAlertsRead, getUnreadAlerts,
  } = useApp();

  const [tab, setTab] = useState('overview'); // 'overview' | 'alerts'

  const guards = users.filter(u => u.role === 'guard' && currentUser.siteIds?.includes(u.siteId));
  const unread = getUnreadAlerts(currentUser.id);

  const getGuardStatus = (guard) => {
    const session = shiftSessions.find(s => s.guardId === guard.id && !s.bookedOffAt);
    if (!session) return { active: false, session: null };
    return { active: true, session };
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const todayStats = {
    activeGuards: guards.filter(g => shiftSessions.some(s => s.guardId === g.id && !s.bookedOffAt)).length,
    totalCheckCalls: checkCalls.filter(cc => cc.firedAt?.startsWith(todayStr) && guards.some(g => g.id === cc.guardId)).length,
    missedCheckCalls: checkCalls.filter(cc => cc.firedAt?.startsWith(todayStr) && cc.response === 'missed' && guards.some(g => g.id === cc.guardId)).length,
    completedPatrols: patrolSessions.filter(ps => ps.startedAt?.startsWith(todayStr) && ps.finishedAt && guards.some(g => g.id === ps.guardId)).length,
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={require('../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.alertBtn} onPress={() => setTab('alerts')}>
            <Bell color={unread.length > 0 ? '#ef4444' : '#64748b'} size={22} />
            {unread.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread.length > 9 ? '9+' : unread.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => require('react-native').Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
          ])}>
            <LogOut color="#64748b" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'alerts'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === 'overview' ? 'Overview' : `Alerts${unread.length > 0 ? ` (${unread.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'overview' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* Greeting */}
          <Text style={styles.greeting}>Good {getGreeting()}, {currentUser.name.split(' ')[0]}</Text>
          <Text style={styles.sub}>Operations Command Centre</Text>

          {/* KPI row */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{todayStats.activeGuards}</Text>
              <Text style={styles.kpiLabel}>On Duty</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{todayStats.totalCheckCalls}</Text>
              <Text style={styles.kpiLabel}>Check Calls</Text>
            </View>
            <View style={[styles.kpiCard, todayStats.missedCheckCalls > 0 && styles.kpiAlert]}>
              <Text style={[styles.kpiVal, todayStats.missedCheckCalls > 0 && { color: '#ef4444' }]}>
                {todayStats.missedCheckCalls}
              </Text>
              <Text style={styles.kpiLabel}>Missed</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{todayStats.completedPatrols}</Text>
              <Text style={styles.kpiLabel}>Patrols</Text>
            </View>
          </View>

          {/* Guard cards */}
          <Text style={styles.sectionTitle}>
            <Users size={13} color="#64748b" /> Guards ({guards.length})
          </Text>

          {guards.length === 0 && (
            <Text style={styles.emptyHint}>No guards assigned to your sites yet.</Text>
          )}

          {guards.map(guard => {
            const { active, session } = getGuardStatus(guard);
            const site = sites.find(s => s.id === guard.siteId);
            const todayCC  = checkCalls.filter(cc => cc.guardId === guard.id && cc.firedAt?.startsWith(todayStr));
            const missedCC = todayCC.filter(cc => cc.response === 'missed');
            const lastCC   = [...todayCC].sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt))[0];
            const todayPatrols = patrolSessions.filter(ps => ps.guardId === guard.id && ps.startedAt?.startsWith(todayStr));
            const lastPatrol   = [...todayPatrols].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];

            return (
              <View key={guard.id} style={[styles.guardCard, active && styles.guardCardActive]}>
                {/* Guard name & status */}
                <View style={styles.guardTop}>
                  <View style={styles.guardInfo}>
                    <View style={[styles.statusDot, { backgroundColor: active ? '#10b981' : '#334155' }]} />
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

                {/* Site */}
                <View style={styles.siteRow}>
                  <MapPin color="#38bdf8" size={12} />
                  <Text style={styles.siteTxt}>{site?.name || 'No site'}</Text>
                </View>

                {active && session && (
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDetail}>
                      <Clock size={11} color="#64748b" /> Booked on {formatTime(session.bookedOnAt)}
                    </Text>
                    {session.punctuality !== 'on_time' && session.punctuality !== 'unscheduled' && (
                      <Text style={styles.punctuality}>⚠ {session.punctuality.replace('_',' ')}</Text>
                    )}
                  </View>
                )}

                {/* Check call status */}
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <CheckCircle size={12} color={missedCC.length > 0 ? '#ef4444' : '#10b981'} />
                    <Text style={styles.statTxt}>
                      {todayCC.filter(cc => cc.response === 'yes').length}/{todayCC.length} calls
                      {missedCC.length > 0 ? ` · ${missedCC.length} missed` : ''}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statTxt}>{todayPatrols.filter(p => p.finishedAt).length} patrols</Text>
                  </View>
                </View>

                {/* Last check call */}
                {lastCC && (
                  <Text style={styles.lastCC}>
                    Last check call: {formatTime(lastCC.firedAt)} —{' '}
                    <Text style={{
                      color: lastCC.response === 'yes' ? '#10b981' :
                             lastCC.response === 'missed' ? '#ef4444' : '#f59e0b'
                    }}>
                      {lastCC.response === 'yes' ? 'OK' :
                       lastCC.response === 'missed' ? 'Missed' :
                       lastCC.response === 'no' ? 'Issue' : 'Pending'}
                    </Text>
                  </Text>
                )}
              </View>
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

          {alerts.length === 0 && (
            <View style={styles.emptyAlerts}>
              <Bell color="#334155" size={40} />
              <Text style={styles.emptyAlertsTxt}>No alerts yet</Text>
            </View>
          )}

          {[...alerts]
            .filter(a => {
              const mgr = users.find(u => u.id === currentUser.id);
              return mgr?.siteIds?.includes(a.siteId);
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(alert => {
              const isUnread = !alert.read;
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={[styles.alertCard, isUnread && styles.alertCardUnread]}
                  onPress={() => markAlertRead(alert.id)}
                >
                  <View style={styles.alertIconWrap}>
                    {alert.type === 'check_call_missed'
                      ? <AlertTriangle color="#ef4444" size={18} />
                      : alert.type === 'check_call_issue'
                      ? <AlertTriangle color="#f59e0b" size={18} />
                      : <AlertTriangle color="#f59e0b" size={18} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertMsg}>{alert.message}</Text>
                    {alert.note && <Text style={styles.alertNote}>Note: {alert.note}</Text>}
                    <Text style={styles.alertTime}>{formatTime(alert.createdAt)}</Text>
                  </View>
                  {isUnread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })
          }
        </ScrollView>
      )}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#090d16' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  logo:       { width: 120, height: 38 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  alertBtn:   { position: 'relative', padding: 4 },
  badge:      { position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText:  { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabs:       { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#0f172a', borderRadius: 10, padding: 4 },
  tab:        { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive:  { backgroundColor: '#1e293b' },
  tabTxt:     { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabTxtActive:{ color: '#fff' },
  scroll:     { flex: 1, paddingHorizontal: 20 },
  greeting:   { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  sub:        { color: '#64748b', fontSize: 13, marginBottom: 16, marginTop: 2 },
  kpiRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiCard:    { flex: 1, backgroundColor: '#0f172a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  kpiAlert:   { borderColor: '#ef4444' },
  kpiVal:     { color: '#fff', fontSize: 22, fontWeight: '800' },
  kpiLabel:   { color: '#64748b', fontSize: 10, marginTop: 2 },
  sectionTitle:{ color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyHint:  { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 16 },
  guardCard:  { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  guardCardActive:{ borderColor: '#10b981' },
  guardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  guardInfo:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  guardName:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  guardBadge: { color: '#64748b', fontSize: 11, marginTop: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillOn:     { backgroundColor: 'rgba(16,185,129,0.15)' },
  pillOff:    { backgroundColor: 'rgba(100,116,139,0.15)' },
  pillTxt:    { fontSize: 10, fontWeight: '800' },
  pillTxtOn:  { color: '#10b981' },
  pillTxtOff: { color: '#475569' },
  siteRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  siteTxt:    { color: '#64748b', fontSize: 12 },
  sessionInfo:{ marginBottom: 6 },
  sessionDetail:{ color: '#64748b', fontSize: 12 },
  punctuality:{ color: '#f59e0b', fontSize: 11, marginTop: 2 },
  statRow:    { flexDirection: 'row', gap: 16, marginBottom: 4 },
  statItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTxt:    { color: '#94a3b8', fontSize: 12 },
  lastCC:     { color: '#475569', fontSize: 11, marginTop: 4 },
  alertsHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  markAll:    { color: '#38bdf8', fontSize: 13 },
  emptyAlerts:{ alignItems: 'center', marginTop: 60, gap: 12 },
  emptyAlertsTxt:{ color: '#475569', fontSize: 14 },
  alertCard:  { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', gap: 12, marginBottom: 10 },
  alertCardUnread:{ borderColor: '#334155', backgroundColor: '#111827' },
  alertIconWrap:{ paddingTop: 2 },
  alertMsg:   { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  alertNote:  { color: '#94a3b8', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  alertTime:  { color: '#475569', fontSize: 11, marginTop: 4 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', alignSelf: 'center' },
});
