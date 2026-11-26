const { ShiftSession, ShiftRoster, CheckCall, RandomPromptLog, PatrolSession, User, Site, Alert } = require('../models');
const { createAlert } = require('./alertService');
const { sendPush } = require('./fcm');
const { sendRoutinePatrolDigests } = require('./routineDigest');
const { dayKey, getMondayOfWeek, parseTimeOnDate, calculateShiftEndDateTime } = require('../utils/dateHelpers');

const HOUR = 60 * 60 * 1000;

async function fireDueCheckCalls(now = new Date()) {
  const sessions = await ShiftSession.find({ bookedOffAt: null, nextCheckCallAt: { $lte: now } }).limit(100);
  for (const session of sessions) {
    if (session.scheduledEndAt && now >= session.scheduledEndAt) {
      // Shift scheduled end reached; do not schedule further check calls
      await ShiftSession.updateOne(
        { _id: session._id, bookedOffAt: null },
        { $set: { nextCheckCallAt: null } }
      );
      continue;
    }
    const dueAt = session.nextCheckCallAt;
    try {
      // A guard may already have submitted this hour manually while the job was
      // queued. Preserve that log and move the automated reminder to the next hour.
      const slotStart = new Date(dueAt); slotStart.setMinutes(0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + HOUR);
      const manualForSlot = await CheckCall.findOne({ sessionId: session._id, isManualLog: true, firedAt: { $gte: slotStart, $lt: slotEnd } }).select('_id');
      if (manualForSlot) {
        await ShiftSession.updateOne({ _id: session._id, bookedOffAt: null, nextCheckCallAt: null }, { $set: { nextCheckCallAt: slotEnd } });
        continue;
      }
      const claimed = await ShiftSession.updateOne(
        { _id: session._id, bookedOffAt: null, nextCheckCallAt: dueAt },
        { $set: { nextCheckCallAt: null } }
      );
      if (!claimed.modifiedCount) continue;
      const checkCall = await CheckCall.findOneAndUpdate(
        { sessionId: session._id, scheduledFor: dueAt },
        {
          $setOnInsert: {
            organisationId: session.organisationId,
            sessionId: session._id,
            guardId: session.guardId,
            siteId: session.siteId,
            firedAt: now,
            scheduledFor: dueAt,
            expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
            isRandom: false,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const guard = await User.findOne({ _id: session.guardId, role: 'guard' }).select('fcmToken role');
      if (guard?.fcmToken && guard.role === 'guard') {
        const isManagerToken = await User.exists({ fcmToken: guard.fcmToken, role: { $in: ['manager', 'admin', 'superadmin'] } });
        if (!isManagerToken) {
          await sendPush([guard.fcmToken], {
            title: 'Hourly check call required',
            body: 'Confirm everything is okay at your site within 10 minutes.',
            data: { type: 'check_call_due', checkCallId: checkCall._id.toString() },
          });
        }
      }
    } catch (error) {
      // A unique scheduledFor index makes simultaneous workers safe.
      if (error.code !== 11000) console.error('[OpsWorker] Check-call scheduling failed:', error.message);
      await ShiftSession.updateOne({ _id: session._id, bookedOffAt: null, nextCheckCallAt: null }, { $set: { nextCheckCallAt: new Date(now.getTime() + HOUR) } });
    }
  }
}

async function expireCheckCalls(now = new Date()) {
  const due = await CheckCall.find({ response: null, expiresAt: { $lte: now } }).limit(100);
  for (const item of due) {
    const call = await CheckCall.findOneAndUpdate(
      { _id: item._id, response: null, expiresAt: { $lte: now } },
      { $set: { response: 'missed', respondedAt: now, managerAlerted: true, managerAlertedAt: now } },
      { new: true }
    );
    if (!call) continue;
    if (call.sessionId) await ShiftSession.findByIdAndUpdate(call.sessionId, {
      $inc: { missedCheckCallCount: 1 },
      $set: { nextCheckCallAt: (() => { const next = new Date(call.scheduledFor || call.firedAt); next.setMinutes(0, 0, 0); return new Date(next.getTime() + HOUR); })() },
    });

    try {
      const [guard, site] = await Promise.all([
        User.findById(item.guardId).select('name badgeNumber'),
        Site.findById(item.siteId).select('name'),
      ]);
      await createAlert({
        organisationId: item.organisationId,
        siteId: item.siteId,
        guardId: item.guardId,
        type: 'check_call_missed',
        title: '🚨 Missed / Late Check Call',
        message: `${guard?.name || 'Guard'}${guard?.badgeNumber ? ` (${guard.badgeNumber})` : ''} missed the scheduled hourly check call at ${site?.name || 'Site'}. No confirmation was received within the 10-minute window.`,
        refModel: 'CheckCall',
        refId: item._id,
      });
    } catch (err) {
      console.error('[OpsWorker] Failed to create missed check call alert:', err.message);
    }
  }
}

async function fireDueRandomPrompts(now = new Date()) {
  const sessions = await ShiftSession.find({
    bookedOffAt: null,
    nextRandomPromptAt: { $lte: now, $ne: null },
    $or: [{ randomPromptCount: { $lt: 2 } }, { randomPromptCount: { $exists: false } }]
  }).limit(100);

  for (const session of sessions) {
    if (session.scheduledEndAt && now >= session.scheduledEndAt) {
      await ShiftSession.updateOne({ _id: session._id }, { $set: { nextRandomPromptAt: null } });
      continue;
    }
    const currentCount = session.randomPromptCount || 0;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * HOUR);
    const dayNightPromptCount = await RandomPromptLog.countDocuments({
      guardId: session.guardId,
      triggeredAt: { $gte: twentyFourHoursAgo }
    });

    // Exactly at most 2 surprise patrols in whole day/night (24h period)
    if (currentCount >= 2 || dayNightPromptCount >= 2) {
      await ShiftSession.updateOne({ _id: session._id }, { $set: { nextRandomPromptAt: null, randomPromptCount: 2 } });
      continue;
    }

    const dueAt = session.nextRandomPromptAt;
    const claimed = await ShiftSession.updateOne(
      { _id: session._id, nextRandomPromptAt: dueAt },
      { $set: { nextRandomPromptAt: null } }
    );
    if (!claimed.modifiedCount) continue;

    const log = await RandomPromptLog.create({
      organisationId: session.organisationId,
      shiftSessionId: session._id,
      guardId: session.guardId,
      siteId: session.siteId,
      triggeredAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      responded: false,
      managerAlerted: false,
    });

    // Exactly 2 surprise patrols in whole day/night: schedule prompt 2 ONLY if count in 24h will be < 2
    let nextPrompt = null;
    if (currentCount === 0 && dayNightPromptCount + 1 < 2) {
      const shiftStart = new Date(session.bookedOnAt || now);
      // Window 2: randomly between 6.5h and 10h from bookedOnAt
      nextPrompt = new Date(shiftStart.getTime() + (6.5 + Math.random() * 3.5) * HOUR);
      if (session.scheduledEndAt && nextPrompt >= session.scheduledEndAt) {
        nextPrompt = new Date(session.scheduledEndAt.getTime() - (1 + Math.random() * 1.5) * HOUR);
      }
      if (nextPrompt <= now) {
        nextPrompt = new Date(now.getTime() + (2 + Math.random() * 2.5) * HOUR);
      }
    }

    await ShiftSession.updateOne(
      { _id: session._id },
      {
        $inc: { randomPromptCount: 1 },
        $set: { nextRandomPromptAt: nextPrompt }
      }
    );

    const guard = await User.findOne({ _id: session.guardId, role: 'guard' }).select('fcmToken role');
    if (guard?.fcmToken && guard.role === 'guard') {
      const isManagerToken = await User.exists({ fcmToken: guard.fcmToken, role: { $in: ['manager', 'admin', 'superadmin'] } });
      if (!isManagerToken) {
        await sendPush([guard.fcmToken], {
          title: 'Surprise patrol check',
          body: 'Start a site patrol now and complete the assigned checkpoints.',
          data: { type: 'random_patrol', promptId: log._id.toString() },
        });
      }
    }
  }
}

// Exactly 2 surprise patrols per shift session: schedule missing if count < 2
async function scheduleMissingRandomPrompts(now = new Date()) {
  const sessions = await ShiftSession.find({
    bookedOffAt: null,
    nextRandomPromptAt: null,
    $or: [{ randomPromptCount: { $lt: 2 } }, { randomPromptCount: { $exists: false } }]
  }).limit(100);

  for (const session of sessions) {
    if (session.scheduledEndAt && now >= session.scheduledEndAt) continue;
    const currentCount = session.randomPromptCount || 0;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * HOUR);
    const dayNightPromptCount = await RandomPromptLog.countDocuments({
      guardId: session.guardId,
      triggeredAt: { $gte: twentyFourHoursAgo }
    });
    if (currentCount >= 2 || dayNightPromptCount >= 2) {
      await ShiftSession.updateOne({ _id: session._id }, { $set: { nextRandomPromptAt: null, randomPromptCount: 2 } });
      continue;
    }

    const activePrompt = await RandomPromptLog.exists({
      shiftSessionId: session._id,
      responded: false,
      expiresAt: { $gt: now },
    });
    if (activePrompt) continue;

    const shiftStart = new Date(session.bookedOnAt || now);
    let nextPrompt;
    if (currentCount === 0) {
      // First prompt: between 1.5h and 4.5h from bookedOnAt
      nextPrompt = new Date(shiftStart.getTime() + (1.5 + Math.random() * 3.0) * HOUR);
      if (nextPrompt <= now) {
        nextPrompt = new Date(now.getTime() + (20 + Math.random() * 40) * 60 * 1000);
      }
    } else {
      // Second prompt: between 6.5h and 10h from bookedOnAt
      nextPrompt = new Date(shiftStart.getTime() + (6.5 + Math.random() * 3.5) * HOUR);
      if (nextPrompt <= now) {
        nextPrompt = new Date(now.getTime() + (45 + Math.random() * 60) * 60 * 1000);
      }
    }

    if (session.scheduledEndAt && nextPrompt >= session.scheduledEndAt) {
      nextPrompt = new Date(session.scheduledEndAt.getTime() - 30 * 60 * 1000);
    }

    if (nextPrompt > now) {
      await ShiftSession.updateOne(
        { _id: session._id, bookedOffAt: null, nextRandomPromptAt: null },
        { $set: { nextRandomPromptAt: nextPrompt } }
      );
    }
  }
}

// Backfill hourly reminders for active shifts created before server scheduling
// was enabled, and for sessions left without a next reminder after recovery.
async function scheduleMissingCheckCalls(now = new Date()) {
  const sessions = await ShiftSession.find({
    bookedOffAt: null,
    nextCheckCallAt: null,
  }).limit(100);

  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  for (const session of sessions) {
    const pendingCall = await CheckCall.exists({
      sessionId: session._id,
      response: null,
    });
    if (pendingCall) continue;

    await ShiftSession.updateOne(
      { _id: session._id, bookedOffAt: null, nextCheckCallAt: null },
      { $set: { nextCheckCallAt: nextHour } }
    );
  }
}

async function warnShiftsEndingSoon(now = new Date()) {
  const due = await ShiftSession.find({
    bookedOffAt: null,
    scheduledEndAt: { $lte: new Date(now.getTime() + 10 * 60 * 1000), $gt: now },
    shiftEndWarningSentAt: null,
  }).limit(100);
  for (const item of due) {
    const claimed = await ShiftSession.findOneAndUpdate(
      { _id: item._id, bookedOffAt: null, shiftEndWarningSentAt: null },
      { $set: { shiftEndWarningSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;
    const guard = await User.findOne({ _id: item.guardId, role: 'guard' }).select('fcmToken role');
    if (guard?.fcmToken && guard.role === 'guard') {
      const isManagerToken = await User.exists({ fcmToken: guard.fcmToken, role: { $in: ['manager', 'admin', 'superadmin'] } });
      if (!isManagerToken) {
        await sendPush([guard.fcmToken], {
          title: 'Your shift ends in 10 minutes',
          body: 'Please book off when you have completed your handover.',
          data: { type: 'shift_end_reminder', shiftSessionId: item._id.toString() },
        });
      }
    }
  }
}

async function alertIgnoredPrompts(now = new Date()) {
  const pending = await RandomPromptLog.find({ responded: false, managerAlerted: false, expiresAt: { $lte: now } }).limit(100);
  for (const item of pending) {
    await RandomPromptLog.updateOne(
      { _id: item._id },
      { $set: { responded: true, managerAlerted: true, respondedAt: item.firedAt || now } }
    );
  }
}

async function checkLateArrivals(now = new Date()) {
  const weekStart = getMondayOfWeek(now);
  const currentDay = dayKey(now);

  const rawRosters = await ShiftRoster.find({
    acceptanceStatus: { $ne: 'rejected' },
    $or: [
      { weekStartDate: weekStart },
      { recurringWeekly: true }
    ]
  }).sort({ weekStartDate: -1 }).limit(300);

  // Group by guardId + siteId: prioritize current week's roster, otherwise latest recurring
  const rosterMap = new Map();
  for (const r of rawRosters) {
    const key = `${r.guardId}_${r.siteId}`;
    if (!rosterMap.has(key)) {
      rosterMap.set(key, r);
    } else {
      const existing = rosterMap.get(key);
      if (existing.weekStartDate !== weekStart && r.weekStartDate === weekStart) {
        rosterMap.set(key, r);
      }
    }
  }

  const rosters = Array.from(rosterMap.values());
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  for (const roster of rosters) {
    const todayShift = roster.days?.[currentDay];
    if (!todayShift?.start || !todayShift?.end) continue;

    const shiftStartAt = parseTimeOnDate(todayShift.start, now);
    const shiftEndAt = calculateShiftEndDateTime(todayShift.start, todayShift.end, now);

    // If shift has not reached exact scheduled start time, or has already ended, skip
    if (now.getTime() < shiftStartAt.getTime() || now > shiftEndAt) continue;

    // Check if guard has an active session or booked on for this shift
    const activeSession = await ShiftSession.findOne({
      organisationId: roster.organisationId,
      guardId: roster.guardId,
      siteId: roster.siteId,
      bookedOffAt: null,
    });
    if (activeSession) continue;

    const sessionToday = await ShiftSession.findOne({
      organisationId: roster.organisationId,
      guardId: roster.guardId,
      siteId: roster.siteId,
      bookedOnAt: { $gte: new Date(shiftStartAt.getTime() - 30 * 60 * 1000) }
    });
    if (sessionToday) continue;

    // If guard already booked on late, do not alert as not arrived
    const bookedLate = await Alert.exists({
      organisationId: roster.organisationId,
      guardId: roster.guardId,
      siteId: roster.siteId,
      type: 'guard_booked_late',
      createdAt: { $gte: startOfDay }
    });
    if (bookedLate) continue;

    // Check if we already alerted the manager for this guard in the last 30 minutes
    const recentAlert = await Alert.findOne({
      organisationId: roster.organisationId,
      guardId: roster.guardId,
      siteId: roster.siteId,
      type: 'guard_not_arrived',
      createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) }
    });
    if (recentAlert) continue;

    const diffMins = Math.max(0, Math.round((now.getTime() - shiftStartAt.getTime()) / 60000));
    try {
      const [guard, site] = await Promise.all([
        User.findById(roster.guardId).select('name badgeNumber'),
        Site.findById(roster.siteId).select('name'),
      ]);
      const guardStr = `${guard?.name || 'Guard'}${guard?.badgeNumber ? ` (${guard.badgeNumber})` : ''}`;
      const siteStr = site?.name || 'Site';
      await createAlert({
        organisationId: roster.organisationId,
        siteId: roster.siteId,
        guardId: roster.guardId,
        type: 'guard_not_arrived',
        title: '🚨 Guard did not book on',
        message: `Hey, ${guardStr} did not book on while their shift started at ${todayShift.start} at ${siteStr}.${diffMins > 0 ? ` Currently ${diffMins} min overdue.` : ''}`,
        refModel: 'ShiftRoster',
        refId: roster._id,
      });
    } catch (err) {
      console.error('[OpsWorker] Failed to create late arrival alert:', err.message);
    }
  }
}

async function checkOverdueSignOuts(now = new Date()) {
  const graceMinutes = 10;
  const sessions = await ShiftSession.find({
    bookedOffAt: null,
    scheduledEndAt: { $ne: null, $lte: new Date(now.getTime() - graceMinutes * 60 * 1000) },
  }).limit(50);

  for (const session of sessions) {
    // If shift is > 2 hours overdue, auto-end it
    if (now.getTime() > session.scheduledEndAt.getTime() + 2 * HOUR) {
      await ShiftSession.updateOne(
        { _id: session._id, bookedOffAt: null },
        { $set: { bookedOffAt: new Date(session.scheduledEndAt.getTime() + 2 * HOUR), nextCheckCallAt: null, autoEnded: true } }
      );
      await PatrolSession.updateMany(
        { shiftSessionId: session._id, status: 'in_progress' },
        { $set: { status: 'incomplete', finishedAt: now, managerNote: 'Auto-closed after shift sign-out expired' } }
      );
      continue;
    }

    // Check if we already alerted manager in the last 60 minutes
    const recentAlert = await Alert.findOne({
      organisationId: session.organisationId,
      guardId: session.guardId,
      siteId: session.siteId,
      refId: session._id,
      type: 'guard_not_signed_out',
      createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
    });
    if (recentAlert) continue;

    const diffMins = Math.max(1, Math.round((now.getTime() - session.scheduledEndAt.getTime()) / 60000));
    try {
      const [guard, site] = await Promise.all([
        User.findById(session.guardId).select('name badgeNumber'),
        Site.findById(session.siteId).select('name'),
      ]);
      await createAlert({
        organisationId: session.organisationId,
        siteId: session.siteId,
        guardId: session.guardId,
        type: 'guard_not_signed_out',
        title: '⏰ Guard not signed out',
        message: `${guard?.name || 'Guard'}${guard?.badgeNumber ? ` (${guard.badgeNumber})` : ''} has not signed out for shift that finished at ${session.scheduledEnd || 'scheduled time'} at ${site?.name || 'Site'}. Overdue by ${diffMins} min.`,
        refModel: 'ShiftSession',
        refId: session._id,
      });
    } catch (err) {
      console.error('[OpsWorker] Failed to create not signed out alert:', err.message);
    }
  }
}

function startOperationsWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      await fireDueCheckCalls(now).catch(e => console.error('[OpsWorker] fireDueCheckCalls error:', e.message));
      await expireCheckCalls(now).catch(e => console.error('[OpsWorker] expireCheckCalls error:', e.message));
      await checkLateArrivals(now).catch(e => console.error('[OpsWorker] checkLateArrivals error:', e.message));
      await checkOverdueSignOuts(now).catch(e => console.error('[OpsWorker] checkOverdueSignOuts error:', e.message));
      await scheduleMissingCheckCalls(now).catch(e => console.error('[OpsWorker] scheduleMissingCheckCalls error:', e.message));
      await scheduleMissingRandomPrompts(now).catch(e => console.error('[OpsWorker] scheduleMissingRandomPrompts error:', e.message));
      await fireDueRandomPrompts(now).catch(e => console.error('[OpsWorker] fireDueRandomPrompts error:', e.message));
      await warnShiftsEndingSoon(now).catch(e => console.error('[OpsWorker] warnShiftsEndingSoon error:', e.message));
      await alertIgnoredPrompts(now).catch(e => console.error('[OpsWorker] alertIgnoredPrompts error:', e.message));
      await sendRoutinePatrolDigests(now).catch(e => console.error('[OpsWorker] sendRoutinePatrolDigests error:', e.message));
    } catch (error) {
      console.error('[OpsWorker] Tick failed:', error.message);
    } finally { running = false; }
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}

module.exports = { startOperationsWorker, fireDueCheckCalls, expireCheckCalls, checkLateArrivals, checkOverdueSignOuts, fireDueRandomPrompts, scheduleMissingCheckCalls, scheduleMissingRandomPrompts, warnShiftsEndingSoon, alertIgnoredPrompts };
