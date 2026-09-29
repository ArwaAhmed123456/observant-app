/**
 * Password reset routes
 * POST /api/auth/forgot-password   — send reset code to email
 * POST /api/auth/verify-reset-code — verify 6-digit code
 * POST /api/auth/reset-password    — set new password with valid code
 */
const router  = require('express').Router();
const { body } = require('express-validator');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { User }          = require('../models');
const PasswordReset     = require('../models/PasswordReset');
const validate          = require('../middleware/validate');
const asyncHandler      = require('../utils/asyncHandler');
const { audit }         = require('../utils/auditLogger');

router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  asyncHandler(async (req, res) => {
    // Never claim a reset message was sent or expose reset codes in server logs.
    // Configure an email provider before enabling this flow.
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) {
      return res.status(503).json({ error: 'Password recovery email is not configured. Contact your administrator.' });
    }
    const { email } = req.body;
    const user = await User.findOne({ email, active: true });

    // Always return 200 — don't reveal whether email exists
    if (!user) return res.json({ message: 'If that email is registered, a reset code has been sent.' });

    // Invalidate any existing reset codes
    await PasswordReset.deleteMany({ userId: user._id });

    const plainCode  = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = await bcrypt.hash(plainCode, 10);
    const expiresAt  = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await PasswordReset.create({ userId: user._id, email, code: hashedCode, expiresAt });

    // A configured transport is required; avoid silently storing codes without delivery.
    const nodemailer = require('nodemailer');
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Observant account password reset',
        text: `Your password reset code is ${plainCode}. It expires in 15 minutes.`,
      });
    } catch (error) {
      await PasswordReset.deleteMany({ userId: user._id });
      throw error;
    }

    await audit({
      organisationId: user.organisationId,
      action:    'password_reset_requested',
      targetModel:'User',
      targetId:   user._id,
      targetName: user.email,
    });

    res.json({ message: 'If that email is registered, a reset code has been sent.' });
  })
);

router.post('/verify-reset-code',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const record = await PasswordReset.findOne({ email, used: false });
    if (!record || record.expiresAt < new Date())
      return res.status(400).json({ error: 'Invalid or expired code' });

    const valid = await bcrypt.compare(code, record.code);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired code' });

    res.json({ valid: true, message: 'Code verified. You may now set a new password.' });
  })
);

router.post('/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 12 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const record = await PasswordReset.findOne({ email, used: false });
    if (!record || record.expiresAt < new Date())
      return res.status(400).json({ error: 'Invalid or expired code' });

    const valid = await bcrypt.compare(code, record.code);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired code' });

    const user = await User.findById(record.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = newPassword;  // pre-save hook will hash it
    user.refreshTokenHash = null;
    await user.save();

    record.used = true;
    await record.save();

    await audit({
      organisationId: user.organisationId,
      action:    'password_reset_completed',
      targetModel:'User',
      targetId:   user._id,
      targetName: user.email,
    });

    res.json({ message: 'Password updated successfully. You can now log in.' });
  })
);

module.exports = router;
