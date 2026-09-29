/**
 * Create the Observant tenant and its first administrator.
 * All values are supplied by the operator; no shared demo passwords or users
 * are written into a real database.
 */
require('dotenv').config();
const connectDB = require('./db');
const { Organisation, User } = require('./models');

async function seed() {
  const required = ['MONGODB_URI', 'ORG_NAME', 'ORG_SLUG', 'BOOTSTRAP_ADMIN_NAME', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment values: ${missing.join(', ')}`);
  if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 16) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 16 characters.');
  }

  await connectDB();
  const org = await Organisation.findOneAndUpdate(
    { slug: process.env.ORG_SLUG },
    { $setOnInsert: {
      name: process.env.ORG_NAME,
      slug: process.env.ORG_SLUG,
      contactEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
    } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const existing = await User.findOne({ organisationId: org._id, role: 'admin' });
  if (existing) {
    console.log(`[Seed] Administrator already exists (${existing.email}); no password or account changed.`);
  } else {
    await User.create({
      organisationId: org._id,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      role: 'admin',
      managedSiteIds: [],
    });
    console.log(`[Seed] Created the first administrator for ${org.name}.`);
  }

  console.log('[Seed] Done. Create real sites, managers, and guards from the admin account.');
  await require('mongoose').disconnect();
}

seed().catch(async error => {
  console.error(`[Seed] ${error.message}`);
  await require('mongoose').disconnect().catch(() => {});
  process.exitCode = 1;
});
