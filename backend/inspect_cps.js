require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { PatrolCheckpoint } = require('./src/models');

async function inspectCPs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cps = await PatrolCheckpoint.find({ active: true });
  console.log('Checkpoints in DB:');
  cps.forEach(c => console.log({
    id: c._id,
    name: c.name,
    siteId: c.siteId,
    required: c.required,
    nfcRequired: c.nfcRequired,
    type: c.type
  }));
  await mongoose.disconnect();
}

inspectCPs().catch(console.error);
