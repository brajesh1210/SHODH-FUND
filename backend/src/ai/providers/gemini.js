'use strict';

const { classifyProviderError, failure, limitedRequestId } = require('../errors');

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const SAFETY_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'PROHIBITED_CONTENT',
  'SPII',
  'BLOCKLIST',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'CONTENT_BLOCKED'
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(5_000, seconds * 1_000));
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, Math.min(5_000, date - Date.now()));
}

function responseRequestId(response) {
  return limitedRequestId(
    response.headers?.get?.('x-request-id') ||
    response.headers?.get?.('x-goog-request-id') ||
    response.headers?.get?.('x-cloud-trace-context')
  );
}

function blockedReason(data) {
  const promptReason = String(data?.promptFeedback?.blockReason || '').toUpperCase();
  if (promptReason && promptReason !== 'BLOCK_REASON_UNSPECIFIED') return promptReason;
  const finishReason = String(data?.candidates?.[0]?.finishReason || '').toUpperCase();
  return SAFETY_REASONS.has(finishReason) ? finishReason : '';
}

function responseText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function responseMetadata(data) {
  return {
    finishReason: String(data?.candidates?.[0]?.finishReason || 'UNSPECIFIED').slice(0, 80),
    modelVersion: typeof data?.modelVersion === 'string' ? data.modelVersion.slice(0, 120) : null,
    responseId: limitedRequestId(data?.responseId)
  };
}

function usage(data) {
  const metadata = data?.usageMetadata || {};
  return {
    inputTokens: Number(metadata.promptTokenCount) || 0,
    outputTokens: Number(metadata.candidatesTokenCount) || 0,
    totalTokens: Number(metadata.totalTokenCount) || 0
  };
}

