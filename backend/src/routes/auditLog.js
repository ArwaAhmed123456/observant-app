/**
 * Audit Log routes (super admin + manager read)
 * GET /api/audit-logs
 */
const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', authenticate, requireRole('manager', 'admin'),
  asyncHandler(async (req, res) => {
    const { action, actorId, targetModel, from, to, limit = 50, page = 1 } = req.query;

    const filter = {};
    // Tenant admins and managers are both scoped to their organisation.
    filter.organisationId = req.user.organisationId;

    if (action)      filter.action      = action;
    if (actorId)     filter.actorId     = actorId;
    if (targetModel) filter.targetModel = targetModel;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('actorId', 'name email role'),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: Number(page), limit: Number(limit) });
  })
);

module.exports = router;
