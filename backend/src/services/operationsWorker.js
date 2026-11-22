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
      // Shift has ended; book off cleanly and do not fire further check calls
      await ShiftSession.updateOne(
        { _id: session._id, bookedOffAt: null },
        { $set: { bookedOffAt: session.scheduledEndAt, nextCheckCallAt: null, autoEnded: true } }
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
      const guard = await User.findById(session.guardId).select('fcmToken');
      if (guard?.fcmToken) await sendPush([guard.fcmToken], {
        title: 'Hourly check call required',
        body: 'Confirm everything is okay at your site within 10 minutes.',
        data: { type: 'check_call_due', checkCallId: checkCall._id.toString() },
      });
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
    if (currentCount >= 2) {
      await ShiftSession.updateOne({ _id: session._id }, { $set: { nextRandomPromptAt: null } });
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

    // Exactly 2 surprise patrols per shift: schedule prompt 2 if this was prompt 1
    let nextPrompt = null;
    if (currentCount === 0) {
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
        $set: { nextRandomPromptAt: currentCount === 0 ? nextPrompt : null }
      }
    );

    const guard = await User.findById(session.guardId).select('fcmToken');
    if (guard?.fcmToken) await sendPush([guard.fcmToken], {
      title: 'Surprise patrol check',
      body: 'Start a site patrol now and complete the assigned checkpoints.',
      data: { type: 'random_patrol', promptId: log._id.toString() },
    });
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
    if (currentCount >= 2) continue;

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
    const guard = await User.findById(item.guardId).select('fcmToken');
    if (guard?.fcmToken) await sendPush([guard.fcmToken], {
      title: 'Your shift ends in 10 minutes',
      body: 'Please book off when you have completed your handover.',
      data: { type: 'shift_end_reminder', shiftSessionId: item._id.toString() },
    });
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

  const rosters = await ShiftRoster.find({
    acceptanceStatus: 'accepted',
    $or: [
      { weekStartDate: weekStart },
      { recurringWeekly: true }
    ]
  }).limit(200);

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  for (const roster of rosters) {
    const todayShift = roster.days?.[currentDay];
    if (!todayShift?.start || !todayShift?.end) continue;

    const shiftStartAt = parseTimeOnDate(todayShift.start, now);
    const shiftEndAt = calculateShiftEndDateTime(todayShift.start, todayShift.end, now);

    // If shift has not started yet or has already ended, skip
    if (now < shiftStartAt || now > shiftEndAt) continue;

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

    // Check if we already alerted the manager for this guard today
    const alreadyAlerted = await Alert.exists({
      organisationId: roster.organisationId,
      guardId: roster.guardId,
      siteId: roster.siteId,
      type: 'guard_booked_late',
      createdAt: { $gte: startOfDay }
    });
    if (alreadyAlerted) continue;

    const diffMins = Math.max(1, Math.round((now.getTime() - shiftStartAt.getTime()) / 60000));
    try {
      const [guard, site] = await Promise.all([
        User.findById(roster.guardId).select('name badgeNumber'),
        Site.findById(roster.siteId).select('name'),
      ]);
      await createAlert({
        organisationId: roster.organisationId,
        siteId: roster.siteId,
        guardId: roster.guardId,
        type: 'guard_booked_late',
        title: '🚨 Guard Not Arrived On Site',
        message: `${guard?.name || 'Guard'}${guard?.badgeNumber ? ` (${guard.badgeNumber})` : ''} has not arrived on site for scheduled shift starting at ${todayShift.start} at ${site?.name || 'Site'}. Currently ${diffMins} min overdue.`,
        refModel: 'ShiftRoster',
        refId: roster._id,
      });
    } catch (err) {
      console.error('[OpsWorker] Failed to create late arrival alert:', err.message);
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
      await fireDueCheckCalls(now);
      await expireCheckCalls(now);
      await checkLateArrivals(now);
      await scheduleMissingCheckCalls(now);
      await scheduleMissingRandomPrompts(now);
      await fireDueRandomPrompts(now);
      await warnShiftsEndingSoon(now);
      await alertIgnoredPrompts(now);
      await sendRoutinePatrolDigests(now);
    } catch (error) {
      console.error('[OpsWorker] Tick failed:', error.message);
    } finally { running = false; }
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}

module.exports = { startOperationsWorker, fireDueCheckCalls, expireCheckCalls, checkLateArrivals, fireDueRandomPrompts, scheduleMissingCheckCalls, scheduleMissingRandomPrompts, warnShiftsEndingSoon, alertIgnoredPrompts };
