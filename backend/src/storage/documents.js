'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
});

function detectBillMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function extensionForMime(mimeType) {
  return Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mimeType)?.[0] || 'bin';
}

function safeOriginalName(value, mimeType) {
  const fallback = `bill.${extensionForMime(mimeType)}`;
  const name = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  if (!name) return fallback;

  const extension = path.extname(name).replace(/^\./, '').toLowerCase();
  return MIME_BY_EXTENSION[extension] === mimeType ? name : `${name}.${extensionForMime(mimeType)}`;
}

function validateBillFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('Choose a PDF, JPG, PNG, or WebP bill to attach.');
    error.status = 400;
    throw error;
  }
  if (file.buffer.length === 0) {
    const error = new Error('The selected bill file is empty.');
    error.status = 400;
    throw error;
  }
  if (file.buffer.length > MAX_DOCUMENT_BYTES) {
    const error = new Error('Bill files must be 8 MB or smaller.');
    error.status = 413;
    throw error;
  }

  const mimeType = detectBillMime(file.buffer);
  if (!mimeType) {
    const error = new Error('The uploaded file is not a supported PDF, JPG, PNG, or WebP bill.');
    error.status = 400;
    throw error;
  }

  return {
    buffer: file.buffer,
    mimeType,
    originalName: safeOriginalName(file.originalname, mimeType),
    sizeBytes: file.buffer.length,
    sha256: crypto.createHash('sha256').update(file.buffer).digest('hex')
  };
}

function storageKey({ expenseId, documentId, mimeType }) {
  const extension = extensionForMime(mimeType);
  const safeExpense = String(expenseId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDocument = String(documentId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeExpense || !safeDocument) throw new Error('A valid expense and document ID are required.');
  return `expense-documents/${safeExpense}/${safeDocument}.${extension}`;
}

function safeDownloadName(value) {
  return safeOriginalName(value, MIME_BY_EXTENSION[path.extname(String(value || '')).replace(/^\./, '').toLowerCase()] || 'application/pdf')
    .replace(/[\r\n]/g, ' ');
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  detectBillMime,
  extensionForMime,
  safeDownloadName,
  safeOriginalName,
  storageKey,
  validateBillFile
};
