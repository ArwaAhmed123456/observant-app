const mongoose = require('mongoose');
require('dotenv').config();
const { User, ShiftSession, CheckCall, Alert, Notification } = require('./src/models');

async function inspectWaqar() {
  await mongoose.connect(process.env.MONGODB_URI);
  const waqar = await User.findOne({ name: /Waqar/i });
  console.log('Waqar User ID:', waqar._id);

  const session = await ShiftSession.findOne({ guardId: waqar._id, bookedOffAt: null });
  console.log('Active session:', session ? {
    id: session._id,
    bookedOnAt: session.bookedOnAt,
    scheduledStart: session.scheduledStart,
    scheduledEnd: session.scheduledEnd,
    punctuality: session.punctuality,
    checkCallCount: session.checkCallCount,
    missedCheckCallCount: session.missedCheckCallCount,
  } : 'NO ACTIVE SESSION');

  if (session) {
    const calls = await CheckCall.find({ sessionId: session._id }).sort({ scheduledFor: 1, firedAt: 1 });
    console.log('Calls count for session:', calls.length);
    calls.forEach(c => {
      console.log('Call:', {
        id: c._id,
        scheduledFor: c.scheduledFor ? c.scheduledFor.toISOString() : null,
        firedAt: c.firedAt ? c.firedAt.toISOString() : null,
        respondedAt: c.respondedAt ? c.respondedAt.toISOString() : null,
        response: c.response,
        isLate: c.isLate,
        note: c.note,
      });
    });
  }

  const todayStart = new Date('2026-11-17T00:00:00.000Z');
  const allTodayCalls = await CheckCall.find({ guardId: waqar._id, firedAt: { $gte: todayStart } }).sort({ firedAt: 1 });
  console.log('All calls today for Waqar:', allTodayCalls.length);
  allTodayCalls.forEach(c => {
    console.log('Today call:', c.scheduledFor ? c.scheduledFor.toISOString() : 'no-sched', 'fired:', c.firedAt.toISOString(), 'resp:', c.response, 'sessionId:', c.sessionId);
  });

  // Check alerts
  const alerts = await Alert.find({});
  console.log('Alerts in DB count:', alerts.length);
  alerts.forEach(a => console.log('Alert:', a.type, a.title, a.createdAt));

  // Check notifications if model exists
  if (Notification) {
    const notifs = await Notification.find({});
    console.log('Notifications count:', notifs.length);
  }

  await mongoose.disconnect();
}
inspectWaqar().catch(console.error);
