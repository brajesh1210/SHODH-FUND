'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  classifyTarget,
  parseDatabaseUrl,
  safeTargetSummary,
  validateMigrationTarget
} = require('../scripts/db-target.cjs');

const productionDirect =
  'postgresql://owner:secret@ep-prod.c-4.ap-southeast-1.aws.neon.tech/shodhfund_prod?sslmode=require';
const stagingDirect =
  'postgresql://owner:secret@ep-stage.c-4.ap-southeast-1.aws.neon.tech/shodhfund_staging?sslmode=require';

test('database target parser does not expose credentials and classifies expected named targets', () => {
  const prod = parseDatabaseUrl(productionDirect);
  assert.equal(prod.databaseName, 'shodhfund_prod');
  assert.equal(prod.isNeon, true);
  assert.equal(prod.isPooled, false);
  assert.equal(classifyTarget(prod), 'production');
  assert.ok(!JSON.stringify(prod).includes('secret'));

  const stage = parseDatabaseUrl(stagingDirect);
  assert.equal(classifyTarget(stage), 'staging');
  assert.equal(classifyTarget(parseDatabaseUrl('postgresql://ci@127.0.0.1:5432/shodhfund_ci')), 'local');
});

test('production migration preflight requires production label, direct Neon and TLS', () => {
  const approved = validateMigrationTarget({
    DATABASE_URL: productionDirect,
    NODE_ENV: 'production'
  });
  assert.deepEqual(safeTargetSummary(approved), {
    target: 'production',
    environment: 'production',
    database: 'shodhfund_prod',
    connection: 'direct'
  });

  assert.throws(
    () => validateMigrationTarget({ DATABASE_URL: productionDirect, NODE_ENV: 'development' }),
    /require SHODHFUND_DEPLOYMENT_ENV=production/
  );
  assert.throws(
    () => validateMigrationTarget({
      DATABASE_URL: productionDirect.replace('ep-prod', 'ep-prod-pooler'),
      NODE_ENV: 'production'
    }),
    /direct\/unpooled/
  );
  assert.throws(
    () => validateMigrationTarget({
      DATABASE_URL: productionDirect.replace('?sslmode=require', ''),
      NODE_ENV: 'production'
    }),
    /sslmode=require/
  );
});

test('staging migrations require staging label and local/CI remain usable', () => {
  const stage = validateMigrationTarget({
    DATABASE_URL: stagingDirect,
    NODE_ENV: 'production',
    SHODHFUND_DEPLOYMENT_ENV: 'staging'
  }, { expected: 'staging' });
  assert.equal(stage.kind, 'staging');
  assert.equal(stage.environment, 'staging');

  assert.throws(
    () => validateMigrationTarget({ DATABASE_URL: stagingDirect, NODE_ENV: 'production' }),
    /require SHODHFUND_DEPLOYMENT_ENV=staging/
  );

  const ci = validateMigrationTarget({
    DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:5432/shodhfund_ci?schema=public',
    NODE_ENV: 'test'
  });
  assert.equal(ci.kind, 'local');
  assert.equal(ci.environment, 'test');

  assert.throws(
    () => validateMigrationTarget({
      DATABASE_URL: 'postgresql://owner:secret@remote.example.com:5432/unknown_db',
      NODE_ENV: 'production'
    }),
    /unrecognized remote/
  );
});
