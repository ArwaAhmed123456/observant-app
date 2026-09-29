const { Alert } = require('../models');

function init() {
  console.log('[Push] Expo Push Service ready');
}

async function sendPush(tokens, { title, body, data = {} }) {
  if (!tokens?.length) return { success: false, reason: 'No tokens' };
  const messages = tokens
    .filter(token => /^Expo(nent)?PushToken\[/.test(token))
    .map(to => ({
      to, title, body,
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
      sound: 'default', priority: 'high', channelId: 'observant_alerts',
    }));
  if (!messages.length) return { success: false, reason: 'No supported Expo push tokens' };
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(messages),
    });
    const payload = await response.json();
    const receipts = payload.data || [];
    const successCount = receipts.filter(item => item.status === 'ok').length;
    const failureCount = messages.length - successCount;
    return { success: response.ok && successCount > 0, successCount, failureCount };
  } catch (error) {
    console.error('[Push] Expo delivery failed:', error.message);
    return { success: false, successCount: 0, failureCount: messages.length, reason: error.message };
  }
}

async function notifyManagers(alertDoc, managerUsers) {
  const result = await sendPush(managerUsers.map(user => user.fcmToken).filter(Boolean), {
    title: alertDoc.title,
    body: alertDoc.message,
    data: { alertId: alertDoc._id.toString(), type: alertDoc.type },
  });
  if (result.success) await Alert.findByIdAndUpdate(alertDoc._id, { pushSent: true, pushSentAt: new Date() });
  return result;
}

module.exports = { init, sendPush, notifyManagers };
