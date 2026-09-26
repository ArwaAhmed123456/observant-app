/**
 * Firebase Cloud Messaging service.
 *
 * Setup:
 *  1. Go to Firebase Console → Project Settings → Service Accounts
 *  2. Generate a new private key → download JSON
 *  3. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env pointing to that JSON file
 *     OR set FIREBASE_SERVICE_ACCOUNT_JSON as the stringified JSON
 */
const admin = require('firebase-admin');
const { Alert } = require('../models');

let initialised = false;

function init() {
  if (initialised) return;
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(sa);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      credential = admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    } else {
      console.warn('[FCM] No Firebase credentials configured — push notifications disabled');
      return;
    }
    admin.initializeApp({ credential });
    initialised = true;
    console.log('[FCM] Firebase Admin initialised');
  } catch (err) {
    console.error('[FCM] Init failed:', err.message);
  }
}

/**
 * Send a push notification to one or more FCM tokens.
 * @param {string[]} tokens  - FCM registration tokens
 * @param {object}   payload - { title, body, data }
 */
async function sendPush(tokens, { title, body, data = {} }) {
  if (!initialised) return { success: false, reason: 'FCM not initialised' };
  if (!tokens?.length) return { success: false, reason: 'No tokens' };

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    tokens,
    android: { priority: 'high', notification: { sound: 'default', channelId: 'observant_alerts' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (err) {
    console.error('[FCM] Send error:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * High-level: send push to all managers of a site and mark Alert.pushSent
 */
async function notifyManagers(alertDoc, managerUsers) {
  const tokens = managerUsers.map(u => u.fcmToken).filter(Boolean);
  const result = await sendPush(tokens, {
    title: alertDoc.title,
    body:  alertDoc.message,
    data:  { alertId: alertDoc._id.toString(), type: alertDoc.type },
  });
  if (result.success) {
    await Alert.findByIdAndUpdate(alertDoc._id, { pushSent: true, pushSentAt: new Date() });
  }
  return result;
}

module.exports = { init, sendPush, notifyManagers };
