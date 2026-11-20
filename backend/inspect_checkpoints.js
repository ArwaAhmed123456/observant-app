require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { PatrolCheckpoint, Site } = require('./src/models');

async function checkCheckpoints() {
  await mongoose.connect(process.env.MONGODB_URI);
  const site = await Site.findOne({ name: /totmonslow/i });
  if (site) {
    const cps = await PatrolCheckpoint.find({ siteId: site._id });
    console.log(`Found ${cps.length} checkpoints for Totmonslow:`);
    cps.forEach(c => console.log(c.name, c.latitude, c.longitude));
  }
  await mongoose.disconnect();
}

checkCheckpoints().catch(console.error);
