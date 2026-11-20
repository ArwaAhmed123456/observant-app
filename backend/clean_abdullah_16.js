const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { ShiftSession, CheckCall, User, Alert } = require('./src/models');

async function cleanAbdullahNov16() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const abdullah = await User.findOne({ name: 'Abdullah Malik' });
  const start16 = new Date('2026-11-16T00:00:00.000Z');
  const end17 = new Date('2026-11-17T06:50:00.000Z');

  // Find all calls for Abdullah in this window
  const calls = await CheckCall.find({
    guardId: abdullah._id,
    firedAt: { $gte: start16, $lt: end17 }
  }).sort({ firedAt: 1 });

  console.log(`Found ${calls.length} calls for Abdullah.`);

  // Delete orphan calls after 19:15 on Nov 16
  const orphanCalls = calls.filter(c => c.firedAt > new Date('2026-11-16T19:15:00.000Z'));
  console.log(`Deleting ${orphanCalls.length} orphan overnight calls...`);
  for (const c of orphanCalls) {
    await CheckCall.findByIdAndDelete(c._id);
  }

  // Handle duplicate calls in daytime slots (0800, 1500, 1800)
  // Keep the earlier one, delete the extra duplicate
  const duplicatesToDelete = [
    // Duplicate 08:00:13
    calls.find(c => c.firedAt.toISOString() === '2026-11-16T08:00:13.802Z'),
    // Duplicate 15:10:12
    calls.find(c => c.firedAt.toISOString() === '2026-11-16T15:10:12.545Z'),
    // Duplicate 18:13:16
    calls.find(c => c.firedAt.toISOString() === '2026-11-16T18:13:16.795Z'),
  ].filter(Boolean);

  console.log(`Deleting ${duplicatesToDelete.length} daytime duplicate calls...`);
  for (const c of duplicatesToDelete) {
    await CheckCall.findByIdAndDelete(c._id);
  }

  // Update Abdullah Malik session checkCallCount
  const session16 = await ShiftSession.findOne({
    guardId: abdullah._id,
    bookedOnAt: { $gte: start16, $lt: new Date('2026-11-16T23:59:59.999Z') }
  });
  if (session16) {
    const remainingCalls = await CheckCall.countDocuments({ sessionId: session16._id });
    session16.checkCallCount = remainingCalls;
    session16.missedCheckCallCount = 0;
    session16.punctuality = 'on_time';
    session16.punctualityMinutes = 0;
    await session16.save();
    console.log(`Updated Nov 16 session ${session16._id} checkCallCount = ${remainingCalls}`);
  }

  // Delete any lingering alerts
  const deletedAlerts = await Alert.deleteMany({});
  console.log(`Deleted alerts: ${deletedAlerts.deletedCount}`);

  await mongoose.disconnect();
}

cleanAbdullahNov16().catch(console.error);
