'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  STAGING_DATABASE_NAME,
  databaseTarget,
  validateStagingSeedEnvironment
} = require('../scripts/seed-staging.cjs');
const { deploymentEnvironment, publicReadinessPayload } = require('../src/runtime');

const directStagingUrl =
  'postgresql://staging_owner:secret@ep-staging-demo.c-4.ap-southeast-1.aws.neon.tech/' +
  `${STAGING_DATABASE_NAME}?sslmode=require`;

test('deployment environment is public metadata and keeps Node and staging labels separate', () => {
  assert.equal(deploymentEnvironment({ NODE_ENV: 'production' }), 'production');
  assert.equal(
    deploymentEnvironment({ NODE_ENV: 'production', SHODHFUND_DEPLOYMENT_ENV: 'staging' }),
    'staging'
  );
  assert.equal(deploymentEnvironment({ NODE_ENV: 'nonsense' }), 'development');
  assert.deepEqual(
    publicReadinessPayload({ NODE_ENV: 'production', SHODHFUND_DEPLOYMENT_ENV: 'staging' }),
    { status: 'ok', service: 'shodhfund-api', environment: 'staging' }
  );
});

test('staging seed parser never returns secrets and recognizes only the database target', () => {
  assert.deepEqual(databaseTarget(directStagingUrl), {
    host: 'ep-staging-demo.c-4.ap-southeast-1.aws.neon.tech',
    databaseName: STAGING_DATABASE_NAME
  });
  assert.throws(() => databaseTarget('not a URL'), /complete PostgreSQL URL/);
});

test('staging demo seed only accepts the explicit staging marker, exact DB name, direct Neon URL', () => {
  assert.deepEqual(
    validateStagingSeedEnvironment({
      SHODHFUND_DEPLOYMENT_ENV: 'staging',
      DATABASE_URL: directStagingUrl
    }),
    {
      host: 'ep-staging-demo.c-4.ap-southeast-1.aws.neon.tech',
      databaseName: STAGING_DATABASE_NAME
    }
  );

  assert.throws(
    () => validateStagingSeedEnvironment({ DATABASE_URL: directStagingUrl }),
    /SHODHFUND_DEPLOYMENT_ENV=staging/
  );
  assert.throws(
    () => validateStagingSeedEnvironment({
      SHODHFUND_DEPLOYMENT_ENV: 'staging',
      DATABASE_URL: directStagingUrl.replace(STAGING_DATABASE_NAME, 'shodhfund_prod')
    }),
    /staging database must be named/
  );
  assert.throws(
    () => validateStagingSeedEnvironment({
      SHODHFUND_DEPLOYMENT_ENV: 'staging',
      DATABASE_URL: directStagingUrl.replace('ep-staging-demo', 'ep-staging-demo-pooler')
    }),
    /direct\/unpooled/
  );
  assert.throws(
    () => validateStagingSeedEnvironment({
      SHODHFUND_DEPLOYMENT_ENV: 'staging',
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/shodhfund_staging'
    }),
    /dedicated Neon staging database/
  );
});
