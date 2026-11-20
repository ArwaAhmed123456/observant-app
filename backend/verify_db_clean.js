const mongoose = require('mongoose');
require('dotenv').config();
const { CheckCall, ShiftSession, Alert } = require('./src/models');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const badCalls = await CheckCall.countDocuments({ response: { $ne: 'yes' } });
  console.log('Non-yes CheckCalls:', badCalls);

  const missedInSessions = await ShiftSession.countDocuments({ missedCheckCallCount: { $gt: 0 } });
  console.log('Sessions with missedCheckCallCount > 0:', missedInSessions);

  const lateSessions = await ShiftSession.countDocuments({ punctuality: { $in: ['late', 'slightly_late'] } });
  console.log('Late sessions:', lateSessions);

  const alertCount = await Alert.countDocuments({});
  console.log('Total alerts in DB:', alertCount);

  await mongoose.disconnect();
}
check().catch(console.error);
