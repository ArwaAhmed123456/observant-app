require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const connectDB      = require('./db');
const errorHandler   = require('./middleware/errorHandler');
const fcm            = require('./services/fcm');
const { startOperationsWorker } = require('./services/operationsWorker');

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
const mediaRoutes         = require('./routes/media');

// ── Init ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production') {
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[name] || process.env[name].length < 32 || process.env[name].startsWith('REPLACE_')) {
      throw new Error(`${name} must be a unique secret of at least 32 characters in production.`);
    }
  }
}

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(value => value.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
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
app.use('/api/media', mediaRoutes);
app.use('/api/auth/login',        authLimiter);
app.use('/api/auth/register-org', authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    database: ready ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

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

// ── Start only after MongoDB is ready ─────────────────────────────────────────
async function start() {
  await connectDB();
  fcm.init();
  startOperationsWorker();
  const server = app.listen(PORT, () =>
    console.log(`[Server] Observant API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
  );
  const shutdown = signal => {
    console.log(`[Server] ${signal} received; closing connections.`);
    server.close(async () => {
      await require('mongoose').disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = app;
