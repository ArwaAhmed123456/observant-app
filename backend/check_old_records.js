const mongoose = require('mongoose');
require('dotenv').config();
const { CheckCall, ShiftSession } = require('./src/models');

async function checkOld() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cutoff = new Date('2026-11-09T00:00:00.000Z');
  const oldSessions = await ShiftSession.countDocuments({ bookedOnAt: { $lt: cutoff } });
  const oldCalls = await CheckCall.countDocuments({ firedAt: { $lt: cutoff } });
  console.log('Old sessions before 2026-11-09:', oldSessions, 'Old calls:', oldCalls);
  await mongoose.disconnect();
}

checkOld().catch(console.error);
