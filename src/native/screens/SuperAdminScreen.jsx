import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Dimensions, Platform
} from 'react-native';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { COLORS, S, R, TYPE, shadows, cardStyle, inputStyle } from '../../theme';
import {
  Users, Shield, AlertTriangle, FileText, CheckCircle,
  XCircle, Plus, Edit2, Trash2, Power, Search, Filter,
  Download, ChevronRight, LogOut, MapPin, Clock, Zap,
  Activity, Building2, Key, RefreshCw, X
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_DESKTOP_VIEW = SCREEN_WIDTH > 768 || Platform.OS === 'web';

const SECTIONS = [
  { id: 'accounts', label: 'Accounts & Access', icon: Users },
  { id: 'system_data', label: 'System-Wide Data', icon: FileText },
  { id: 'audit_log', label: 'Audit Trail', icon: Activity },
  { id: 'sites', label: 'Sites & Geofences', icon: Building2 },
];

export function SuperAdminScreen() {
  const {
    currentUser, users, sites, logout, createSite,
    auditLogs, createUser, updateUser, toggleUserStatus, deleteUser,
    shiftSessions, checkCalls, patrolSessions, alerts
  } = useApp();

  const [activeSection, setActiveSection] = useState('accounts');

  // Account Filters & Search
  const [userSearch, setUserSearch]     = useState('');
  const [roleFilter, setRoleFilter]     = useState('all'); // all | guard | manager
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  // User Modal (Create / Edit)
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser]     = useState(null);
  const [formName, setFormName]           = useState('');
  const [formEmail, setFormEmail]         = useState('');
  const [formPassword, setFormPassword]   = useState('');
  const [formRole, setFormRole]           = useState('guard');
  const [formSiteId, setFormSiteId]       = useState('s1');
  const [formBadge, setFormBadge]         = useState('');
  const [formPhone, setFormPhone]         = useState('');
  const [modalLoading, setModalLoading]   = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteManagerId, setSiteManagerId] = useState('');
  const [siteRadius, setSiteRadius] = useState('200');

  // System-wide Data Filters
  const [dateFilter, setDateFilter]     = useState('all'); // all | today | this_week
  const [dataSiteFilter, setDataSiteFilter] = useState('all');
  const [dataTypeFilter, setDataTypeFilter] = useState('all'); // all | check_call | patrol | alert

  // Audit Log Search & Filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  // ── Open Create User Modal ────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('guard');
    setFormSiteId(sites[0]?.id || '');
    setFormBadge(`SG-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPhone('+44 7700 900');
    setShowUserModal(true);
  };

  // ── Open Edit User Modal ──────────────────────────────────────────────────
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormSiteId(user.siteId || (user.siteIds && user.siteIds[0]) || '');
    setFormBadge(user.badgeNumber || '');
    setFormPhone(user.phone || '');
    setShowUserModal(true);
  };

  // ── Save User ─────────────────────────────────────────────────────────────
  const handleSaveUser = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      return Alert.alert('Missing Fields', 'Please provide a name and email.');
    }
    if (formRole === 'guard' && !formSiteId) return Alert.alert('Site required', 'Assign a site to this guard before creating the account.');
    if (!editingUser && formPassword.trim().length < 12) return Alert.alert('Password too short', 'Choose an initial password with at least 12 characters.');
    if (editingUser && formPassword.trim() && formPassword.trim().length < 12) return Alert.alert('Password too short', 'Choose a new password with at least 12 characters.');
    setModalLoading(true);

    if (editingUser) {
      const updates = {
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        badgeNumber: formBadge.trim(),
        phone: formPhone.trim(),
        siteId: formRole === 'guard' ? formSiteId : undefined,
        siteIds: formRole === 'manager' && formSiteId ? [formSiteId] : undefined,
      };
      if (formPassword.trim()) {
        updates.password = formPassword.trim();
      }
      const res = await updateUser(editingUser.id, updates);
      setModalLoading(false);
      if (res.success) {
        setShowUserModal(false);
        Alert.alert('Account Updated', `Account for ${formName} has been modified successfully.`);
      } else {
        Alert.alert('Update Failed', res.error || 'Could not update user.');
      }
    } else {
      if (!formPassword.trim()) {
        setModalLoading(false);
        return Alert.alert('Password Required', 'Please assign an initial password for the new account.');
      }
      const res = await createUser({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword.trim(),
        role: formRole,
        siteId: formSiteId,
        siteIds: formRole === 'manager' && formSiteId ? [formSiteId] : undefined,
        badgeNumber: formBadge.trim(),
        phone: formPhone.trim(),
        status: 'active',
      });
      setModalLoading(false);
      if (res.success) {
        setShowUserModal(false);
        Alert.alert('Account Created', `New ${formRole.toUpperCase()} account created for ${formName}.`);
      } else {
        Alert.alert('Creation Failed', res.error || 'Could not create account.');
      }
    }
  };

  // ── Toggle Active / Inactive ──────────────────────────────────────────────
  const handleToggleStatus = (user) => {
    const isActivating = user.status === 'inactive';
    Alert.alert(
      isActivating ? 'Activate Account?' : 'Deactivate Account?',
      `Are you sure you want to ${isActivating ? 'activate' : 'deactivate'} ${user.name}? ${!isActivating ? 'They will no longer be able to log into the mobile apps.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActivating ? 'Activate' : 'Deactivate',
          style: isActivating ? 'default' : 'destructive',
          onPress: async () => {
            await toggleUserStatus(user.id);
          },
        },
      ]
    );
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteUser = (user) => {
    Alert.alert(
      'Delete Account Permanently?',
      `Are you sure you want to permanently delete ${user.name} (${user.badgeNumber})? This action will be audited and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteUser(user.id);
          },
        },
      ]
    );
  };

  // ── Filtered Users ────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchesName = (u.name || '').toLowerCase().includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        const matchesBadge = (u.badgeNumber || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesBadge) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, userSearch]);

  // ── System-wide Data Rows ─────────────────────────────────────────────────
  const systemDataRows = useMemo(() => {
    const rows = [];
    const today = new Date().toISOString().slice(0, 10);

    // Check calls
    if (dataTypeFilter === 'all' || dataTypeFilter === 'check_call') {
      (checkCalls || []).forEach(cc => {
        const guard = (users || []).find(u => u.id === cc.guardId);
        const site = (sites || []).find(s => s.id === cc.siteId);
        if (dataSiteFilter !== 'all' && cc.siteId !== dataSiteFilter) return;
        if (dateFilter === 'today' && !cc.firedAt?.startsWith(today)) return;

        rows.push({
          id: cc.id,
          type: 'Check Call',
          timestamp: cc.firedAt,
          guardName: guard?.name || 'Unassigned Guard',
          badgeNumber: guard?.badgeNumber || '—',
          siteName: site?.name || 'Unassigned Site',
          status: cc.response === 'yes' ? 'All Okay' : cc.response === 'missed' ? 'Missed Call' : cc.response === 'no' ? 'Issue Reported' : 'Pending',
          severity: cc.response === 'yes' ? 'ok' : cc.response === 'missed' ? 'missed' : 'issue',
          manuallyLogged: !!cc.manuallyLogged,
          outsideGeofence: !!cc.outsideGeofence,
          distanceMeters: cc.distanceMeters,
          details: cc.note || (cc.category ? `Category: ${cc.category}` : 'Regular scheduled check call'),
        });
      });
    }

    // Patrols
    if (dataTypeFilter === 'all' || dataTypeFilter === 'patrol') {
      (patrolSessions || []).forEach(ps => {
        const guard = (users || []).find(u => u.id === ps.guardId);
        const site = (sites || []).find(s => s.id === ps.siteId);
        if (dataSiteFilter !== 'all' && ps.siteId !== dataSiteFilter) return;
        if (dateFilter === 'today' && !ps.startedAt?.startsWith(today)) return;

        rows.push({
          id: ps.id,
          type: 'Patrol Tour',
          timestamp: ps.startedAt,
          guardName: guard?.name || 'Officer',
          badgeNumber: guard?.badgeNumber || '—',
          siteName: site?.name || 'Site',
          status: ps.finishedAt ? 'Completed' : 'In Progress',
          severity: ps.finishedAt ? 'ok' : 'info',
          manuallyLogged: !!ps.manuallyLogged,
          details: ps.note || 'Scheduled patrol circuit inspection',
        });
      });
    }

    // Alerts
    if (dataTypeFilter === 'all' || dataTypeFilter === 'alert') {
      (alerts || []).forEach(al => {
        const guard = (users || []).find(u => u.id === al.guardId);
        const site = (sites || []).find(s => s.id === al.siteId);
        if (dataSiteFilter !== 'all' && al.siteId !== dataSiteFilter) return;
        if (dateFilter === 'today' && !al.createdAt?.startsWith(today)) return;

        rows.push({
          id: al.id,
          type: al.type === 'sos' ? 'EMERGENCY SOS' : 'System Alert',
          timestamp: al.createdAt,
          guardName: guard?.name || 'Officer',
          badgeNumber: guard?.badgeNumber || '—',
          siteName: site?.name || 'Site',
          status: al.type === 'sos' ? 'URGENT SOS' : (al.title || 'Security Notice'),
          severity: al.type === 'sos' ? 'urgent' : 'issue',
          details: al.message || al.note || 'Supervisory alert raised.',
        });
      });
    }

    return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [checkCalls, patrolSessions, alerts, users, sites, dataSiteFilter, dataTypeFilter, dateFilter]);

  // ── Filtered Audit Logs ───────────────────────────────────────────────────
  const filteredAuditLogs = useMemo(() => {
    return (auditLogs || []).filter(item => {
      if (auditActionFilter !== 'all' && item.action !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const mAction = (item.action || '').toLowerCase().includes(q);
        const mDetails = (item.details || '').toLowerCase().includes(q);
        const mTarget = (item.targetName || '').toLowerCase().includes(q);
        const mActor = (item.actorName || '').toLowerCase().includes(q);
        if (!mAction && !mDetails && !mTarget && !mActor) return false;
      }
      return true;
    });
  }, [auditLogs, auditActionFilter, auditSearch]);

  return (
    <View style={styles.root}>
      {/* Super Admin Top Header */}
      <View style={styles.adminHeader}>
        <View style={styles.headerBrand}>
          <View style={styles.adminBadgeIcon}>
            <Shield color={COLORS.brand} size={22} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>OBSERVANT</Text>
              <View style={styles.adminTag}>
                <Text style={styles.adminTagTxt}>SUPER ADMIN PORTAL</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>Enterprise Identity & Global Security Supervision</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.userProfilePill}>
            <View style={styles.userDot} />
            <Text style={styles.userNameTxt}>{currentUser?.name || 'Chief Administrator'}</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign Out', 'Sign out of Super Admin Portal?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
          >
            <LogOut size={16} color={COLORS.textMuted} />
            <Text style={styles.signOutBtnTxt}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Container */}
      <View style={styles.bodyWrapper}>
        {/* Navigation Tabs Bar */}
        <View style={styles.navBar}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.navBtn, isActive && styles.navBtnActive]}
                onPress={() => setActiveSection(s.id)}
              >
                <Icon size={16} color={isActive ? COLORS.brand : COLORS.textMuted} />
                <Text style={[styles.navBtnTxt, isActive && styles.navBtnTxtActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} showsVerticalScrollIndicator={false}>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 1: ACCOUNTS & ACCESS
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === 'accounts' && (
            <View>
              {/* Metric Counters */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiVal}>{users.length}</Text>
                  <Text style={styles.kpiLabel}>Total Enterprise Accounts</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiVal, { color: COLORS.ok }]}>
                    {users.filter(u => u.role === 'guard' && u.status !== 'inactive').length}
                  </Text>
                  <Text style={styles.kpiLabel}>Active Security Officers</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiVal, { color: COLORS.info }]}>
                    {users.filter(u => u.role === 'manager' && u.status !== 'inactive').length}
                  </Text>
                  <Text style={styles.kpiLabel}>Operations Managers</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiVal, { color: COLORS.missed }]}>
                    {users.filter(u => u.status === 'inactive').length}
                  </Text>
                  <Text style={styles.kpiLabel}>Deactivated Accounts</Text>
                </View>
              </View>

              {/* Action Toolbar */}
              <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                  <Search size={16} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={userSearch}
                    onChangeText={setUserSearch}
                    placeholder="Search accounts by name, email, badge…"
                    placeholderTextColor={COLORS.textDisabled}
                  />
                  {userSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setUserSearch('')}>
                      <X size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filters */}
                <View style={styles.filterGroup}>
                  {['all', 'guard', 'manager'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.filterPill, roleFilter === r && styles.filterPillActive]}
                      onPress={() => setRoleFilter(r)}
                    >
                      <Text style={[styles.filterPillTxt, roleFilter === r && styles.filterPillTxtActive]}>
                        {r === 'all' ? 'All Roles' : r === 'guard' ? 'Guards' : 'Managers'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {['all', 'active', 'inactive'].map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.filterPill, statusFilter === st && styles.filterPillActive]}
                      onPress={() => setStatusFilter(st)}
                    >
                      <Text style={[styles.filterPillTxt, statusFilter === st && styles.filterPillTxtActive]}>
                        {st === 'all' ? 'All Status' : st === 'active' ? 'Active Only' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.createAccountBtn} onPress={handleOpenCreate}>
                  <Plus size={16} color={COLORS.white} />
                  <Text style={styles.createAccountBtnTxt}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {/* Account Table / Cards */}
              <View style={styles.accountList}>
                {filteredUsers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Users size={36} color={COLORS.textDisabled} />
                    <Text style={styles.emptyCardTitle}>No Accounts Found</Text>
                    <Text style={styles.emptyCardSub}>Try adjusting your search criteria or role filters.</Text>
                  </View>
                ) : (
                  filteredUsers.map(user => {
                    const isSuper = user.role === 'superadmin';
                    const isMgr = user.role === 'manager';
                    const isGuard = user.role === 'guard';
                    const isActive = user.status !== 'inactive';
                    const assignedSite = sites.find(s => s.id === user.siteId);

                    return (
                      <View key={user.id} style={[styles.userCard, !isActive && styles.userCardInactive]}>
                        <View style={styles.userCardMain}>
                          <View style={[styles.userAvatar, { backgroundColor: isSuper ? '#8b5cf6' : isMgr ? '#0284c7' : COLORS.brandDark }]}>
                            <Text style={styles.userAvatarTxt}>
                              {(user.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.userMeta}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
                              <Text style={styles.userName}>{user.name}</Text>
                              <View style={[styles.roleBadge, isSuper ? styles.roleBadgeAdmin : isMgr ? styles.roleBadgeMgr : styles.roleBadgeGuard]}>
                                <Text style={styles.roleBadgeTxt}>
                                  {isSuper ? 'SUPER ADMIN' : isMgr ? 'OPERATIONS MANAGER' : 'SECURITY OFFICER'}
                                </Text>
                              </View>
                              <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                                <Text style={[styles.statusBadgeTxt, { color: isActive ? COLORS.ok : COLORS.missed }]}>
                                  {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.userEmail}>{user.email} · Badge: {user.badgeNumber || 'HQ'} · Phone: {user.phone || 'N/A'}</Text>

                            <View style={styles.siteAssignmentRow}>
                              <Building2 size={13} color={COLORS.textMuted} />
                              <Text style={styles.siteAssignmentTxt}>
                                {isSuper
                                  ? 'Global Enterprise Access (All Sites)'
                                  : isMgr
                                  ? `Supervising: ${sites.map(s => s.name).join(', ')}`
                                  : `Primary Site: ${assignedSite?.name || 'Unassigned'}`}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Actions */}
                        {!isSuper && (
                          <View style={styles.userActionsRow}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenEdit(user)}>
                              <Edit2 size={14} color={COLORS.info} />
                              <Text style={[styles.actionBtnTxt, { color: COLORS.info }]}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionBtn, { borderColor: isActive ? COLORS.missedBorder : COLORS.okBorder }]}
                              onPress={() => handleToggleStatus(user)}
                            >
                              <Power size={14} color={isActive ? COLORS.missed : COLORS.ok} />
                              <Text style={[styles.actionBtnTxt, { color: isActive ? COLORS.missed : COLORS.ok }]}>
                                {isActive ? 'Deactivate' : 'Activate'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionBtn, { borderColor: 'rgba(239,68,68,0.3)' }]}
                              onPress={() => handleDeleteUser(user)}
                            >
                              <Trash2 size={14} color={COLORS.missed} />
                              <Text style={[styles.actionBtnTxt, { color: COLORS.missed }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 2: SYSTEM-WIDE DATA & REPORTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === 'system_data' && (
            <View>
              {/* Filter controls */}
              <View style={styles.toolbar}>
                <View style={styles.filterGroup}>
                  {['all', 'today'].map(df => (
                    <TouchableOpacity
                      key={df}
                      style={[styles.filterPill, dateFilter === df && styles.filterPillActive]}
                      onPress={() => setDateFilter(df)}
                    >
                      <Text style={[styles.filterPillTxt, dateFilter === df && styles.filterPillTxtActive]}>
                        {df === 'all' ? 'All Time' : "Today's Data"}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {['all', 'check_call', 'patrol', 'alert'].map(dt => (
                    <TouchableOpacity
                      key={dt}
                      style={[styles.filterPill, dataTypeFilter === dt && styles.filterPillActive]}
                      onPress={() => setDataTypeFilter(dt)}
                    >
                      <Text style={[styles.filterPillTxt, dataTypeFilter === dt && styles.filterPillTxtActive]}>
                        {dt === 'all' ? 'All Activities' : dt === 'check_call' ? 'Check Calls' : dt === 'patrol' ? 'Patrols' : 'Alerts/SOS'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.siteFilterRow}>
                  <Text style={styles.siteFilterLabel}>Site Scope:</Text>
                  <TouchableOpacity
                    style={[styles.filterPill, dataSiteFilter === 'all' && styles.filterPillActive]}
                    onPress={() => setDataSiteFilter('all')}
                  >
                    <Text style={[styles.filterPillTxt, dataSiteFilter === 'all' && styles.filterPillTxtActive]}>
                      All Sites
                    </Text>
                  </TouchableOpacity>
                  {sites.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.filterPill, dataSiteFilter === s.id && styles.filterPillActive]}
                      onPress={() => setDataSiteFilter(s.id)}
                    >
                      <Text style={[styles.filterPillTxt, dataSiteFilter === s.id && styles.filterPillTxtActive]}>
                        {s.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Data Table */}
              <View style={styles.dataTableCard}>
                <View style={styles.dataTableHeader}>
                  <Text style={[styles.thTxt, { flex: 1.5 }]}>ACTIVITY / EVENT</Text>
                  <Text style={[styles.thTxt, { flex: 1.5 }]}>OFFICER & BADGE</Text>
                  <Text style={[styles.thTxt, { flex: 1.5 }]}>SITE</Text>
                  <Text style={[styles.thTxt, { flex: 1.2 }]}>TIMESTAMP</Text>
                  <Text style={[styles.thTxt, { flex: 2 }]}>DETAILS & FLAGS</Text>
                </View>

                {systemDataRows.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardTitle}>No Records Found</Text>
                    <Text style={styles.emptyCardSub}>No operational records matching current filters.</Text>
                  </View>
                ) : (
                  systemDataRows.slice(0, 50).map((row, idx) => (
                    <View key={row.id + idx} style={styles.dataTableRow}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.rowTypeTxt}>{row.type}</Text>
                        <Text style={[styles.rowStatusPill, {
                          color: row.severity === 'ok' ? COLORS.ok :
                                 row.severity === 'missed' || row.severity === 'urgent' ? COLORS.missed : COLORS.issue
                        }]}>
                          {row.status}
                        </Text>
                      </View>

                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.rowOfficerName}>{row.guardName}</Text>
                        <Text style={styles.rowOfficerBadge}>{row.badgeNumber}</Text>
                      </View>

                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.rowSiteTxt}>{row.siteName}</Text>
                      </View>

                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.rowTimeTxt}>{formatTime(row.timestamp)}</Text>
                        <Text style={styles.rowDateTxt}>{formatDate(row.timestamp)}</Text>
                      </View>

                      <View style={{ flex: 2 }}>
                        {row.manuallyLogged && (
                          <View style={styles.tableManualBadge}>
                            <Text style={styles.tableManualBadgeTxt}>📝 Manually logged by Manager</Text>
                          </View>
                        )}
                        {row.outsideGeofence && (
                          <View style={styles.tableGeoBadge}>
                            <Text style={styles.tableGeoBadgeTxt}>⚠️ Out of bounds ({row.distanceMeters || '300'}m)</Text>
                          </View>
                        )}
                        <Text style={styles.rowDetailTxt} numberOfLines={2}>{row.details}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 3: AUDIT TRAIL LOG
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === 'audit_log' && (
            <View>
              <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                  <Search size={16} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={auditSearch}
                    onChangeText={setAuditSearch}
                    placeholder="Search audit trail by actor, target, or details…"
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>

                <View style={styles.filterGroup}>
                  {['all', 'ACCOUNT_CREATED', 'MANUAL_LOG_ENTERED', 'SOS_TRIGGERED', 'ISSUE_REPORTED'].map(act => (
                    <TouchableOpacity
                      key={act}
                      style={[styles.filterPill, auditActionFilter === act && styles.filterPillActive]}
                      onPress={() => setAuditActionFilter(act)}
                    >
                      <Text style={[styles.filterPillTxt, auditActionFilter === act && styles.filterPillTxtActive]}>
                        {act === 'all' ? 'All Actions' : act.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.auditList}>
                {filteredAuditLogs.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Activity size={36} color={COLORS.textDisabled} />
                    <Text style={styles.emptyCardTitle}>No Audit Events Found</Text>
                  </View>
                ) : (
                  filteredAuditLogs.map(log => {
                    const isUrgent = log.severity === 'urgent';
                    const isWarn = log.severity === 'warning';
                    return (
                      <View key={log.id} style={[styles.auditCard, isUrgent && styles.auditCardUrgent]}>
                        <View style={styles.auditCardHeader}>
                          <View style={styles.auditActionBadge}>
                            <Text style={styles.auditActionTxt}>{log.action.replace(/_/g, ' ')}</Text>
                          </View>
                          <Text style={styles.auditTime}>{formatDate(log.timestamp)} at {formatTime(log.timestamp)}</Text>
                        </View>

                        <Text style={styles.auditActor}>
                          Initiated by: <Text style={{ color: COLORS.white, fontWeight: '700' }}>{log.actorName} ({log.actorRole.toUpperCase()})</Text>
                          {log.targetName ? ` → Target: ${log.targetName}` : ''}
                        </Text>

                        <Text style={styles.auditDetails}>{log.details}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 4: SITES & GEOFENCES
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === 'sites' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { alignSelf: 'flex-start', marginBottom: 16 }]}
                onPress={() => {
                  setSiteName(''); setSiteAddress(''); setSiteRadius('200');
                  setSiteManagerId(users.find(user => user.role === 'manager' && user.status !== 'inactive')?.id || '');
                  setShowSiteModal(true);
                }}
              >
                <Plus color={COLORS.white} size={16} />
                <Text style={styles.actionBtnTxt}>Add Site</Text>
              </TouchableOpacity>
              <View style={styles.sitesGrid}>
              {sites.map(site => {
                const manager = users.find(u => u.id === site.managerId);
                const assignedGuards = users.filter(u => u.siteId === site.id);
                return (
                  <View key={site.id} style={styles.siteCard}>
                    <View style={styles.siteHeader}>
                      <Building2 color={COLORS.brand} size={22} />
                      <Text style={styles.siteCardTitle}>{site.name}</Text>
                    </View>
                    <Text style={styles.siteCardAddress}>{site.address}</Text>

                    <View style={styles.siteInfoBlock}>
                      <Text style={styles.siteInfoRow}>
                        <Text style={styles.siteInfoLabel}>Manager: </Text>
                        {manager?.name || 'Elena Rostova'}
                      </Text>
                      <Text style={styles.siteInfoRow}>
                        <Text style={styles.siteInfoLabel}>Assigned Guards: </Text>
                        {assignedGuards.length} Officers
                      </Text>
                      <Text style={styles.siteInfoRow}>
                        <Text style={styles.siteInfoLabel}>Geofence Radius: </Text>
                        {site.geofenceRadiusMeters || 500} metres (Verified GPS Enforced)
                      </Text>
                      <Text style={styles.siteInfoRow}>
                        <Text style={styles.siteInfoLabel}>GPS Coordinates: </Text>
                        {site.latitude || '51.5050'}°, {site.longitude || '-0.0195'}°
                      </Text>
                    </View>
                  </View>
                );
              })}
              {sites.length === 0 && <Text style={styles.siteCardAddress}>No sites configured. Add a site, then assign managers and guards.</Text>}
              </View>
            </>
          )}

        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE / EDIT ACCOUNT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showUserModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>
                {editingUser ? 'Edit Account' : 'Create New Account'}
              </Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <X color={COLORS.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.formLabel}>Full Legal Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. David Miller"
                placeholderTextColor={COLORS.textDisabled}
              />

              <Text style={styles.formLabel}>Email Address (Login Identity) *</Text>
              <TextInput
                style={styles.formInput}
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="david@observant.com"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>
                {editingUser ? 'New Password (leave blank to retain current)' : 'Password *'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="Minimum 12 characters"
                placeholderTextColor={COLORS.textDisabled}
                secureTextEntry
              />

              <Text style={styles.formLabel}>Operational Role *</Text>
              <View style={styles.rolePickerRow}>
                {[
                  { id: 'guard', label: 'Security Officer (Guard)' },
                  { id: 'manager', label: 'Operations Manager' },
                ].map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleSelectBtn, formRole === r.id && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole(r.id)}
                  >
                    <Text style={[styles.roleSelectBtnTxt, formRole === r.id && styles.roleSelectBtnTxtActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Assigned Site *</Text>
              <View style={styles.siteSelectGroup}>
                {sites.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.siteOptionBtn, formSiteId === s.id && styles.siteOptionBtnActive]}
                    onPress={() => setFormSiteId(s.id)}
                  >
                    <Text style={[styles.siteOptionBtnTxt, formSiteId === s.id && styles.siteOptionBtnTxtActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Badge Number</Text>
              <TextInput
                style={styles.formInput}
                value={formBadge}
                onChangeText={setFormBadge}
                placeholder="SG-1088"
                placeholderTextColor={COLORS.textDisabled}
              />

              <Text style={styles.formLabel}>Contact Phone</Text>
              <TextInput
                style={styles.formInput}
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="+44 7700 900010"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="phone-pad"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowUserModal(false)}
                disabled={modalLoading}
              >
                <Text style={styles.modalCancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, modalLoading && styles.btnDisabled]}
                onPress={handleSaveUser}
                disabled={modalLoading}
              >
                <Text style={styles.modalSubmitBtnTxt}>
                  {modalLoading ? 'Saving…' : editingUser ? 'Save Changes' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSiteModal} transparent animationType="fade" onRequestClose={() => setShowSiteModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Create Operational Site</Text>
              <TouchableOpacity onPress={() => setShowSiteModal(false)}><X color={COLORS.textMuted} size={20} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Site name *</Text>
              <TextInput style={styles.formInput} value={siteName} onChangeText={setSiteName} placeholder="e.g. North Gate" placeholderTextColor={COLORS.textDisabled} />
              <Text style={styles.formLabel}>Address</Text>
              <TextInput style={styles.formInput} value={siteAddress} onChangeText={setSiteAddress} placeholder="Street, city" placeholderTextColor={COLORS.textDisabled} />
              <Text style={styles.formLabel}>Manager *</Text>
              {users.filter(user => user.role === 'manager' && user.status !== 'inactive').map(manager => (
                <TouchableOpacity key={manager.id} style={[styles.siteOptionBtn, siteManagerId === manager.id && styles.siteOptionBtnActive]} onPress={() => setSiteManagerId(manager.id)}>
                  <Text style={styles.siteOptionBtnTxt}>{manager.name}</Text>
                </TouchableOpacity>
              ))}
              {users.every(user => user.role !== 'manager' || user.status === 'inactive') && <Text style={styles.siteCardAddress}>Create an active manager account first.</Text>}
              <Text style={styles.formLabel}>Geofence radius (metres)</Text>
              <TextInput style={styles.formInput} value={siteRadius} onChangeText={setSiteRadius} keyboardType="number-pad" placeholder="200" placeholderTextColor={COLORS.textDisabled} />
              <TouchableOpacity
                style={[styles.actionBtn, { marginTop: 20, opacity: modalLoading ? 0.6 : 1 }]}
                disabled={modalLoading}
                onPress={async () => {
                  if (!siteName.trim() || !siteManagerId) return Alert.alert('Required fields', 'Enter a site name and select an active manager.');
                  setModalLoading(true);
                  const result = await createSite({ name: siteName.trim(), address: siteAddress.trim(), managerId: siteManagerId, geofenceRadiusMetres: Math.max(50, Number(siteRadius) || 200) });
                  setModalLoading(false);
                  if (!result.success) return Alert.alert('Site could not be created', result.error || 'Please try again.');
                  setShowSiteModal(false);
                  Alert.alert('Site created', `${result.site.name} is ready for guard and checkpoint setup.`);
                }}
              >
                <Text style={styles.actionBtnTxt}>{modalLoading ? 'Saving…' : 'Create Site'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgRoot },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c121e',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingHorizontal: S.xl,
    paddingVertical: S.lg,
    flexWrap: 'wrap',
    gap: S.md,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  adminBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: COLORS.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  adminTag: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: COLORS.brandBorder,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adminTagTxt: { color: COLORS.brand, fontSize: 10, fontWeight: '800' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  userProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
  },
  userDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.ok },
  userNameTxt: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: R.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutBtnTxt: { color: COLORS.missed, fontSize: 12, fontWeight: '700' },
  bodyWrapper: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingHorizontal: S.xl,
    gap: S.sm,
    flexWrap: 'wrap',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navBtnActive: { borderBottomColor: COLORS.brand },
  navBtnTxt: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  navBtnTxtActive: { color: COLORS.white, fontWeight: '800' },
  mainScroll: { flex: 1 },
  mainScrollContent: { padding: S.xl, paddingBottom: 80 },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S.md,
    marginBottom: S.xl,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    ...shadows.sm,
  },
  kpiVal: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  kpiLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: S.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: S.lg,
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgInput,
    borderRadius: R.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: 13, paddingVertical: 10 },
  filterGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterPill: {
    backgroundColor: COLORS.bgInput,
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
  },
  filterPillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  filterPillTxt: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  filterPillTxtActive: { color: COLORS.black, fontWeight: '800' },
  createAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.brand,
    borderRadius: R.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadows.brand,
  },
  createAccountBtnTxt: { color: COLORS.black, fontSize: 13, fontWeight: '800' },
  accountList: { gap: S.md },
  userCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: IS_DESKTOP_VIEW ? 'row' : 'column',
    alignItems: IS_DESKTOP_VIEW ? 'center' : 'stretch',
    justifyContent: 'space-between',
    gap: S.md,
    ...shadows.sm,
  },
  userCardInactive: { opacity: 0.6, borderColor: 'rgba(239,68,68,0.2)' },
  userCardMain: { flexDirection: 'row', alignItems: 'center', gap: S.md, flex: 1 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  userAvatarTxt: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  userMeta: { flex: 1 },
  userName: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  roleBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeAdmin: { backgroundColor: 'rgba(168,85,247,0.18)' },
  roleBadgeMgr:   { backgroundColor: 'rgba(56,189,248,0.18)' },
  roleBadgeGuard: { backgroundColor: 'rgba(16,185,129,0.18)' },
  roleBadgeTxt:   { fontSize: 10, fontWeight: '800', color: COLORS.white },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  statusBadgeActive: { backgroundColor: COLORS.okBg, borderColor: COLORS.okBorder },
  statusBadgeInactive: { backgroundColor: COLORS.missedBg, borderColor: COLORS.missedBorder },
  statusBadgeTxt: { fontSize: 10, fontWeight: '800' },
  userEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  siteAssignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  siteAssignmentTxt: { color: COLORS.textSecondary, fontSize: 12 },
  userActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: R.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.xxl,
    alignItems: 'center',
    gap: S.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  emptyCardTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  emptyCardSub: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  siteFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  siteFilterLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  dataTableCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    overflow: 'hidden',
    ...shadows.md,
  },
  dataTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0c121e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  thTxt: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dataTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: 8,
  },
  rowTypeTxt: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  rowStatusPill: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  rowOfficerName: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  rowOfficerBadge: { color: COLORS.textMuted, fontSize: 11 },
  rowSiteTxt: { color: COLORS.textSecondary, fontSize: 12 },
  rowTimeTxt: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  rowDateTxt: { color: COLORS.textMuted, fontSize: 11 },
  rowDetailTxt: { color: COLORS.textSecondary, fontSize: 12 },
  tableManualBadge: { backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: COLORS.info, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, alignSelf: 'flex-start' },
  tableManualBadgeTxt: { color: COLORS.info, fontSize: 10, fontWeight: '800' },
  tableGeoBadge: { backgroundColor: COLORS.missedBg, borderWidth: 1, borderColor: COLORS.missedBorder, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, alignSelf: 'flex-start' },
  tableGeoBadgeTxt: { color: COLORS.missed, fontSize: 10, fontWeight: '800' },
  auditList: { gap: S.md },
  auditCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    ...shadows.sm,
  },
  auditCardUrgent: { borderColor: COLORS.sosBorder, backgroundColor: 'rgba(255,45,85,0.08)' },
  auditCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  auditActionBadge: { backgroundColor: COLORS.bgInput, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.borderMid },
  auditActionTxt: { color: COLORS.brand, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  auditTime: { color: COLORS.textMuted, fontSize: 12 },
  auditActor: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  auditDetails: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 18 },
  sitesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.lg },
  siteCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: COLORS.bgCard,
    borderRadius: R.lg,
    padding: S.xl,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    ...shadows.sm,
  },
  siteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  siteCardTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  siteCardAddress: { color: COLORS.textMuted, fontSize: 13, marginBottom: S.lg },
  siteInfoBlock: { gap: 6, backgroundColor: COLORS.bgInput, borderRadius: R.md, padding: S.md },
  siteInfoRow: { color: COLORS.textSecondary, fontSize: 13 },
  siteInfoLabel: { color: COLORS.white, fontWeight: '700' },
  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: S.lg },
  modalBox: { width: '100%', maxWidth: 520, backgroundColor: COLORS.bgCard, borderRadius: R.xl, padding: S.xl, borderWidth: 1, borderColor: COLORS.borderSubtle, ...shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  modalTitleText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  formLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, padding: 12, color: COLORS.white, fontSize: 14 },
  rolePickerRow: { flexDirection: 'row', gap: S.md },
  roleSelectBtn: { flex: 1, backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' },
  roleSelectBtnActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: COLORS.brand },
  roleSelectBtnTxt: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  roleSelectBtnTxtActive: { color: COLORS.brand },
  siteSelectGroup: { gap: 6 },
  siteOptionBtn: { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, padding: 10 },
  siteOptionBtnActive: { borderColor: COLORS.info, backgroundColor: 'rgba(56,189,248,0.15)' },
  siteOptionBtnTxt: { color: COLORS.textSecondary, fontSize: 13 },
  siteOptionBtnTxtActive: { color: COLORS.white, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.md, marginTop: S.xl },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: R.md, backgroundColor: COLORS.bgInput },
  modalCancelBtnTxt: { color: COLORS.textSecondary, fontWeight: '600' },
  modalSubmitBtn: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: COLORS.brand, ...shadows.brand },
  modalSubmitBtnTxt: { color: COLORS.black, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});
