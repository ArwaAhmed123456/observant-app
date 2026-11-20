require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, Site } = require('./src/models');

async function checkManagers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const managers = await User.find({ role: { $in: ['manager', 'admin', 'superadmin'] } });
  console.log('Existing managers/admins:', managers.map(m => ({
    id: m._id,
    name: m.name,
    email: m.email,
    role: m.role,
    organisationId: m.organisationId,
    siteId: m.siteId,
    managedSiteIds: m.managedSiteIds
  })));

  const sites = await Site.find({});
  console.log('Sites:', sites.map(s => ({ id: s._id, name: s.name })));

  await mongoose.disconnect();
}

checkManagers().catch(console.error);
