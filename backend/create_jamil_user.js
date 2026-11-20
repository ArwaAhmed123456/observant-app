require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, Site } = require('./src/models');

async function createJamil() {
  await mongoose.connect(process.env.MONGODB_URI);

  const orgId = new mongoose.Types.ObjectId('6abb615076248dd8200dd719');
  const site = await Site.findOne({ name: /totmonslow/i });
  const siteId = site?._id || new mongoose.Types.ObjectId('6aef099c741e8672af1fa0b3');

  const email = 'jamil@gmail.com';
  let user = await User.findOne({ email });

  if (user) {
    user.role = 'manager';
    user.name = 'Jamil';
    user.password = 'Jamil1234';
    user.active = true;
    user.organisationId = orgId;
    user.managedSiteIds = [siteId];
    await user.save();
    console.log('Updated existing user Jamil:', user._id);
  } else {
    user = new User({
      name: 'Jamil',
      email: email,
      password: 'Jamil1234',
      role: 'manager',
      organisationId: orgId,
      siteId: siteId,
      managedSiteIds: [siteId],
      active: true,
      notificationPreferences: {
        routinePatrolPush: true,
        includePatrolPhotosInDigest: true
      }
    });
    await user.save();
    console.log('Created new user Jamil:', user._id);
  }

  // Verify credentials
  const check = await User.findOne({ email }).select('+password');
  const match = await check.comparePassword('Jamil1234');
  console.log('Verified login with Jamil1234:', match);

  await mongoose.disconnect();
}

createJamil().catch(console.error);
