const { Alert } = require('../models');
const { createSignedMediaUrl } = require('../utils/signedMedia');

const EXCEPTION_TYPES = new Set([
  'check_call_missed', 'check_call_issue', 'patrol_incomplete',
  'patrol_missing_checkpoints', 'sos', 'geofence_warning',
  'random_prompt_ignored', 'account_deletion_request',
]);
const mailConfigured = () => Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM
);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

async function sendIncidentAlertEmail(alert, managers) {
  if (!alert || !EXCEPTION_TYPES.has(alert.type) || !mailConfigured()) return { sent: 0 };
  const recipients = (managers || []).filter(manager => manager.email);
  if (!recipients.length) return { sent: 0 };

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const record = await Alert.findById(alert._id)
    .populate('guardId', 'name badgeNumber phone')
    .populate('siteId', 'name address what3words');
  if (!record) return { sent: 0 };

  const guard = record.guardId || {};
  const site = record.siteId || {};
  const timestamp = new Date(record.createdAt || Date.now()).toISOString();
  const photos = [...new Set(record.photoUrls || (record.photoUrl ? [record.photoUrl] : []))]
    .map(url => createSignedMediaUrl(url, record.organisationId))
    .filter(Boolean);
  const location = record.location || {};
  const locationText = location.what3words || (location.latitude != null && location.longitude != null
    ? `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
    : 'Not recorded');
  const photoHtml = photos.length
    ? `<h3>Photo evidence</h3>${photos.map((url, index) => `<p><a href="${escapeHtml(url)}">Open evidence photo ${index + 1}</a></p><a href="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="Incident photo ${index + 1}" style="display:block;max-width:560px;width:100%;height:auto;border:1px solid #dbe3ec;border-radius:8px;margin:8px 0 18px" /></a>`).join('')}`
    : '<p>No photo evidence was attached.</p>';
  const textPhotos = photos.length ? photos.map((url, index) => `Photo ${index + 1}: ${url}`).join('\n') : 'No photo evidence attached.';
  const subject = `Observant Security: ${record.title} · ${site.name || 'Site'}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#162235"><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.message)}</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #dbe3ec"><b>Time</b></td><td style="padding:8px;border-bottom:1px solid #dbe3ec">${escapeHtml(timestamp)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #dbe3ec"><b>Officer</b></td><td style="padding:8px;border-bottom:1px solid #dbe3ec">${escapeHtml(guard.name || 'Unknown officer')} · SIA ${escapeHtml(guard.badgeNumber || '—')} · ${escapeHtml(guard.phone || 'No phone')}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #dbe3ec"><b>Site</b></td><td style="padding:8px;border-bottom:1px solid #dbe3ec">${escapeHtml(site.name || 'Unknown site')} · ${escapeHtml(site.address || 'No address')}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #dbe3ec"><b>Category</b></td><td style="padding:8px;border-bottom:1px solid #dbe3ec">${escapeHtml(record.category || '—')}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #dbe3ec"><b>Location</b></td><td style="padding:8px;border-bottom:1px solid #dbe3ec">${escapeHtml(locationText)}</td></tr></table>${record.note ? `<h3>Officer note</h3><p>${escapeHtml(record.note)}</p>` : ''}${photoHtml}<p style="color:#64748b;font-size:12px">Secure photo links expire after 72 hours.</p></div>`;
  const text = `${record.title}\n${record.message}\n\nTime: ${timestamp}\nOfficer: ${guard.name || 'Unknown officer'} (SIA ${guard.badgeNumber || '—'})\nSite: ${site.name || 'Unknown site'} · ${site.address || 'No address'}\nCategory: ${record.category || '—'}\nLocation: ${locationText}\n${record.note ? `Officer note: ${record.note}\n` : ''}\n${textPhotos}\n\nPhoto links expire after 72 hours.`;

  const results = await Promise.allSettled(recipients.map(manager => transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: manager.email,
    subject,
    text,
    html,
  })));
  const sent = results.filter(result => result.status === 'fulfilled').length;
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error(`[IncidentEmail] Email failed for manager ${recipients[index]._id}:`, result.reason?.message);
  });
  return { sent };
}

module.exports = { sendIncidentAlertEmail };
