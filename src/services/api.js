import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'obs_auth_tokens';
const configuredUrl = process.env.EXPO_PUBLIC_API_URL || '';
export const API_BASE_URL = configuredUrl.replace(/\/+$/, '');
export const API_ENABLED = Boolean(API_BASE_URL);

let tokens = null;
let refreshPromise = null;

export async function restoreTokens() {
  if (!tokens) {
    try { tokens = JSON.parse(await AsyncStorage.getItem(TOKEN_KEY) || 'null'); }
    catch { tokens = null; }
  }
  return tokens;
}

export async function setTokens(value) {
  tokens = value || null;
  if (tokens) await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAccessToken() {
  return (await restoreTokens())?.accessToken || null;
}

export function authorizedImageSource(uri) {
  const accessToken = tokens?.accessToken;
  return { uri, ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}) };
}

async function refreshAccessToken() {
  if (!tokens?.refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).then(async response => {
      if (!response.ok) return false;
      const next = await response.json();
      await setTokens({ ...tokens, ...next });
      return true;
    }).catch(() => false).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}, retry = true) {
  if (!API_ENABLED) throw new Error('The Observant API is not configured for this build.');
  const session = await restoreTokens();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Cannot reach the Observant server at ${API_BASE_URL}. Check the server URL and connection.`);
  }

  if (response.status === 401 && retry && !path.includes('/api/auth/login') && !path.includes('/api/auth/refresh')) {
    if (await refreshAccessToken()) return apiRequest(path, options, false);
    await setTokens(null);
    throw new Error('Your session expired. Please sign in again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    Object.assign(error, payload);
    throw error;
  }
  return payload;
}

export const apiGet = path => apiRequest(path);
export const apiPost = (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body || {}) });
export const apiPatch = (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const apiDelete = path => apiRequest(path, { method: 'DELETE' });
export const apiUpload = (path, formData) => apiRequest(path, { method: 'POST', body: formData });

export function idOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || value._id || null;
}

function normalizePerson(value) {
  if (!value || typeof value !== 'object') return value;
  return { ...value, id: idOf(value), status: value.active === false ? 'inactive' : 'active', siteIds: (value.managedSiteIds || value.siteIds || []).map(idOf) };
}

export function normalizeSite(value) {
  const [longitude, latitude] = value.location?.coordinates || [];
  return { ...value, id: idOf(value), managerId: idOf(value.managerId), latitude: latitude || value.latitude, longitude: longitude || value.longitude, geofenceRadiusMeters: value.geofenceRadiusMetres || value.geofenceRadiusMeters || 500 };
}

export function normalizeSession(value) {
  return { ...value, id: idOf(value), guardId: idOf(value.guardId), siteId: idOf(value.siteId), missedCheckCalls: value.missedCheckCallCount ?? value.missedCheckCalls ?? 0 };
}

export function normalizeCheckCall(value) {
  return { ...value, id: idOf(value), sessionId: idOf(value.sessionId), guardId: idOf(value.guardId), siteId: idOf(value.siteId), respondedAt: value.respondedAt || null };
}

export function normalizePatrol(value) {
  const captures = (value.captures || []).map(capture => ({ ...capture, id: idOf(capture), patrolId: idOf(value), checkpointId: idOf(capture.checkpointId), photoUri: capture.photoUrl || capture.photoUri }));
  const captured = (value.capturedCheckpointIds || value.checkpointsCaptured || captures.map(capture => capture.checkpointId)).map(idOf);
  return { ...value, id: idOf(value), sessionId: idOf(value.shiftSessionId || value.sessionId), guardId: idOf(value.guardId), siteId: idOf(value.siteId), finishedAt: value.finishedAt || null, checkpointsCaptured: captured, missingCheckpoints: (value.missingCheckpointIds || value.missingCheckpoints || []).map(idOf), captures };
}

export function normalizeRoster(value) {
  return { ...value, id: idOf(value), guardId: idOf(value.guardId), siteId: idOf(value.siteId), days: value.days || {} };
}

export function normalizeAlert(value) {
  const guard = value.guardId && typeof value.guardId === 'object' ? value.guardId.name : null;
  const site = value.siteId && typeof value.siteId === 'object' ? value.siteId.name : null;
  return { ...value, id: idOf(value), guardId: idOf(value.guardId), siteId: idOf(value.siteId), guardName: value.guardName || guard, siteName: value.siteName || site, read: value.isRead ?? value.read ?? false };
}

export function normalizeCheckpoint(value) {
  return { ...value, id: idOf(value), siteId: idOf(value.siteId), required: value.required !== false, nfcRequired: Boolean(value.nfcRequired), nfcTagId: value.nfcTagId || null };
}

export function normalizeUser(value) {
  const user = normalizePerson(value);
  // The mobile UI calls the organisation administrator "superadmin"; the API
  // deliberately stores that account as "admin".
  return { ...user, role: user.role === 'admin' ? 'superadmin' : user.role, siteId: idOf(value.siteId), siteIds: (value.managedSiteIds || value.siteIds || []).map(idOf) };
}
