'use strict';

/**
 * Intentionally narrow helper for a disposable, separately named staging DB.
 * It is not a production provisioning command and it never prints DATABASE_URL.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config();

const STAGING_DATABASE_NAME = 'shodhfund_staging';

function databaseTarget(databaseUrl) {
  if (typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required for staging demo seeding.');
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a complete PostgreSQL URL.');
  }

  if (!/^postgres(?:ql)?:$/.test(url.protocol)) {
    throw new Error('DATABASE_URL must use the postgresql:// protocol.');
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return {
    host: url.hostname.toLowerCase(),
    databaseName
  };
}

function validateStagingSeedEnvironment(env = process.env) {
  if (String(env.SHODHFUND_DEPLOYMENT_ENV || '').trim().toLowerCase() !== 'staging') {
    throw new Error('Set SHODHFUND_DEPLOYMENT_ENV=staging before seeding the staging database.');
  }

  const target = databaseTarget(env.DATABASE_URL);
  if (target.databaseName !== STAGING_DATABASE_NAME) {
    throw new Error(
      `Refusing to seed ${target.databaseName || 'an unnamed database'}. ` +
      `The staging database must be named ${STAGING_DATABASE_NAME}.`
    );
  }

  if (target.host.includes('-pooler')) {
    throw new Error('Use the direct/unpooled PostgreSQL URL for staging demo seeding.');
  }

  if (!target.host.endsWith('.neon.tech')) {
    throw new Error('Remote demo seeding is restricted to the dedicated Neon staging database.');
  }

  return target;
}

function run() {
  const target = validateStagingSeedEnvironment();
  console.log(`Approved staging demo target: ${target.databaseName}`);

  // Invoke Prisma's local JavaScript CLI through the current Node binary.
  // This avoids Windows spawnSync failures from invoking the npx.cmd wrapper.
  const prismaCli = require.resolve('prisma/build/index.js', {
    paths: [path.resolve(__dirname, '..')]
  });
  const result = spawnSync(process.execPath, [prismaCli, 'db', 'seed'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      // The seed's generic production/staging guard stays active for normal use.
      // This single command is the explicit and separately named staging escape hatch.
      NODE_ENV: 'development',
      SHODHFUND_ALLOW_REMOTE_DEMO_SEED: 'true',
      SHODHFUND_STAGING_SEED: 'true'
    }
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging demo seed failed.');
    process.exitCode = 1;
  }
}

module.exports = {
  STAGING_DATABASE_NAME,
  databaseTarget,
  validateStagingSeedEnvironment
};
