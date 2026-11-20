const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { User } = require('./src/models');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await User.find({ role: { $in: ['admin', 'manager'] } }).select('email name role');
  console.log(users);
  await mongoose.disconnect();
});