class GeminiProvider {
  constructor({
    apiKey,
    model,
    timeoutMs,
    maxRetries,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    random = Math.random,
    now = Date.now,
    logger = console,
    circuitThreshold = 3,
    circuitResetMs = 30_000
  }) {
    this.name = 'gemini';
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.fetchImpl = fetchImpl;
    this.sleepImpl = sleepImpl;
    this.random = random;
    this.now = now;
    this.logger = logger;
    this.circuitThreshold = circuitThreshold;
    this.circuitResetMs = circuitResetMs;
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastAttempt = null;
    this.lastSuccess = null;
    this.lastFailure = null;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  status() {
    const now = this.now();
    return {
      provider: this.name,
      configured: this.configured,
      model: this.model,
      state: !this.configured
        ? 'not-configured'
        : this.openUntil > now
          ? 'circuit-open'
          : this.lastSuccess
            ? 'available-at-last-attempt'
            : this.lastFailure
              ? 'failed-at-last-attempt'
              : 'not-probed',
      lastAttempt: this.lastAttempt,
      lastSuccess: this.lastSuccess,
      lastFailure: this.lastFailure,
      circuitOpenUntil: this.openUntil > now ? new Date(this.openUntil).toISOString() : null
    };
  }

  log(result) {
    const payload = {
      event: 'ai_provider_request',
      provider: result.provider,
      model: result.model,
      ok: result.ok,
      code: result.ok ? 'SUCCESS' : result.code,
      latencyMs: result.latencyMs,
      requestId: result.requestId || null
    };
    const method = result.ok ? 'info' : 'warn';
    this.logger?.[method]?.(JSON.stringify(payload));
  }

  remember(result) {
    const timestamp = new Date(this.now()).toISOString();
    this.lastAttempt = {
      ok: result.ok,
      code: result.ok ? 'SUCCESS' : result.code,
      latencyMs: result.latencyMs,
      requestId: result.requestId || null,
      at: timestamp
    };

    if (result.ok) {
      this.consecutiveFailures = 0;
      this.openUntil = 0;
      this.lastSuccess = { latencyMs: result.latencyMs, requestId: result.requestId || null, at: timestamp };
      return;
    }

    this.lastFailure = { code: result.code, latencyMs: result.latencyMs, requestId: result.requestId || null, at: timestamp };
    if (!['NOT_CONFIGURED', 'SAFETY_BLOCK', 'INVALID_REQUEST'].includes(result.code)) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.circuitThreshold) {
        this.openUntil = this.now() + this.circuitResetMs;
      }
    }
  }

  async generate({ contents, systemInstruction, requestId }) {
    const started = this.now();
    if (!this.configured) {
      return failure({
        provider: this.name,
        model: this.model,
        code: 'NOT_CONFIGURED',
        latencyMs: 0,
        requestId
      });
    }

    if (this.openUntil > this.now()) {
      const result = failure({
        provider: this.name,
        model: this.model,
        code: 'CIRCUIT_OPEN',
        latencyMs: 0,
        requestId
      });
      this.log(result);
      return result;
    }

    const url = `${API_ROOT}/${encodeURIComponent(this.model)}:generateContent`;
    let finalFailure;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const remainingMs = this.timeoutMs - (this.now() - started);
      if (remainingMs <= 0) {
        finalFailure = failure({
          provider: this.name,
          model: this.model,
          code: 'TIMEOUT',
          httpStatus: 504,
          latencyMs: this.now() - started,
          requestId
        });
        break;
      }

      let response;
      let data = null;
      let providerRequestId = null;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 700
            }
          }),
          signal: AbortSignal.timeout(Math.max(1, remainingMs))
        });
        providerRequestId = responseRequestId(response) || limitedRequestId(requestId);
        data = await response.json().catch(() => null);

        if (response.ok) {
          const reason = blockedReason(data);
          if (reason) {
            finalFailure = failure({
              provider: this.name,
              model: this.model,
              code: 'SAFETY_BLOCK',
              httpStatus: 422,
              latencyMs: this.now() - started,
              requestId: providerRequestId
            });
            break;
          }

          const text = responseText(data);
          if (!text) {
            finalFailure = failure({
              provider: this.name,
              model: this.model,
              code: 'MALFORMED_RESPONSE',
              httpStatus: 502,
              latencyMs: this.now() - started,
              requestId: providerRequestId
            });
            break;
          }

          const result = {
            ok: true,
            text,
            provider: this.name,
            model: this.model,
            latencyMs: this.now() - started,
            requestId: providerRequestId,
            metadata: responseMetadata(data),
            usage: usage(data)
          };
          this.remember(result);
          this.log(result);
          return result;
        }

        const code = classifyProviderError({ status: response.status, payload: data });
        finalFailure = failure({
          provider: this.name,
          model: this.model,
          code,
          httpStatus: response.status,
          latencyMs: this.now() - started,
          requestId: providerRequestId
        });

        if (attempt >= this.maxRetries || !RETRYABLE_HTTP.has(response.status) || !finalFailure.retryable) {
          break;
        }

        const serverDelay = retryAfterMs(response);
        const backoff = Math.min(4_000, 300 * (2 ** attempt));
        const jitter = Math.floor(this.random() * 150);
        const delay = Math.max(serverDelay, backoff + jitter);
        if (this.now() - started + delay >= this.timeoutMs) break;
        await this.sleepImpl(delay);
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        finalFailure = failure({
          provider: this.name,
          model: this.model,
          code: classifyProviderError({ status: 0, payload: null, timedOut, networkError: !timedOut }),
          httpStatus: timedOut ? 504 : 503,
          latencyMs: this.now() - started,
          requestId
        });
        if (attempt >= this.maxRetries) break;
        const backoff = Math.min(4_000, 300 * (2 ** attempt));
        const delay = backoff + Math.floor(this.random() * 150);
        if (this.now() - started + delay >= this.timeoutMs) break;
        await this.sleepImpl(delay);
      }
    }

    finalFailure ||= failure({
      provider: this.name,
      model: this.model,
      code: 'UNAVAILABLE',
      latencyMs: this.now() - started,
      requestId
    });
    this.remember(finalFailure);
    this.log(finalFailure);
    return finalFailure;
  }
}

module.exports = {
  API_ROOT,
  GeminiProvider,
  blockedReason,
  responseMetadata,
  responseText,
  retryAfterMs,
  usage
};
