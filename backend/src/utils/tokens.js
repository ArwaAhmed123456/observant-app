const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

function signAccess(userId, role, organisationId) {
  return jwt.sign(
    { sub: userId, role, organisationId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function signRefresh(userId) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

async function hashToken(raw) {
  return bcrypt.hash(raw, 10);
}

async function compareToken(raw, hashed) {
  return bcrypt.compare(raw, hashed);
}

module.exports = { signAccess, signRefresh, verifyRefresh, hashToken, compareToken };
