/**
 * SOS routes
 * POST /api/sos/trigger  — guard triggers SOS emergency alert
 * POST /api/sos/:id/resolve — manager resolves SOS
 * GET  /api/sos          — list SOS alerts (manager)
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { Alert, User, ShiftSession } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { createAlert } = require('../services/alertService');
const { audit }   = require('../utils/auditLogger');

router.post('/trigger',
  authenticate, requireRole('guard'),
  [
    body('latitude').optional().isFloat(),
    body('longitude').optional().isFloat(),
    body('note').optional().trim().isLength({ max: 300 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, note } = req.body;
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;

    const guard   = await User.findById(guardId).select('name badgeNumber siteId');
    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });

    const locationStr = latitude && longitude
      ? `GPS: ${parseFloat(latitude).toFixed(5)}, ${parseFloat(longitude).toFixed(5)}`
      : 'Location unavailable';

    const alert = await createAlert({
      organisationId: orgId,
      siteId:   guard.siteId,
      guardId,
      type:     'sos',
      title:    `🚨 SOS — ${guard.name}`,
      message:  `URGENT: ${guard.name} (${guard.badgeNumber}) has triggered an emergency alert. ${locationStr}`,
      note:     note || null,
      refModel: session ? 'ShiftSession' : null,
      refId:    session?._id || null,
    });

    await audit({
      req,
      organisationId: orgId,
      action:      'sos_triggered',
      targetModel: 'Alert',
      targetId:    alert._id,
      targetName:  guard.name,
      details:     { latitude, longitude, note },
    });

    res.status(201).json({ alert });
  })
);

router.post('/:id/resolve',
  authenticate, requireRole('manager', 'admin'),
  asyncHandler(async (req, res) => {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId, type: 'sos' },
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'SOS alert not found' });

    await audit({
      req,
      organisationId: req.user.organisationId,
      action:    'sos_resolved',
      targetModel: 'Alert',
      targetId:  alert._id,
      targetName:`SOS by ${alert.guardId}`,
    });

    res.json({ alert });
  })
);

router.get('/', authenticate, requireRole('manager', 'admin'),
  asyncHandler(async (req, res) => {
    const alerts = await Alert.find({
      organisationId: req.user.organisationId,
      type: 'sos',
      managerIds: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('guardId', 'name badgeNumber')
      .populate('siteId',  'name');
    res.json({ alerts });
  })
);

module.exports = router;
