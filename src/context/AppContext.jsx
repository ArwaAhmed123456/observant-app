import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import { load, save, KEYS } from '../data/store';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ─── Constants ────────────────────────────────────────────────────────────────
const CHECK_CALL_INTERVAL_MS = 60 * 60 * 1000;   // 1 hour
const CHECK_CALL_WINDOW_MS   = 10 * 60 * 1000;   // 10 min to respond
const PATROL_INTERVAL_MS     = 60 * 60 * 1000;   // 1 hour between patrols
const ANTI_IDLE_MIN_MS       = 30 * 60 * 1000;   // earliest random patrol prompt
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
  const appStateRef         = useRef(AppState.currentState);

  // ─── Load all data from AsyncStorage ──────────────────────────────────────
  const loadAll = useCallback(async () => {
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
  }, []);

  // ─── Super Admin User Management ──────────────────────────────────────────
  const createUser = useCallback(async (userData) => {
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
    scheduleNextPatrolTimer(session, null);

    return session;
  }, [getTodayRoster, shiftSessions]);

  // ─── Shift: Book Off ──────────────────────────────────────────────────────
  const bookOff = useCallback(async (sessionId) => {
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
    if (checkCallTimerRef.current) clearTimeout(checkCallTimerRef.current);
    checkCallTimerRef.current = setTimeout(() => {
      fireCheckCall(session);
    }, CHECK_CALL_INTERVAL_MS);
  }, []);

  const fireCheckCall = useCallback(async (session) => {
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

    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const cc = allCC.find(c => c.id === checkCallId);
    if (!cc) return;

    const guard = users.find(u => u.id === cc.guardId);
    const site  = sites.find(s => s.id === cc.siteId);

    // Geofence verification
    let outsideGeofence = false;
    let distanceMeters = null;
    if (extra?.location && site?.latitude && site?.longitude) {
      distanceMeters = getDistanceFromLatLonInMeters(
        extra.location.latitude,
        extra.location.longitude,
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
            location: extra?.location || null,
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
      await addAlert({
        type: 'check_call_issue',
        severity: 'issue',
        guardId: cc.guardId,
        siteId: cc.siteId,
        title: `⚠️ Check Call Issue — ${guard?.name || 'Guard'}`,
        message: `${catLabel}${guard?.name || 'Guard'} reported an issue at ${site?.name || 'site'}: ${note || 'No notes provided'}.`,
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
    const allCC = await load(KEYS.CHECK_CALLS) || [];
    const existing = allCC.find(c => c.id === cc.id);
    if (!existing || existing.response) return; // already responded

    const updated = allCC.map(c =>
      c.id === cc.id ? { ...c, response: 'missed', respondedAt: null } : c
    );
    await save(KEYS.CHECK_CALLS, updated);
    setCheckCalls(updated);
    setActiveCheckCall(null);

    const guard = users.find(u => u.id === cc.guardId);
    const site  = sites.find(s => s.id === cc.siteId);
    await addAlert({
      type: 'check_call_missed',
      guardId: cc.guardId,
      siteId: cc.siteId,
      message: `🚨 ${guard?.name || 'Guard'} did not respond to check call at ${formatTime(new Date())} — ${site?.name || 'site'}`,
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

    // Still schedule next check call
    if (!session.bookedOffAt) {
      startCheckCallTimer(session);
    }
  }, [users, sites, addAlert, startCheckCallTimer]);

  // ─── Patrol Timers ────────────────────────────────────────────────────────
  const scheduleNextPatrolTimer = useCallback((session, lastPatrolEndTime) => {
    if (patrolTimerRef.current) clearTimeout(patrolTimerRef.current);
    if (antiIdleTimerRef.current) clearTimeout(antiIdleTimerRef.current);

    const base = lastPatrolEndTime ? new Date(lastPatrolEndTime) : new Date();
    const nextPatrolAt = new Date(base.getTime() + PATROL_INTERVAL_MS);
    const antiIdleDelay = ANTI_IDLE_MIN_MS + Math.random() * (PATROL_INTERVAL_MS - ANTI_IDLE_MIN_MS);

    // Anti-idle: random prompt between 30-60 min after last patrol
    antiIdleTimerRef.current = setTimeout(() => {
      setAntiIdlePrompt(true);
      logRandomPrompt(session.guardId, session.id);
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

  const logRandomPrompt = useCallback(async (guardId, sessionId) => {
    const log = {
      id: `rpl_${Date.now()}`,
      guardId,
      sessionId,
      triggeredAt: new Date().toISOString(),
      responded: false,
      respondedAt: null,
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
  }, []);

  // ─── Patrol: Capture Checkpoint Photo ─────────────────────────────────────
  const captureCheckpoint = useCallback(async (patrolId, checkpointId, photoUri) => {
    const capture = {
      id: `pc_${Date.now()}`,
      patrolId,
      checkpointId,
      photoUri,
      capturedAt: new Date().toISOString(),
    };

    const allCaptures = await load(KEYS.PATROL_CAPTURES) || [];
    const updated = [...allCaptures, capture];
    await save(KEYS.PATROL_CAPTURES, updated);
    setPatrolCaptures(updated);

    // Update active patrol's captured list
    const allPatrols = await load(KEYS.PATROL_SESSIONS) || [];
    const updatedPatrols = allPatrols.map(p =>
      p.id === patrolId
        ? { ...p, checkpointsCaptured: [...(p.checkpointsCaptured || []), checkpointId] }
        : p
    );
    await save(KEYS.PATROL_SESSIONS, updatedPatrols);
    setPatrolSessions(updatedPatrols);

    const current = updatedPatrols.find(p => p.id === patrolId);
    setActivePatrol(current || null);

    return capture;
  }, []);

  // ─── Patrol: Finish ───────────────────────────────────────────────────────
  const finishPatrol = useCallback(async (patrolId, forceFinish = false) => {
    const allPatrols = await load(KEYS.PATROL_SESSIONS) || [];
    const patrol = allPatrols.find(p => p.id === patrolId);
    if (!patrol) return;

    const siteCheckpoints = checkpoints.filter(cp => cp.siteId === patrol.siteId && cp.required);
    const missing = siteCheckpoints
      .filter(cp => !(patrol.checkpointsCaptured || []).includes(cp.id))
      .map(cp => cp.id);

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
  }, [checkpoints, users, sites, addAlert, scheduleNextPatrolTimer]);

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
    scheduleNextPatrolTimer(active, lastPatrol?.finishedAt || null);
  }, [currentUser, patrolSessions, startCheckCallTimer, startShiftEndTimer, scheduleNextPatrolTimer]);

  // ─── Roster management ────────────────────────────────────────────────────
  const publishRoster = useCallback(async (rosterData) => {
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

  const saveRosterTemplate = useCallback(async (template) => {
    const all = await load(KEYS.ROSTER_TEMPLATES) || [];
    const updated = [...all, { id: `rt_${Date.now()}`, createdAt: new Date().toISOString(), ...template }];
    await save(KEYS.ROSTER_TEMPLATES, updated);
    setRosterTemplates(updated);
  }, []);

  const deleteRosterTemplate = useCallback(async (templateId) => {
    const all = await load(KEYS.ROSTER_TEMPLATES) || [];
    const updated = all.filter(t => t.id !== templateId);
    await save(KEYS.ROSTER_TEMPLATES, updated);
    setRosterTemplates(updated);
  }, []);

  // ─── Alerts ───────────────────────────────────────────────────────────────
  const markAlertRead = useCallback(async (alertId) => {
    const all = await load(KEYS.ALERTS) || [];
    const updated = all.map(a => a.id === alertId ? { ...a, read: true } : a);
    await save(KEYS.ALERTS, updated);
    setAlerts(updated);
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    const all = await load(KEYS.ALERTS) || [];
    const updated = all.map(a => ({ ...a, read: true }));
    await save(KEYS.ALERTS, updated);
    setAlerts(updated);
  }, []);

  // ─── Checkpoint config ────────────────────────────────────────────────────
  const saveCheckpoints = useCallback(async (newCheckpoints) => {
    await save(KEYS.PATROL_CHECKPOINTS, newCheckpoints);
    setCheckpoints(newCheckpoints);
  }, []);

  // ─── Users management ─────────────────────────────────────────────────────
  const refreshUsers = useCallback(async () => {
    const u = await load(KEYS.USERS);
    setUsers(u || []);
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
    return alerts.filter(a => !a.read && mgr.siteIds?.includes(a.siteId));
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
    currentUser, authLoading, login, logout,
    updatePassword, resetPasswordWithCode,
    // Reference data
    users, sites, checkpoints, refreshUsers,
    // Super Admin Account Management & Audit
    auditLogs, addAuditLog, createUser, updateUser, toggleUserStatus, deleteUser,
    // Sessions
    shiftSessions, getGuardActiveSession, bookOn, bookOff,
    // Check calls
    checkCalls, activeCheckCall, respondToCheckCall,
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
    rosters, rosterTemplates, publishRoster, saveRosterTemplate,
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
