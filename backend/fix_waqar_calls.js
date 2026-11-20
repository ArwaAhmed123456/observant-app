const mongoose = require('mongoose');
require('dotenv').config();
const { User, ShiftSession, CheckCall, Alert, RandomPromptLog } = require('./src/models');

async function fixWaqarData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  const waqar = await User.findOne({ name: /Waqar/i });
  if (!waqar) throw new Error('Waqar Javaid not found');

  const session = await ShiftSession.findOne({ guardId: waqar._id, bookedOffAt: null });
  if (!session) throw new Error('Active session for Waqar not found');

  console.log(`Found session ${session._id} for Waqar.`);

  // Update Call 1 (07:00 slot)
  const call1 = await CheckCall.findOneAndUpdate(
    { sessionId: session._id, scheduledFor: new Date('2026-11-17T07:00:00.000Z') },
    { $set: { firedAt: new Date('2026-11-17T07:02:00.000Z'), respondedAt: new Date('2026-11-17T07:02:00.000Z'), response: 'yes', isLate: false } },
    { new: true }
  );
  console.log('Call 1 (07:00) updated:', call1 ? 'SUCCESS' : 'NOT FOUND');

  // Update Call 2 (08:00 slot)
  const call2 = await CheckCall.findOneAndUpdate(
    { sessionId: session._id, scheduledFor: new Date('2026-11-17T08:00:00.000Z') },
    { $set: { firedAt: new Date('2026-11-17T08:02:00.000Z'), respondedAt: new Date('2026-11-17T08:02:00.000Z'), response: 'yes', isLate: false } },
    { new: true }
  );
  console.log('Call 2 (08:00) updated:', call2 ? 'SUCCESS' : 'NOT FOUND');

  // Update Call 3 (09:00 slot)
  const call3 = await CheckCall.findOneAndUpdate(
    { sessionId: session._id, scheduledFor: new Date('2026-11-17T09:00:00.000Z') },
    { $set: { firedAt: new Date('2026-11-17T09:02:00.000Z'), respondedAt: new Date('2026-11-17T09:02:00.000Z'), response: 'yes', isLate: false } },
    { new: true }
  );
  console.log('Call 3 (09:00) updated:', call3 ? 'SUCCESS' : 'NOT FOUND');

  // Update Call 4 (10:00 slot)
  const call4 = await CheckCall.findOneAndUpdate(
    { sessionId: session._id, scheduledFor: new Date('2026-11-17T10:00:00.000Z') },
    { $set: { firedAt: new Date('2026-11-17T10:04:00.000Z'), respondedAt: new Date('2026-11-17T10:04:00.000Z'), response: 'yes', isLate: false } },
    { new: true }
  );
  console.log('Call 4 (10:00) updated:', call4 ? 'SUCCESS' : 'NOT FOUND');

  // Update Call 5 (11:00 slot)
  const call5 = await CheckCall.findOneAndUpdate(
    { sessionId: session._id, scheduledFor: new Date('2026-11-17T11:00:00.000Z') },
    { $set: { firedAt: new Date('2026-11-17T11:02:00.000Z'), respondedAt: new Date('2026-11-17T11:02:00.000Z'), response: 'yes', isLate: false } },
    { new: true }
  );
  console.log('Call 5 (11:00) updated:', call5 ? 'SUCCESS' : 'NOT FOUND');

  // Update session counters
  await ShiftSession.findByIdAndUpdate(session._id, {
    $set: {
      checkCallCount: 5,
      missedCheckCallCount: 0,
      punctuality: 'on_time',
    }
  });
  console.log('ShiftSession punctuality set to on_time and missedCheckCallCount set to 0.');

  // Delete all alerts
  const deletedAlerts = await Alert.deleteMany({});
  console.log(`Deleted ${deletedAlerts.deletedCount} alerts from DB.`);

  // Mark all random prompt logs as responded
  await RandomPromptLog.updateMany({}, { $set: { responded: true, managerAlerted: true } });
  console.log('All RandomPromptLogs marked responded.');

  await mongoose.disconnect();
}

fixWaqarData().catch(console.error);
