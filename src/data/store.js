/**
 * Persistent store using AsyncStorage.
 * All app state is persisted here and loaded on startup.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USERS: 'obs_users',
  SITES: 'obs_sites',
  SHIFT_ROSTERS: 'obs_shift_rosters',
  SHIFT_SESSIONS: 'obs_shift_sessions',
  CHECK_CALLS: 'obs_check_calls',
  PATROL_SESSIONS: 'obs_patrol_sessions',
  PATROL_CHECKPOINTS: 'obs_patrol_checkpoints',
  PATROL_CAPTURES: 'obs_patrol_captures',
  RANDOM_PROMPT_LOGS: 'obs_random_prompt_logs',
  ALERTS: 'obs_alerts',
  ROSTER_TEMPLATES: 'obs_roster_templates',
  CURRENT_USER_ID: 'obs_current_user_id',
  AUDIT_LOGS: 'obs_audit_logs',
};

export async function load(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function save(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function remove(key) {
  try { await AsyncStorage.removeItem(key); } catch {}
}

export { KEYS };

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const SEED_SITES = [
  {
    id: 's1',
    name: 'Horton Solar Farm',
    address: 'Horton, Northamptonshire',
    managerId: 'u_mgr1',
    latitude: 52.2014,
    longitude: -0.8035,
    geofenceRadiusMeters: 450,
  },
  {
    id: 's2',
    name: 'Canary Wharf Office Tower',
    address: '1 Canada Square, London E14 5AB',
    managerId: 'u_mgr1',
    latitude: 51.5050,
    longitude: -0.0195,
    geofenceRadiusMeters: 250,
  },
  {
    id: 's3',
    name: 'Stansted Logistics Hub',
    address: 'Stansted Airport, Essex CM24',
    managerId: 'u_mgr1',
    latitude: 51.8860,
    longitude: 0.2389,
    geofenceRadiusMeters: 500,
  },
];

export const SEED_USERS = [
  {
    id: 'u_admin1',
    name: 'Sarah Jenkins',
    email: 'admin@observant.com',
    password: 'admin123',
    role: 'superadmin',
    badgeNumber: 'HQ-001',
    phone: '+44 7700 900000',
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'u_mgr1',
    name: 'Elena Rostova',
    email: 'elena@observant.com',
    password: 'manager123',
    role: 'manager',
    siteIds: ['s1', 's2', 's3'],
    badgeNumber: 'MGR-001',
    phone: '+44 7700 900001',
    status: 'active',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'u_g1',
    name: 'Ahmad Raza',
    email: 'ahmad@observant.com',
    password: 'guard123',
    role: 'guard',
    siteId: 's1',
    badgeNumber: 'SG-1042',
    phone: '+44 7700 900002',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'u_g2',
    name: 'Marcus Chen',
    email: 'marcus@observant.com',
    password: 'guard123',
    role: 'guard',
    siteId: 's2',
    badgeNumber: 'SG-1055',
    phone: '+44 7700 900003',
    status: 'active',
    createdAt: '2026-02-05T11:00:00.000Z',
  },
  {
    id: 'u_g3',
    name: 'Sofia Okafor',
    email: 'sofia@observant.com',
    password: 'guard123',
    role: 'guard',
    siteId: 's3',
    badgeNumber: 'SG-1071',
    phone: '+44 7700 900004',
    status: 'active',
    createdAt: '2026-02-10T12:00:00.000Z',
  },
];

// Patrol checkpoints per site
export const SEED_CHECKPOINTS = [
  { id: 'cp1', siteId: 's1', name: 'Main Gate', order: 1, required: true },
  { id: 'cp2', siteId: 's1', name: 'Inverter Block A', order: 2, required: true },
  { id: 'cp3', siteId: 's1', name: 'Perimeter Fence North', order: 3, required: true },
  { id: 'cp4', siteId: 's1', name: 'Control Room', order: 4, required: true },
  { id: 'cp5', siteId: 's2', name: 'Ground Floor Reception', order: 1, required: true },
  { id: 'cp6', siteId: 's2', name: 'Server Room Corridor', order: 2, required: true },
  { id: 'cp7', siteId: 's2', name: 'Rooftop Access Door', order: 3, required: true },
  { id: 'cp8', siteId: 's3', name: 'Loading Bay A', order: 1, required: true },
  { id: 'cp9', siteId: 's3', name: 'Warehouse North Exit', order: 2, required: true },
  { id: 'cp10', siteId: 's3', name: 'CCTV Hub', order: 3, required: true },
];

export const SEED_AUDIT_LOGS = [
  {
    id: 'aud_1',
    action: 'SYSTEM_INITIALIZED',
    actorName: 'System Security Core',
    actorRole: 'system',
    targetName: 'Observant Enterprise System',
    details: 'Initial database seeds and cryptographic keys initialized.',
    timestamp: new Date(Date.now() - 3600 * 24 * 7 * 1000).toISOString(),
    severity: 'info',
  },
  {
    id: 'aud_2',
    action: 'ACCOUNT_CREATED',
    actorName: 'Sarah Jenkins',
    actorRole: 'superadmin',
    targetName: 'Elena Rostova (MGR-001)',
    details: 'Manager account created with multi-site supervisory permissions: Horton Solar Farm, Canary Wharf, Stansted Logistics.',
    timestamp: new Date(Date.now() - 3600 * 24 * 5 * 1000).toISOString(),
    severity: 'info',
  },
  {
    id: 'aud_3',
    action: 'ACCOUNT_CREATED',
    actorName: 'Sarah Jenkins',
    actorRole: 'superadmin',
    targetName: 'Ahmad Raza (SG-1042)',
    details: 'Guard account created with assigned primary site: Horton Solar Farm.',
    timestamp: new Date(Date.now() - 3600 * 24 * 3 * 1000).toISOString(),
    severity: 'info',
  },
];

/**
 * Seed the store if it's empty (first launch) or ensure superadmin exists.
 */
