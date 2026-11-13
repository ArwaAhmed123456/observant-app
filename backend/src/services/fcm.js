const { Alert, User } = require('../models');

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
      sound: 'default',
      priority: 'high',
      channelId: 'observant_alerts',
      _displayInForeground: true,
      badge: 1,
    }));
  if (!messages.length) return { success: false, reason: 'No supported Expo push tokens' };
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(messages),
    });
    const payload = await response.json();
    const tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    const successCount = tickets.filter(item => item.status === 'ok').length;
    const failures = tickets
      .map((ticket, index) => ({ ticket, token: messages[index]?.to }))
      .filter(({ ticket }) => ticket.status !== 'ok');
    for (const { ticket, token } of failures) {
      const code = ticket.details?.error || ticket.message || 'Unknown push error';
      console.error(`[Push] Expo rejected notification (${code}): ${ticket.message || 'no details'}`);
      if (code === 'DeviceNotRegistered' && token) {
        await User.updateMany({ fcmToken: token }, { $set: { fcmToken: null } });
      }
    }
    if (!response.ok) console.error('[Push] Expo request failed:', JSON.stringify(payload.errors || payload));

    // Asynchronously check delivery receipts from Apple (APNs) after 5 seconds.
    // Expo /send only queues the notification; Apple delivery errors (like InvalidProviderToken)
    // appear in the receipts endpoint.
    const ticketIds = tickets.filter(item => item.id).map(item => item.id);
    if (ticketIds.length) {
      setTimeout(async () => {
        try {
          const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ticketIds }),
          });
          const receiptData = await receiptRes.json();
          if (receiptData?.data) {
            for (const [id, receipt] of Object.entries(receiptData.data)) {
              if (receipt.status === 'error') {
                console.error(`[Push] Apple APNs rejected delivery for ticket ${id}: ${receipt.message} (${receipt.details?.error || receipt.details?.apns?.reason || ''})`);
              }
            }
          }
        } catch (e) {
          console.warn('[Push] Receipt inspection warning:', e.message);
        }
      }, 5000);
    }

    return { success: response.ok && successCount > 0, successCount, failureCount: messages.length - successCount };
  } catch (error) {
    console.error('[Push] Expo delivery failed:', error.message);
    return { success: false, successCount: 0, failureCount: messages.length, reason: error.message };
  }
}

async function notifyManagers(alertDoc, managerUsers) {
  const result = await sendPush(managerUsers.map(user => user.fcmToken).filter(Boolean), {
    title: alertDoc.title,
    body: alertDoc.message,
    data: {
      alertId: alertDoc._id.toString(),
      type: alertDoc.type,
      guardId: alertDoc.guardId?.toString() || '',
      siteId: alertDoc.siteId?.toString() || '',
    },
  });
  if (result.success) await Alert.findByIdAndUpdate(alertDoc._id, { pushSent: true, pushSentAt: new Date() });
  return result;
}

module.exports = { init, sendPush, notifyManagers };
