/**
 * Auth routes
 * POST /api/auth/register-org  — create org + first admin user
 * POST /api/auth/login         — email/password → access + refresh tokens
 * POST /api/auth/refresh       — swap refresh token for new access token
 * POST /api/auth/logout        — revoke refresh token
 * GET  /api/auth/me            — current user profile
 * PATCH /api/auth/me/fcm-token — update Expo push token
 */
const router  = require('express').Router();
const { body } = require('express-validator');
const { Organisation, User } = require('../models');
const { authenticate }  = require('../middleware/auth');
const validate          = require('../middleware/validate');
const asyncHandler      = require('../utils/asyncHandler');
const { signAccess, signRefresh, verifyRefresh, hashToken, compareToken } = require('../utils/tokens');
const { audit } = require('../utils/auditLogger');

// ── Register new organisation + admin user ────────────────────────────────────
router.post('/register-org',
  [
    body('orgName').trim().notEmpty().withMessage('Organisation name required'),
    body('orgSlug').trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty(),
    body('contactEmail').isEmail().normalizeEmail(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { orgName, orgSlug, email, password, name, contactEmail } = req.body;

    if (process.env.ALLOW_ORG_REGISTRATION !== 'true') return res.status(403).json({ error: 'Organisation registration is disabled. Contact your system administrator.' });

    const existing = await Organisation.findOne({ slug: orgSlug });
    if (existing) return res.status(409).json({ error: 'Organisation slug already taken' });

    const org = await Organisation.create({
      name: orgName,
      slug: orgSlug,
      contactEmail,
    });

    const user = await User.create({
      organisationId: org._id,
      name,
      email,
      password,
      role: 'admin',
      managedSiteIds: [],
    });

    const accessToken  = signAccess(user._id, user.role, org._id);
    const refreshToken = signRefresh(user._id);
    const tokenHash    = await hashToken(refreshToken);

    await User.findByIdAndUpdate(user._id, { refreshTokenHash: tokenHash, lastLoginAt: new Date() });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, organisationId: org._id },
      organisation: { id: org._id, name: org.name, slug: org.slug },
    });
  })
);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshTokenHash');
    if (!user || !user.active)
      return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken  = signAccess(user._id, user.role, user.organisationId);
    const refreshToken = signRefresh(user._id);
    const tokenHash    = await hashToken(refreshToken);

    await User.findByIdAndUpdate(user._id, { refreshTokenHash: tokenHash, lastLoginAt: new Date() });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:             user._id,
        name:           user.name,
        email:          user.email,
        role:           user.role,
        organisationId: user.organisationId,
        siteId:         user.siteId,
        managedSiteIds: user.managedSiteIds,
        badgeNumber:    user.badgeNumber,
        avatarUrl:      user.avatarUrl,
      },
    });
  })
);

// ── Refresh token ─────────────────────────────────────────────────────────────
router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefresh(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.sub).select('+refreshTokenHash');
    if (!user || !user.active || !user.refreshTokenHash)
      return res.status(401).json({ error: 'Session revoked' });

    const valid = await compareToken(refreshToken, user.refreshTokenHash);
    if (!valid) return res.status(401).json({ error: 'Refresh token mismatch' });

    const newAccess  = signAccess(user._id, user.role, user.organisationId);
    const newRefresh = signRefresh(user._id);
    const newHash    = await hashToken(newRefresh);

    await User.findByIdAndUpdate(user._id, { refreshTokenHash: newHash });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  })
);

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
  res.json({ message: 'Logged out' });
}));

// ── Current user ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

router.post('/change-password', authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 12 }).withMessage('New password must be at least 12 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password +refreshTokenHash');
    if (!user || !(await user.comparePassword(req.body.currentPassword))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    user.password = req.body.newPassword;
    user.refreshTokenHash = null;
    await user.save();
    await audit({
      req,
      organisationId: user.organisationId,
      action: 'password_changed',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.email,
    });
    res.json({ message: 'Password changed. Sign in again with your new password.' });
  })
);

// ── Update Expo push token ────────────────────────────────────────────────────
router.patch('/me/fcm-token',
  authenticate,
    [body('fcmToken').matches(/^Expo(nent)?PushToken\[[^\]]+\]$/).withMessage('Invalid Expo push token')],
  validate,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: req.body.fcmToken });
    res.json({ message: 'FCM token updated' });
  })
);

module.exports = router;
