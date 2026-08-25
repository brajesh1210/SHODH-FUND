'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config();
const { safeTargetSummary, validateMigrationTarget } = require('./db-target.cjs');

try {
  const target = validateMigrationTarget(process.env);
  console.log(`Migration preflight approved: ${JSON.stringify(safeTargetSummary(target))}`);

  // Running Prisma's local JS entry through Node avoids npx.cmd wrapper issues on Windows.
  const prismaCli = require.resolve('prisma/build/index.js', {
    paths: [path.resolve(__dirname, '..')]
  });
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration deployment failed.');
  process.exitCode = 1;
}