export async function seedIfEmpty() {
  const existing = await load(KEYS.USERS);
  if (!existing || existing.length === 0) {
    await save(KEYS.USERS, SEED_USERS);
    await save(KEYS.SITES, SEED_SITES);
    await save(KEYS.PATROL_CHECKPOINTS, SEED_CHECKPOINTS);
    await save(KEYS.SHIFT_ROSTERS, []);
    await save(KEYS.SHIFT_SESSIONS, []);
    await save(KEYS.CHECK_CALLS, []);
    await save(KEYS.PATROL_SESSIONS, []);
    await save(KEYS.PATROL_CAPTURES, []);
    await save(KEYS.RANDOM_PROMPT_LOGS, []);
    await save(KEYS.ALERTS, []);
    await save(KEYS.ROSTER_TEMPLATES, []);
    await save(KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
    return;
  }

  // Ensure superadmin exists in existing users
  let updatedUsers = [...existing];
  let changed = false;
  if (!updatedUsers.some(u => u.email === 'admin@observant.com' || u.role === 'superadmin')) {
    updatedUsers.unshift(SEED_USERS[0]);
    changed = true;
  }
  // Ensure status property exists
  updatedUsers = updatedUsers.map(u => ({ ...u, status: u.status || 'active' }));
  if (changed || updatedUsers.some(u => !u.status)) {
    await save(KEYS.USERS, updatedUsers);
  }

  // Ensure sites have coordinates and geofence
  const currentSites = await load(KEYS.SITES);
  if (!currentSites || currentSites.length === 0) {
    await save(KEYS.SITES, SEED_SITES);
  } else if (!currentSites[0].geofenceRadiusMeters) {
    const updatedSites = currentSites.map(s => {
      const match = SEED_SITES.find(seed => seed.id === s.id);
      return match ? { ...s, ...match } : s;
    });
    await save(KEYS.SITES, updatedSites);
  }

  // Ensure audit logs key exists
  const existingAudits = await load(KEYS.AUDIT_LOGS);
  if (!existingAudits) {
    await save(KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
  }
}
