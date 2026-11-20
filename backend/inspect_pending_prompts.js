require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { RandomPromptLog } = require('./src/models');

async function inspectPrompts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const prompts = await RandomPromptLog.find({ responded: false });
  console.log('Unresponded prompts:', prompts);
  await mongoose.disconnect();
}

inspectPrompts().catch(console.error);
