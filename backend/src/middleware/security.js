'use strict';

function securityHeaders() {
  return (req, res, next) => {
    // Basic security headers without external dependency
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // HSTS only in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // No cache for API
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    next();
  };
}

function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    const id = req.headers['x-request-id'] || '-';
    res.on('finish', () => {
      const duration = Date.now() - start;
      // Structured log without secrets
      const log = {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        requestId: id,
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
      };
      if (res.statusCode >= 400) {
        console.warn(JSON.stringify({ level: 'warn', ...log }));
      }
    });
    next();
  };
}

module.exports = { securityHeaders, requestLogger };
