/**
 * alertService — creates Alert documents and fires FCM push to managers.
 * Called from check call, patrol, and shift routes.
 */
const { Alert, User } = require('../models');
const fcm = require('./fcm');

async function createAlert({ organisationId, siteId, guardId, type, title, message, note, refModel, refId }) {
  // Find all active managers who manage this site
  const managers = await User.find({
    organisationId,
    active: true,
    $or: [
      { role: 'admin' },
      { role: 'manager', managedSiteIds: siteId },
    ],
  }).select('_id fcmToken');

  const managerIds = managers.map(m => m._id);

  const alert = await Alert.create({
    organisationId,
    siteId,
    guardId,
    managerIds,
    type,
    title,
    message,
    note:     note || null,
    refModel: refModel || null,
    refId:    refId   || null,
  });

  // Fire push notifications asynchronously (don't block the API response)
  fcm.notifyManagers(alert, managers).catch(err =>
    console.error('[alertService] FCM error:', err.message)
  );

  return alert;
}

module.exports = { createAlert };
