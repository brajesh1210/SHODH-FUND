'use strict';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const KNOWN_PROVIDERS = new Set(['gemini']);

function booleanValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function integerValue(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function modelValue(value) {
  const model = String(value || DEFAULT_MODEL).trim();
  return /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(model) ? model : DEFAULT_MODEL;
}

function providerOrder(value) {
  const names = String(value ?? 'gemini')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name, index, all) => KNOWN_PROVIDERS.has(name) && all.indexOf(name) === index);
  return names;
}

function readAiConfig(env = process.env) {
  const geminiKey = String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  return Object.freeze({
    providerOrder: providerOrder(env.AI_PROVIDER_ORDER),
    timeoutMs: integerValue(env.AI_TIMEOUT_MS, 15_000, 1_000, 25_000),
    maxRetries: integerValue(env.AI_MAX_RETRIES, 2, 0, 3),
    probeCacheMs: integerValue(env.AI_PROBE_CACHE_SECONDS, 300, 60, 3600) * 1000,
    builtInGuidanceEnabled: booleanValue(env.AI_BUILTIN_GUIDANCE_ENABLED, true),
    // Record data is not sent to an external provider unless explicitly approved.
    recordContextEnabled: booleanValue(env.AI_RECORD_CONTEXT_ENABLED, false),
    gemini: Object.freeze({
      apiKey: geminiKey,
      configured: Boolean(geminiKey),
      model: modelValue(env.GEMINI_MODEL)
    })
  });
}

module.exports = {
  DEFAULT_MODEL,
  booleanValue,
  integerValue,
  modelValue,
  providerOrder,
  readAiConfig
};
