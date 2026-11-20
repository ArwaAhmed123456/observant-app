const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { User, ShiftSession, CheckCall, Alert } = require('./src/models');

async function finalAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== FINAL AUDIT REPORT ===');
  const alertCount = await Alert.countDocuments({});
  console.log('Active Alerts in DB:', alertCount);
  
  const badCalls = await CheckCall.countDocuments({ response: { $ne: 'yes' } });
  console.log('Missed/Non-yes Check Calls:', badCalls);

  const guards = await User.find({ role: 'guard' }).sort({ name: 1 });
  for (const g of guards) {
    const s = await ShiftSession.countDocuments({ guardId: g._id });
    const c = await CheckCall.countDocuments({ guardId: g._id });
    const onTime = await ShiftSession.countDocuments({ guardId: g._id, punctuality: 'on_time' });
    console.log(g.name.padEnd(22), 'Shifts:', String(s).padStart(4), 'Calls:', String(c).padStart(5), 'All On-Time:', onTime === s);
  }

  await mongoose.disconnect();
}
finalAudit().catch(console.error);
