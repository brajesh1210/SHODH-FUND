
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createMemoryStorage, readB2Config, readR2Config } = require('../src/storage/object-storage');
const {
  MAX_DOCUMENT_BYTES,
  detectBillMime,
  safeOriginalName,
  storageKey,
  validateBillFile
} = require('../src/storage/documents');

test('R2 configuration stays disabled until every server-only setting exists', () => {
  const absent = readR2Config({});
  assert.equal(absent.configured, false);
  assert.deepEqual(absent.missing, [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET'
  ]);

  const configured = readR2Config({
    R2_ENDPOINT: 'https://abc.r2.cloudflarestorage.com/',
    R2_ACCESS_KEY_ID: 'id',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'shodhfund-bills',
    R2_REGION: 'auto'
  });
  assert.equal(configured.configured, true);
  assert.equal(configured.endpoint, 'https://abc.r2.cloudflarestorage.com');
  assert.ok(!JSON.stringify({ endpoint: configured.endpoint, bucket: configured.bucket }).includes('secret'));
});

test('only supported bill magic bytes and bounded file sizes are accepted', () => {
  const pdf = Buffer.from('%PDF-1.7\nexample');
  assert.equal(detectBillMime(pdf), 'application/pdf');
  const validated = validateBillFile({ buffer: pdf, originalname: 'receipt.PDF' });
  assert.equal(validated.mimeType, 'application/pdf');
  assert.equal(validated.originalName, 'receipt.PDF');
  assert.match(validated.sha256, /^[a-f0-9]{64}$/);

  assert.throws(
    () => validateBillFile({ buffer: Buffer.from('fake'), originalname: 'fake.pdf' }),
    /not a supported/
  );
  assert.throws(
    () => validateBillFile({ buffer: Buffer.alloc(MAX_DOCUMENT_BYTES + 1), originalname: 'large.pdf' }),
    /8 MB/
  );
  assert.equal(safeOriginalName('unsafe<>name', 'application/pdf'), 'unsafe--name.pdf');
  assert.equal(storageKey({ expenseId: 'EXP-1', documentId: 'doc_1', mimeType: 'application/pdf' }), 'expense-documents/EXP-1/doc_1.pdf');
});

test('in-memory object storage preserves bytes only for isolated tests', async () => {
  const storage = createMemoryStorage();
  await storage.put({ key: 'x.pdf', body: Buffer.from('bytes'), contentType: 'application/pdf', metadata: { sha256: 'x' } });
  const got = await storage.get('x.pdf');
  const chunks = [];
  for await (const chunk of got.body) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), Buffer.from('bytes'));
  assert.equal(got.contentType, 'application/pdf');
  await storage.remove('x.pdf');
  await assert.rejects(() => storage.get('x.pdf'), (error) => error?.code === 'NoSuchKey');
});

test('Backblaze B2 uses its S3 endpoint, key ID, application key, bucket and region', () => {
  const b2 = readB2Config({
    B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
    B2_KEY_ID: 'b2-key-id',
    B2_APPLICATION_KEY: 'b2-application-secret',
    B2_BUCKET: 'shodhfund-staging-bills',
    B2_REGION: 'us-west-004'
  });
  assert.equal(b2.configured, true);
  assert.equal(b2.provider, 'backblaze-b2');
  assert.equal(b2.forcePathStyle, true);
  assert.ok(!JSON.stringify({ endpoint: b2.endpoint, bucket: b2.bucket }).includes('application-secret'));
});

