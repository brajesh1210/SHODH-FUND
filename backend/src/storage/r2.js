'use strict';

// Backwards-compatible module path. New code uses object-storage.js, which
// supports private Cloudflare R2 and Backblaze B2 S3-compatible endpoints.
module.exports = require('./object-storage');
