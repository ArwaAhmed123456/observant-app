import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_SITES,
  INITIAL_USERS,
  INITIAL_ROSTERS,
  INITIAL_TEMPLATES,
  INITIAL_SHIFT_SESSIONS,
  INITIAL_CHECK_CALLS,
  INITIAL_PATROLS,
  INITIAL_ANTI_IDLE_LOGS,
  INITIAL_NOTIFICATIONS,
  getCurrentWeekDates
} from '../data/mockData';
import { sounds } from '../utils/soundEffects';

const SecurityContext = createContext(null);

export const SecurityProvider = ({ children }) => {
  // Safe initial value getter
  const getInitial = (key, fallback) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(`observant_${key}`);
        return saved ? JSON.parse(saved) : fallback;
      }
      return fallback;
    } catch {
      return fallback;
    }
  };

  const [users] = useState(() => getInitial('users', INITIAL_USERS));
  const [sites, setSites] = useState(() => getInitial('sites', INITIAL_SITES));
  const [rosters, setRosters] = useState(() => getInitial('rosters', INITIAL_ROSTERS));
  const [templates, setTemplates] = useState(() => getInitial('templates', INITIAL_TEMPLATES));
  const [shiftSessions, setShiftSessions] = useState(() => getInitial('shiftSessions', INITIAL_SHIFT_SESSIONS));
  const [checkCalls, setCheckCalls] = useState(() => getInitial('checkCalls', INITIAL_CHECK_CALLS));
  const [patrolSessions, setPatrolSessions] = useState(() => getInitial('patrolSessions', INITIAL_PATROLS));
  const [antiIdleLogs, setAntiIdleLogs] = useState(() => getInitial('antiIdleLogs', INITIAL_ANTI_IDLE_LOGS));
  const [notifications, setNotifications] = useState(() => getInitial('notifications', INITIAL_NOTIFICATIONS));

  // Current logged in user (default: Ahmad Khan - Guard)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = getInitial('currentUser', null);
    return saved || INITIAL_USERS[0];
  });

  // Sound enable/disable
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active check call awaiting response (modal state)
  const [pendingCheckCall, setPendingCheckCall] = useState(null);

  // Pending surprise patrol prompt (modal / toast state)
  const [pendingSurprisePatrol, setPendingSurprisePatrol] = useState(null);

  // Manager real-time alert banner
  const [managerAlert, setManagerAlert] = useState(null);

  // Guard confirmation toast
  const [guardToast, setGuardToast] = useState(null);

  // Next expected patrol slot (by site)
  const [expectedPatrolSlots, setExpectedPatrolSlots] = useState({
    'site-1': new Date(Date.now() + 3600000).toISOString(),
    'site-2': new Date(Date.now() + 3600000).toISOString(),
    'site-3': new Date(Date.now() + 3600000).toISOString()
  });

  // Sync state to storage
  useEffect(() => {
    const saveState = async () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('observant_sites', JSON.stringify(sites));
          localStorage.setItem('observant_rosters', JSON.stringify(rosters));
          localStorage.setItem('observant_templates', JSON.stringify(templates));
          localStorage.setItem('observant_shiftSessions', JSON.stringify(shiftSessions));
          localStorage.setItem('observant_checkCalls', JSON.stringify(checkCalls));
          localStorage.setItem('observant_patrolSessions', JSON.stringify(patrolSessions));
          localStorage.setItem('observant_antiIdleLogs', JSON.stringify(antiIdleLogs));
          localStorage.setItem('observant_notifications', JSON.stringify(notifications));
          localStorage.setItem('observant_currentUser', JSON.stringify(currentUser));
        }
      } catch {}
    };
    saveState();
  }, [sites, rosters, templates, shiftSessions, checkCalls, patrolSessions, antiIdleLogs, notifications, currentUser]);

  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Find active shift session for current user
  const activeShiftSession = shiftSessions.find(
    s => s.guardId === currentUser.id && s.isActive
  );

  // Find active patrol session for current user
  const activePatrolSession = patrolSessions.find(
    p => p.guardId === currentUser.id && p.status === 'in_progress'
  );

  // Helper to add notification
  const addNotification = ({ userId, title, message, type = 'info', actionTab = null }) => {
    const notif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
      actionTab
    };
    setNotifications(prev => [notif, ...prev]);
    return notif;
  };

  // Helper to push alert to Manager
  const triggerManagerAlert = ({ type, title, message, guardName, siteName, timestamp }) => {
    sounds.playEmergencyAlarm();
    setManagerAlert({
      id: `alert-${Date.now()}`,
      type, // 'issue_reported' | 'missed_check_call' | 'early_late_book' | 'shift_override'
      title,
      message,
      guardName,
      siteName,
      timestamp: timestamp || new Date().toISOString()
    });
  };

  // 1. BOOK ON
  const bookOn = (siteId = null) => {
    const assignedSite = siteId || currentUser.assignedSiteId || 'site-1';
    const siteObj = sites.find(s => s.id === assignedSite);

    // Compute punctuality relative to scheduled shift
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Check today's scheduled shift in the roster
    const today = getCurrentWeekDates().find(d => d.isToday)?.dayName || 'Mon';
    const currentRoster = rosters[0];
    const todayShift = currentRoster?.shifts?.find(
      s => s.guardId === currentUser.id && s.dayName === today && s.status !== 'off'
    );

    let punctualityStatus = 'On Time';
    let punctualityMinutes = 0;

    if (todayShift) {
      const [schedH, schedM] = todayShift.startTime.split(':').map(Number);
      const diffMins = (currentHours * 60 + currentMinutes) - (schedH * 60 + schedM);
      if (diffMins > 10) {
        punctualityStatus = 'Late';
        punctualityMinutes = diffMins;
      } else if (diffMins < -15) {
        punctualityStatus = 'Early';
        punctualityMinutes = Math.abs(diffMins);
      }
    }

    const newSession = {
      id: `session-${Date.now()}`,
      guardId: currentUser.id,
      siteId: assignedSite,
      scheduledStartTime: todayShift ? todayShift.startTime : '18:00',
      scheduledEndTime: todayShift ? todayShift.endTime : '06:00',
      bookedOnAt: new Date().toISOString(),
      punctualityStatus,
      punctualityMinutes,
      bookedOffAt: null,
      isActive: true,
      gpsLocation: `51.5147° N, 0.0815° W (${siteObj?.name || 'On-Site GPS Verified'})`
    };

    setShiftSessions(prev => [newSession, ...prev]);
    sounds.playSuccessChime();

    setGuardToast({
      title: 'Booked On Successfully',
      message: `Active shift started at ${siteObj?.name}. Status: ${punctualityStatus} (${punctualityMinutes > 0 ? `${punctualityMinutes}m` : 'Perfect Timing'}).`,
      type: 'success'
    });

    addNotification({
      userId: currentUser.id,
      title: 'Shift Session Started',
      message: `You booked on at ${siteObj?.name} (${punctualityStatus}). Check calls are now active.`,
      type: 'shift'
    });

    // If late or early by significant margin, alert manager
    if (punctualityStatus !== 'On Time') {
      triggerManagerAlert({
        type: 'early_late_book',
        title: `Guard Booked On ${punctualityStatus}`,
        message: `${currentUser.name} booked on ${punctualityStatus.toLowerCase()} by ${punctualityMinutes} minutes at ${siteObj?.name}.`,
        guardName: currentUser.name,
        siteName: siteObj?.name
      });
    }

    return newSession;
  };

  // 2. BOOK OFF
  const bookOff = () => {
    if (!activeShiftSession) return;

    const siteObj = sites.find(s => s.id === activeShiftSession.siteId);
    const updated = {
      ...activeShiftSession,
      bookedOffAt: new Date().toISOString(),
      isActive: false
    };

    setShiftSessions(prev =>
      prev.map(s => (s.id === activeShiftSession.id ? updated : s))
    );

    // Also close any active check call
    setPendingCheckCall(null);
    sounds.playSuccessChime();

    setGuardToast({
      title: 'Booked Off Successfully',
      message: `Shift closed at ${siteObj?.name}. Have a safe rest period!`,
      type: 'success'
    });

    addNotification({
      userId: currentUser.id,
      title: 'Shift Session Ended',
      message: `You booked off from ${siteObj?.name}. Total session logged.`,
      type: 'shift'
    });
  };

  // 3. TRIGGER CHECK CALL (Hourly or Random)
  const triggerCheckCall = (isRandom = false, targetGuard = null) => {
    const target = targetGuard || currentUser;
    const session = shiftSessions.find(s => s.guardId === target.id && s.isActive);
    const siteId = session ? session.siteId : target.assignedSiteId || 'site-1';
    const siteObj = sites.find(s => s.id === siteId);

    const checkCallId = `cc-${Date.now()}`;
    const newPrompt = {
      id: checkCallId,
      sessionId: session?.id || 'live-adhoc',
      guardId: target.id,
      siteId,
      siteName: siteObj?.name || 'Site',
      guardName: target.name,
      promptTime: new Date().toISOString(),
      callType: isRandom ? 'random' : 'hourly',
      status: 'pending',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10-minute response window
    };

    setPendingCheckCall(newPrompt);
    sounds.playCheckCallBeep();

    addNotification({
      userId: target.id,
      title: isRandom ? '⚡ Random Security Check Call' : '⏰ Hourly Check Call Prompt',
      message: 'Is everything okay on site? You have 10 minutes to respond.',
      type: 'check_call_prompt',
      actionTab: 'check_call'
    });

    return newPrompt;
  };

  // 4. RESPOND TO CHECK CALL
  const respondCheckCall = (responseType, notes = '') => {
    if (!pendingCheckCall) return;

    const isYes = responseType === 'yes';
    const nowIso = new Date().toISOString();
    const siteObj = sites.find(s => s.id === pendingCheckCall.siteId);

    const completedCall = {
      ...pendingCheckCall,
      status: isYes ? 'completed' : 'issue_reported',
      response: responseType,
      responseTime: nowIso,
      notes: notes || (isYes ? 'All secure on site.' : 'Issue flagged by guard.'),
      managerAlerted: !isYes
    };

    setCheckCalls(prev => [completedCall, ...prev]);
    setPendingCheckCall(null);

    if (isYes) {
      sounds.playSuccessChime();
      setGuardToast({
        title: 'Check Call Recorded',
        message: 'Okay thank you, your check call is recorded successfully.',
        type: 'success'
      });
      addNotification({
        userId: pendingCheckCall.guardId,
        title: 'Check Call Recorded',
        message: 'Okay thank you, your check call is recorded successfully.',
        type: 'check_call_ok'
      });
    } else {
      sounds.playEmergencyAlarm();
      setGuardToast({
        title: 'Issue Alert Sent to Manager',
        message: 'Your report has been escalated to the Operations Manager immediately.',
        type: 'warning'
      });

      // Notify Manager
      triggerManagerAlert({
        type: 'issue_reported',
        title: '⚠️ Guard Reported Issue on Site',
        message: `${pendingCheckCall.guardName} reported an issue at ${siteObj?.name}: "${notes || 'No description provided'}"`,
        guardName: pendingCheckCall.guardName,
        siteName: siteObj?.name
      });
    }
  };

  // 5. EXPIRE CHECK CALL (Missed after 10 min window)
  const expireCheckCall = () => {
    if (!pendingCheckCall) return;

    const siteObj = sites.find(s => s.id === pendingCheckCall.siteId);
    const missedCall = {
      ...pendingCheckCall,
      status: 'missed',
      response: 'missed',
      responseTime: null,
      notes: 'No response received within the 10-minute response window.',
      managerAlerted: true
    };

    setCheckCalls(prev => [missedCall, ...prev]);
    setPendingCheckCall(null);

    // Auto alert to Manager
    triggerManagerAlert({
      type: 'missed_check_call',
      title: '🚨 Missed Check Call Alert',
      message: `${pendingCheckCall.guardName} did not respond to check call within 10 minutes at ${siteObj?.name}. Immediate welfare check required!`,
      guardName: pendingCheckCall.guardName,
      siteName: siteObj?.name
    });

    addNotification({
      userId: pendingCheckCall.guardId,
      title: 'Missed Check Call Warning',
      message: 'You failed to answer the check call within 10 minutes. The Operations Manager was alerted.',
      type: 'warning'
    });
  };

  // 6. PATROLLING MODULE: START PATROL
  const startPatrol = (siteId = null) => {
    const assignedSite = siteId || activeShiftSession?.siteId || currentUser.assignedSiteId || 'site-1';
    const siteObj = sites.find(s => s.id === assignedSite);
    const checkpoints = siteObj?.requiredCheckpoints || [];

    const newPatrol = {
      id: `patrol-${Date.now()}`,
      sessionId: activeShiftSession?.id || 'adhoc-session',
      guardId: currentUser.id,
      siteId: assignedSite,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'in_progress',
      isAntiIdlePrompted: !!pendingSurprisePatrol,
      checkpointsTotal: checkpoints.length,
      checkpointsCompleted: 0,
      captures: []
    };

    // If this patrol was started in response to a surprise anti-idle prompt, log it!
    if (pendingSurprisePatrol) {
      respondSurprisePatrol(true, newPatrol.id);
    }

    setPatrolSessions(prev => [newPatrol, ...prev]);
    sounds.playSuccessChime();

    setGuardToast({
      title: 'Patrol Started',
      message: `Patrol begun at ${siteObj?.name}. Photo capture required for ${checkpoints.length} checkpoints.`,
      type: 'info'
    });

    return newPatrol;
  };

  // 7. CAPTURE CHECKPOINT PHOTO
  const captureCheckpointPhoto = (checkpointId, photoDataUrl) => {
    if (!activePatrolSession) return;

    sounds.playCameraShutter();
    const siteObj = sites.find(s => s.id === activePatrolSession.siteId);
    const cp = siteObj?.requiredCheckpoints?.find(c => c.id === checkpointId);

    const newCapture = {
      checkpointId,
      name: cp ? cp.name : 'Checkpoint',
      timestamp: new Date().toISOString(),
      photoUrl: photoDataUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&auto=format&fit=crop&q=80',
      verified: true
    };

    const existingCaptures = activePatrolSession.captures.filter(c => c.checkpointId !== checkpointId);
    const updatedCaptures = [...existingCaptures, newCapture];

    const updatedPatrol = {
      ...activePatrolSession,
      captures: updatedCaptures,
      checkpointsCompleted: updatedCaptures.length
    };

    setPatrolSessions(prev =>
      prev.map(p => (p.id === activePatrolSession.id ? updatedPatrol : p))
    );

    setGuardToast({
      title: 'Checkpoint Photographed',
      message: `${newCapture.name} verified (${updatedCaptures.length} of ${activePatrolSession.checkpointsTotal} complete).`,
      type: 'success'
    });
  };

  // 8. FINISH PATROL
  const finishPatrol = (allowIncomplete = false) => {
    if (!activePatrolSession) return;

    const isComplete = activePatrolSession.checkpointsCompleted >= activePatrolSession.checkpointsTotal;

    if (!isComplete && !allowIncomplete) {
      return { success: false, missingCount: activePatrolSession.checkpointsTotal - activePatrolSession.checkpointsCompleted };
    }

    const endTime = new Date().toISOString();
    const updatedPatrol = {
      ...activePatrolSession,
      endTime,
      status: isComplete ? 'completed' : 'completed_with_warnings',
      warningNotes: !isComplete ? `Completed with ${activePatrolSession.checkpointsTotal - activePatrolSession.checkpointsCompleted} missing checkpoint photos` : null
    };

    setPatrolSessions(prev =>
      prev.map(p => (p.id === activePatrolSession.id ? updatedPatrol : p))
    );

    sounds.playSuccessChime();

    // DYNAMIC PATROL SLOT SHIFTING
    // If completed, next scheduled patrol slot shifts forward ~1 hour from completion time!
    const nextSlot = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    setExpectedPatrolSlots(prev => ({
      ...prev,
      [activePatrolSession.siteId]: nextSlot
    }));

    setGuardToast({
      title: isComplete ? 'Patrol Completed Successfully' : 'Patrol Finished (Flagged)',
      message: `All logs saved. Next patrol expected at ~${new Date(nextSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      type: isComplete ? 'success' : 'warning'
    });

    if (!isComplete) {
      triggerManagerAlert({
        type: 'incomplete_patrol',
        title: '⚠️ Incomplete Patrol Warning',
        message: `${currentUser.name} finished patrol with ${activePatrolSession.checkpointsTotal - activePatrolSession.checkpointsCompleted} missing checkpoints.`,
        guardName: currentUser.name,
        siteName: sites.find(s => s.id === activePatrolSession.siteId)?.name
      });
    }

    return { success: true };
  };

  // 9. ANTI-IDLE "LAZY GUARD" DETECTION TRIGGER
  const triggerSurprisePatrolPrompt = (guardId = null) => {
    const targetId = guardId || currentUser.id;
    const targetUser = users.find(u => u.id === targetId);
    const siteId = targetUser?.assignedSiteId || 'site-1';
    const siteObj = sites.find(s => s.id === siteId);

    const surprisePrompt = {
      id: `surprise-${Date.now()}`,
      guardId: targetId,
      siteId,
      siteName: siteObj?.name,
      triggerTime: new Date().toISOString(),
      promptGapMinutes: 32 + Math.floor(Math.random() * 15) // Random point between 32 and 47 mins
    };

    setPendingSurprisePatrol(surprisePrompt);
    sounds.playEmergencyAlarm();

    addNotification({
      userId: targetId,
      title: '⚡ Anti-Idle Surprise Patrol Alert',
      message: 'Surprise patrol prompt triggered! Start patrol immediately to satisfy this hour’s requirement.',
      type: 'surprise_patrol',
      actionTab: 'patrol'
    });

    return surprisePrompt;
  };

  // 10. RESPOND TO SURPRISE PATROL PROMPT
  const respondSurprisePatrol = (accepted, patrolSessionId = null) => {
    if (!pendingSurprisePatrol) return;

    const triggerMs = new Date(pendingSurprisePatrol.triggerTime).getTime();
    const latencySec = Math.round((Date.now() - triggerMs) / 1000);

    const logEntry = {
      id: `ail-${Date.now()}`,
      guardId: pendingSurprisePatrol.guardId,
      siteId: pendingSurprisePatrol.siteId,
      patrolSessionId,
      triggerTime: pendingSurprisePatrol.triggerTime,
      promptType: 'Surprise Anti-Idle Patrol Alert',
      gapIntervalMinutes: pendingSurprisePatrol.promptGapMinutes,
      responded: accepted,
      responseLatencySeconds: accepted ? latencySec : null,
      dynamicSlotShifted: accepted,
      newNextPatrolTime: accepted ? new Date(Date.now() + 3600000).toISOString() : null,
      notes: accepted
        ? `Guard accepted early surprise patrol in ${latencySec}s. Next slot shifted forward 1 hour.`
        : 'Guard ignored or dismissed surprise patrol prompt. Regular top-of-hour schedule retained.'
    };

    setAntiIdleLogs(prev => [logEntry, ...prev]);
    setPendingSurprisePatrol(null);
  };

  // 11. SHIFT-END REMINDER (10 min before end)
  const triggerShiftEndReminder = () => {
    sounds.playCheckCallBeep();
    setGuardToast({
      title: 'Shift Ending Soon',
      message: "Your shift is about to end in 10 minutes — don't forget to Book Off!",
      type: 'info'
    });
    addNotification({
      userId: currentUser.id,
      title: 'Shift Ending Reminder',
      message: "Your shift is about to end in 10 minutes — don't forget to Book Off.",
      type: 'reminder',
      actionTab: 'shift'
    });
  };

  // 12. ROSTER: PUBLISH WEEKLY SCHEDULE
  const publishRoster = (weekRosterId) => {
    setRosters(prev =>
      prev.map(r =>
        r.id === weekRosterId
          ? { ...r, published: true, publishedAt: new Date().toISOString() }
          : r
      )
    );

    sounds.playSuccessChime();

    // Push notification to each guard
    users.filter(u => u.role === 'guard').forEach(g => {
      addNotification({
        userId: g.id,
        title: 'Weekly Schedule Published',
        message: 'Your schedule for this week is ready. Tap to view your assigned shifts and times.',
        type: 'roster',
        actionTab: 'calendar'
      });
    });

    setGuardToast({
      title: 'Schedule Published',
      message: 'Weekly roster published. Notification sent to all guards.',
      type: 'success'
    });
  };

  // 13. ROSTER: SINGLE-DAY OVERRIDE
  const overrideShiftDay = (shiftId, { startTime, endTime, siteId, reason }) => {
    let affectedGuardId = null;

    setRosters(prev =>
      prev.map(r => ({
        ...r,
        shifts: r.shifts.map(s => {
          if (s.id === shiftId) {
            affectedGuardId = s.guardId;
            return {
              ...s,
              startTime: startTime || s.startTime,
              endTime: endTime || s.endTime,
              siteId: siteId || s.siteId,
              isOverridden: true,
              overrideReason: reason || 'Manager single-day schedule adjustment'
            };
          }
          return s;
        })
      }))
    );

    if (affectedGuardId) {
      const guardUser = users.find(u => u.id === affectedGuardId);
      addNotification({
        userId: affectedGuardId,
        title: 'Shift Schedule Modified',
        message: `Your shift was adjusted: ${startTime || ''}–${endTime || ''}. Reason: ${reason || 'Operational update'}.`,
        type: 'override',
        actionTab: 'calendar'
      });

      triggerManagerAlert({
        type: 'shift_override',
        title: 'Shift Override Recorded',
        message: `Single-day shift for ${guardUser?.name || 'Guard'} was modified: ${reason || 'Updated'}`,
        guardName: guardUser?.name,
        siteName: 'Schedule Override'
      });
    }
  };

  // 14. ROSTER TEMPLATES: SAVE & APPLY
  const saveRosterTemplate = (name, description, guardId, siteId, schedule) => {
    const newTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      description,
      guardId,
      siteId,
      schedule
    };
    setTemplates(prev => [newTemplate, ...prev]);
    return newTemplate;
  };

  const applyRosterTemplate = (templateId, guardId) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;

    setRosters(prev =>
      prev.map(r => {
        const otherShifts = r.shifts.filter(s => s.guardId !== guardId);
        const newShifts = Object.entries(tpl.schedule).map(([dayName, dayPlan], idx) => ({
          id: `sh-${guardId}-${dayName}-${Date.now()}-${idx}`,
          guardId,
          siteId: tpl.siteId,
          dayName,
          startTime: dayPlan.start,
          endTime: dayPlan.end,
          status: dayPlan.active ? 'scheduled' : 'off'
        }));
        return {
          ...r,
          shifts: [...otherShifts, ...newShifts]
        };
      })
    );

    setGuardToast({
      title: 'Template Applied',
      message: `Template "${tpl.name}" applied successfully.`,
      type: 'success'
    });
  };

  // 15. CHECKPOINT CONFIGURATION PER SITE
  const updateSiteCheckpoints = (siteId, newCheckpoints) => {
    setSites(prev =>
      prev.map(s => (s.id === siteId ? { ...s, requiredCheckpoints: newCheckpoints } : s))
    );
    setGuardToast({
      title: 'Checkpoints Updated',
      message: 'Site patrol checklist requirements updated.',
      type: 'success'
    });
  };

  return (
    <SecurityContext.Provider
      value={{
        users,
        sites,
        rosters,
        templates,
        shiftSessions,
        checkCalls,
        patrolSessions,
        antiIdleLogs,
        notifications,
        currentUser,
        setCurrentUser,
        soundEnabled,
        setSoundEnabled,
        activeShiftSession,
        activePatrolSession,
        pendingCheckCall,
        setPendingCheckCall,
        pendingSurprisePatrol,
        setPendingSurprisePatrol,
        managerAlert,
        setManagerAlert,
        guardToast,
        setGuardToast,
        expectedPatrolSlots,

        // Actions
        bookOn,
        bookOff,
        triggerCheckCall,
        respondCheckCall,
        expireCheckCall,
        startPatrol,
        captureCheckpointPhoto,
        finishPatrol,
        triggerSurprisePatrolPrompt,
        respondSurprisePatrol,
        triggerShiftEndReminder,
        publishRoster,
        overrideShiftDay,
        saveRosterTemplate,
        applyRosterTemplate,
        updateSiteCheckpoints,
        addNotification
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
