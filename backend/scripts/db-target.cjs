'use strict';

const KNOWN_SYSTEM_DATABASES = new Set(['postgres', 'template0', 'template1']);
const PRODUCTION_DATABASES = new Set(['shodhfund_prod', 'shodhfund_production']);
const STAGING_DATABASE = 'shodhfund_staging';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required for database target validation.');
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a complete PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://.');
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName || KNOWN_SYSTEM_DATABASES.has(databaseName.toLowerCase())) {
    throw new Error('Refusing a PostgreSQL system or unnamed database target.');
  }

  const host = normalize(url.hostname);
  return {
    databaseName,
    host,
    isLocal: ['localhost', '127.0.0.1', '::1'].includes(host),
    isNeon: host.endsWith('.neon.tech'),
    isPooled: host.includes('-pooler'),
    sslRequired: normalize(url.searchParams.get('sslmode')) === 'require'
  };
}

function environmentLabel(env = process.env) {
  const explicit = normalize(env.SHODHFUND_DEPLOYMENT_ENV);
  if (['development', 'test', 'staging', 'production'].includes(explicit)) return explicit;

  const node = normalize(env.NODE_ENV);
  if (['development', 'test', 'staging', 'production'].includes(node)) return node;
  return 'development';
}

function classifyTarget(target) {
  const database = target.databaseName.toLowerCase();
  if (PRODUCTION_DATABASES.has(database)) return 'production';
  if (database === STAGING_DATABASE) return 'staging';
  if (target.isLocal) return 'local';
  if (/^shodhfund_(ci|test|phase\d+_clean_)/.test(database)) return 'test';
  return 'remote-unknown';
}

function assertDirectNeon(target, kind) {
  if (!target.isNeon) {
    throw new Error(`${kind} migrations require the approved direct Neon connection URL.`);
  }
  if (target.isPooled) {
    throw new Error(`${kind} migrations require the direct/unpooled URL, not a -pooler URL.`);
  }
  if (!target.sslRequired) {
    throw new Error(`${kind} migrations require sslmode=require in DATABASE_URL.`);
  }
}

function validateMigrationTarget(env = process.env, options = {}) {
  const target = parseDatabaseUrl(env.DATABASE_URL);
  const kind = classifyTarget(target);
  const environment = environmentLabel(env);
  const expected = options.expected ? normalize(options.expected) : '';

  if (expected && kind !== expected) {
    throw new Error(`Expected ${expected} database target, but detected ${kind}.`);
  }

  if (kind === 'remote-unknown') {
    throw new Error('Refusing an unrecognized remote database target for migrations.');
  }

  if (kind === 'production') {
    if (environment !== 'production') {
      throw new Error('Production migrations require SHODHFUND_DEPLOYMENT_ENV=production or NODE_ENV=production.');
    }
    assertDirectNeon(target, 'Production');
  }

  if (kind === 'staging') {
    if (environment !== 'staging') {
      throw new Error('Staging migrations require SHODHFUND_DEPLOYMENT_ENV=staging.');
    }
    assertDirectNeon(target, 'Staging');
  }

  return {
    kind,
    environment,
    databaseName: target.databaseName,
    connection: target.isPooled ? 'pooled' : 'direct'
  };
}

function safeTargetSummary(target) {
  return {
    target: target.kind,
    environment: target.environment,
    database: target.databaseName,
    connection: target.connection
  };
}

module.exports = {
  PRODUCTION_DATABASES,
  STAGING_DATABASE,
  classifyTarget,
  environmentLabel,
  parseDatabaseUrl,
  safeTargetSummary,
  validateMigrationTarget
};
