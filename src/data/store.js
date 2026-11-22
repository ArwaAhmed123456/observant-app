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
  } catch { }
}

export async function remove(key) {
  try { await AsyncStorage.removeItem(key); } catch { }
}

export { KEYS };

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const SEED_SITES = [
  {
    id: '6aef099c741e8672af1fa0b3',
    name: 'Totmonslow Solar Farm',
    address: 'Totmonslow, Staffordshire',
    managerId: 'abid_mgr',
    latitude: 52.948242,
    longitude: -2.006144,
    altitude: 182.89,
    geofenceRadiusMeters: 2500,
  },
];

export const SEED_USERS = [
  {
    id: 'admin_1',
    name: 'Admin HQ',
    email: 'admin@observant.com',
    password: 'Password123!',
    role: 'superadmin',
    badgeNumber: 'HQ-001',
    phone: '+44 7700 900000',
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'abid_mgr',
    name: 'Abid Fiaz',
    email: 'abid@observantsecurity.co.uk',
    password: 'Password123!',
    role: 'manager',
    siteIds: ['6aef099c741e8672af1fa0b3'],
    badgeNumber: 'MGR-001',
    phone: '+44 7700 900001',
    status: 'active',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: '6aef019b741e8672af1fa0a7',
    name: 'Abdullah Malik',
    email: 'mabdullah956@gmail.com',
    password: 'Password123!',
    role: 'guard',
    siteId: '6aef099c741e8672af1fa0b3',
    badgeNumber: '10147851784414348',
    phone: '+44 7700 900101',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: '6aef0194741e8672af1fa0a1',
    name: 'Ukasha Ayaz',
    email: 'ukashaayaz1877@gmail.com',
    password: 'Password123!',
    role: 'guard',
    siteId: '6aef099c741e8672af1fa0b3',
    badgeNumber: '10174378210489548',
    phone: '+44 7700 900102',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: '6aef0198741e8672af1fa0a5',
    name: 'Asad Iqbal',
    email: 'asad50507@gmail.com',
    password: 'Password123!',
    role: 'guard',
    siteId: '6aef099c741e8672af1fa0b3',
    badgeNumber: '10146018742234308',
    phone: '+44 7700 900103',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: '6aef0191741e8672af1fa09f',
    name: 'Waqar Javaid',
    email: 'waqalkhan5249775@gmail.com',
    password: 'Password123!',
    role: 'guard',
    siteId: '6aef099c741e8672af1fa0b3',
    badgeNumber: '10128344678243956',
    phone: '+44 7700 900104',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: '6aef0196741e8672af1fa0a3',
    name: 'Rehman Saleem',
    email: 'ipao1992@gmail.com',
    password: 'Password123!',
    role: 'guard',
    siteId: '6aef099c741e8672af1fa0b3',
    badgeNumber: '10132649517121228',
    phone: '+44 7700 900105',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
];

// Patrol checkpoints per site
export const SEED_CHECKPOINTS = [
  { id: 'cp1', siteId: '6aef099c741e8672af1fa0b3', name: 'Main Security Gate & Access Barrier', order: 1, required: true },
  { id: 'cp2', siteId: '6aef099c741e8672af1fa0b3', name: 'Inverter Station & Battery Enclosure', order: 2, required: true },
  { id: 'cp3', siteId: '6aef099c741e8672af1fa0b3', name: 'Perimeter Boundary Fence North', order: 3, required: true },
  { id: 'cp4', siteId: '6aef099c741e8672af1fa0b3', name: 'Main Control Room & CCTV Post', order: 4, required: true },
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
 * Seed the store if it's empty (first launch) or ensure all seed users exist.
 * This guarantees demo credentials always work regardless of previous app state.
 */
export async function seedIfEmpty() {
  const existing = await load(KEYS.USERS);
  if (!existing || existing.length === 0) {
    // First launch — write everything from scratch
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

  // Subsequent launches — do not re-insert deleted users.
  // Ensure status property exists on all existing users
  const withStatus = existing.map(u => ({ ...u, status: u.status || 'active' }));
  if (withStatus.some(u => !existing.find(e => e.id === u.id)?.status)) {
    await save(KEYS.USERS, withStatus);
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
