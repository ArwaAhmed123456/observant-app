require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User } = require('./src/models');

async function checkJamal() {
  await mongoose.connect(process.env.MONGODB_URI);
  const jamal = await User.findOne({ name: /Jamal/i });
  console.log('Jamal:', {
    id: jamal?._id,
    name: jamal?.name,
    email: jamal?.email,
    siteId: jamal?.siteId,
    assignedSiteIds: jamal?.assignedSiteIds,
    managedSiteIds: jamal?.managedSiteIds
  });
  await mongoose.disconnect();
}

checkJamal().catch(console.error);
