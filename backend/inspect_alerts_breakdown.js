require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Alert } = require('./src/models');

async function inspectAlerts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const alerts = await Alert.find({});
  console.log(`Found ${alerts.length} alerts:`);
  const typeCounts = {};
  alerts.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    if (a.type.includes('missed') || a.type.includes('bound') || a.type.includes('prompt')) {
      console.log('Exception alert:', a.type, a.title, a.createdAt);
    }
  });
  console.log('Type breakdown:', typeCounts);
  await mongoose.disconnect();
}

inspectAlerts().catch(console.error);
