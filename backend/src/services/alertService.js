/**
 * alertService — creates Alert documents and fires FCM push to managers.
 * Called from check call, patrol, and shift routes.
 */
const mongoose = require('mongoose');
const { Alert, User, Site } = require('../models');
const fcm = require('./fcm');
const { sendIncidentAlertEmail } = require('./incidentEmail');

async function createAlert({ organisationId, siteId, guardId, type, title, message, note, photoUrl, photoUrls, category, location, refModel, refId }) {
  let validSiteId = siteId;
  if (siteId && typeof siteId === 'string' && mongoose.Types.ObjectId.isValid(siteId)) {
    try { validSiteId = new mongoose.Types.ObjectId(siteId); } catch (_) {}
  }

  // Look up site to get its direct manager if assigned
  let siteManagerId = null;
  if (siteId) {
    try {
      const siteDoc = await Site.findById(siteId).select('managerId');
      if (siteDoc?.managerId) siteManagerId = siteDoc.managerId;
    } catch (_) {}
  }

  // Find active managers who manage this site
  let managers = await User.find({
    organisationId,
    active: true,
    $or: [
      { role: 'manager', managedSiteIds: { $in: [validSiteId, siteId].filter(Boolean) } },
      { role: 'manager', siteId: { $in: [validSiteId, siteId].filter(Boolean) } },
      ...(siteManagerId ? [{ _id: siteManagerId }] : []),
      { role: 'admin' },
    ],
  }).select('_id fcmToken name email notificationPreferences role managedSiteIds siteId');

  // Fallback 1: if no site-specific manager configured, find active managers / admins
  if (!managers.length) {
    managers = await User.find({
      organisationId,
      active: true,
      role: { $in: ['admin', 'manager'] },
    }).select('_id fcmToken name email notificationPreferences role managedSiteIds siteId');
  }

  // Fallback 2: Check if ANY matched manager actually has an active push token.
  // If no matched manager has an active push token (e.g. site manager has not logged into the mobile app),
  // fallback to all active managers/admins in the company who DO have active push tokens so alerts are never lost!
  let pushManagers = managers.filter(manager => !!manager.fcmToken);
  if (!pushManagers.length) {
    const orgManagersWithPush = await User.find({
      organisationId,
      active: true,
      role: { $in: ['manager', 'admin'] },
      fcmToken: { $ne: null, $exists: true },
    }).select('_id fcmToken name email notificationPreferences role managedSiteIds siteId');

    if (orgManagersWithPush.length) {
      pushManagers = orgManagersWithPush;
      for (const om of orgManagersWithPush) {
        if (!managers.some(m => m._id.toString() === om._id.toString())) {
          managers.push(om);
        }
      }
    }
  }

  const managerIds = managers.map(m => m._id);

  // Enrich alert with guard and site details if not present in message
  let enrichedTitle = title;
  let enrichedMessage = message;

  try {
    const [guard, site] = await Promise.all([
      guardId ? User.findById(guardId).select('name badgeNumber') : null,
      siteId ? Site.findById(siteId).select('name') : null,
    ]);

    const guardStr = guard ? `${guard.name}${guard.badgeNumber ? ` (${guard.badgeNumber})` : ''}` : '';
    const siteStr = site ? site.name : '';

    if (guardStr && !enrichedMessage.includes(guard.name)) {
      enrichedMessage = `${guardStr}: ${enrichedMessage}`;
    }
    if (siteStr && !enrichedMessage.includes(siteStr)) {
      enrichedMessage = `${enrichedMessage} · ${siteStr}`;
    }
  } catch (_) {}

  const alert = await Alert.create({
    organisationId,
    siteId,
    guardId,
    managerIds,
    type,
    title:    enrichedTitle,
    message:  enrichedMessage,
    note:     note || null,
    category: category || null,
    photoUrl: photoUrl || null,
    photoUrls: [...new Set([...(photoUrls || []), ...(photoUrl ? [photoUrl] : [])])],
    location: location || null,
    refModel: refModel || null,
    refId:    refId   || null,
  });

  // Routine patrol completion is normal operational progress and NOT an issue — do NOT push to managers
  if (type === 'patrol_complete') {
    return alert;
  }

  // All issue alert types: check call missed, check call issue, surprise patrol missed,
  // guard not arrived / not on duty, early sign out / logout, incomplete patrol, SOS
  if (pushManagers.length) {
    try {
      await fcm.notifyManagers(alert, pushManagers);
    } catch (err) {
      console.error('[alertService] FCM error:', err.message);
    }
  }
  sendIncidentAlertEmail(alert, managers).catch(err =>
    console.error('[alertService] Incident email error:', err.message)
  );

  return alert;
}

module.exports = { createAlert };
