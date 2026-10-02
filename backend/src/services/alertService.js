/**
 * alertService — creates Alert documents and fires FCM push to managers.
 * Called from check call, patrol, and shift routes.
 */
const mongoose = require('mongoose');
const { Alert, User, Site } = require('../models');
const fcm = require('./fcm');

async function createAlert({ organisationId, siteId, guardId, type, title, message, note, refModel, refId }) {
  let validSiteId = siteId;
  if (siteId && typeof siteId === 'string' && mongoose.Types.ObjectId.isValid(siteId)) {
    try { validSiteId = new mongoose.Types.ObjectId(siteId); } catch (_) {}
  }

  // Find all active managers who manage this site or organisation
  let managers = await User.find({
    organisationId,
    active: true,
    $or: [
      { role: 'admin' },
      { role: 'manager', managedSiteIds: { $in: [validSiteId, siteId].filter(Boolean) } },
      { role: 'manager', siteId: { $in: [validSiteId, siteId].filter(Boolean) } },
    ],
  }).select('_id fcmToken name');

  // Fallback: if no site-specific manager configured, notify all active managers
  if (!managers.length) {
    managers = await User.find({
      organisationId,
      active: true,
      role: { $in: ['manager', 'admin'] },
    }).select('_id fcmToken name');
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
    refModel: refModel || null,
    refId:    refId   || null,
  });

  // Fire push notifications asynchronously with full officer telemetry
  fcm.notifyManagers(alert, managers).catch(err =>
    console.error('[alertService] FCM error:', err.message)
  );

  return alert;
}

module.exports = { createAlert };
