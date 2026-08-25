'use strict';

const { readAiConfig } = require('./config');
const { builtInAssistantReply } = require('./guidance');
const { buildAssistantRequest, buildProbeRequest } = require('./prompts');
const { GeminiProvider } = require('./providers/gemini');
const { retrieveAuthorizedRecords } = require('./retrieval');

function looksRecordSpecific(message) {
  return /\b(my|our|record|grant|expense|budget|balance|milestone|utili[sz]ation certificate|uc|anomal|pending|spent|remaining|GR-[A-Z0-9-]+|EXP-[A-Z0-9-]+)\b/i.test(String(message || ''));
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .slice(-6);
}

function uniqueLinks(links) {
  const seen = new Set();
  return (Array.isArray(links) ? links : []).filter((link) => {
    const key = link?.href || '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicFailure(providerFailure) {
  return {
    code: 'AI_PROVIDER_UNAVAILABLE',
    message: 'Live AI and built-in guidance are currently unavailable. Please try again later.',
    providerCode: providerFailure?.code || 'NOT_CONFIGURED',
    retryable: Boolean(providerFailure?.retryable)
  };
}

function createAIService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  now = Date.now,
  sleepImpl,
  random
} = {}) {
  const config = readAiConfig(env);
  const providers = new Map();
  providers.set('gemini', new GeminiProvider({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    fetchImpl,
    logger,
    now,
    ...(sleepImpl ? { sleepImpl } : {}),
    ...(random ? { random } : {})
  }));

  let probeCache = null;
  let probeInFlight = null;
  let lastProbeStartedAt = Number.NEGATIVE_INFINITY;

  async function generate(request, requestId) {
    let lastFailure = null;
    for (const providerName of config.providerOrder) {
      const provider = providers.get(providerName);
      if (!provider) continue;
      const result = await provider.generate({ ...request, requestId });
      if (result.ok) return result;
      lastFailure = result;
      if (['SAFETY_BLOCK', 'INVALID_REQUEST'].includes(result.code)) break;
    }
    return lastFailure || {
      ok: false,
      code: 'NOT_CONFIGURED',
      provider: null,
      model: null,
      retryable: false,
      sanitizedMessage: 'No live AI provider is configured.'
    };
  }

  async function answer({ message, page, history, user = null, prisma = null, requestId = null }) {
    let recordResult = null;
    if (config.recordContextEnabled && user && prisma && looksRecordSpecific(message)) {
      recordResult = await retrieveAuthorizedRecords({ prisma, user, message });
      recordResult.links = uniqueLinks(recordResult.links);
    }

    const recentHistory = cleanHistory(history);
    const latestHistoryItem = recentHistory[recentHistory.length - 1];
    if (latestHistoryItem?.role === 'user' && latestHistoryItem.content.trim() === message.trim()) {
      recentHistory.pop();
    }
    const request = buildAssistantRequest({
      message,
      page,
      history: recentHistory,
      recordContext: recordResult?.context || null
    });
    const providerResult = await generate(request, requestId);

    if (providerResult.ok) {
      return {
        status: 200,
        body: {
          answer: providerResult.text,
          mode: 'live-ai',
          source: 'Gemini',
          provider: providerResult.provider,
          model: providerResult.model,
          requestId: providerResult.requestId,
          records: recordResult ? { answer: recordResult.answer, links: recordResult.links, intent: recordResult.intent } : null
        }
      };
    }

    if (config.builtInGuidanceEnabled) {
      return {
        status: 200,
        body: {
          answer: builtInAssistantReply(message, recordResult, Boolean(user)),
          mode: 'built-in-guidance',
          source: recordResult ? 'Authorized ShodhFund records' : 'Built-in ShodhFund guidance',
          provider: null,
          model: null,
          providerStatus: providerResult.code,
          records: recordResult ? { answer: recordResult.answer, links: recordResult.links, intent: recordResult.intent } : null
        }
      };
    }

    return { status: 503, body: publicFailure(providerResult) };
  }

  async function askRecords({ prisma, user, question }) {
    const result = await retrieveAuthorizedRecords({ prisma, user, message: question });
    const links = uniqueLinks(result.links);
    return {
      answer: result.answer,
      mode: 'record-data',
      source: 'Authorized ShodhFund records',
      intent: result.intent,
      links,
      results: links
    };
  }

  function status() {
    return {
      providerOrder: [...config.providerOrder],
      builtInGuidanceEnabled: config.builtInGuidanceEnabled,
      externalRecordContextEnabled: config.recordContextEnabled,
      providers: [...providers.values()].map((provider) => ({
        ...provider.status(),
        enabled: config.providerOrder.includes(provider.name)
      })),
      checkedAt: new Date(now()).toISOString(),
      note: 'Configuration and last-attempt state only. This endpoint does not call an external provider.'
    };
  }

  async function probe(requestId = null) {
    const current = now();
    if (probeCache && current - probeCache.at < config.probeCacheMs) {
      return { ...probeCache.value, cached: true };
    }
    if (probeInFlight) return probeInFlight;
    if (current - lastProbeStartedAt < Math.min(config.probeCacheMs, 30_000)) {
      return {
        ok: false,
        code: 'PROBE_RATE_LIMITED',
        message: 'A provider probe ran recently. Wait before trying again.',
        cached: false
      };
    }

    lastProbeStartedAt = current;
    probeInFlight = (async () => {
      const result = await generate(buildProbeRequest(), requestId);
      const value = result.ok
        ? {
            ok: true,
            provider: result.provider,
            model: result.model,
            latencyMs: result.latencyMs,
            requestId: result.requestId,
            cached: false,
            checkedAt: new Date(now()).toISOString()
          }
        : {
            ok: false,
            provider: result.provider || null,
            model: result.model || null,
            code: result.code,
            retryable: Boolean(result.retryable),
            message: result.sanitizedMessage,
            cached: false,
            checkedAt: new Date(now()).toISOString()
          };
      probeCache = { at: now(), value };
      return value;
    })();

    try {
      return await probeInFlight;
    } finally {
      probeInFlight = null;
    }
  }

  return { answer, askRecords, config, probe, providers, status };
}

module.exports = {
  cleanHistory,
  createAIService,
  looksRecordSpecific,
  publicFailure
};
