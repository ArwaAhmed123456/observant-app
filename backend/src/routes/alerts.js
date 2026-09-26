/**
 * Alert routes
 *
 * GET   /api/alerts           — list alerts for current manager
 * GET   /api/alerts/unread-count — fast unread badge count
 * PATCH /api/alerts/:id/read  — mark one alert as read
 * PATCH /api/alerts/read-all  — mark all as read
 * DELETE /api/alerts/:id      — delete alert (manager only)
 */
const router = require('express').Router();
const { Alert } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// ── List alerts ───────────────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { type, siteId, read, limit = 50, page = 1 } = req.query;
    const orgId = req.user.organisationId;

    const filter = {
      organisationId: orgId,
      managerIds: req.user._id,
    };
    if (type)   filter.type   = type;
    if (siteId) filter.siteId = siteId;
    if (read === 'true')  filter.readBy = req.user._id;
    if (read === 'false') filter.readBy = { $ne: req.user._id };

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name'),
      Alert.countDocuments(filter),
    ]);

    // Attach isRead flag per manager
    const result = alerts.map(a => ({
      ...a.toObject(),
      isRead: a.readBy.map(String).includes(req.user._id.toString()),
    }));

    res.json({ alerts: result, total, page: Number(page), limit: Number(limit) });
  })
);

// ── Unread count (for badge) ──────────────────────────────────────────────────
router.get('/unread-count', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const count = await Alert.countDocuments({
      organisationId: req.user.organisationId,
      managerIds:     req.user._id,
      readBy:         { $ne: req.user._id },
    });
    res.json({ count });
  })
);

// ── Mark one read ─────────────────────────────────────────────────────────────
router.patch('/:id/read', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId, managerIds: req.user._id },
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  })
);

// ── Mark all read ─────────────────────────────────────────────────────────────
router.patch('/read-all', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    await Alert.updateMany(
      {
        organisationId: req.user.organisationId,
        managerIds: req.user._id,
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ message: 'All alerts marked as read' });
  })
);

// ── Delete alert ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    await Alert.findOneAndDelete({
      _id: req.params.id, organisationId: req.user.organisationId,
    });
    res.json({ message: 'Alert deleted' });
  })
);

module.exports = router;
