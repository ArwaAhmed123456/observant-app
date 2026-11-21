require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { PatrolSession, User } = require('./src/models');

async function checkRehmanPatrols() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rehman = await User.findOne({ name: /rehman/i });
  console.log('Rehman user ID:', rehman._id);
  const patrols = await PatrolSession.find({ guardId: rehman._id }).sort({ createdAt: -1 }).limit(5);
  console.log('Rehman patrols:', patrols.map(p => ({
    id: p._id,
    status: p.status,
    startedAt: p.startedAt,
    finishedAt: p.finishedAt,
    captures: p.captures
  })));
  await mongoose.disconnect();
}

checkRehmanPatrols().catch(console.error);
