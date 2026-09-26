const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', err =>
    console.error('[DB] Runtime error:', err.message)
  );
  mongoose.connection.on('disconnected', () =>
    console.warn('[DB] Disconnected — attempting reconnect...')
  );
}

module.exports = connectDB;
