'use strict';

const KNOWN_DEPLOYMENT_ENVIRONMENTS = new Set([
  'development',
  'test',
  'staging',
  'production'
]);

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Returns a non-secret, user-facing deployment label. NODE_ENV keeps its normal
 * Node semantics while SHODHFUND_DEPLOYMENT_ENV can distinguish a production-mode
 * Render process serving the staging environment.
 */
function deploymentEnvironment(env = process.env) {
  const explicit = normalized(env.SHODHFUND_DEPLOYMENT_ENV);
  if (KNOWN_DEPLOYMENT_ENVIRONMENTS.has(explicit)) return explicit;

  const nodeEnvironment = normalized(env.NODE_ENV);
  if (KNOWN_DEPLOYMENT_ENVIRONMENTS.has(nodeEnvironment)) return nodeEnvironment;
  return 'development';
}

function publicReadinessPayload(env = process.env) {
  return {
    status: 'ok',
    service: 'shodhfund-api',
    environment: deploymentEnvironment(env)
  };
}

module.exports = {
  KNOWN_DEPLOYMENT_ENVIRONMENTS,
  deploymentEnvironment,
  publicReadinessPayload
};
