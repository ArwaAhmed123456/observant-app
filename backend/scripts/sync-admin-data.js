const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('../node_modules/mongoose');
const bcrypt = require('../node_modules/bcryptjs');
const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.xalem4o.mongodb.net/ObservantApp?retryWrites=true&w=majority';

async function update() {
  await mongoose.connect(uri);
  const User = mongoose.connection.collection('users');
  const Site = mongoose.connection.collection('sites');

  // 1. Get all active site IDs
  const activeSites = await Site.find({ active: true }).toArray();
  const allActiveSiteIds = activeSites.map(s => s._id);
  console.log('Active sites:', activeSites.map(s => s.name));

  // 2. Set admin password to Admin1234
  const adminHash = await bcrypt.hash('Admin1234', 12);
  const adminRes = await User.updateOne(
    { email: 'admin@observant.com' },
    { $set: { password: adminHash, managedSiteIds: allActiveSiteIds } }
  );
  console.log('Admin password updated:', adminRes.modifiedCount);

  // 3. Update Abid and Jamil managedSiteIds to include all active sites so they see everything
  const abidRes = await User.updateOne(
    { email: 'abid@observantsecurity.co.uk' },
    { $set: { managedSiteIds: allActiveSiteIds } }
  );
  console.log('Abid managedSiteIds updated:', abidRes.modifiedCount);

  const jamilRes = await User.updateOne(
    { email: 'jamil@gmail.com' },
    { $set: { managedSiteIds: allActiveSiteIds } }
  );
  console.log('Jamil managedSiteIds updated:', jamilRes.modifiedCount);

  await mongoose.disconnect();
  console.log('Database sync complete!');
}

update().catch(err => {
  console.error(err);
  process.exit(1);
});
