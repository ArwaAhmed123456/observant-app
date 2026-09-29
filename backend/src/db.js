const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy backend/.env.example to backend/.env and configure it.');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    throw new Error(`[DB] MongoDB connection failed: ${err.message}`, { cause: err });
  }

  mongoose.connection.on('error', err =>
    console.error('[DB] Runtime error:', err.message)
  );
  mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected.'));
}

module.exports = connectDB;
