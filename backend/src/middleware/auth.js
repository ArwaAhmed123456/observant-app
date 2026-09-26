/**
 * Auth middleware
 * - authenticate   : verifies JWT, attaches req.user
 * - requireRole    : role guard (guard / manager / admin)
 * - requireSameTenant : ensures resource belongs to caller's org
 */
const jwt  = require('jsonwebtoken');
const { User } = require('../models');

// ── Verify access token ───────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.sub).select('-password -refreshTokenHash');
    if (!user || !user.active)
      return res.status(401).json({ error: 'User not found or deactivated' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── Role guard ────────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
  next();
};

// ── Tenant isolation helper ───────────────────────────────────────────────────
// Attach to any route that handles a document — call after authenticate.
// Usage: pass the orgId from the document and compare to req.user.organisationId
const requireSameTenant = (orgId) => {
  if (!orgId) return false;
  return orgId.toString() === req.user.organisationId.toString();
};

// Middleware version: reads :orgId param from URL
const requireTenantParam = (req, res, next) => {
  const paramOrgId = req.params.orgId || req.body.organisationId;
  if (
    req.user.role !== 'admin' &&
    paramOrgId &&
    paramOrgId.toString() !== req.user.organisationId.toString()
  ) {
    return res.status(403).json({ error: 'Cross-tenant access denied' });
  }
  next();
};

module.exports = { authenticate, requireRole, requireSameTenant, requireTenantParam };
