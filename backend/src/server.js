require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const connectDB      = require('./db');
const errorHandler   = require('./middleware/errorHandler');
const fcm            = require('./services/fcm');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const passwordResetRoutes = require('./routes/passwordReset');
const userRoutes          = require('./routes/users');
const shiftRoutes         = require('./routes/shifts');
const checkCallRoutes     = require('./routes/checkCalls');
const patrolRoutes        = require('./routes/patrols');
const rosterRoutes        = require('./routes/rosters');
const alertRoutes         = require('./routes/alerts');
const reportRoutes        = require('./routes/reports');
const sosRoutes           = require('./routes/sos');
const manualLogRoutes     = require('./routes/manualLog');
const auditLogRoutes      = require('./routes/auditLog');

// ── Init ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

connectDB();
fcm.init();

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please slow down' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message: { error: 'Too many login attempts' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login',        authLimiter);
app.use('/api/auth/register-org', authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/auth',         passwordResetRoutes);
app.use('/api',              userRoutes);
app.use('/api/shifts',       shiftRoutes);
app.use('/api/check-calls',  checkCallRoutes);
app.use('/api/patrols',      patrolRoutes);
app.use('/api/rosters',      rosterRoutes);
app.use('/api/alerts',       alertRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/sos',          sosRoutes);
app.use('/api/manual-log',   manualLogRoutes);
app.use('/api/audit-logs',   auditLogRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`[Server] Observant API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
);

module.exports = app;
