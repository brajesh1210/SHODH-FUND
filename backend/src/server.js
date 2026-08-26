require('dotenv').config();

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const addFixedRoutes = require('./fixed-routes');
const { createMemoryStorage, createObjectStorage } = require('./storage/object-storage');
const { deploymentEnvironment, publicReadinessPayload } = require('./runtime');
const { securityHeaders, requestLogger } = require('./middleware/security');

const app = express();
const prisma = new PrismaClient();
const objectStorage = process.env.SHODHFUND_TEST_OBJECT_STORAGE === 'true'
  ? createMemoryStorage()
  : createObjectStorage(process.env);
const PORT = Number(process.env.PORT || 4000);
const configuredJwtSecret = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
const runtimeEnvironment = deploymentEnvironment(process.env);

if (isProduction && (!configuredJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
}

const JWT_SECRET = configuredJwtSecret || crypto.randomBytes(64).toString('hex');
if (!configuredJwtSecret) {
  console.warn('JWT_SECRET is not configured; using a temporary development-only secret.');
}

const configuredOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(securityHeaders());
app.use(requestLogger());
app.use(
  cors({
    credentials: false,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not permitted.'));
    }
  })
);
app.use(express.json({ limit: '1mb' }));

// Safe for platform health checks. Unlike /api/health, this endpoint returns no
// configuration, users, database details, provider state, or secret-derived data.
app.get('/api/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json(publicReadinessPayload({
      NODE_ENV: process.env.NODE_ENV,
      SHODHFUND_DEPLOYMENT_ENV: runtimeEnvironment
    }));
  } catch (error) {
    console.error('Database readiness check failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({
      status: 'unavailable',
      service: 'shodhfund-api',
      environment: runtimeEnvironment
    });
  }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    {
      expiresIn: '8h',
      issuer: 'shodhfund-api',
      audience: 'shodhfund-web'
    }
  );
}

function verifyToken(value) {
  return jwt.verify(value, JWT_SECRET, {
    issuer: 'shodhfund-api',
    audience: 'shodhfund-web'
  });
}

const currentUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  designation: true,
  avatarUrl: true
};

async function optionalAuth(req, _res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return next();

  let claims;
  try {
    claims = verifyToken(authorization.slice(7));
  } catch {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: String(claims.id || '') },
      select: currentUserSelect
    });
    if (user) req.user = user;
  } catch (error) {
    console.error('Optional session rehydration failed:', error instanceof Error ? error.message : error);
  }
  return next();
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  let claims;
  try {
    claims = verifyToken(authorization.slice(7));
  } catch {
    return res.status(401).json({ error: 'The session is invalid or has expired.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: String(claims.id || '') },
      select: currentUserSelect
    });
    if (!user) {
      return res.status(401).json({ error: 'The session account no longer exists.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    console.error('Required session rehydration failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

async function logAction(userId, action, entityType, entityId, metadata) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata || null
      }
    });
  } catch (error) {
    console.error('Audit log write failed:', error instanceof Error ? error.message : error);
  }
}

addFixedRoutes({
  app,
  prisma,
  requireAuth,
  optionalAuth,
  requireRole,
  signToken,
  logAction,
  storage: objectStorage
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'The request could not be completed.' });
});

let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShodhFund API listening on port ${PORT} [${runtimeEnvironment}]`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down.`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, prisma };
