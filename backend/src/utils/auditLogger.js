const AuditLog = require('../models/AuditLog');

async function audit({ req, organisationId, action, targetModel, targetId, targetName, details }) {
  try {
    await AuditLog.create({
      organisationId: organisationId || req?.user?.organisationId || null,
      actorId:   req?.user?._id   || null,
      actorName: req?.user?.name  || 'System',
      actorRole: req?.user?.role  || null,
      action,
      targetModel: targetModel || null,
      targetId:    targetId    || null,
      targetName:  targetName  || null,
      details:     details     || null,
      ipAddress:   req?.ip     || null,
    });
  } catch (err) {
    // Never let audit failures crash the main flow
    console.error('[Audit] Failed to write log:', err.message);
  }
}

module.exports = { audit };
