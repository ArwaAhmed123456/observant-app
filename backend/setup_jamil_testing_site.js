require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Site, PatrolCheckpoint, ShiftRoster } = require('./src/models');

async function setupJamilAndTestingSite() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const testingSite = await Site.findOne({ name: /testing site/i });
  if (!testingSite) {
    throw new Error('Testing site not found in DB!');
  }
  console.log('Found Testing Site:', testingSite._id, testingSite.name);

  const totmonslowSite = await Site.findOne({ name: /totmonslow/i });
  console.log('Found Totmonslow Site:', totmonslowSite?._id, totmonslowSite?.name);

  // 1. Assign Testing Site to Jamil and completely remove Totmonslow
  const jamil = await User.findOne({ email: 'jamil@gmail.com' });
  if (!jamil) {
    throw new Error('Jamil user not found in DB!');
  }

  jamil.role = 'manager';
  jamil.siteId = testingSite._id;
  jamil.managedSiteIds = [testingSite._id];
  await jamil.save();
  console.log('Updated Jamil:', {
    id: jamil._id,
    name: jamil.name,
    role: jamil.role,
    siteId: jamil.siteId,
    managedSiteIds: jamil.managedSiteIds
  });

  // Ensure Testing Site's managerId is Jamil
  testingSite.managerId = jamil._id;
  await testingSite.save();
  console.log('Testing Site managerId updated to Jamil:', testingSite.managerId);

  // 2. Create Dummy Guards for Testing Site
  const dummyGuards = [
    {
      name: 'Tariq Mehmood',
      email: 'tariq.guard@gmail.com',
      password: 'Guard1234!',
      badgeNumber: 'SEC-701',
      phone: '+44 7700 900701',
    },
    {
      name: 'Bilal Ahmed',
      email: 'bilal.guard@gmail.com',
      password: 'Guard1234!',
      badgeNumber: 'SEC-702',
      phone: '+44 7700 900702',
    },
    {
      name: 'Hamza Ali',
      email: 'hamza.guard@gmail.com',
      password: 'Guard1234!',
      badgeNumber: 'SEC-703',
      phone: '+44 7700 900703',
    }
  ];

  const createdGuards = [];
  for (const g of dummyGuards) {
    let guardUser = await User.findOne({ email: g.email });
    if (guardUser) {
      guardUser.name = g.name;
      guardUser.password = g.password;
      guardUser.role = 'guard';
      guardUser.badgeNumber = g.badgeNumber;
      guardUser.phone = g.phone;
      guardUser.siteId = testingSite._id;
      guardUser.assignedSiteIds = [testingSite._id];
      guardUser.managedSiteIds = [];
      guardUser.active = true;
      await guardUser.save();
      console.log('Updated existing dummy guard:', g.name, g.email);
    } else {
      guardUser = new User({
        organisationId: testingSite.organisationId,
        name: g.name,
        email: g.email,
        password: g.password,
        role: 'guard',
        badgeNumber: g.badgeNumber,
        phone: g.phone,
        siteId: testingSite._id,
        assignedSiteIds: [testingSite._id],
        managedSiteIds: [],
        active: true,
      });
      await guardUser.save();
      console.log('Created dummy guard:', g.name, g.email, guardUser._id);
    }
    createdGuards.push(guardUser);
  }

  // 3. Add Patrol Checkpoints for Testing Site
  const checkpointNames = [
    { name: 'Main Entrance Gate', description: 'Inspect barrier, lock seal, and vehicle log', order: 1 },
    { name: 'Security Office / Reception', description: 'Verify alarm panel and visitor register', order: 2 },
    { name: 'Perimeter Fence - North', description: 'Inspect security fence integrity and lighting', order: 3 },
  ];

  const createdCheckpoints = [];
  for (const cp of checkpointNames) {
    let checkpoint = await PatrolCheckpoint.findOne({ siteId: testingSite._id, name: cp.name });
    if (!checkpoint) {
      checkpoint = await PatrolCheckpoint.create({
        organisationId: testingSite.organisationId,
        siteId: testingSite._id,
        name: cp.name,
        description: cp.description,
        order: cp.order,
        active: true,
        type: 'photo',
      });
      console.log('Created checkpoint for Testing Site:', cp.name);
    }
    createdCheckpoints.push(checkpoint);
  }

  // 4. Create sample weekly roster for Testing Site guards
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().split('T')[0];
  }
  const currentWeekMonday = getMonday(new Date());

  for (let i = 0; i < createdGuards.length; i++) {
    const g = createdGuards[i];
    const shiftStart = i % 2 === 0 ? '07:00' : '19:00';
    const shiftEnd = i % 2 === 0 ? '19:00' : '07:00';

    await ShiftRoster.findOneAndUpdate(
      {
        organisationId: testingSite.organisationId,
        siteId: testingSite._id,
        guardId: g._id,
        weekStartDate: currentWeekMonday
      },
      {
        $set: {
          days: {
            mon: { start: shiftStart, end: shiftEnd },
            tue: { start: shiftStart, end: shiftEnd },
            wed: { start: shiftStart, end: shiftEnd },
            thu: { start: shiftStart, end: shiftEnd },
            fri: { start: shiftStart, end: shiftEnd },
            sat: { start: shiftStart, end: shiftEnd },
            sun: { start: shiftStart, end: shiftEnd },
          },
          checkpointIds: createdCheckpoints.map(c => c._id),
          publishedAt: new Date(),
          recurringWeekly: true
        }
      },
      { upsert: true, new: true }
    );
    console.log(`Roster created for ${g.name} (${shiftStart}-${shiftEnd}) at Testing Site`);
  }

  // 5. Verification Test: Simulate Jamil's API calls
  console.log('\n--- VERIFICATION TEST FOR JAMIL ---');
  // Check accessible sites for Jamil
  const jamilSites = await Site.find({
    organisationId: jamil.organisationId,
    active: true,
    $or: [
      { _id: { $in: jamil.managedSiteIds } },
      { managerId: jamil._id }
    ]
  });
  console.log('Sites visible to Jamil:', jamilSites.map(s => s.name));
  const canSeeTotmonslow = jamilSites.some(s => s.name.toLowerCase().includes('totmonslow'));
  console.log('Can Jamil see Totmonslow Solar Farm?:', canSeeTotmonslow ? 'YES (ERROR)' : 'NO (CORRECT! TOTMONSLOW IS HIDDEN)');

  // Check visible guards for Jamil
  const jamilGuards = await User.find({
    organisationId: jamil.organisationId,
    role: 'guard',
    active: true,
    $or: [
      { siteId: { $in: jamil.managedSiteIds } },
      { assignedSiteIds: { $in: jamil.managedSiteIds } }
    ]
  });
  console.log('Guards visible to Jamil:', jamilGuards.map(g => `${g.name} (${g.badgeNumber})`));
  const canSeeTotmonslowGuards = jamilGuards.some(g => ['Waqar Javaid', 'Abdullah Malik', 'Rehman Saleem'].includes(g.name));
  console.log('Can Jamil see Totmonslow guards?:', canSeeTotmonslowGuards ? 'YES (ERROR)' : 'NO (CORRECT! TOTMONSLOW GUARDS ARE HIDDEN)');

  await mongoose.disconnect();
}

setupJamilAndTestingSite().catch(console.error);
