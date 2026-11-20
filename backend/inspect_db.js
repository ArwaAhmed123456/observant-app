const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { Alert, CheckCall, ShiftSession, User, Site } = require('./src/models');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Total Sessions:', await ShiftSession.countDocuments());
  console.log('Total CheckCalls:', await CheckCall.countDocuments());
  console.log('Total Alerts:', await Alert.countDocuments());

  // Check Abdullah Malik Nov 16 calls
  const nov16Abdullah = await CheckCall.find({
    firedAt: { $gte: new Date('2026-11-16T00:00:00.000Z'), $lte: new Date('2026-11-16T23:59:59.999Z') }
  }).populate('guardId', 'name').sort({ firedAt: 1 });
  console.log('Nov 16 Abdullah calls:');
  nov16Abdullah.forEach(c => {
    if (c.guardId?.name === 'Abdullah Malik') {
      console.log(`  ${c.firedAt.toISOString()} | resp: ${c.respondedAt?.toISOString()} | res: ${c.response}`);
    }
  });

  await mongoose.disconnect();
}

test().catch(console.error);
