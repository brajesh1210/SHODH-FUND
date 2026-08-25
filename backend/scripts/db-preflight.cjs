'use strict';

require('dotenv').config();
const { safeTargetSummary, validateMigrationTarget } = require('./db-target.cjs');

function expectedTarget() {
  const option = process.argv.find((item) => item.startsWith('--expect='));
  return option ? option.slice('--expect='.length) : '';
}

try {
  const target = validateMigrationTarget(process.env, { expected: expectedTarget() });
  console.log(JSON.stringify({ ok: true, ...safeTargetSummary(target) }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database preflight failed.');
  process.exitCode = 1;
}
