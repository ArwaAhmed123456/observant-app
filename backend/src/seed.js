/**
 * Seed script — run once to populate Observant Security's org, users, sites, checkpoints.
 * Usage: npm run seed
 */
require('dotenv').config();
const connectDB = require('./db');
const {
  Organisation, User, Site, PatrolCheckpoint
} = require('./models');

async function seed() {
  await connectDB();

  // ── Organisation ────────────────────────────────────────────────────────────
  let org = await Organisation.findOne({ slug: 'observant-security' });
  if (!org) {
    org = await Organisation.create({
      name:         'Observant Security Group UK',
      slug:         'observant-security',
      contactEmail: 'ops@observant.com',
      contactPhone: '+44 800 092 1100',
      address:      '44 Bishopsgate, London EC2N 4AG',
      plan:         'pro',
    });
    console.log('[Seed] Organisation created:', org.name);
  } else {
    console.log('[Seed] Organisation already exists, skipping.');
  }

  // ── Sites ────────────────────────────────────────────────────────────────────
  const siteDefs = [
    { name: 'Horton Solar Farm',        address: 'Horton, Northamptonshire' },
    { name: 'Canary Wharf Office Tower', address: '1 Canada Square, London E14 5AB' },
    { name: 'Stansted Logistics Hub',    address: 'Stansted Airport, Essex CM24' },
  ];

  // Need manager to exist first — create manager before sites
  let manager = await User.findOne({ organisationId: org._id, role: 'manager' });
  if (!manager) {
    // Temporarily create without managedSiteIds, update after sites exist
    manager = await User.create({
      organisationId: org._id,
      name:           'Elena Rostova',
      email:          'elena@observant.com',
      password:       'manager123',
      role:           'manager',
      badgeNumber:    'MGR-001',
      phone:          '+44 7700 900001',
      managedSiteIds: [],
    });
    console.log('[Seed] Manager created:', manager.email);
  }

  const sites = [];
  for (const def of siteDefs) {
    let site = await Site.findOne({ organisationId: org._id, name: def.name });
    if (!site) {
      site = await Site.create({ ...def, organisationId: org._id, managerId: manager._id });
      console.log('[Seed] Site created:', site.name);
    }
    sites.push(site);
  }

  // Assign all sites to manager
  await User.findByIdAndUpdate(manager._id, { managedSiteIds: sites.map(s => s._id) });

  // ── Guards ───────────────────────────────────────────────────────────────────
  const guardDefs = [
    { name: 'Ahmad Raza',   email: 'ahmad@observant.com',  badgeNumber: 'SG-1042', siteIdx: 0 },
    { name: 'Marcus Chen',  email: 'marcus@observant.com', badgeNumber: 'SG-1055', siteIdx: 1 },
    { name: 'Sofia Okafor', email: 'sofia@observant.com',  badgeNumber: 'SG-1071', siteIdx: 2 },
  ];

  for (const def of guardDefs) {
    const existing = await User.findOne({ organisationId: org._id, email: def.email });
    if (!existing) {
      await User.create({
        organisationId: org._id,
        name:        def.name,
        email:       def.email,
        password:    'guard123',
        role:        'guard',
        badgeNumber: def.badgeNumber,
        siteId:      sites[def.siteIdx]._id,
      });
      console.log('[Seed] Guard created:', def.email);
    }
  }

  // ── Checkpoints ──────────────────────────────────────────────────────────────
  const cpDefs = [
    { siteIdx: 0, checkpoints: ['Main Gate', 'Inverter Block A', 'Perimeter Fence North', 'Control Room'] },
    { siteIdx: 1, checkpoints: ['Ground Floor Reception', 'Server Room Corridor', 'Rooftop Access Door'] },
    { siteIdx: 2, checkpoints: ['Loading Bay A', 'Warehouse North Exit', 'CCTV Hub'] },
  ];

  for (const { siteIdx, checkpoints } of cpDefs) {
    const site = sites[siteIdx];
    for (let i = 0; i < checkpoints.length; i++) {
      const existing = await PatrolCheckpoint.findOne({ siteId: site._id, name: checkpoints[i] });
      if (!existing) {
        await PatrolCheckpoint.create({
          organisationId: org._id,
          siteId:   site._id,
          name:     checkpoints[i],
          order:    i + 1,
          required: true,
        });
        console.log(`[Seed] Checkpoint created: ${checkpoints[i]} @ ${site.name}`);
      }
    }
  }

  console.log('\n[Seed] ✅ Done! Login credentials:');
  console.log('  Manager : elena@observant.com   / manager123');
  console.log('  Guard 1 : ahmad@observant.com   / guard123');
  console.log('  Guard 2 : marcus@observant.com  / guard123');
  console.log('  Guard 3 : sofia@observant.com   / guard123');
  process.exit(0);
}

seed().catch(err => { console.error('[Seed] Error:', err); process.exit(1); });
