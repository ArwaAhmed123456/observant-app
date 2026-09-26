/**
 * Offline Queue Service
 * Queues failed API calls to AsyncStorage and replays them when connectivity resumes.
 * Uses @react-native-community/netinfo for connectivity detection.
 *
 * Usage:
 *   import { enqueue, startSyncListener } from './offlineQueue';
 *   await enqueue({ url, method, body, label });
 *   startSyncListener();  // call once in AppContext
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY   = 'obs_offline_queue';
const BASE_URL    = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// ── Queue helpers ─────────────────────────────────────────────────────────────
export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(queue) {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

/**
 * Add an item to the offline queue.
 * @param {{ url: string, method: string, body: object, label: string, token: string }} item
 */
export async function enqueue(item) {
  const queue = await getQueue();
  queue.push({ ...item, id: `q_${Date.now()}`, queuedAt: new Date().toISOString() });
  await saveQueue(queue);
  console.log(`[OfflineQueue] Queued: ${item.label}`);
}

/**
 * Attempt to flush all queued items.
 * Returns { flushed, failed } counts.
 */
export async function flush(token) {
  const queue = await getQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  const remaining = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`${BASE_URL}${item.url}`, {
        method:  item.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${item.token || token || ''}`,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      if (res.ok) {
        flushed++;
        console.log(`[OfflineQueue] Flushed: ${item.label}`);
      } else {
        remaining.push(item); // keep for next retry
      }
    } catch {
      remaining.push(item);
    }
  }

  await saveQueue(remaining);
  return { flushed, failed: remaining.length };
}

/**
 * Subscribe to connectivity changes and auto-flush when online.
 * Returns unsubscribe function — call on cleanup.
 */
export function startSyncListener(getToken, onSyncResult) {
  const unsub = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      getQueue().then(q => {
        if (q.length > 0) {
          flush(getToken?.()).then(result => {
            if (onSyncResult) onSyncResult(result);
          });
        }
      });
    }
  });
  return unsub;
}

/**
 * Check if device is currently online.
 */
export async function isOnline() {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
}
