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

function config({ provider, endpoint, accessKeyId, secretAccessKey, bucket, region, forcePathStyle, missing }) {
  return {
    provider,
    endpoint: text(endpoint).replace(/\/$/, ''),
    accessKeyId: text(accessKeyId),
    secretAccessKey: text(secretAccessKey),
    bucket: text(bucket),
    region: text(region),
    forcePathStyle: Boolean(forcePathStyle),
    missing
  };
}

function finalizeConfig(value) {
  const missing = value.missing.filter((key) => !value[key]);
  return { ...value, configured: missing.length === 0, missing };
}

function renameMissing(value, names) {
  return {
    ...value,
    missing: value.missing.map((field) => names[field] || field)
  };
}

function readR2Config(env = process.env) {
  return renameMissing(finalizeConfig(config({
    provider: 'cloudflare-r2',
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    region: env.R2_REGION || 'auto',
    forcePathStyle: false,
    missing: ['endpoint', 'accessKeyId', 'secretAccessKey', 'bucket']
  })), {
    endpoint: 'R2_ENDPOINT',
    accessKeyId: 'R2_ACCESS_KEY_ID',
    secretAccessKey: 'R2_SECRET_ACCESS_KEY',
    bucket: 'R2_BUCKET'
  });
}

function readB2Config(env = process.env) {
  return renameMissing(finalizeConfig(config({
    provider: 'backblaze-b2',
    endpoint: env.B2_ENDPOINT,
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    bucket: env.B2_BUCKET,
    region: env.B2_REGION,
    // Backblaze documents its S3-compatible API with path-style requests.
    forcePathStyle: true,
    missing: ['endpoint', 'accessKeyId', 'secretAccessKey', 'bucket', 'region']
  })), {
    endpoint: 'B2_ENDPOINT',
    accessKeyId: 'B2_KEY_ID',
    secretAccessKey: 'B2_APPLICATION_KEY',
    bucket: 'B2_BUCKET',
    region: 'B2_REGION'
  });
}

function readObjectStorageConfig(env = process.env) {
  const selected = text(env.OBJECT_STORAGE_PROVIDER).toLowerCase();
  if (['backblaze-b2', 'b2'].includes(selected)) return readB2Config(env);
  if (['cloudflare-r2', 'r2'].includes(selected)) return readR2Config(env);

  // Preserve R2 compatibility, while allowing an explicitly configured B2 setup
  // to work without any R2 values.
  const b2 = readB2Config(env);
  if (b2.configured) return b2;
  const r2 = readR2Config(env);
  if (r2.configured) return r2;
  return selected ? { ...b2, provider: selected } : r2;
}

function createObjectStorage(env = process.env, dependencies = {}) {
  const storageConfig = readObjectStorageConfig(env);
  if (!storageConfig.configured) return null;

  const Client = dependencies.S3Client || S3Client;
  const client = dependencies.client || new Client({
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
    forcePathStyle: storageConfig.forcePathStyle,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey
    }
  });
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

/** In-memory adapter used only by isolated integration tests. */
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
  readR2Config
};
