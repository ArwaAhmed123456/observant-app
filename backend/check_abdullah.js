const mongoose = require('mongoose');
require('dotenv').config();
const { ShiftSession, CheckCall, ShiftRoster, Alert, AuditLog } = require('./src/models');

async function checkAbdullah() {
  await mongoose.connect(process.env.MONGODB_URI);
  const startOfDay = new Date('2026-11-16T00:00:00.000Z');
  const endOfDay = new Date('2026-11-16T23:59:59.999Z');

  const sessions = await ShiftSession.find({
    bookedOnAt: { $gte: new Date('2026-11-16T06:00:00.000Z'), $lte: endOfDay }
  }).populate('guardId', 'name');

  console.log('Today Sessions:');
  sessions.forEach(s => {
    console.log(' - Guard:', s.guardId?.name, 'bookedOnAt:', s.bookedOnAt.toISOString(), 'scheduledStart:', s.scheduledStart);
  });

  const calls = await CheckCall.find({
    firedAt: { $gte: startOfDay, $lte: endOfDay }
  }).populate('guardId', 'name').sort({ firedAt: 1 });

  console.log('Today CheckCalls for Abdullah:');
  calls.filter(c => c.guardId?.name === 'Abdullah Malik').forEach(c => {
    console.log(' - firedAt:', c.firedAt.toISOString(), 'respondedAt:', c.respondedAt?.toISOString(), 'scheduledFor:', c.scheduledFor?.toISOString());
  });

  await mongoose.disconnect();
}
checkAbdullah().catch(console.error);
