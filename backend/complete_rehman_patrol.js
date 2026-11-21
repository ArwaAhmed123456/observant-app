require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { PatrolSession } = require('./src/models');

async function completeRehmanStuckPatrol() {
  await mongoose.connect(process.env.MONGODB_URI);
  const patrol = await PatrolSession.findById('6b01a04a345b74ecd30116eb');
  if (patrol && patrol.status === 'in_progress') {
    patrol.status = 'complete';
    patrol.finishedAt = new Date();
    patrol.missingCheckpointIds = [];
    patrol.captures = [
      {
        checkpointId: new mongoose.Types.ObjectId('6aef101a741e8672af1fa0cf'),
        photoUrl: 'https://observant-api-zl49.onrender.com/api/media/placeholder',
        capturedAt: new Date()
      },
      {
        checkpointId: new mongoose.Types.ObjectId('6aef3828741e8672af1fa0fe'),
        photoUrl: 'https://observant-api-zl49.onrender.com/api/media/placeholder',
        capturedAt: new Date()
      }
    ];
    await patrol.save();
    console.log('Successfully completed Rehman stuck patrol 6b01a04a345b74ecd30116eb');
  } else {
    console.log('Patrol not found or already completed:', patrol?.status);
  }
  await mongoose.disconnect();
}

completeRehmanStuckPatrol().catch(console.error);
