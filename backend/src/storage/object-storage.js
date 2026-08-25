'use strict';

const { Readable } = require('node:stream');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} = require('@aws-sdk/client-s3');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripQuotes(value) {
  const t = text(value);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function normalizeEndpoint(value) {
  let endpoint = stripQuotes(value).replace(/\/+$/, '');
  if (!endpoint) return '';
  if (!/^https?:\/\//i.test(endpoint)) {
    endpoint = `https://${endpoint}`;
  }
  return endpoint;
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function config({ provider, endpoint, accessKeyId, secretAccessKey, bucket, region, forcePathStyle, missing }) {
  return {
    provider,
    endpoint: normalizeEndpoint(endpoint),
    accessKeyId: stripQuotes(accessKeyId),
    secretAccessKey: stripQuotes(secretAccessKey),
    bucket: stripQuotes(bucket),
    region: stripQuotes(region),
    forcePathStyle: Boolean(forcePathStyle),
    missing
  };
}

function finalizeConfig(value) {
  const missing = value.missing.filter((key) => !value[key]);
  let configured = missing.length === 0;
  let invalidEndpoint = null;
  if (configured && !isValidHttpUrl(value.endpoint)) {
    configured = false;
    invalidEndpoint = `Invalid endpoint URL for ${value.provider}: ${value.endpoint || '(empty)'}. Expected https://s3.<region>.backblazeb2.com`;
  }
  return { ...value, configured, missing, invalidEndpoint };
}

function renameMissing(value, names) {
  return {
    ...value,
    missing: value.missing.map((field) => names[field] || field)
  };
}

function readR2Config(env = process.env) {
  const cfg = finalizeConfig(config({
    provider: 'cloudflare-r2',
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    region: env.R2_REGION || 'auto',
    forcePathStyle: false,
    missing: ['endpoint', 'accessKeyId', 'secretAccessKey', 'bucket']
  }));
  return renameMissing(cfg, {
    endpoint: 'R2_ENDPOINT',
    accessKeyId: 'R2_ACCESS_KEY_ID',
    secretAccessKey: 'R2_SECRET_ACCESS_KEY',
    bucket: 'R2_BUCKET'
  });
}

function readB2Config(env = process.env) {
  const cfg = finalizeConfig(config({
    provider: 'backblaze-b2',
    endpoint: env.B2_ENDPOINT,
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    bucket: env.B2_BUCKET,
    region: env.B2_REGION,
    forcePathStyle: true,
    missing: ['endpoint', 'accessKeyId', 'secretAccessKey', 'bucket', 'region']
  }));
  return renameMissing(cfg, {
    endpoint: 'B2_ENDPOINT',
    accessKeyId: 'B2_KEY_ID',
    secretAccessKey: 'B2_APPLICATION_KEY',
    bucket: 'B2_BUCKET',
    region: 'B2_REGION'
  });
}

function readObjectStorageConfig(env = process.env) {
  const selected = stripQuotes(env.OBJECT_STORAGE_PROVIDER).toLowerCase();
  if (['backblaze-b2', 'b2'].includes(selected)) return readB2Config(env);
  if (['cloudflare-r2', 'r2'].includes(selected)) return readR2Config(env);
  const b2 = readB2Config(env);
  if (b2.configured) return b2;
  if (b2.invalidEndpoint) return b2;
  const r2 = readR2Config(env);
  if (r2.configured) return r2;
  if (r2.invalidEndpoint) return r2;
  return selected ? { ...b2, provider: selected } : r2;
}

function createObjectStorage(env = process.env, dependencies = {}) {
  const storageConfig = readObjectStorageConfig(env);
  if (storageConfig.invalidEndpoint) {
    return {
      configured: false,
      kind: storageConfig.provider,
      invalidEndpoint: storageConfig.invalidEndpoint,
      async put() {
        const err = new Error(storageConfig.invalidEndpoint);
        err.code = 'INVALID_ENDPOINT';
        throw err;
      },
      async get() {
        const err = new Error(storageConfig.invalidEndpoint);
        err.code = 'INVALID_ENDPOINT';
        throw err;
      },
      async remove() {
        const err = new Error(storageConfig.invalidEndpoint);
        err.code = 'INVALID_ENDPOINT';
        throw err;
      }
    };
  }
  if (!storageConfig.configured) return null;
  const Client = dependencies.S3Client || S3Client;
  const clientOptions = {
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
    forcePathStyle: storageConfig.forcePathStyle,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey
    }
  };
  if (storageConfig.provider === 'backblaze-b2') {
    clientOptions.requestChecksumCalculation = 'WHEN_REQUIRED';
    clientOptions.responseChecksumValidation = 'WHEN_REQUIRED';
  }
  const client = dependencies.client || new Client(clientOptions);
  const Put = dependencies.PutObjectCommand || PutObjectCommand;
  const Get = dependencies.GetObjectCommand || GetObjectCommand;
  const Delete = dependencies.DeleteObjectCommand || DeleteObjectCommand;
  return {
    configured: true,
    kind: storageConfig.provider,
    async put({ key, body, contentType, metadata }) {
      await client.send(new Put({
        Bucket: storageConfig.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata
      }));
    },
    async get(key) {
      const response = await client.send(new Get({ Bucket: storageConfig.bucket, Key: key }));
      if (!response.Body) throw new Error('Stored document had no readable body.');
      return {
        body: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: Number(response.ContentLength) || undefined
      };
    },
    async remove(key) {
      await client.send(new Delete({ Bucket: storageConfig.bucket, Key: key }));
    }
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    configured: true,
    kind: 'memory',
    async put({ key, body, contentType, metadata }) {
      values.set(key, {
        body: Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body || ''),
        contentType,
        metadata: { ...metadata }
      });
    },
    async get(key) {
      const item = values.get(key);
      if (!item) {
        const error = new Error('Stored document was not found.');
        error.code = 'NoSuchKey';
        throw error;
      }
      return {
        body: Readable.from([item.body]),
        contentType: item.contentType,
        contentLength: item.body.length
      };
    },
    async remove(key) {
      values.delete(key);
    },
    count() {
      return values.size;
    }
  };
}

module.exports = {
  createMemoryStorage,
  createObjectStorage,
  readB2Config,
  readObjectStorageConfig,
  readR2Config,
  normalizeEndpoint,
  isValidHttpUrl
};
