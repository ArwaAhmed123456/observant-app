require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, ShiftSession, Alert, CheckCall, RandomPromptLog } = require('./src/models');

async function inspectWaqar() {
  await mongoose.connect(process.env.MONGODB_URI);
  const waqar = await User.findOne({ name: /waqar/i });
  console.log('Waqar user:', waqar._id);

  const pendingCalls = await CheckCall.find({ guardId: waqar._id, response: null });
  console.log('Pending check calls for Waqar:', pendingCalls.length);

  const pendingPrompts = await RandomPromptLog.find({ guardId: waqar._id, responded: false });
  console.log('Pending random prompts for Waqar:', pendingPrompts.length);

  const activeAlerts = await Alert.find({ guardId: waqar._id, resolved: false });
  console.log('Active alerts for Waqar:', activeAlerts.length);

  await mongoose.disconnect();
}

inspectWaqar().catch(console.error);
