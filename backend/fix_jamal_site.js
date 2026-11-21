require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, Site } = require('./src/models');

async function fixJamalSite() {
  await mongoose.connect(process.env.MONGODB_URI);
  const totmonslow = await Site.findOne({ name: /totmonslow/i });
  if (totmonslow) {
    await User.updateOne(
      { name: /Jamal Faisal Sharif/i },
      { $set: { siteId: totmonslow._id, assignedSiteIds: [totmonslow._id] } }
    );
    console.log('Restored Jamal Faisal Sharif to Totmonslow Solar Farm');
  }
  await mongoose.disconnect();
}

fixJamalSite().catch(console.error);
