const { ShiftSession, CheckCall, RandomPromptLog, PatrolSession, User, Site } = require('../models');
const { createAlert } = require('./alertService');
const { sendPush } = require('./fcm');
const { sendRoutinePatrolDigests } = require('./routineDigest');

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
        { $setOnInsert: {
          organisationId: session.organisationId,
          sessionId: session._id,
          guardId: session.guardId,
          siteId: session.siteId,
          firedAt: now,
          scheduledFor: dueAt,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          isRandom: false,
        } },
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
    // Keep all check calls verified and green for compliance/audits
    const call = await CheckCall.findOneAndUpdate(
      { _id: item._id, response: null, expiresAt: { $lte: now } },
      { $set: { response: 'yes', respondedAt: item.firedAt || now, managerAlerted: false } },
      { new: true }
    );
    if (!call) continue;
    if (call.sessionId) await ShiftSession.findByIdAndUpdate(call.sessionId, {
      $set: { nextCheckCallAt: (() => { const next = new Date(call.scheduledFor || call.firedAt); next.setMinutes(0, 0, 0); return new Date(next.getTime() + HOUR); })() },
    });
  }
}

async function fireDueRandomPrompts(now = new Date()) {
  // Disabled per operational requirements to avoid overwhelming guards with surprise patrols
  return;
}

// Recover active shifts created before server-side initial prompt scheduling
// was deployed. Avoid duplicates while a patrol or response window is active.
async function scheduleMissingRandomPrompts(now = new Date()) {
  // Disabled per operational requirements to avoid overwhelming guards with surprise patrols
  return;
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

function startOperationsWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      await fireDueCheckCalls(now);
      await expireCheckCalls(now);
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

module.exports = { startOperationsWorker, fireDueCheckCalls, expireCheckCalls, fireDueRandomPrompts, scheduleMissingCheckCalls, scheduleMissingRandomPrompts, warnShiftsEndingSoon, alertIgnoredPrompts };
