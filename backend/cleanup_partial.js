const mongoose = require('mongoose');
require('dotenv').config();
const { ShiftSession, CheckCall } = require('./src/models');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cutoff = new Date('2026-11-09T00:00:00.000Z');
  const sRes = await ShiftSession.deleteMany({ bookedOnAt: { $lt: cutoff } });
  const cRes = await CheckCall.deleteMany({ firedAt: { $lt: cutoff } });
  console.log('Cleaned pre-Nov 9 sessions:', sRes.deletedCount, 'calls:', cRes.deletedCount);
  await mongoose.disconnect();
}

clean().catch(console.error);
