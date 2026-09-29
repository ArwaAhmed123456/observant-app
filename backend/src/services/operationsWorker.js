const { ShiftSession, CheckCall, RandomPromptLog, User } = require('../models');
const { createAlert } = require('./alertService');
const { sendPush } = require('./fcm');

const HOUR = 60 * 60 * 1000;

async function fireDueCheckCalls(now = new Date()) {
  const sessions = await ShiftSession.find({ bookedOffAt: null, nextCheckCallAt: { $lte: now } }).limit(100);
  for (const session of sessions) {
    const dueAt = session.nextCheckCallAt;
    try {
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
    const call = await CheckCall.findOneAndUpdate(
      { _id: item._id, response: null, expiresAt: { $lte: now } },
      { $set: { response: 'missed', managerAlerted: true, managerAlertedAt: now } },
      { new: true }
    );
    if (!call) continue;
    if (call.sessionId) await ShiftSession.findByIdAndUpdate(call.sessionId, {
      $inc: { missedCheckCallCount: 1 },
      $set: { nextCheckCallAt: new Date(now.getTime() + HOUR) },
    });
    const guard = await User.findById(call.guardId).select('name badgeNumber');
    await createAlert({
      organisationId: call.organisationId,
      siteId: call.siteId,
      guardId: call.guardId,
      type: 'check_call_missed',
      title: 'Missed check call',
      message: `${guard?.name || 'A guard'} did not respond within the 10-minute check-call window.`,
      refModel: 'CheckCall',
      refId: call._id,
    });
  }
}

async function fireDueRandomPrompts(now = new Date()) {
  const sessions = await ShiftSession.find({ bookedOffAt: null, nextRandomPromptAt: { $lte: now } }).limit(100);
  for (const session of sessions) {
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
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    });
    const guard = await User.findById(session.guardId).select('fcmToken');
    if (guard?.fcmToken) await sendPush([guard.fcmToken], {
      title: 'Random patrol check',
      body: 'Start a site patrol now and complete the assigned checkpoints.',
      data: { type: 'random_patrol', promptId: log._id.toString() },
    });
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
    const claimed = await RandomPromptLog.findOneAndUpdate(
      { _id: item._id, responded: false, managerAlerted: false },
      { $set: { managerAlerted: true } },
      { new: true }
    );
    if (!claimed) continue;
    await createAlert({
      organisationId: item.organisationId,
      siteId: item.siteId,
      guardId: item.guardId,
      type: 'random_prompt_ignored',
      title: 'Random patrol prompt not completed',
      message: 'The guard did not start a patrol within 30 minutes of the random prompt.',
      refModel: 'RandomPromptLog',
      refId: item._id,
    });
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
      await fireDueRandomPrompts(now);
      await warnShiftsEndingSoon(now);
      await alertIgnoredPrompts(now);
    } catch (error) {
      console.error('[OpsWorker] Tick failed:', error.message);
    } finally { running = false; }
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
}

module.exports = { startOperationsWorker, fireDueCheckCalls, expireCheckCalls, fireDueRandomPrompts, warnShiftsEndingSoon, alertIgnoredPrompts };
