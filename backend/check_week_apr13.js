const mongoose = require('mongoose');
require('dotenv').config();
const { User, ShiftSession, CheckCall } = require('./src/models');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const start = new Date('2026-04-13T00:00:00.000Z');
  const end = new Date('2026-04-20T00:00:00.000Z');
  
  const sessions = await ShiftSession.find({
    bookedOnAt: { $gte: start, $lt: end }
  }).populate('guardId', 'name').sort({ bookedOnAt: 1 });
  
  console.log('Total sessions found for 2026-04-13 to 2026-04-19:', sessions.length);
  for (const s of sessions) {
    console.log(s.bookedOnAt.toISOString().slice(0, 16), (s.guardId ? s.guardId.name : 'Unknown').padEnd(20), s.punctuality, 'calls:', s.checkCallCount);
  }
  await mongoose.disconnect();
}
check().catch(console.error);
