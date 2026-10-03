import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import * as Location from 'expo-location';
import { load, save, KEYS, seedIfEmpty } from '../data/store';
import {
  API_ENABLED, apiGet, apiPost, apiPatch, apiDelete, restoreTokens, setTokens,
  apiUpload,
  idOf, normalizeUser, normalizeSite, normalizeSession, normalizeCheckCall,
  normalizePatrol, normalizeRoster, normalizeAlert, normalizeCheckpoint,
} from '../services/api';
import { registerPushNotifications } from '../services/pushNotifications';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

async function loadRemoteSnapshot(user) {
  const isManager = user.role === 'manager' || user.role === 'admin' || user.role === 'superadmin';
  const [sitesResult, shiftsResult, callsResult, patrolsResult, rostersResult, usersResult, alertsResult, templatesResult, auditResult] = await Promise.all([
    apiGet('/api/sites'),
    apiGet('/api/shifts?limit=100'),
    apiGet('/api/check-calls?limit=100'),
    apiGet('/api/patrols?limit=100'),
    apiGet('/api/rosters'),
    isManager ? apiGet('/api/users?active=all') : Promise.resolve({ users: [] }),
    isManager ? apiGet('/api/alerts?limit=100') : Promise.resolve({ alerts: [] }),
    isManager ? apiGet('/api/rosters/templates') : Promise.resolve({ templates: [] }),
    isManager ? apiGet('/api/audit-logs?limit=100') : Promise.resolve({ logs: [] }),
  ]);
  const sites = (sitesResult.sites || []).map(normalizeSite);
  const checkpointsBySite = await Promise.all(sites.map(site => apiGet(`/api/patrols/checkpoints?siteId=${encodeURIComponent(site.id)}`)));
  const patrols = (patrolsResult.patrols || []).map(normalizePatrol);
  return {
    users: isManager ? (usersResult.users || []).map(normalizeUser) : [user],
    sites,
    checkpoints: checkpointsBySite.flatMap(result => (result.checkpoints || []).map(normalizeCheckpoint)),
    shiftSessions: (shiftsResult.sessions || []).map(normalizeSession),
    checkCalls: (callsResult.checkCalls || []).map(normalizeCheckCall),
    patrolSessions: patrols,
    patrolCaptures: patrols.flatMap(patrol => patrol.captures || []),
    rosters: (rostersResult.rosters || []).map(normalizeRoster),
    alerts: (alertsResult.alerts || []).map(alert => ({ ...normalizeAlert(alert), read: !!alert.isRead })),
    rosterTemplates: templatesResult.templates || [],
    auditLogs: (auditResult.logs || []).map(log => ({
      id: idOf(log), action: log.action, actorName: log.actorName || log.actorId?.name || 'System',
      actorRole: log.actorRole || log.actorId?.role || 'system', targetName: log.targetName || '—',
      details: typeof log.details === 'string' ? log.details : log.details ? JSON.stringify(log.details) : '',
      severity: /sos|missed|deactivated/i.test(log.action) ? 'warning' : 'info',
      timestamp: log.createdAt,
    })),
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHECK_CALL_INTERVAL_MS = 60 * 60 * 1000;   // 1 hour
const CHECK_CALL_WINDOW_MS   = 10 * 60 * 1000;   // 10 min to respond
const PATROL_INTERVAL_MS     = 60 * 60 * 1000;   // 1 hour between patrols
const ANTI_IDLE_MIN_MS       = 10 * 60 * 1000;   // earliest random patrol prompt
const ANTI_IDLE_MAX_MS       = 30 * 60 * 1000;   // latest random patrol prompt
const SHIFT_END_WARN_MS      = 10 * 60 * 1000;   // 10 min before shift end

export function AppProvider({ children }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser]     = useState(null);
  const [authLoading, setAuthLoading]     = useState(true);

  // ── Reference data ────────────────────────────────────────────────────────
  const [users, setUsers]                 = useState([]);
  const [sites, setSites]                 = useState([]);
  const [checkpoints, setCheckpoints]     = useState([]);

  // ── Operational state ─────────────────────────────────────────────────────
  const [shiftSessions, setShiftSessions]   = useState([]);
  const [checkCalls, setCheckCalls]         = useState([]);
  const [patrolSessions, setPatrolSessions] = useState([]);
  const [patrolCaptures, setPatrolCaptures] = useState([]);
  const [randomPromptLogs, setRandomPromptLogs] = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [rosters, setRosters]             = useState([]);
  const [rosterTemplates, setRosterTemplates] = useState([]);
  const [auditLogs, setAuditLogs]         = useState([]);

  // ── Live timers / UI state ─────────────────────────────────────────────────
  const [activeCheckCall, setActiveCheckCall]   = useState(null);  // pending check call awaiting guard response
  const [activePatrol, setActivePatrol]         = useState(null);  // in-progress patrol session
  const [antiIdlePrompt, setAntiIdlePrompt]     = useState(false); // show surprise patrol prompt
  const [shiftEndWarning, setShiftEndWarning]   = useState(false);

  const checkCallTimerRef   = useRef(null);
  const checkCallExpireRef  = useRef(null);
  const patrolTimerRef      = useRef(null);
  const antiIdleTimerRef    = useRef(null);
  const shiftEndTimerRef    = useRef(null);
  const expireCheckCallHandlerRef = useRef(null);
  const appStateRef         = useRef(AppState.currentState);

  // ─── Load all data from AsyncStorage ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (API_ENABLED) {
      const savedTokens = await restoreTokens();
      if (savedTokens?.accessToken) {
        try {
          const { user: rawUser } = await apiGet('/api/auth/me');
          const user = normalizeUser(rawUser);
          const snapshot = await loadRemoteSnapshot(user);
          Object.entries(snapshot).forEach(([key, value]) => {
            const setters = {
              users: setUsers, sites: setSites, checkpoints: setCheckpoints,
              shiftSessions: setShiftSessions, checkCalls: setCheckCalls,
              patrolSessions: setPatrolSessions, patrolCaptures: setPatrolCaptures,
              rosters: setRosters, alerts: setAlerts, rosterTemplates: setRosterTemplates, auditLogs: setAuditLogs,
            };
            setters[key]?.(value);
          });
          setCurrentUser(user);
          const activeShift = snapshot.shiftSessions.find(session => session.guardId === user.id && !session.bookedOffAt);
          const pendingCall = snapshot.checkCalls.find(call => call.guardId === user.id && !call.response);
          const activePatrolRecord = snapshot.patrolSessions.find(patrol => patrol.guardId === user.id && patrol.status === 'in_progress');
          if (activeShift) {
            if (activeShift.scheduledEndAt && new Date(activeShift.scheduledEndAt).getTime() - Date.now() <= SHIFT_END_WARN_MS) setShiftEndWarning(true);
            setActiveCheckCall(pendingCall || null);
            if (activePatrolRecord) {
              const detail = await apiGet(`/api/patrols/${activePatrolRecord.id}`);
              const active = normalizePatrol(detail.patrol);
              setActivePatrol(active);
              setPatrolSessions(previous => previous.map(item => item.id === active.id ? active : item));
            }
          }
        } catch (error) {
          if (error.status === 401) {
            await setTokens(null);
            await save(KEYS.CURRENT_USER_ID, null);
          }
          console.warn('[Observant] Could not restore server session:', error.message);
        }
      }
      setAuthLoading(false);
      return;
    }
    // Seed before the first read. App-level parallel seeding could race login
    // initialization and leave a fresh install looking like an empty app.
    await seedIfEmpty();
    const [
      u, s, cp, ss, cc, ps, pc, rpl, al, ro, rt, uid, aud
    ] = await Promise.all([
      load(KEYS.USERS),
      load(KEYS.SITES),
      load(KEYS.PATROL_CHECKPOINTS),
      load(KEYS.SHIFT_SESSIONS),
      load(KEYS.CHECK_CALLS),
      load(KEYS.PATROL_SESSIONS),
      load(KEYS.PATROL_CAPTURES),
      load(KEYS.RANDOM_PROMPT_LOGS),
      load(KEYS.ALERTS),
      load(KEYS.SHIFT_ROSTERS),
      load(KEYS.ROSTER_TEMPLATES),
      load(KEYS.CURRENT_USER_ID),
      load(KEYS.AUDIT_LOGS),
    ]);

    setUsers(u || []);
    setSites(s || []);
    setCheckpoints(cp || []);
    setShiftSessions(ss || []);
    setCheckCalls(cc || []);
    setPatrolSessions(ps || []);
    setPatrolCaptures(pc || []);
    setRandomPromptLogs(rpl || []);
    setAlerts(al || []);
    setRosters(ro || []);
    setRosterTemplates(rt || []);
    setAuditLogs(aud || []);

    if (uid && u) {
      const found = (u || []).find(x => x.id === uid);
      if (found) setCurrentUser(found);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!API_ENABLED || !currentUser) return undefined;
    const refreshOperations = async () => {
      try {
        const [shifts, calls, patrols, alerts, prompts, rostersResult] = await Promise.all([
          apiGet('/api/shifts?limit=100'),
          apiGet('/api/check-calls?limit=100'),
          apiGet('/api/patrols?limit=100'),
          currentUser.role === 'guard' ? Promise.resolve({ alerts: [] }) : apiGet('/api/alerts?limit=100'),
          apiGet('/api/patrols/random-prompt?limit=100'),
          apiGet('/api/rosters'),
        ]);
        setShiftSessions((shifts.sessions || []).map(normalizeSession));
        const activeShift = (shifts.sessions || []).find(session => idOf(session.guardId) === currentUser.id && !session.bookedOffAt);
        if (activeShift?.scheduledEndAt && new Date(activeShift.scheduledEndAt).getTime() - Date.now() <= SHIFT_END_WARN_MS) setShiftEndWarning(true);
        const callsList = (calls.checkCalls || []).map(normalizeCheckCall);
        setCheckCalls(callsList);
        const pending = callsList.find(call => call.guardId === currentUser.id && !call.response);
        setActiveCheckCall(pending || null);
        const patrolList = (patrols.patrols || []).map(normalizePatrol);
        setPatrolSessions(patrolList);
        setRosters((rostersResult.rosters || []).map(normalizeRoster));
        const active = patrolList.find(patrol => patrol.guardId === currentUser.id && patrol.status === 'in_progress');
        if (active && !activePatrol) {
          const detail = await apiGet(`/api/patrols/${active.id}`);
          setActivePatrol(normalizePatrol(detail.patrol));
        }
        setAlerts((alerts.alerts || []).map(alert => ({ ...normalizeAlert(alert), read: !!alert.isRead })));
        const promptList = prompts.logs || [];
        setRandomPromptLogs(promptList.map(prompt => ({ ...prompt, id: idOf(prompt), guardId: idOf(prompt.guardId), sessionId: idOf(prompt.shiftSessionId) })));
        if (currentUser.role === 'guard') setAntiIdlePrompt(promptList.some(prompt =>
          idOf(prompt.guardId) === currentUser.id && !prompt.responded && !prompt.managerAlerted
          && (!prompt.expiresAt || new Date(prompt.expiresAt).getTime() > Date.now())
        ));
      } catch (error) {
        console.warn('[Observant] Operation refresh failed:', error.message);
      }
    };
    refreshOperations();
    const interval = setInterval(refreshOperations, 30_000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.role, activePatrol?.id]);

  // ─── Handle app coming to foreground — resume timers if shift is active ───
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        rehydrateTimers();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  });

  // ─── Audit Log ────────────────────────────────────────────────────────────
  const addAuditLog = useCallback(async ({ action, actorName, actorRole, targetName, details, severity = 'info' }) => {
    if (API_ENABLED) return null; // The server writes actor-attributed audit records for remote operations.
    const newEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      action,
      actorName: actorName || currentUser?.name || 'System',
      actorRole: actorRole || currentUser?.role || 'system',
      targetName: targetName || '—',
      details: details || '',
      severity,
      timestamp: new Date().toISOString(),
    };
    const current = await load(KEYS.AUDIT_LOGS) || [];
    const updated = [newEntry, ...current];
    await save(KEYS.AUDIT_LOGS, updated);
    setAuditLogs(updated);
    return newEntry;
  }, [currentUser]);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (API_ENABLED) {
      try {
        const response = await apiPost('/api/auth/login', { email: email.trim().toLowerCase(), password });
        await setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
        const user = normalizeUser(response.user);
        const snapshot = await loadRemoteSnapshot(user);
        setUsers(snapshot.users); setSites(snapshot.sites); setCheckpoints(snapshot.checkpoints);
        setShiftSessions(snapshot.shiftSessions); setCheckCalls(snapshot.checkCalls);
        setPatrolSessions(snapshot.patrolSessions); setPatrolCaptures(snapshot.patrolCaptures);
        setRosters(snapshot.rosters); setAlerts(snapshot.alerts); setRosterTemplates(snapshot.rosterTemplates);
        setAuditLogs(snapshot.auditLogs);
        setCurrentUser(user);
        const activeSession = snapshot.shiftSessions.find(item => item.guardId === user.id && !item.bookedOffAt);
        setActiveCheckCall(snapshot.checkCalls.find(item => item.guardId === user.id && !item.response) || null);
        const activePatrolRecord = snapshot.patrolSessions.find(item => item.guardId === user.id && item.status === 'in_progress');
        if (activePatrolRecord) {
          const detail = await apiGet(`/api/patrols/${activePatrolRecord.id}`);
          setActivePatrol(normalizePatrol(detail.patrol));
        }
        registerPushNotifications();
        await save(KEYS.CURRENT_USER_ID, user.id);
        return { success: true, user };
      } catch (error) {
        await setTokens(null);
        return { success: false, error: error.message };
      }
    }
    const allUsers = await load(KEYS.USERS);
    const user = (allUsers || []).find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    );
    if (!user) return { success: false, error: 'Incorrect email or password.' };
    if (user.status === 'inactive') {
      return { success: false, error: 'Your account has been deactivated. Please contact Super Admin.' };
    }
    setCurrentUser(user);
    await save(KEYS.CURRENT_USER_ID, user.id);
    return { success: true, user };
  }, []);

  const logout = useCallback(async () => {
    clearAllTimers();
    setCurrentUser(null);
    setActiveCheckCall(null);
    setActivePatrol(null);
    setAntiIdlePrompt(false);
    setShiftEndWarning(false);
    await save(KEYS.CURRENT_USER_ID, null);
    if (API_ENABLED) {
      try { await apiPost('/api/auth/logout', {}); } catch {}
      await setTokens(null);
    }
  }, []);

  // ─── Super Admin User Management ──────────────────────────────────────────
  const createUser = useCallback(async (userData) => {
    if (API_ENABLED) {
      try {
        const response = await apiPost('/api/users', {
          name: userData.name.trim(), email: userData.email.trim().toLowerCase(),
          password: userData.password, role: userData.role === 'superadmin' ? 'admin' : (userData.role || 'guard'),
          badgeNumber: userData.badgeNumber, phone: userData.phone,
          siteId: userData.siteId || null, managedSiteIds: userData.siteIds || [],
        });
        const user = normalizeUser(response.user);
        setUsers(previous => [user, ...previous]);
        return { success: true, user };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const normalizedEmail = (userData.email || '').trim().toLowerCase();
    if (allUsers.some(u => u.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }
    const newUser = {
      id: `u_${Date.now()}`,
      name: userData.name.trim(),
      email: normalizedEmail,
      password: userData.password || 'welcome123',
      role: userData.role || 'guard',
      status: userData.status || 'active',
      badgeNumber: userData.badgeNumber || `SG-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: userData.phone || '',
      siteId: userData.role === 'guard' ? userData.siteId : undefined,
      siteIds: userData.role === 'manager' ? (userData.siteIds || [userData.siteId].filter(Boolean)) : undefined,
      createdAt: new Date().toISOString(),
    };
    const updated = [newUser, ...allUsers];
    await save(KEYS.USERS, updated);
    setUsers(updated);

    await addAuditLog({
      action: 'ACCOUNT_CREATED',
      targetName: `${newUser.name} (${newUser.badgeNumber})`,
      details: `Created new ${newUser.role.toUpperCase()} account with email ${newUser.email}. Assigned site: ${userData.siteId || (userData.siteIds && userData.siteIds.join(', ')) || 'None'}.`,
      severity: 'info',
    });

    return { success: true, user: newUser };
  }, [addAuditLog]);

  const updateUser = useCallback(async (userId, updates) => {
    if (API_ENABLED) {
      try {
        const { user: saved } = await apiPatch(`/api/users/${userId}`, {
          ...updates,
          ...(updates.status ? { active: updates.status !== 'inactive' } : {}),
          ...(updates.siteIds ? { managedSiteIds: updates.siteIds } : {}),
        });
        const user = normalizeUser(saved);
        setUsers(previous => previous.map(item => item.id === userId ? user : item));
        if (currentUser?.id === userId) setCurrentUser(user);
        return { success: true };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, error: 'User not found' };

    const updatedList = allUsers.map(u => (u.id === userId ? { ...u, ...updates } : u));
    await save(KEYS.USERS, updatedList);
    setUsers(updatedList);
    if (currentUser?.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }

    await addAuditLog({
      action: 'ACCOUNT_UPDATED',
      targetName: `${target.name} (${target.badgeNumber})`,
      details: `Account fields modified: ${Object.keys(updates).join(', ')}.`,
      severity: 'info',
    });

    return { success: true };
  }, [currentUser, addAuditLog]);

  const toggleUserStatus = useCallback(async (userId) => {
    if (API_ENABLED) {
      const target = users.find(user => user.id === userId);
      if (!target) return { success: false, error: 'User not found' };
      const active = target.status === 'inactive';
      try {
        const { user: saved } = await apiPatch(`/api/users/${userId}`, { active });
        const updated = normalizeUser(saved);
        setUsers(previous => previous.map(user => user.id === userId ? updated : user));
        return { success: true, status: updated.status };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, error: 'User not found' };
    const newStatus = target.status === 'inactive' ? 'active' : 'inactive';

    const updatedList = allUsers.map(u => (u.id === userId ? { ...u, status: newStatus } : u));
    await save(KEYS.USERS, updatedList);
    setUsers(updatedList);

    await addAuditLog({
      action: newStatus === 'inactive' ? 'ACCOUNT_DEACTIVATED' : 'ACCOUNT_ACTIVATED',
      targetName: `${target.name} (${target.badgeNumber})`,
      details: `Account status updated to ${newStatus.toUpperCase()}.`,
      severity: newStatus === 'inactive' ? 'warning' : 'info',
    });

    return { success: true, status: newStatus };
  }, [addAuditLog]);

  const deleteUser = useCallback(async (userId) => {
    if (API_ENABLED) {
      const target = users.find(user => user.id === userId);
      if (!target) return { success: false, error: 'User not found' };
      try {
        await apiDelete(`/api/users/${userId}`);
        setUsers(previous => previous.map(user => user.id === userId ? { ...user, status: 'inactive' } : user));
        return { success: true };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, error: 'User not found' };

    const updatedList = allUsers.filter(u => u.id !== userId);
    await save(KEYS.USERS, updatedList);
    setUsers(updatedList);

    await addAuditLog({
      action: 'ACCOUNT_DELETED',
      targetName: `${target.name} (${target.badgeNumber})`,
      details: `Account permanently removed from system database. Role: ${target.role}.`,
      severity: 'warning',
    });

    return { success: true };
  }, [addAuditLog]);

  const updatePassword = useCallback(async (userId, oldPassword, newPassword) => {
    if (API_ENABLED) {
      try {
        await apiPost('/api/auth/change-password', { currentPassword: oldPassword, newPassword });
        await setTokens(null);
        setCurrentUser(null);
        return { success: true, requiresLogin: true };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const target = allUsers.find(u => u.id === userId);
    if (!target) return { success: false, error: 'User not found' };
    if (target.password !== oldPassword) {
      return { success: false, error: 'Current password does not match.' };
    }
    const updatedList = allUsers.map(u => (u.id === userId ? { ...u, password: newPassword } : u));
    await save(KEYS.USERS, updatedList);
    setUsers(updatedList);

    await addAuditLog({
      action: 'PASSWORD_CHANGED',
      targetName: target.name,
      details: `User changed password successfully.`,
      severity: 'info',
    });

    return { success: true };
  }, [addAuditLog]);

  const resetPasswordWithCode = useCallback(async (email, code, newPassword) => {
    if (API_ENABLED) {
      try {
        await apiPost('/api/auth/reset-password', { email: email.trim().toLowerCase(), code, newPassword });
        return { success: true };
      } catch (error) { return { success: false, error: error.message }; }
    }
    const allUsers = await load(KEYS.USERS) || [];
    const normalizedEmail = (email || '').trim().toLowerCase();
    const target = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!target) {
      return { success: false, error: 'No account with this email address exists.' };
    }
    const updatedList = allUsers.map(u => (u.id === target.id ? { ...u, password: newPassword } : u));
    await save(KEYS.USERS, updatedList);
    setUsers(updatedList);

    await addAuditLog({
      action: 'PASSWORD_RESET',
      targetName: target.name,
      details: `Account password was reset using verification code.`,
      severity: 'info',
    });

    return { success: true };
  }, [addAuditLog]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const clearAllTimers = () => {
    [checkCallTimerRef, checkCallExpireRef, patrolTimerRef, antiIdleTimerRef, shiftEndTimerRef]
      .forEach(r => { if (r.current) { clearTimeout(r.current); r.current = null; } });
  };

  const getActiveSession = useCallback((guardId) => {
    return shiftSessions.find(s => s.guardId === guardId && !s.bookedOffAt) || null;
  }, [shiftSessions]);

  const getTodayRoster = useCallback((guardId) => {
    const today = new Date();
    const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
    const todayDay = dayNames[today.getDay()];
    return rosters.find(r =>
      r.guardId === guardId &&
      r.days &&
      r.days[todayDay] &&
      r.weekStartDate &&
      isThisWeek(r.weekStartDate)
    ) || null;
  }, [rosters]);

  const addAlert = useCallback(async (alert) => {
    if (API_ENABLED) return null; // The API persists and routes operational alerts.
    const newAlert = {
      id: `al_${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...alert,
    };
    const updated = await load(KEYS.ALERTS);
    const list = [newAlert, ...(updated || [])];
    await save(KEYS.ALERTS, list);
    setAlerts(list);
    return newAlert;
  }, []);

  // ─── Shift: Book On ───────────────────────────────────────────────────────
  const bookOn = useCallback(async (guardId, siteId) => {
    if (API_ENABLED) {
      const scheduledEnd = getTodayRoster(guardId)?.days?.[todayKey()]?.end;
      let scheduledEndAt = null;
      if (scheduledEnd) {
        const [hours, minutes] = scheduledEnd.split(':').map(Number);
        const end = new Date();
        end.setHours(hours, minutes, 0, 0);
        if (end <= new Date()) end.setDate(end.getDate() + 1);
        scheduledEndAt = end.toISOString();
      }
      const { session: remoteSession } = await apiPost('/api/shifts/book-on', { siteId, scheduledEndAt });
      const session = normalizeSession(remoteSession);
      setShiftSessions(previous => [session, ...previous.filter(item => item.id !== session.id)]);
      setActiveCheckCall(null);
      setShiftEndWarning(false);
      // Server worker creates hourly calls and expires them even if the app is closed.
      startShiftEndTimer(session);
      return session;
    }
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    // Close any stale open session for this guard
    const cleaned = allSessions.map(s =>
      s.guardId === guardId && !s.bookedOffAt
        ? { ...s, bookedOffAt: new Date().toISOString(), autoEnded: true }
        : s
    );

    const roster = getTodayRoster(guardId);
    const scheduledStart = roster?.days?.[todayKey()]?.start || null;
    const scheduledEnd   = roster?.days?.[todayKey()]?.end   || null;
    const now = new Date();
    let punctuality = 'unscheduled';
    if (scheduledStart) {
      const diff = getMinutesFromTime(now, scheduledStart);
      punctuality = diff <= 0 ? 'on_time' : diff <= 15 ? 'slightly_late' : 'late';
    }

    const session = {
      id: `ss_${Date.now()}`,
      guardId,
      siteId,
      bookedOnAt: now.toISOString(),
      bookedOffAt: null,
      scheduledStart,
      scheduledEnd,
      punctuality,
      checkCallCount: 0,
      missedCheckCalls: 0,
      patrolCount: 0,
    };

    const updated = [...cleaned, session];
    await save(KEYS.SHIFT_SESSIONS, updated);
    setShiftSessions(updated);

    // Start timers
    startCheckCallTimer(session);
    startShiftEndTimer(session);

    return session;
  }, [getTodayRoster, shiftSessions, startCheckCallTimer, startShiftEndTimer, scheduleNextPatrolTimer]);

  // ─── Shift: Book Off ──────────────────────────────────────────────────────
  const bookOff = useCallback(async (sessionId) => {
    if (API_ENABLED) {
      const { session: remoteSession } = await apiPost('/api/shifts/book-off', {});
      clearAllTimers();
      setActiveCheckCall(null);
      setActivePatrol(null);
      setAntiIdlePrompt(false);
      setShiftEndWarning(false);
      if (remoteSession) {
        const session = normalizeSession(remoteSession);
        setShiftSessions(previous => previous.map(item => item.id === session.id ? session : item));
      }
      return;
    }
    clearAllTimers();
    setActiveCheckCall(null);
    setActivePatrol(null);
    setAntiIdlePrompt(false);
    setShiftEndWarning(false);
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    const updated = allSessions.map(s =>
      s.id === sessionId ? { ...s, bookedOffAt: new Date().toISOString() } : s
    );
    await save(KEYS.SHIFT_SESSIONS, updated);
    setShiftSessions(updated);
  }, []);

  // ─── Check Call Timers ────────────────────────────────────────────────────
  const startCheckCallTimer = useCallback((session) => {
    if (API_ENABLED) return;
    if (checkCallTimerRef.current) clearTimeout(checkCallTimerRef.current);
    checkCallTimerRef.current = setTimeout(() => {
      fireCheckCall(session);
    }, CHECK_CALL_INTERVAL_MS);
  }, []);

  const fireCheckCall = useCallback(async (session) => {
    if (API_ENABLED) {
      try {
        const { checkCall } = await apiPost('/api/check-calls/fire', { isRandom: false });
        const call = normalizeCheckCall(checkCall);
        setCheckCalls(previous => [call, ...previous]);
        setActiveCheckCall(call);
        if (checkCallExpireRef.current) clearTimeout(checkCallExpireRef.current);
        checkCallExpireRef.current = setTimeout(() => expireCheckCallHandlerRef.current?.(call, session), Math.max(0, new Date(call.expiresAt).getTime() - Date.now()));
      } catch (error) {
        console.warn('[Observant] Could not open check call:', error.message);
      }
      return;
    }
    const cc = {
      id: `cc_${Date.now()}`,
      sessionId: session.id,
      guardId: session.guardId,
      siteId: session.siteId,
      firedAt: new Date().toISOString(),
      respondedAt: null,
      response: null,  // 'yes' | 'no' | 'missed'
      note: null,
      isRandom: false,
      managerAlerted: false,
    };

    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const updated = [...allCC, cc];
    await save(KEYS.CHECK_CALLS, updated);
    setCheckCalls(updated);
    setActiveCheckCall(cc);

    // Start 10-min expiry window
    if (checkCallExpireRef.current) clearTimeout(checkCallExpireRef.current);
    checkCallExpireRef.current = setTimeout(() => {
      expireCheckCall(cc, session);
    }, CHECK_CALL_WINDOW_MS);
  }, []);

  const respondToCheckCall = useCallback(async (checkCallId, response, note = null, extra = {}) => {
    if (checkCallExpireRef.current) {
      clearTimeout(checkCallExpireRef.current);
      checkCallExpireRef.current = null;
    }

    let checkCallLocation = extra?.location || null;
    if (!checkCallLocation) {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          checkCallLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch { /* Check call response remains available without location access. */ }
    }

    if (API_ENABLED) {
      const form = new FormData();
      form.append('response', response);
      if (note) form.append('note', note);
      if (extra?.photoUri) form.append('photo', { uri: extra.photoUri, name: 'check-call-issue.jpg', type: 'image/jpeg' });
      if (extra?.category) form.append('category', extra.category);
      if (checkCallLocation?.latitude != null) form.append('latitude', String(checkCallLocation.latitude));
      if (checkCallLocation?.longitude != null) form.append('longitude', String(checkCallLocation.longitude));
      const { checkCall } = await apiUpload(`/api/check-calls/${checkCallId}/respond`, form);
      const updatedCall = normalizeCheckCall(checkCall);
      setCheckCalls(previous => previous.map(item => item.id === checkCallId ? updatedCall : item));
      setActiveCheckCall(null);
      const session = shiftSessions.find(item => item.id === updatedCall.sessionId);
      if (session && !session.bookedOffAt) startCheckCallTimer(session);
      return updatedCall;
    }
    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const cc = allCC.find(c => c.id === checkCallId);
    if (!cc) return;

    const guard = users.find(u => u.id === cc.guardId);
    const site  = sites.find(s => s.id === cc.siteId);

    // Geofence verification
    let outsideGeofence = false;
    let distanceMeters = null;
    if (checkCallLocation && site?.latitude && site?.longitude) {
      distanceMeters = getDistanceFromLatLonInMeters(
        checkCallLocation.latitude,
        checkCallLocation.longitude,
        site.latitude,
        site.longitude
      );
      const maxRadius = site.geofenceRadiusMeters || 500;
      if (distanceMeters != null && distanceMeters > maxRadius) {
        outsideGeofence = true;
      }
    }

    const updated = allCC.map(c =>
      c.id === checkCallId
        ? {
            ...c,
            respondedAt: new Date().toISOString(),
            response,
            note,
            category: extra?.category || null,
            photoUri: extra?.photoUri || null,
            location: checkCallLocation,
            outsideGeofence,
            distanceMeters,
            manuallyLogged: !!extra?.isManual,
            loggedBy: extra?.isManual ? 'Manager' : undefined,
          }
        : c
    );
    await save(KEYS.CHECK_CALLS, updated);
    setCheckCalls(updated);
    setActiveCheckCall(null);

    // Update session count
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    const sessionUpdated = allSessions.map(s =>
      s.id === cc.sessionId
        ? { ...s, checkCallCount: (s.checkCallCount || 0) + 1 }
        : s
    );
    await save(KEYS.SHIFT_SESSIONS, sessionUpdated);
    setShiftSessions(sessionUpdated);

    // If outside geofence, send warning alert to manager
    if (outsideGeofence) {
      await addAlert({
        type: 'geofence_warning',
        severity: 'issue',
        guardId: cc.guardId,
        siteId: cc.siteId,
        title: `⚠️ Out-of-Bounds Check Call — ${guard?.name || 'Guard'}`,
        message: `${guard?.name || 'Guard'} responded ${distanceMeters}m outside the perimeter for ${site?.name || 'Site'}. Geofence limit: ${site?.geofenceRadiusMeters || 500}m.`,
      });
    }

    if (response === 'no') {
      // Alert manager for issue
      const catLabel = extra?.category ? `[${extra.category}] ` : '';
      const callTimeStr = formatTime(new Date());
      await addAlert({
        type: 'check_call_issue',
        severity: 'issue',
        guardId: cc.guardId,
        guardName: guard?.name,
        badgeNumber: guard?.badgeNumber,
        siteId: cc.siteId,
        siteName: site?.name,
        title: `⚠️ Issue at ${callTimeStr} — ${guard?.name || 'Guard'} (${guard?.badgeNumber || '—'})`,
        message: `${catLabel}${guard?.name || 'Guard'} (${guard?.badgeNumber || '—'}) reported an issue at ${site?.name || 'site'} during the ${callTimeStr} check call: ${note || 'No notes provided'}.`,
        note,
        category: extra?.category,
        photoUri: extra?.photoUri,
      });

      await addAuditLog({
        action: 'ISSUE_REPORTED',
        targetName: `${guard?.name} (${site?.name})`,
        details: `Issue reported during check call: ${catLabel}${note || 'No details'}.`,
        severity: 'warning',
      });
    }

    // Schedule next check call
    const session = allSessions.find(s => s.id === cc.sessionId);
    if (session && !session.bookedOffAt) {
      startCheckCallTimer(session);
    }
  }, [users, sites, addAlert, addAuditLog, startCheckCallTimer]);

  // ─── Manual Logs by Manager ───────────────────────────────────────────────
  const addManualCheckCall = useCallback(async ({ guardId, siteId, response = 'yes', note = '' }) => {
    if (API_ENABLED) {
      const { checkCall } = await apiPost('/api/manual-log/check-call', { guardId, response, note });
      const saved = normalizeCheckCall(checkCall);
      setCheckCalls(previous => [saved, ...previous]);
      return saved;
    }
    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const guard = users.find(u => u.id === guardId);
    const site  = sites.find(s => s.id === siteId);
    const now   = new Date().toISOString();

    const newCC = {
      id: `cc_manual_${Date.now()}`,
      guardId,
      siteId,
      firedAt: now,
      respondedAt: now,
      response,
      note,
      manuallyLogged: true,
      loggedBy: 'Manager',
      managerId: currentUser?.id,
      managerName: currentUser?.name,
    };
    const updated = [newCC, ...allCC];
    await save(KEYS.CHECK_CALLS, updated);
    setCheckCalls(updated);

    await addAuditLog({
      action: 'MANUAL_LOG_ENTERED',
      targetName: `${guard?.name || 'Guard'} (${site?.name || 'Site'})`,
      details: `Manager ${currentUser?.name} manually recorded check call (${response === 'yes' ? 'All Okay' : 'Issue'}). Note: ${note || 'None'}.`,
      severity: 'warning',
    });

    return newCC;
  }, [users, sites, currentUser, addAuditLog]);

  const addManualPatrol = useCallback(async ({ guardId, siteId, note = '', startedAt, finishedAt }) => {
    if (API_ENABLED) {
      const { patrol } = await apiPost('/api/manual-log/patrol', { guardId, note, startedAt, finishedAt });
      const saved = normalizePatrol(patrol);
      setPatrolSessions(previous => [saved, ...previous]);
      return saved;
    }
    const allPS = await load(KEYS.PATROL_SESSIONS) || [];
    const guard = users.find(u => u.id === guardId);
    const site  = sites.find(s => s.id === siteId);
    const now   = new Date().toISOString();

    const newPatrol = {
      id: `patrol_manual_${Date.now()}`,
      guardId,
      siteId,
      startedAt: startedAt || now,
      finishedAt: finishedAt || now,
      type: 'scheduled',
      note,
      manuallyLogged: true,
      loggedBy: 'Manager',
      managerId: currentUser?.id,
      managerName: currentUser?.name,
    };
    const updated = [newPatrol, ...allPS];
    await save(KEYS.PATROL_SESSIONS, updated);
    setPatrolSessions(updated);

    await addAuditLog({
      action: 'MANUAL_LOG_ENTERED',
      targetName: `${guard?.name || 'Guard'} (${site?.name || 'Site'})`,
      details: `Manager ${currentUser?.name} manually recorded completed patrol tour. Note: ${note || 'None'}.`,
      severity: 'warning',
    });

    return newPatrol;
  }, [users, sites, currentUser, addAuditLog]);

  // ─── Emergency SOS ────────────────────────────────────────────────────────
  const triggerSOS = useCallback(async ({ location, note } = {}) => {
    if (API_ENABLED) {
      const { alert } = await apiPost('/api/sos/trigger', {
        latitude: location?.latitude,
        longitude: location?.longitude,
        note,
      });
      const saved = { ...normalizeAlert(alert), read: false };
      setAlerts(previous => [saved, ...previous]);
      return saved;
    }
    const guard = currentUser;
    const site = sites.find(s => s.id === guard?.siteId);
    const now = new Date().toISOString();
    const locText = location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : (site?.address || 'Site perimeter');

    const alert = await addAlert({
      type: 'sos',
      severity: 'urgent',
      isUrgent: true,
      guardId: guard?.id,
      siteId: guard?.siteId,
      title: `🚨 SOS EMERGENCY — ${guard?.name}`,
      message: `URGENT: ${guard?.name} (${guard?.badgeNumber || 'Officer'}) triggered an emergency SOS alert at ${site?.name || 'Site'}. Location: ${locText}.`,
      location: locText,
      note: note || '',
      createdAt: now,
    });

    await addAuditLog({
      action: 'SOS_TRIGGERED',
      targetName: `${guard?.name} (${site?.name || 'Unknown Site'})`,
      details: `Emergency SOS triggered by ${guard?.name}. Location: ${locText}. Immediate supervisory response required.`,
      severity: 'urgent',
    });

    return alert;
  }, [currentUser, sites, addAlert, addAuditLog]);

  const expireCheckCall = useCallback(async (cc, session) => {
    if (API_ENABLED) {
      try {
        const { checkCall } = await apiPost('/api/check-calls/expire', { checkCallId: cc.id });
        const saved = normalizeCheckCall(checkCall);
        setCheckCalls(previous => previous.map(item => item.id === saved.id ? saved : item));
        setActiveCheckCall(null);
      } catch (error) {
        if (error.status !== 404) console.warn('[Observant] Check call expiry failed:', error.message);
      }
      return;
    }
    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const existing = allCC.find(c => c.id === cc.id);
    if (!existing || existing.response) return; // already responded

    const updated = allCC.map(c =>
      c.id === cc.id ? { ...c, response: 'missed', respondedAt: null } : c
    );
    await save(KEYS.CHECK_CALLS, updated);
    setCheckCalls(updated);
    setActiveCheckCall(null);

    const guard = users.find(u => u.id === cc.guardId || u._id === cc.guardId);
    const site  = sites.find(s => s.id === cc.siteId || s._id === cc.siteId);
    const guardName = guard ? `${guard.name} (${guard.badgeNumber || 'SG-900'})` : 'Officer';
    const siteName = site ? site.name : 'Assigned Site';

    await addAlert({
      type: 'check_call_missed',
      severity: 'urgent',
      guardId: cc.guardId,
      guardName: guard?.name,
      badgeNumber: guard?.badgeNumber,
      siteId: cc.siteId,
      siteName: site?.name,
      title: `🚨 Missed Check Call — ${guardName} at ${formatTime(new Date(cc.firedAt))}`,
      message: `${guardName} did not respond to the ${formatTime(new Date(cc.firedAt))} check call at ${siteName}. The 10-minute response window has expired. Immediate welfare follow-up recommended.`,
    });

    // Update missed count
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    const sessionUpdated = allSessions.map(s =>
      s.id === session.id
        ? { ...s, missedCheckCalls: (s.missedCheckCalls || 0) + 1 }
        : s
    );
    await save(KEYS.SHIFT_SESSIONS, sessionUpdated);
    setShiftSessions(sessionUpdated);

    // Still schedule next check call for the next hour
    if (!session.bookedOffAt) {
      startCheckCallTimer(session);
    }
  }, [users, sites, addAlert, startCheckCallTimer]);

  const recordManualGuardCheckCall = useCallback(async (response, note = null, category = null) => {
    // Clear any active pending call timer and active banner
    if (checkCallExpireRef.current) {
      clearTimeout(checkCallExpireRef.current);
      checkCallExpireRef.current = null;
    }
    setActiveCheckCall(null);

    if (API_ENABLED) {
      try {
        // Use the /manual endpoint — single atomic call that creates & responds
        const body = { response };
        if (note) body.note = note;
        if (category) body.category = category;
        const result = await apiPost('/api/check-calls/manual', body);
        const saved = normalizeCheckCall(result.checkCall);
        setCheckCalls(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
        const session = shiftSessions.find(item => item.id === saved.sessionId || (item.guardId === currentUser?.id && !item.bookedOffAt));
        if (session && !session.bookedOffAt) startCheckCallTimer(session);
        return saved;
      } catch (err) {
        // Fallback 1: If Render backend route /api/check-calls/manual is not yet deployed (404),
        // fallback to /api/check-calls/fire + /api/check-calls/:id/respond
        if (err?.message?.includes('not found') || err?.message?.includes('404')) {
          try {
            const fireRes = await apiPost('/api/check-calls/fire', {});
            const firedId = fireRes?.checkCall?._id || fireRes?.checkCall?.id;
            if (firedId) {
              const noteText = category ? `[${category}]${note ? ' ' + note : ''}` : note;
              const respRes = await apiPost(`/api/check-calls/${firedId}/respond`, { response, note: noteText || undefined });
              const saved = normalizeCheckCall(respRes.checkCall);
              setCheckCalls(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
              const session = shiftSessions.find(item => item.id === saved.sessionId || (item.guardId === currentUser?.id && !item.bookedOffAt));
              if (session && !session.bookedOffAt) startCheckCallTimer(session);
              return saved;
            }
          } catch (fireErr) {
            console.warn('Fire fallback failed', fireErr);
          }
        }
        // Fallback 2: If offline / network error / server unreachable, fall through to local storage so guard is never blocked
        const isNetworkError = err?.message?.includes('Cannot reach') || err?.message?.includes('Network') || err?.message?.includes('fetch') || err?.message?.includes('timeout') || err?.message?.includes('not found') || err?.message?.includes('404');
        if (!isNetworkError) {
          throw new Error(err?.message || 'Could not record check call. Please try again.');
        }
        // Fall through to local save below
      }
    }
    const session = shiftSessions.find(item => item.guardId === currentUser?.id && !item.bookedOffAt);
    if (!session) throw new Error('Book on before recording a check call.');
    const now = new Date().toISOString();
    const guard = users.find(u => u.id === currentUser?.id) || currentUser;
    const site = sites.find(s => s.id === session.siteId);

    const saved = {
      id: `cc_${Date.now()}`,
      sessionId: session.id,
      guardId: currentUser.id,
      guardName: guard?.name,
      siteId: session.siteId,
      siteName: site?.name,
      firedAt: now,
      scheduledFor: now,
      respondedAt: now,
      expiresAt: now,
      response,
      note,
      category,
      isManualLog: true,
      manuallyLogged: false,
    };
    const all = await load(KEYS.CHECK_CALLS) || [];
    await save(KEYS.CHECK_CALLS, [saved, ...all]);
    setCheckCalls(previous => [saved, ...previous]);

    if (response === 'no') {
      const guardLabel = guard?.name ? `${guard.name} (${guard.badgeNumber || 'SG-900'})` : 'Guard';
      await addAlert({
        type: 'check_call_issue',
        severity: 'issue',
        title: `⚠️ Check Call Issue — ${guardLabel}`,
        message: `${guardLabel} reported an issue at ${site?.name || 'Site'}: ${note || category || 'No details provided'}.`,
        note,
        category,
        siteId: session.siteId,
        guardId: currentUser?.id,
        guardName: guard?.name,
        badgeNumber: guard?.badgeNumber,
        siteName: site?.name,
      });
    }

    // Schedule next automatic check call for 1 hour from now
    startCheckCallTimer(session);
    return saved;
  }, [currentUser, users, sites, shiftSessions, addAlert, startCheckCallTimer]);

  // ─── Patrol Timers ────────────────────────────────────────────────────────
  const scheduleNextPatrolTimer = useCallback((session, lastPatrolEndTime) => {
    if (patrolTimerRef.current) clearTimeout(patrolTimerRef.current);
    if (antiIdleTimerRef.current) clearTimeout(antiIdleTimerRef.current);

    const base = lastPatrolEndTime ? new Date(lastPatrolEndTime) : new Date();
    const nextPatrolAt = new Date(base.getTime() + PATROL_INTERVAL_MS);
    const antiIdleDelay = ANTI_IDLE_MIN_MS + Math.random() * (ANTI_IDLE_MAX_MS - ANTI_IDLE_MIN_MS);

    // Anti-idle: random prompt between 10-30 min after the last patrol (or shift start).
    antiIdleTimerRef.current = setTimeout(() => {
      setAntiIdlePrompt(true);
      logRandomPrompt(session.guardId, session.id, new Date(Date.now() + CHECK_CALL_WINDOW_MS).toISOString());
    }, antiIdleDelay);

    // Next full patrol due
    const fullDelay = nextPatrolAt.getTime() - Date.now();
    if (fullDelay > 0) {
      patrolTimerRef.current = setTimeout(() => {
        // If anti-idle prompt was ignored, this is the "required" patrol
        // The prompt already fired; this just clears any remaining prompt
        setAntiIdlePrompt(prev => prev); // keep if still showing
      }, fullDelay);
    }
  }, []);

  const logRandomPrompt = useCallback(async (guardId, sessionId, expiresAt) => {
    const log = {
      id: `rpl_${Date.now()}`,
      guardId,
      sessionId,
      triggeredAt: new Date().toISOString(),
      responded: false,
      respondedAt: null,
      expiresAt,
    };
    const all = await load(KEYS.RANDOM_PROMPT_LOGS) || [];
    const updated = [...all, log];
    await save(KEYS.RANDOM_PROMPT_LOGS, updated);
    setRandomPromptLogs(updated);
    return log;
  }, []);

  const dismissAntiIdlePrompt = useCallback(() => setAntiIdlePrompt(false), []);

  // ─── Patrol: Start ────────────────────────────────────────────────────────
  const startPatrol = useCallback(async (guardId, siteId, sessionId) => {
    if (API_ENABLED) {
      const pending = [...randomPromptLogs].reverse().find(log => !log.responded && !log.managerAlerted && log.sessionId === sessionId && (!log.expiresAt || new Date(log.expiresAt).getTime() > Date.now()));
      const { patrol } = await apiPost('/api/patrols/start', { triggeredByAntiIdle: antiIdlePrompt });
      const saved = normalizePatrol(patrol);
      setPatrolSessions(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      setActivePatrol(saved);
      setAntiIdlePrompt(false);
      if (pending) {
        setRandomPromptLogs(previous => previous.map(log => log.id === pending.id ? { ...log, responded: true, respondedAt: new Date().toISOString() } : log));
      }
      return saved;
    }
    if (antiIdleTimerRef.current) clearTimeout(antiIdleTimerRef.current);
    if (patrolTimerRef.current)   clearTimeout(patrolTimerRef.current);
    setAntiIdlePrompt(false);

    // Mark random prompt as responded if it was pending
    const allLogs = await load(KEYS.RANDOM_PROMPT_LOGS) || [];
    const updatedLogs = allLogs.map(l =>
      l.sessionId === sessionId && !l.responded
        ? { ...l, responded: true, respondedAt: new Date().toISOString() }
        : l
    );
    await save(KEYS.RANDOM_PROMPT_LOGS, updatedLogs);
    setRandomPromptLogs(updatedLogs);

    const patrol = {
      id: `ps_${Date.now()}`,
      guardId,
      siteId,
      sessionId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      checkpointsCaptured: [],
      missingCheckpoints: [],
      status: 'in_progress',
    };

    const all = await load(KEYS.PATROL_SESSIONS) || [];
    const updated = [...all, patrol];
    await save(KEYS.PATROL_SESSIONS, updated);
    setPatrolSessions(updated);
    setActivePatrol(patrol);
    return patrol;
  }, [antiIdlePrompt, randomPromptLogs]);

  // ─── Patrol: Capture Checkpoint Photo ─────────────────────────────────────
  const captureCheckpoint = useCallback(async (patrolId, checkpointId, photoUri, nfcTagId = null, location = null) => {
    if (API_ENABLED) {
      const form = new FormData();
      form.append('checkpointId', checkpointId);
      if (photoUri) form.append('photo', { uri: photoUri, name: `checkpoint-${checkpointId}.jpg`, type: 'image/jpeg' });
      if (nfcTagId) form.append('nfcTagId', nfcTagId);
      if (location?.latitude != null) form.append('latitude', String(location.latitude));
      if (location?.longitude != null) form.append('longitude', String(location.longitude));
      try {
        const { patrol } = await apiUpload(`/api/patrols/${patrolId}/capture`, form);
        const saved = normalizePatrol(patrol);
        setPatrolSessions(previous => previous.map(item => item.id === saved.id ? saved : item));
        setPatrolCaptures(saved.captures || []);
        setActivePatrol(saved);
        return saved.captures?.[saved.captures.length - 1];
      } catch (err) {
        // If server is unreachable, fall through to local storage so patrol can continue offline
        const isNetworkError = err?.message?.includes('Cannot reach') || err?.message?.includes('Network') || err?.message?.includes('fetch');
        if (!isNetworkError) throw err;
        // Fall through to local path below
      }
    }
    const capture = {
      id: `pc_${Date.now()}`,
      patrolId,
      checkpointId,
      photoUri,
      nfcTagId,
      nfcVerifiedAt: nfcTagId ? new Date().toISOString() : null,
      capturedAt: new Date().toISOString(),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    };

    const allCaptures = await load(KEYS.PATROL_CAPTURES) || [];
    const existing = allCaptures.findIndex(item => item.patrolId === patrolId && item.checkpointId === checkpointId);
    const updated = existing < 0
      ? [...allCaptures, capture]
      : allCaptures.map((item, index) => index === existing ? {
          ...item,
          photoUri: photoUri || item.photoUri || null,
          nfcTagId: nfcTagId || item.nfcTagId || null,
          nfcVerifiedAt: nfcTagId ? new Date().toISOString() : item.nfcVerifiedAt || null,
          capturedAt: capture.capturedAt,
          latitude: location?.latitude ?? item.latitude ?? null,
          longitude: location?.longitude ?? item.longitude ?? null,
        } : item);
    await save(KEYS.PATROL_CAPTURES, updated);
    setPatrolCaptures(updated);

    // Update active patrol — embed capture into patrol.captures AND add to checkpointsCaptured
    const allPatrols = await load(KEYS.PATROL_SESSIONS) || [];
    const updatedPatrols = allPatrols.map(p => {
      if (p.id !== patrolId) return p;
      const existingCaptures = p.captures || [];
      const capIdx = existingCaptures.findIndex(c => c.checkpointId === checkpointId);
      const newCaptures = capIdx < 0
        ? [...existingCaptures, capture]
        : existingCaptures.map((c, i) => i === capIdx ? { ...c, ...capture } : c);
      const alreadyCaptured = (p.checkpointsCaptured || []).includes(checkpointId);
      return {
        ...p,
        captures: newCaptures,
        checkpointsCaptured: alreadyCaptured
          ? p.checkpointsCaptured
          : [...(p.checkpointsCaptured || []), checkpointId],
      };
    });
    await save(KEYS.PATROL_SESSIONS, updatedPatrols);
    setPatrolSessions(updatedPatrols);

    const current = updatedPatrols.find(p => p.id === patrolId);
    setActivePatrol(current || null);

    return capture;
  }, []);

  // ─── Patrol: Finish ───────────────────────────────────────────────────────
  const finishPatrol = useCallback(async (patrolId, forceFinish = false) => {
    if (API_ENABLED) {
      try {
        const { patrol } = await apiPost(`/api/patrols/${patrolId}/finish`, { forceFinish });
        const saved = normalizePatrol(patrol);
        setPatrolSessions(previous => previous.map(item => item.id === saved.id ? saved : item));
        setActivePatrol(null);
        setPatrolCaptures(saved.captures || []);
        return { incomplete: false, patrol: saved };
      } catch (error) {
        if (error.status === 422) return { incomplete: true, missing: error.missingCheckpointIds || [], patrol: activePatrol };
        throw error;
      }
    }
    const allPatrols = await load(KEYS.PATROL_SESSIONS) || [];
    const patrol = allPatrols.find(p => p.id === patrolId);
    if (!patrol) return;

    const rosterCheckpointIds = getTodayRoster(patrol.guardId)?.checkpointIds || [];
    const assignedIds = patrol.assignedCheckpointIds?.length ? patrol.assignedCheckpointIds : rosterCheckpointIds;
    const siteCheckpoints = checkpoints.filter(cp => cp.siteId === patrol.siteId && (cp.required || cp.nfcRequired) && (!assignedIds.length || assignedIds.includes(cp.id)));
    const capturesForPatrol = (await load(KEYS.PATROL_CAPTURES) || []).filter(capture => capture.patrolId === patrolId);
    const missing = siteCheckpoints.filter(cp => {
      const capture = capturesForPatrol.find(item => item.checkpointId === cp.id);
      return !capture || (cp.required && !capture.photoUri) || (cp.nfcRequired && !capture.nfcVerifiedAt);
    }).map(cp => cp.id);

    if (missing.length > 0 && !forceFinish) {
      return { incomplete: true, missing, patrol };
    }

    const now = new Date().toISOString();
    const updatedPatrols = allPatrols.map(p =>
      p.id === patrolId
        ? { ...p, finishedAt: now, missingCheckpoints: missing, status: missing.length > 0 ? 'incomplete' : 'complete' }
        : p
    );
    await save(KEYS.PATROL_SESSIONS, updatedPatrols);
    setPatrolSessions(updatedPatrols);
    setActivePatrol(null);

    // Update session patrol count
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    const updatedSessions = allSessions.map(s =>
      s.id === patrol.sessionId
        ? { ...s, patrolCount: (s.patrolCount || 0) + 1 }
        : s
    );
    await save(KEYS.SHIFT_SESSIONS, updatedSessions);
    setShiftSessions(updatedSessions);

    if (missing.length > 0) {
      const guard = users.find(u => u.id === patrol.guardId);
      const site  = sites.find(s => s.id === patrol.siteId);
      await addAlert({
        type: 'patrol_incomplete',
        guardId: patrol.guardId,
        siteId: patrol.siteId,
        message: `⚠️ ${guard?.name || 'Guard'} finished patrol at ${site?.name || 'site'} with ${missing.length} checkpoint(s) missing.`,
      });
    }

    // Schedule next patrol from now
    const session = allSessions.find(s => s.id === patrol.sessionId);
    if (session && !session.bookedOffAt) {
      scheduleNextPatrolTimer(session, now);
    }

    return { incomplete: false, patrol: updatedPatrols.find(p => p.id === patrolId) };
  }, [checkpoints, users, sites, addAlert, scheduleNextPatrolTimer, activePatrol, getTodayRoster]);

  // ─── Shift-end warning ────────────────────────────────────────────────────
  const startShiftEndTimer = useCallback((session) => {
    if (!session.scheduledEnd) return;
    if (shiftEndTimerRef.current) clearTimeout(shiftEndTimerRef.current);

    const [h, m] = session.scheduledEnd.split(':').map(Number);
    const endTime = new Date();
    endTime.setHours(h, m, 0, 0);
    if (endTime < new Date()) endTime.setDate(endTime.getDate() + 1); // next day for night shifts
    const warnAt = endTime.getTime() - SHIFT_END_WARN_MS;
    const delay = warnAt - Date.now();
    if (delay > 0) {
      shiftEndTimerRef.current = setTimeout(() => setShiftEndWarning(true), delay);
    }
  }, []);

  // ─── Rehydrate timers when app comes to foreground ────────────────────────
  const rehydrateTimers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'guard') return;
    const allSessions = await load(KEYS.SHIFT_SESSIONS) || [];
    const active = allSessions.find(s => s.guardId === currentUser.id && !s.bookedOffAt);
    if (!active) return;
    startCheckCallTimer(active);
    startShiftEndTimer(active);
    const lastPatrol = [...patrolSessions]
      .filter(p => p.sessionId === active.id && p.finishedAt)
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0];
    if (lastPatrol?.finishedAt) scheduleNextPatrolTimer(active, lastPatrol.finishedAt);
  }, [currentUser, patrolSessions, startCheckCallTimer, startShiftEndTimer, scheduleNextPatrolTimer]);

  // ─── Roster management ────────────────────────────────────────────────────
  const publishRoster = useCallback(async (rosterData) => {
    if (API_ENABLED) {
      const { roster } = await apiPost('/api/rosters', rosterData);
      const saved = normalizeRoster(roster);
      setRosters(previous => [saved, ...previous.filter(item => !(item.guardId === saved.guardId && item.weekStartDate === saved.weekStartDate))]);
      return saved;
    }
    const all = await load(KEYS.SHIFT_ROSTERS) || [];
    const existing = all.findIndex(r => r.guardId === rosterData.guardId && r.weekStartDate === rosterData.weekStartDate);
    let updated;
    if (existing >= 0) {
      updated = all.map((r, i) => i === existing ? { ...r, ...rosterData, updatedAt: new Date().toISOString() } : r);
    } else {
      updated = [...all, { id: `ro_${Date.now()}`, createdAt: new Date().toISOString(), ...rosterData }];
    }
    await save(KEYS.SHIFT_ROSTERS, updated);
    setRosters(updated);
    return updated;
  }, []);

  const refreshRosters = useCallback(async () => {
    if (API_ENABLED) {
      const result = await apiGet('/api/rosters');
      const refreshed = (result.rosters || []).map(normalizeRoster);
      setRosters(refreshed);
      return refreshed;
    }
    const refreshed = await load(KEYS.SHIFT_ROSTERS) || [];
    setRosters(refreshed);
    return refreshed;
  }, []);

  const saveRosterTemplate = useCallback(async (template) => {
    if (API_ENABLED) {
      const { template: saved } = await apiPost('/api/rosters/templates', template);
      setRosterTemplates(previous => [...previous, saved]);
      return saved;
    }
    const all = await load(KEYS.ROSTER_TEMPLATES) || [];
    const updated = [...all, { id: `rt_${Date.now()}`, createdAt: new Date().toISOString(), ...template }];
    await save(KEYS.ROSTER_TEMPLATES, updated);
    setRosterTemplates(updated);
  }, []);

  const deleteRosterTemplate = useCallback(async (templateId) => {
    if (API_ENABLED) {
      await apiDelete(`/api/rosters/templates/${templateId}`);
      setRosterTemplates(previous => previous.filter(item => item.id !== templateId));
      return;
    }
    const all = await load(KEYS.ROSTER_TEMPLATES) || [];
    const updated = all.filter(t => t.id !== templateId);
    await save(KEYS.ROSTER_TEMPLATES, updated);
    setRosterTemplates(updated);
  }, []);

  // ─── Alerts ───────────────────────────────────────────────────────────────
  const markAlertRead = useCallback(async (alertId) => {
    if (API_ENABLED) {
      await apiPatch(`/api/alerts/${alertId}/read`, {});
      setAlerts(previous => previous.map(alert => alert.id === alertId ? { ...alert, read: true } : alert));
      return;
    }
    const all = await load(KEYS.ALERTS) || [];
    const updated = all.map(a => a.id === alertId ? { ...a, read: true } : a);
    await save(KEYS.ALERTS, updated);
    setAlerts(updated);
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    if (API_ENABLED) {
      await apiPatch('/api/alerts/read-all', {});
      setAlerts(previous => previous.map(alert => ({ ...alert, read: true })));
      return;
    }
    const all = await load(KEYS.ALERTS) || [];
    const updated = all.map(a => ({ ...a, read: true }));
    await save(KEYS.ALERTS, updated);
    setAlerts(updated);
  }, []);

  // ─── Checkpoint config ────────────────────────────────────────────────────
  const saveCheckpoints = useCallback(async (newCheckpoints) => {
    if (API_ENABLED) {
      const existingIds = new Set(checkpoints.map(item => item.id));
      const nextIds = new Set(newCheckpoints.map(item => item.id));
      const saved = [];
      for (const checkpoint of newCheckpoints) {
        if (existingIds.has(checkpoint.id)) {
          const { checkpoint: updated } = await apiPatch(`/api/patrols/checkpoints/${checkpoint.id}`, checkpoint);
          saved.push(normalizeCheckpoint(updated));
        } else {
          const { checkpoint: created } = await apiPost('/api/patrols/checkpoints', checkpoint);
          saved.push(normalizeCheckpoint(created));
        }
      }
      for (const checkpoint of checkpoints) {
        if (!nextIds.has(checkpoint.id)) await apiDelete(`/api/patrols/checkpoints/${checkpoint.id}`);
      }
      setCheckpoints(saved);
      return;
    }
    await save(KEYS.PATROL_CHECKPOINTS, newCheckpoints);
    setCheckpoints(newCheckpoints);
  }, [checkpoints]);

  // ─── Users management ─────────────────────────────────────────────────────
  const refreshUsers = useCallback(async () => {
    if (API_ENABLED) {
      const { users: remoteUsers } = await apiGet('/api/users?active=all');
      const normalized = (remoteUsers || []).map(normalizeUser);
      setUsers(normalized);
      return normalized;
    }
    const u = await load(KEYS.USERS);
    setUsers(u || []);
  }, []);

  const createSite = useCallback(async (siteData) => {
    if (API_ENABLED) {
      const { site } = await apiPost('/api/sites', siteData);
      const saved = normalizeSite(site);
      setSites(previous => [...previous, saved]);
      if (saved.managerId) {
        setUsers(previous => previous.map(user => user.id === saved.managerId
          ? { ...user, siteIds: [...new Set([...(user.siteIds || []), saved.id])] }
          : user));
      }
      return { success: true, site: saved };
    }
    const saved = { id: `site_${Date.now()}`, active: true, geofenceRadiusMeters: 200, ...siteData };
    const updated = [...(await load(KEYS.SITES) || []), saved];
    await save(KEYS.SITES, updated);
    setSites(updated);
    return { success: true, site: saved };
  }, []);

  // ─── Computed helpers ─────────────────────────────────────────────────────
  const getGuardActiveSession = useCallback((guardId) =>
    shiftSessions.find(s => s.guardId === guardId && !s.bookedOffAt) || null,
  [shiftSessions]);

  const getTodayCheckCalls = useCallback((guardId) => {
    const today = todayDateStr();
    return checkCalls.filter(cc =>
      cc.guardId === guardId && cc.firedAt.startsWith(today)
    );
  }, [checkCalls]);

  const getTodayPatrols = useCallback((guardId) => {
    const today = todayDateStr();
    return patrolSessions.filter(ps =>
      ps.guardId === guardId && ps.startedAt.startsWith(today)
    );
  }, [patrolSessions]);

  const getUnreadAlerts = useCallback((managerId) => {
    const mgr = users.find(u => u.id === managerId);
    if (!mgr) return [];
    return alerts.filter(a => !a.read && (mgr.role === 'admin' || mgr.siteIds?.includes(a.siteId)));
  }, [alerts, users]);

  const getSiteCheckpoints = useCallback((siteId) =>
    checkpoints.filter(cp => cp.siteId === siteId).sort((a, b) => a.order - b.order),
  [checkpoints]);

  const getPatrolCaptures = useCallback((patrolId) =>
    patrolCaptures.filter(pc => pc.patrolId === patrolId),
  [patrolCaptures]);

  const getWeekRosters = useCallback((weekStartDate) =>
    rosters.filter(r => r.weekStartDate === weekStartDate),
  [rosters]);

  const getGuardRoster = useCallback((guardId, weekStartDate) =>
    rosters.find(r => r.guardId === guardId && r.weekStartDate === weekStartDate) || null,
  [rosters]);

  const value = {
    // Auth
    currentUser, authLoading, login, logout, createSite,
    updatePassword, resetPasswordWithCode,
    // Reference data
    users, sites, checkpoints, refreshUsers,
    // Super Admin Account Management & Audit
    auditLogs, addAuditLog, createUser, updateUser, toggleUserStatus, deleteUser,
    // Sessions
    shiftSessions, getGuardActiveSession, bookOn, bookOff,
    // Check calls
    checkCalls, activeCheckCall, respondToCheckCall, recordManualGuardCheckCall,
    getTodayCheckCalls, addManualCheckCall,
    // Patrol
    patrolSessions, activePatrol, antiIdlePrompt, dismissAntiIdlePrompt,
    startPatrol, captureCheckpoint, finishPatrol, getTodayPatrols,
    getPatrolCaptures, getSiteCheckpoints,
    randomPromptLogs, addManualPatrol,
    // Emergency SOS
    triggerSOS,
    // Shift end
    shiftEndWarning, setShiftEndWarning,
    // Alerts
    alerts, getUnreadAlerts, markAlertRead, markAllAlertsRead, addAlert,
    // Rosters
    rosters, rosterTemplates, publishRoster, refreshRosters, saveRosterTemplate,
    deleteRosterTemplate, getWeekRosters, getGuardRoster, getTodayRoster,
    // Checkpoints
    saveCheckpoints,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Utility functions ────────────────────────────────────────────────────────
export function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function todayKey() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
}

function isThisWeek(weekStartDate) {
  const start = new Date(weekStartDate);
  const now = new Date();
  const diff = (now - start) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff < 7;
}

function getMinutesFromTime(date, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const scheduled = new Date(date);
  scheduled.setHours(h, m, 0, 0);
  return Math.round((date - scheduled) / 60000);
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
