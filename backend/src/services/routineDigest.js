const { User, Alert } = require('../models');
const { createSignedMediaUrl } = require('../utils/signedMedia');

const hasMailConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function sendRoutinePatrolDigests(now = new Date()) {
  if (!hasMailConfig()) return { sent: 0, skipped: 'SMTP is not configured' };
  const digestHour = Math.max(0, Math.min(23, Number(process.env.ROUTINE_DIGEST_HOUR_UTC || 8)));
  if (now.getUTCHours() !== digestHour) return { sent: 0, skipped: 'Outside the digest delivery hour' };

  const managers = await User.find({
    active: true,
    role: { $in: ['manager', 'admin'] },
    'notificationPreferences.dailyPatrolEmailDigest': true,
  }).select('_id name email organisationId notificationPreferences');
  if (!managers.length) return { sent: 0 };

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  let sent = 0;
  for (const manager of managers) {
    const preferences = manager.notificationPreferences || {};
    const lastSent = preferences.lastRoutineDigestAt ? new Date(preferences.lastRoutineDigestAt) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (lastSent.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) continue;
    const lastAttempt = preferences.lastRoutineDigestAttemptAt ? new Date(preferences.lastRoutineDigestAttemptAt) : null;
    if (lastAttempt && now.getTime() - lastAttempt.getTime() < 30 * 60 * 1000) continue;

    const alerts = await Alert.find({
      organisationId: manager.organisationId,
      managerIds: manager._id,
      type: 'patrol_complete',
      createdAt: { $gt: lastSent, $lte: now },
    }).sort({ createdAt: 1 }).limit(100).populate('guardId', 'name badgeNumber').populate('siteId', 'name');

    if (!alerts.length) {
      await User.updateOne({ _id: manager._id }, { $set: {
        'notificationPreferences.lastRoutineDigestAt': now,
        'notificationPreferences.lastRoutineDigestAttemptAt': now,
      } });
      continue;
    }

    const includePhotos = preferences.includePatrolPhotosInDigest !== false;
    const entries = alerts.map(alert => {
      const guard = alert.guardId?.name || 'Guard';
      const site = alert.siteId?.name || 'Site';
      const date = new Date(alert.createdAt).toUTCString();
      const photoLinks = includePhotos ? [...new Set(alert.photoUrls || [])]
        .map(url => createSignedMediaUrl(url, manager.organisationId))
        .filter(Boolean) : [];
      const photos = photoLinks.length
        ? `<p>Photo evidence: ${photoLinks.map((url, index) => `<a href="${escapeHtml(url)}">Open checkpoint photo ${index + 1}</a>`).join(' · ')}</p>`
        : '';
      return `<article style="border:1px solid #dbe3ec;border-radius:8px;padding:14px;margin:12px 0"><strong>${escapeHtml(guard)}</strong> · ${escapeHtml(site)}<br><span>${escapeHtml(date)}</span><p>${escapeHtml(alert.message)}</p>${photos}</article>`;
    });
    const attemptAt = new Date();
    await User.updateOne({ _id: manager._id }, { $set: { 'notificationPreferences.lastRoutineDigestAttemptAt': attemptAt } });
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: manager.email,
        subject: `Observant Security: ${alerts.length} routine patrol record${alerts.length === 1 ? '' : 's'}`,
        text: alerts.map(alert => `${alert.guardId?.name || 'Guard'} · ${alert.siteId?.name || 'Site'} · ${alert.message}`).join('\n\n'),
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#162235"><h2>Routine patrol digest</h2><p>${alerts.length} completed patrol record${alerts.length === 1 ? '' : 's'} from Observant Security.</p>${entries.join('')}<p style="color:#64748b;font-size:12px">Photo links expire after 72 hours.</p></div>`,
      });
      await User.updateOne({ _id: manager._id }, { $set: { 'notificationPreferences.lastRoutineDigestAt': now } });
      sent += 1;
    } catch (error) {
      console.error(`[RoutineDigest] Email failed for manager ${manager._id}:`, error.message);
    }
  }
  return { sent };
}

module.exports = { sendRoutinePatrolDigests, hasMailConfig };
