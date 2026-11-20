const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { Alert, CheckCall, ShiftSession } = require('./src/models');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const alerts = await Alert.countDocuments();
  const nonYesCalls = await CheckCall.countDocuments({ response: { $ne: 'yes' } });
  const lateSessions = await ShiftSession.countDocuments({ punctuality: { $ne: 'on_time' } });
  const missedSessions = await ShiftSession.countDocuments({ missedCheckCallCount: { $gt: 0 } });

  console.log(`FINAL DB AUDIT CHECK:`);
  console.log(` - Total Alerts in DB: ${alerts}`);
  console.log(` - Total Non-Yes CheckCalls: ${nonYesCalls}`);
  console.log(` - Late ShiftSessions: ${lateSessions}`);
  console.log(` - ShiftSessions with missed calls > 0: ${missedSessions}`);

  await mongoose.disconnect();
}
check().catch(console.error);
