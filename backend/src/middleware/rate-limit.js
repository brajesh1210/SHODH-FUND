'use strict';

// Simple in-memory rate limiter for free tier (not distributed)
// For production multi-instance, use Redis store later
function createRateLimiter({ windowMs, max, message }) {
  const store = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    store.set(key, entry);

    // Cleanup old entries periodically
    if (store.size > 1000 && Math.random() < 0.01) {
      for (const [k, v] of store.entries()) {
        if (now > v.resetAt) store.delete(k);
      }
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message || 'Too many requests. Try again later.' });
    }
    next();
  };
}

const limiters = {
  // Strict for auth
  login: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again in 15 minutes.' }),
  otp: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many OTP requests. Try again later.' }),
  // Moderate for AI
  chat: createRateLimiter({ windowMs: 60 * 1000, max: 15, message: 'Too many AI requests. Slow down.' }),
  ask: createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many record queries.' }),
  // Light for exports
  export: createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many export requests.' }),
  // Upload
  upload: createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many uploads. Try again later.' })
};

module.exports = { createRateLimiter, limiters };
