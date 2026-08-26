'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;

function randomOtp() {
  // Crypto-secure 6-digit OTP
  const num = crypto.randomInt(0, 1_000_000);
  return String(num).padStart(OTP_LENGTH, '0');
}

async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

async function verifyHash(code, hash) {
  return bcrypt.compare(code, hash);
}

function isExpired(record) {
  return !record?.expiresAt || new Date(record.expiresAt).getTime() < Date.now();
}

function canResend(record) {
  if (!record?.lastSentAt) return true;
  return Date.now() - new Date(record.lastSentAt).getTime() >= OTP_RESEND_COOLDOWN_MS;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePurpose(purpose) {
  const p = String(purpose || '').trim().toUpperCase();
  if (['REGISTRATION', 'PASSWORD_RESET'].includes(p)) return p;
  return null;
}

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  randomOtp,
  hashOtp,
  verifyHash,
  isExpired,
  canResend,
  normalizeEmail,
  validatePurpose
};
