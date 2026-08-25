'use strict';

const RETRYABLE_CODES = new Set(['RATE_LIMIT', 'TIMEOUT', 'UNAVAILABLE']);

function limitedRequestId(value) {
  const requestId = typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId) ? requestId : null;
}

function errorText(payload) {
  const error = payload && typeof payload === 'object' ? payload.error : null;
  if (typeof error === 'string') return error.slice(0, 500);
  if (!error || typeof error !== 'object') return '';
  return [error.code, error.status, error.message]
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .slice(0, 500);
}

function classifyProviderError({ status, payload, timedOut = false, networkError = false }) {
  if (timedOut || status === 408 || status === 504) return 'TIMEOUT';
  if (networkError) return 'UNAVAILABLE';

  const text = errorText(payload).toLowerCase();
  if (status === 401 || text.includes('api_key_invalid') || text.includes('api key not valid')) {
    return 'INVALID_KEY';
  }
  if (status === 403) return 'PERMISSION';
  if (status === 404 || text.includes('model_not_found') || text.includes('model not found')) {
    return 'MODEL_NOT_FOUND';
  }
  if (status === 429) {
    return text.includes('quota') ? 'QUOTA' : 'RATE_LIMIT';
  }
  if (status >= 500) return 'UNAVAILABLE';
  if (status === 400) return 'INVALID_REQUEST';
  return 'UNAVAILABLE';
}

function sanitizedMessage(code) {
  const messages = {
    NOT_CONFIGURED: 'No live AI provider is configured.',
    CIRCUIT_OPEN: 'The live AI provider is temporarily paused after repeated failures.',
    INVALID_KEY: 'The AI provider rejected its server credential.',
    PERMISSION: 'The AI provider credential lacks permission.',
    RATE_LIMIT: 'The AI provider rate limit was reached.',
    QUOTA: 'The AI provider quota is unavailable.',
    MODEL_NOT_FOUND: 'The configured AI model is unavailable.',
    SAFETY_BLOCK: 'The AI provider blocked this request.',
    TIMEOUT: 'The AI provider request timed out.',
    INVALID_REQUEST: 'The AI provider rejected the request.',
    MALFORMED_RESPONSE: 'The AI provider returned an unusable response.',
    UNAVAILABLE: 'The AI provider is temporarily unavailable.'
  };
  return messages[code] || messages.UNAVAILABLE;
}

function failure({ provider = 'gemini', model, code, httpStatus = 503, latencyMs = 0, requestId }) {
  return {
    ok: false,
    provider,
    model,
    code,
    retryable: RETRYABLE_CODES.has(code),
    httpStatus,
    sanitizedMessage: sanitizedMessage(code),
    latencyMs,
    requestId: limitedRequestId(requestId)
  };
}

module.exports = {
  RETRYABLE_CODES,
  classifyProviderError,
  errorText,
  failure,
  limitedRequestId,
  sanitizedMessage
};
