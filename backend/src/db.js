const mongoose = require('mongoose');
const User = require('./models/User');

// Remove stale unique User indexes left by older schemas before accepting
// requests. The old organisationId-only index blocked subsequent signups, and
// an obsolete sessionId index causes duplicate-key errors during User.create.
// Preserve the current unique (organisationId, email) constraint.
async function repairUserIndexes() {
  let indexes = [];
  try {
    indexes = await User.collection.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
  const obsolete = indexes.filter(index =>
    index.unique === true &&
    (
      (Object.keys(index.key || {}).length === 1 && index.key.organisationId === 1) ||
      (Object.keys(index.key || {}).length === 1 && index.key.sessionId === 1)
    )
  );

  for (const index of obsolete) {
    await User.collection.dropIndex(index.name);
    console.warn(`[DB] Removed obsolete unique user index ${index.name}; current User schema no longer uses this constraint.`);
  }

  // Recreate any schema indexes only after removing the incompatible legacy index.
  await User.createIndexes();
  const scopedEmailIndex = (await User.collection.indexes()).find(index =>
    Object.keys(index.key || {}).length === 2 &&
    index.key.organisationId === 1 &&
    index.key.email === 1 &&
    index.unique === true
  );
  if (!scopedEmailIndex) {
    throw new Error('[DB] Required unique user email index (organisationId, email) is missing.');
  }
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy backend/.env.example to backend/.env and configure it.');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
    await repairUserIndexes();
  } catch (err) {
    throw new Error(`[DB] MongoDB connection failed: ${err.message}`, { cause: err });
  }

  mongoose.connection.on('error', err =>
    console.error('[DB] Runtime error:', err.message)
  );
  mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected.'));
}

module.exports = connectDB;
