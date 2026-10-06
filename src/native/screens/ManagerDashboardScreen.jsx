import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, formatTime } from '../../context/AppContext';
import { LogOut, Bell, MapPin, CheckCircle, AlertTriangle, Clock, Users, Zap, ClipboardList, Shield, PlusCircle, ChevronRight, X } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { StatusTile } from '../components/StatusTile';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';
import { COLORS, S, R, TYPE, shadows, cardStyle } from '../../theme';

const TABS = ['overview', 'alerts'];

export function ManagerDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);
  const {
    currentUser, users, sites, logout, createUser, updateUser, createSite,
    shiftSessions, checkCalls, patrolSessions,
    alerts, markAlertRead, markAllAlertsRead, getUnreadAlerts,
    addAlert, addManualCheckCall, addManualPatrol,
  } = useApp();

  const [tab, setTab] = useState('overview');

  // Alert detail modal
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Manual log modal
  const [manualGuard, setManualGuard]   = useState(null);
  const [manualType, setManualType]     = useState('check_call'); // check_call | patrol
  const [manualResponse, setManualResponse] = useState('yes');
  const [manualNote, setManualNote]     = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Manager-created guard account
  const [createGuardVisible, setCreateGuardVisible] = useState(false);
  const [createGuardBusy, setCreateGuardBusy] = useState(false);
  const [guardDraft, setGuardDraft] = useState({ name: '', email: '', password: '', badgeNumber: '', phone: '', siteId: '' });

  // Manager-created site
  const [createSiteVisible, setCreateSiteVisible] = useState(false);
  const [createSiteBusy, setCreateSiteBusy] = useState(false);
  const [siteDraft, setSiteDraft] = useState({ name: '', address: '', geofenceRadius: '250' });

  // Reassign guard site
  const [reassignGuard, setReassignGuard] = useState(null);
  const [reassignSiteId, setReassignSiteId] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);

  const managerSiteIds = (currentUser?.siteIds || []).map(String);
  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const canSeeSite = (siteId, siteObj) => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') return true;
    const sId = String(siteId || '');
    if (managerSiteIds.includes(sId)) return true;
    if (siteObj && String(siteObj.managerId || '') === currentUserId) return true;
    const found = (sites || []).find(s => String(s.id || s._id) === sId);
    if (found && String(found.managerId || '') === currentUserId) return true;
    return false;
  };
  const availableSites = (sites || []).filter(site => canSeeSite(site.id || site._id, site));
  const guards   = (users || []).filter(u => u.role === 'guard' && canSeeSite(u.siteId));
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

  const handleCreateGuard = async () => {
    const { name, email, password, badgeNumber, phone, siteId } = guardDraft;
    if (!name.trim() || !email.trim() || !siteId) {
      Alert.alert('Complete guard details', 'Enter the guard name and work email, then assign a site.');
      return;
    }
    if (password.length < 12) {
      Alert.alert('Password too short', 'Set a temporary password with at least 12 characters.');
      return;
    }
    setCreateGuardBusy(true);
    try {
      const result = await createUser({
        name: name.trim(), email: email.trim().toLowerCase(), password,
        role: 'guard', badgeNumber: badgeNumber.trim(), phone: phone.trim(), siteId,
      });
      if (!result?.success) throw new Error(result?.error || 'The guard account could not be created.');
      setCreateGuardVisible(false);
      setGuardDraft({ name: '', email: '', password: '', badgeNumber: '', phone: '', siteId: '' });
      Alert.alert('Guard account created', `${result.user?.name || name} is assigned to ${availableSites.find(site => String(site.id || site._id) === String(siteId))?.name || 'the selected site'}. Assign their shifts next.`, [
        { text: 'Assign schedule', onPress: () => navigation?.navigate('Schedule') },
        { text: 'Done' },
      ]);
    } catch (error) {
      Alert.alert('Could not create guard', error.message || 'Check the details and try again.');
    } finally {
      setCreateGuardBusy(false);
    }
  };

  const handleCreateSite = async () => {
    const { name, address, geofenceRadius } = siteDraft;
    if (!name.trim()) {
      Alert.alert('Site Name Required', 'Please enter a name for the new site.');
      return;
    }
    setCreateSiteBusy(true);
    try {
      const result = await createSite({
        name: name.trim(),
        address: address.trim(),
        managerId: currentUser?.id || currentUser?._id,
        geofenceRadiusMetres: Math.max(50, Number(geofenceRadius) || 250),
      });
      if (!result?.success) throw new Error(result?.error || 'Site creation failed.');
      setCreateSiteVisible(false);
      setSiteDraft({ name: '', address: '', geofenceRadius: '250' });
      const newId = String(result.site?.id || result.site?._id);
      if (newId) {
        setGuardDraft(prev => ({ ...prev, siteId: newId }));
        setReassignSiteId(newId);
      }
      Alert.alert('Site Created', `${result.site?.name || name} has been registered and is now available to assign to security officers.`);
    } catch (error) {
      Alert.alert('Could not create site', error.message || 'Please try again.');
    } finally {
      setCreateSiteBusy(false);
    }
  };

  const handleReassignSite = async () => {
    if (!reassignGuard || !reassignSiteId) return;
    setReassignBusy(true);
    try {
      const targetSite = (sites || []).find(s => String(s.id || s._id) === String(reassignSiteId));
      const res = await updateUser(reassignGuard.id || reassignGuard._id, { siteId: reassignSiteId });
      if (!res?.success) throw new Error(res?.error || 'Failed to update site assignment.');
      Alert.alert('Site Assigned', `${reassignGuard.name} has been assigned to ${targetSite?.name || 'the selected site'}.`);
      setReassignGuard(null);
    } catch (err) {
      Alert.alert('Could not update site', err.message || 'Please try again.');
    } finally {
      setReassignBusy(false);
    }
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
    if (type === 'random_prompt_ignored') {
      return { color: '#C8232C', bg: 'rgba(200,35,44,0.12)', border: '#C8232C', icon: '🚨', label: 'MISSED SURPRISE PATROL', isUrgent: true };
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
      if (['sos', 'random_prompt_ignored'].includes(a.type) && !['sos', 'random_prompt_ignored'].includes(b.type)) return -1;
      if (['sos', 'random_prompt_ignored'].includes(b.type) && !['sos', 'random_prompt_ignored'].includes(a.type)) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const priorityAlerts = mgrAlerts.filter(alert =>
    ['sos', 'random_prompt_ignored', 'check_call_missed', 'check_call_issue', 'geofence_warning', 'patrol_missing_checkpoints'].includes(alert.type)
      && !alert.read
  ).slice(0, 3);

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

          {priorityAlerts.length > 0 && (
            <View style={styles.priorityAlerts}>
              <View style={styles.priorityHeader}>
                <AlertTriangle color={P.danger} size={16} />
                <Text style={styles.priorityTitle}>Alert Center</Text>
                <Text style={styles.priorityCount}>{priorityAlerts.length} active</Text>
              </View>
              {priorityAlerts.map(alert => {
                const critical = alert.type === 'sos';
                const accent = critical ? P.danger : alert.type === 'check_call_missed' || alert.type === 'check_call_issue' ? P.warn : P.info;
                return (
                  <TouchableOpacity
                    key={alert.id || alert._id}
                    style={[styles.priorityCard, { borderLeftColor: accent, backgroundColor: critical ? P.dangerSubtle : P.warnSubtle }]}
                    onPress={() => setTab('alerts')}
                    activeOpacity={0.82}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.priorityCardTitle, { color: accent }]} numberOfLines={1}>{alert.title || 'Security alert'}</Text>
                      <Text style={styles.priorityCardDetail} numberOfLines={2}>{alert.message || 'Review this operational alert.'}</Text>
                    </View>
                    <Text style={styles.priorityCardTime}>{formatTime(alert.createdAt)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* KPI row */}
          <View style={styles.kpiRow}>
            <KPICard value={todayStats.activeGuards}    label="On Duty"   />
            <KPICard value={todayStats.totalCheckCalls} label="Calls"     />
            <KPICard value={todayStats.missedCheckCalls} label="Missed"   color={todayStats.missedCheckCalls > 0 ? COLORS.missed : undefined} />
            <KPICard value={todayStats.completedPatrols} label="Patrols"  />
          </View>

          <View style={styles.guardSectionHeader}>
            <Text style={[styles.sectionTitle, { flex: 1, marginBottom: 0 }]}>LIVE GUARD STATUS ({guards.length})</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.addSiteButton} onPress={() => setCreateSiteVisible(true)}>
                <Text style={styles.addSiteButtonText}>+ Add site</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addGuardButton} onPress={() => {
                if (!availableSites.length) {
                  Alert.alert('No site assigned', 'Register or assign a site before creating guards.', [
                    { text: 'Register site now', onPress: () => setCreateSiteVisible(true) },
                    { text: 'Cancel', style: 'cancel' }
                  ]);
                  return;
                }
                setGuardDraft(previous => ({ ...previous, siteId: previous.siteId || String(availableSites[0].id || availableSites[0]._id) }));
                setCreateGuardVisible(true);
              }}>
                <Text style={styles.addGuardButtonText}>+ Add guard</Text>
              </TouchableOpacity>
            </View>
          </View>
          {guards.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No Officers Deployed"
              message="There are currently no security officers assigned to your operational sites."
              style={{ marginVertical: SP.px24 }}
            />
          ) : (
            guards.map(guard => {
              const { active, session } = getGuardStatus(guard);
              const site         = sites.find(s => s.id === guard.siteId || s._id === guard.siteId);
              const todayCC      = (checkCalls || []).filter(cc => (cc.guardId === guard.id || cc.guardId === guard._id) && cc.firedAt?.startsWith(todayStr));
              const todayPatrols = (patrolSessions || []).filter(ps => (ps.guardId === guard.id || ps.guardId === guard._id) && ps.startedAt?.startsWith(todayStr));
              const latestCheckCall = (checkCalls || []).filter(cc => cc.guardId === (guard.id || guard._id)).sort((a, b) => new Date(b.respondedAt || b.firedAt) - new Date(a.respondedAt || a.firedAt))[0];
              const latestPatrol = (patrolSessions || []).filter(ps => ps.guardId === (guard.id || guard._id)).sort((a, b) => new Date(b.finishedAt || b.startedAt) - new Date(a.finishedAt || a.startedAt))[0];

              return (
                <StatusTile
                  key={guard.id || guard._id}
                  guard={guard}
                  active={active}
                  session={session}
                  site={site}
                  todayCheckCalls={todayCC}
                  todayPatrols={todayPatrols}
                  latestCheckCall={latestCheckCall}
                  latestPatrol={latestPatrol}
                  onPress={() => navigation?.navigate('GuardCheckCallPath', { guardId: guard.id || guard._id })}
                  onManualLog={(g) => setManualGuard(g)}
                  onReassignSite={(g) => {
                    setReassignGuard(g);
                    setReassignSiteId(String(g.siteId || ''));
                  }}
                />
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.alertsHeader}>
            <Text style={styles.sectionTitle}>SECURITY ALERTS & EXCEPTIONS</Text>
            {unread.length > 0 && (
              <TouchableOpacity onPress={markAllAlertsRead}>
                <Text style={styles.markAll}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {mgrAlerts.length === 0 ? (
            <EmptyState
              icon="alert"
              title="Zero Security Exceptions"
              message="All monitored security sites are operating within normal parameters. No active alerts."
              style={{ marginTop: SP.px32 }}
            />
          ) : null}

          {mgrAlerts.map(alert => {
            const sev = alertSeverity(alert.type);
            const isUnread = !alert.read && !(alert.readBy || []).includes(currentUser?.id || currentUser?._id);
            return (
              <TouchableOpacity
                key={alert.id || alert._id}
                style={[styles.alertCard, { borderColor: sev.border, backgroundColor: sev.bg }]}
                onPress={() => {
                  markAlertRead(alert.id || alert._id);
                  setSelectedAlert(alert);
                }}
                activeOpacity={0.8}
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
                <ChevronRight size={16} color={sev.color} style={{ alignSelf: 'center', marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Alert Detail Modal ── */}
      <Modal visible={!!selectedAlert} transparent animationType="fade" onRequestClose={() => setSelectedAlert(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.alertDetailCard, { paddingBottom: safeBottom + S.xl }]}>
            {selectedAlert && (() => {
              const sev = alertSeverity(selectedAlert.type);
              const targetGuard = (users || []).find(u => u.id === selectedAlert.guardId || u._id === selectedAlert.guardId);
              const targetSite = (sites || []).find(s => s.id === selectedAlert.siteId || s._id === selectedAlert.siteId);
              const guardName = selectedAlert.guardName || targetGuard?.name || 'Officer';
              const badgeNum = selectedAlert.badgeNumber || targetGuard?.badgeNumber || '—';
              const siteName = selectedAlert.siteName || targetSite?.name || 'Assigned Site';

              return (
                <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.alertDetailHeader}>
                    <View style={[styles.alertSevBadge, { backgroundColor: sev.color }]}>
                      <Text style={styles.alertSevTxt}>{sev.label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedAlert(null)} style={{ padding: 4 }}>
                      <X size={20} color={P.t3} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.alertDetailTitle, { color: sev.color }]}>
                    {selectedAlert.title || 'Security Exception Alert'}
                  </Text>
                  <Text style={styles.alertDetailTime}>{formatTime(selectedAlert.createdAt)} · {new Date(selectedAlert.createdAt).toLocaleDateString()}</Text>

                  {/* Officer & Site Telemetry Card */}
                  <View style={styles.telemetryCard}>
                    <View style={styles.telemetryRow}>
                      <Text style={styles.telemetryLabel}>SECURITY OFFICER:</Text>
                      <Text style={styles.telemetryVal}>{guardName} ({badgeNum})</Text>
                    </View>
                    <View style={styles.telemetryRow}>
                      <Text style={styles.telemetryLabel}>OPERATIONAL SITE:</Text>
                      <Text style={styles.telemetryVal}>{siteName}</Text>
                    </View>
                    {selectedAlert.category && (
                      <View style={styles.telemetryRow}>
                        <Text style={styles.telemetryLabel}>ISSUE CATEGORY:</Text>
                        <Text style={[styles.telemetryVal, { color: P.warn }]}>{selectedAlert.category}</Text>
                      </View>
                    )}
                  </View>

                  {/* Message description */}
                  <View style={styles.alertMessageBox}>
                    <Text style={styles.alertMessageTxt}>{selectedAlert.message}</Text>
                  </View>

                  {selectedAlert.note && (
                    <View style={styles.alertNoteBox}>
                      <Text style={styles.alertNoteLabel}>OFFICER NOTE / EXPLANATION:</Text>
                      <Text style={styles.alertNoteContent}>"{selectedAlert.note}"</Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={{ gap: 10, marginTop: 16 }}>
                    {selectedAlert.guardId && (
                      <TouchableOpacity
                        style={styles.actionPrimaryBtn}
                        onPress={() => {
                          const gId = selectedAlert.guardId;
                          setSelectedAlert(null);
                          navigation?.navigate('GuardCheckCallPath', { guardId: gId });
                        }}
                      >
                        <Text style={styles.actionPrimaryTxt}>View Guard Check-Call Path →</Text>
                      </TouchableOpacity>
                    )}

                    {targetGuard && (
                      <TouchableOpacity
                        style={styles.actionSecondaryBtn}
                        onPress={() => {
                          setManualGuard(targetGuard);
                          setSelectedAlert(null);
                        }}
                      >
                        <Text style={styles.actionSecondaryTxt}>Log Manual Check Call on Behalf</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedAlert(null)}>
                      <Text style={styles.cancelBtnTxt}>Dismiss & Close</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Create Site Modal */}
      <Modal visible={createSiteVisible} transparent animationType="slide" onRequestClose={() => setCreateSiteVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ScrollView style={styles.createGuardSheet} contentContainerStyle={{ paddingBottom: safeBottom + S.xl }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Register New Security Site</Text>
            <Text style={styles.modalSub}>Add a new site or client facility to your management portfolio. You can assign security officers and check-calls immediately.</Text>

            <Text style={styles.fieldLabel}>Site Name *</Text>
            <TextInput
              style={styles.accountInput}
              value={siteDraft.name}
              onChangeText={name => setSiteDraft(v => ({ ...v, name }))}
              placeholder="e.g. Metro Data Center, North Gate"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={styles.fieldLabel}>Site Address / Location</Text>
            <TextInput
              style={styles.accountInput}
              value={siteDraft.address}
              onChangeText={address => setSiteDraft(v => ({ ...v, address }))}
              placeholder="e.g. 100 Commercial Road, London"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={styles.fieldLabel}>Geofence Perimeter Radius (Metres)</Text>
            <TextInput
              style={styles.accountInput}
              value={siteDraft.geofenceRadius}
              onChangeText={geofenceRadius => setSiteDraft(v => ({ ...v, geofenceRadius }))}
              placeholder="250"
              placeholderTextColor={COLORS.textDisabled}
              keyboardType="numeric"
            />

            <TouchableOpacity style={[styles.submitBtn, createSiteBusy && styles.btnDisabled]} onPress={handleCreateSite} disabled={createSiteBusy}>
              <Text style={styles.submitBtnTxt}>{createSiteBusy ? 'Registering Site…' : 'Register & Enable Site'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateSiteVisible(false)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Guard Modal */}
      <Modal visible={createGuardVisible} transparent animationType="slide" onRequestClose={() => setCreateGuardVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ScrollView style={styles.createGuardSheet} contentContainerStyle={{ paddingBottom: safeBottom + S.xl }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Create guard account</Text>
            <Text style={styles.modalSub}>Create a sign-in for an officer at one of your assigned sites. You can publish their rota immediately after.</Text>
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput style={styles.accountInput} value={guardDraft.name} onChangeText={name => setGuardDraft(value => ({ ...value, name }))} placeholder="Guard name" placeholderTextColor={COLORS.textDisabled} autoCapitalize="words" />
            <Text style={styles.fieldLabel}>Work email</Text>
            <TextInput style={styles.accountInput} value={guardDraft.email} onChangeText={email => setGuardDraft(value => ({ ...value, email }))} placeholder="guard@company.com" placeholderTextColor={COLORS.textDisabled} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.fieldLabel}>Temporary password (12+ characters)</Text>
            <TextInput style={styles.accountInput} value={guardDraft.password} onChangeText={password => setGuardDraft(value => ({ ...value, password }))} placeholder="Set a secure temporary password" placeholderTextColor={COLORS.textDisabled} secureTextEntry autoCapitalize="none" />
            <View style={styles.guardFieldsRow}>
              <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Badge ID</Text><TextInput style={styles.accountInput} value={guardDraft.badgeNumber} onChangeText={badgeNumber => setGuardDraft(value => ({ ...value, badgeNumber }))} placeholder="Optional" placeholderTextColor={COLORS.textDisabled} /></View>
              <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Phone</Text><TextInput style={styles.accountInput} value={guardDraft.phone} onChangeText={phone => setGuardDraft(value => ({ ...value, phone }))} placeholder="Optional" placeholderTextColor={COLORS.textDisabled} keyboardType="phone-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Text style={styles.fieldLabel}>Assign site</Text>
              <TouchableOpacity onPress={() => setCreateSiteVisible(true)}>
                <Text style={{ color: COLORS.brand, fontSize: 11, fontWeight: '700' }}>+ Add new site</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.typeRow}>
              {availableSites.map(site => {
                const id = String(site.id || site._id);
                const active = String(guardDraft.siteId) === id;
                return <TouchableOpacity key={id} style={[styles.typePill, active && styles.typePillActive]} onPress={() => setGuardDraft(value => ({ ...value, siteId: id }))}><Text style={[styles.typePillTxt, active && styles.typePillTxtActive]}>{site.name}</Text></TouchableOpacity>;
              })}
            </View>
            <TouchableOpacity style={[styles.submitBtn, createGuardBusy && styles.btnDisabled]} onPress={handleCreateGuard} disabled={createGuardBusy}>
              <Text style={styles.submitBtnTxt}>{createGuardBusy ? 'Creating account…' : 'Create guard & assign site'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateGuardVisible(false)}><Text style={styles.cancelBtnTxt}>Cancel</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reassign Guard Site Modal */}
      <Modal visible={!!reassignGuard} transparent animationType="slide" onRequestClose={() => setReassignGuard(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.createGuardSheet} contentContainerStyle={{ paddingBottom: safeBottom + S.xl }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Assign Site to Officer</Text>
            <Text style={styles.modalSub}>
              Assign or transfer <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{reassignGuard?.name}</Text> ({reassignGuard?.badgeNumber || 'Officer'}) to one of your active security sites.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={styles.fieldLabel}>Select Site</Text>
              <TouchableOpacity onPress={() => { setReassignGuard(null); setCreateSiteVisible(true); }}>
                <Text style={{ color: COLORS.brand, fontSize: 11, fontWeight: '700' }}>+ Register new site</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.typeRow}>
              {availableSites.map(site => {
                const id = String(site.id || site._id);
                const active = String(reassignSiteId) === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.typePill, active && styles.typePillActive]}
                    onPress={() => setReassignSiteId(id)}
                  >
                    <Text style={[styles.typePillTxt, active && styles.typePillTxtActive]}>{site.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, (!reassignSiteId || reassignBusy) && styles.btnDisabled]}
              onPress={handleReassignSite}
              disabled={!reassignSiteId || reassignBusy}
            >
              <Text style={styles.submitBtnTxt}>{reassignBusy ? 'Updating Assignment…' : 'Confirm Site Assignment'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReassignGuard(null)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!manualGuard} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        </KeyboardAvoidingView>
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
  priorityAlerts:{ backgroundColor: COLORS.bgCard, borderColor: P.dangerBorder, borderWidth: 1, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  priorityHeader:{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm },
  priorityTitle:{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', flex: 1 },
  priorityCount:{ color: P.danger, fontSize: 11, fontWeight: '700' },
  priorityCard:{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderRadius: R.sm, padding: S.sm, marginTop: S.xs, gap: S.sm },
  priorityCardTitle:{ fontSize: 12, fontWeight: '800' },
  priorityCardDetail:{ color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  priorityCardTime:{ color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  sosBannerTxt:  { color: COLORS.white, fontSize: 14, fontWeight: '800', flex: 1 },
  kpiRow:        { flexDirection: 'row', gap: S.sm, marginBottom: S.lg },
  kpiCard:       { flex: 1, padding: S.md, alignItems: 'center' },
  kpiVal:        { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  kpiLabel:      { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  sectionTitle:  { ...TYPE.label, marginBottom: S.md },
  guardSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md },
  addSiteButton: { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.brand, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm },
  addSiteButtonText: { color: COLORS.brand, fontSize: 12, fontWeight: '800' },
  addGuardButton:{ backgroundColor: COLORS.brand, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm },
  addGuardButtonText:{ color: COLORS.white, fontSize: 12, fontWeight: '800' },
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
  createGuardSheet:{ width: '100%', maxHeight: '92%', backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderTopWidth: 0.5, borderColor: COLORS.borderSubtle },
  guardFieldsRow:{ flexDirection: 'row', gap: S.md, marginBottom: S.md },
  accountInput:  { backgroundColor: COLORS.bgInput, borderWidth: 0.5, borderColor: COLORS.borderSubtle, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 14, marginBottom: S.md },
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
  alertDetailCard: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle, maxHeight: '90%', ...shadows.lg },
  alertDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  alertDetailTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22, marginTop: 4 },
  alertDetailTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: S.md },
  telemetryCard: { backgroundColor: COLORS.bgInput, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: COLORS.borderSubtle, gap: 6, marginBottom: S.md },
  telemetryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  telemetryLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
  telemetryVal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  alertMessageBox: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: COLORS.borderSubtle, marginBottom: S.md },
  alertMessageTxt: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 20 },
  alertNoteBox: { backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', marginBottom: S.md },
  alertNoteLabel: { fontSize: 10, fontWeight: '800', color: COLORS.warn, letterSpacing: 0.5, marginBottom: 4 },
  alertNoteContent: { fontSize: 13, color: COLORS.textPrimary, fontStyle: 'italic', lineHeight: 19 },
  actionPrimaryBtn: { backgroundColor: COLORS.brand, borderRadius: R.md, paddingVertical: 14, alignItems: 'center' },
  actionPrimaryTxt: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  actionSecondaryBtn: { backgroundColor: COLORS.bgInput, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: COLORS.brand },
  actionSecondaryTxt: { color: COLORS.brand, fontSize: 13, fontWeight: '700' },
});
