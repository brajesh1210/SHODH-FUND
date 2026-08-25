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

function readR2Config(env = process.env) {
  const endpoint = text(env.R2_ENDPOINT).replace(/\/$/, '');
  const accessKeyId = text(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = text(env.R2_SECRET_ACCESS_KEY);
  const bucket = text(env.R2_BUCKET);
  const region = text(env.R2_REGION) || 'auto';
  const missing = [
    !endpoint && 'R2_ENDPOINT',
    !accessKeyId && 'R2_ACCESS_KEY_ID',
    !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
    !bucket && 'R2_BUCKET'
  ].filter(Boolean);

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
    configured: missing.length === 0,
    missing
  };
}

function createR2Storage(env = process.env, dependencies = {}) {
  const config = readR2Config(env);
  if (!config.configured) return null;

  const Client = dependencies.S3Client || S3Client;
  const client = dependencies.client || new Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  const Put = dependencies.PutObjectCommand || PutObjectCommand;
  const Get = dependencies.GetObjectCommand || GetObjectCommand;
  const Delete = dependencies.DeleteObjectCommand || DeleteObjectCommand;

  return {
    configured: true,
    kind: 'r2',
    async put({ key, body, contentType, metadata }) {
      await client.send(new Put({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata
      }));
    },
    async get(key) {
      const response = await client.send(new Get({ Bucket: config.bucket, Key: key }));
      if (!response.Body) throw new Error('Stored document had no readable body.');
      return {
        body: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: Number(response.ContentLength) || undefined
      };
    },
    async remove(key) {
      await client.send(new Delete({ Bucket: config.bucket, Key: key }));
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
  createR2Storage,
  readR2Config
};
