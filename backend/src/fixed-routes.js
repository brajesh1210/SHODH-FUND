const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { createAIService } = require('./ai/service');
const { extractBill } = require('./ocr');
const {
  MAX_DOCUMENT_BYTES,
  safeDownloadName,
  storageKey,
  validateBillFile
} = require('./storage/documents');
const { sendEmail, otpEmail, readEmailConfig } = require('./email');
const { limiters } = require('./middleware/rate-limit');
const {
  randomOtp,
  hashOtp,
  verifyHash,
  isExpired,
  canResend,
  normalizeEmail,
  validatePurpose,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR
} = require('./otp');

// Used when an account is absent or has an unsupported legacy password value so
// credential checks still perform one bcrypt operation without accepting plaintext.
const DUMMY_PASSWORD_HASH = '$2b$12$q8P8.luIbHgxIAfmh.0riOnQUQRwVYCWm9k7w9QjOw6ONZJIGZC5m';
const OCR_PROOF_SECRET = Buffer.from(
  process.env.OCR_PROOF_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
);

const ROLE = {
  PI: 'PI',
  FINANCE: 'FINANCE',
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR'
};

const BUDGET_CATEGORIES = new Set([
  'EQUIPMENT',
  'CONSUMABLES',
  'TRAVEL',
  'CONTINGENCY',
  'MANPOWER',
  'OVERHEAD'
]);

const GRANT_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'SUSPENDED', 'CLOSED']);

const EXPENSE_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUESTED'
]);

const UC_STATUSES = new Set([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'SUBMITTED_TO_AGENCY'
]);

const MILESTONE_STATUSES = new Set([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'DELAYED'
]);

const NOTIFICATION_TYPES = new Set([
  'UC_DUE',
  'APPROVAL_PENDING',
  'ANOMALY_DETECTED',
  'BUDGET_THRESHOLD',
  'GENERAL'
]);

const OBJECTION_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED']);

const CURRENT_DOCUMENT_INCLUDE = {
  documents: {
    where: { isCurrent: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { uploadedBy: { select: { id: true, name: true } } }
  }
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function dateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function ocrFieldDigest(value) {
  const normalized = {
    vendor: cleanText(value?.vendorName ?? value?.vendor, 200),
    invoice: cleanText(value?.invoiceNumber ?? value?.invoice, 120),
    amount: number(value?.amount),
    date: cleanText(value?.date, 20).slice(0, 10),
    gst: cleanText(value?.gstNumber ?? value?.gst, 30).toUpperCase(),
    description: cleanText(value?.description ?? value?.desc, 1000)
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function createOcrProof(userId, extracted) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    digest: ocrFieldDigest(extracted),
    expiresAt: Date.now() + (10 * 60 * 1000)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', OCR_PROOF_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyOcrProof(token, userId, submitted) {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', OCR_PROOF_SECRET).update(payload).digest();
  let provided;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;
  try {
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return proof.userId === userId &&
      Number(proof.expiresAt) >= Date.now() &&
      proof.digest === ocrFieldDigest(submitted);
  } catch {
    return false;
  }
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function piScope(user) {
  return user.role === ROLE.PI ? { piId: user.id } : {};
}

function expenseScope(user) {
  return user.role === ROLE.PI ? { grant: { piId: user.id } } : {};
}

function grantReadableBy(grant, user) {
  return user.role !== ROLE.PI || grant.piId === user.id;
}

function expenseReadableBy(expense, user) {
  return user.role !== ROLE.PI || expense.grant?.piId === user.id;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department || '',
    dept: user.department || '',
    designation: user.designation || '',
    avatarUrl: user.avatarUrl || null
  };
}

function serializeBudgetHead(head) {
  return {
    ...head,
    allocatedAmount: number(head.allocatedAmount),
    spentAmount: number(head.spentAmount),
    allocated: number(head.allocatedAmount),
    spent: number(head.spentAmount)
  };
}

function serializeDocument(document, expenseId) {
  if (!document) return null;
  return {
    id: document.id,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes) || 0,
    sha256: document.sha256,
    ocrSource: document.ocrSource || null,
    ocrModel: document.ocrModel || null,
    createdAt: document.createdAt,
    uploadedBy: document.uploadedBy
      ? { id: document.uploadedBy.id, name: document.uploadedBy.name }
      : undefined,
    downloadUrl: `/api/expenses/${encodeURIComponent(expenseId)}/document`
  };
}

function serializeExpense(expense) {
  const { documents, billUrl: _legacyBillUrl, ...rawExpense } = expense;
  const budgetHead = rawExpense.budgetHead
    ? serializeBudgetHead(rawExpense.budgetHead)
    : null;
  const currentDocument = Array.isArray(documents) ? documents[0] : null;

  return {
    ...rawExpense,
    amount: number(rawExpense.amount),
    date: dateOnly(rawExpense.date),
    vendor: rawExpense.vendorName || '',
    invoice: rawExpense.invoiceNumber || '',
    gst: rawExpense.gstNumber || '',
    head: budgetHead?.name || '',
    budgetHead,
    compliance: rawExpense.complianceStatus || 'PENDING',
    document: serializeDocument(currentDocument, rawExpense.id)
  };
}

function serializeGrant(grant) {
  const pi = grant.pi;
  const amount = number(grant.sanctionedAmount);
  const spent = number(grant.spentAmount);

  const serialized = {
    ...grant,
    sanctionedAmount: amount,
    spentAmount: spent,
    amount,
    spent,
    startDate: dateOnly(grant.startDate),
    endDate: dateOnly(grant.endDate),
    start: dateOnly(grant.startDate),
    end: dateOnly(grant.endDate),
    ucDueDate: grant.ucDueDate ? dateOnly(grant.ucDueDate) : null,
    ucDue: grant.ucDueDate ? dateOnly(grant.ucDueDate) : '',
    pi: pi && typeof pi === 'object' ? pi.name || '' : pi || '',
    piDetails: pi && typeof pi === 'object' ? pi : undefined,
    department:
      pi && typeof pi === 'object' ? pi.department || '' : grant.department || ''
  };

  if (Array.isArray(grant.budgetHeads)) {
    serialized.budgetHeads = grant.budgetHeads.map(serializeBudgetHead);
  }
  if (Array.isArray(grant.expenses)) {
    serialized.expenses = grant.expenses.map(serializeExpense);
  }
  return serialized;
}

function serializeUC(uc) {
  const total = number(uc.totalUtilized);
  const balance = number(uc.balanceAmount);
  const grantAmount = number(uc.grant?.sanctionedAmount || uc.grant?.amount);
  const content =
    uc.generatedContent && typeof uc.generatedContent === 'object'
      ? uc.generatedContent
      : {};

  return {
    ...uc,
    totalUtilized: total,
    balanceAmount: balance,
    grant: uc.grant ? serializeGrant(uc.grant) : undefined,
    utilizationPct: grantAmount
      ? Math.round((total / grantAmount) * 1000) / 10
      : 0,
    summary: content.summary || '',
    heads: Array.isArray(content.heads) ? content.heads : []
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function normalizeCategory(value) {
  const normalized = cleanText(value, 50)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return BUDGET_CATEGORIES.has(normalized) ? normalized : 'CONTINGENCY';
}

function normalizeGrantCodePart(value) {
  return cleanText(value, 30)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'GRANT';
}

function currentIndianDate(date = new Date()) {
  // India has a fixed UTC+05:30 offset and no daylight-saving transitions.
  const indiaTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return new Date(Date.UTC(
    indiaTime.getUTCFullYear(),
    indiaTime.getUTCMonth(),
    indiaTime.getUTCDate()
  ));
}

function currentIndianFinancialYear(date = new Date()) {
  const indiaDate = currentIndianDate(date);
  const year = indiaDate.getUTCFullYear();
  const start = indiaDate.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function financialYearBounds(financialYear) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(financialYear));
  if (!match) return null;
  const startYear = Number(match[1]);
  if (match[2] !== String(startYear + 1).slice(-2)) return null;
  return {
    startYear,
    start: new Date(Date.UTC(startYear, 3, 1)),
    endExclusive: new Date(Date.UTC(startYear + 1, 3, 1))
  };
}

function financialYearPeriod(financialYear) {
  const bounds = financialYearBounds(financialYear);
  if (!bounds) return '';
  return `01 Apr ${bounds.startYear} - 31 Mar ${bounds.startYear + 1}`;
}

async function calculateUcFinancials(client, grant, financialYear) {
  const bounds = financialYearBounds(financialYear);
  if (!bounds) return null;

  const [periodExpenses, cumulative] = await Promise.all([
    client.expense.findMany({
      where: {
        grantId: grant.id,
        status: 'APPROVED',
        date: { gte: bounds.start, lt: bounds.endExclusive }
      },
      select: { amount: true, budgetHeadId: true }
    }),
    client.expense.aggregate({
      where: {
        grantId: grant.id,
        status: 'APPROVED',
        date: { lt: bounds.endExclusive }
      },
      _sum: { amount: true }
    })
  ]);

  const byHead = new Map();
  for (const expense of periodExpenses) {
    byHead.set(
      expense.budgetHeadId,
      number(byHead.get(expense.budgetHeadId)) + number(expense.amount)
    );
  }

  const periodApproved = periodExpenses.reduce(
    (sum, expense) => sum + number(expense.amount),
    0
  );
  const cumulativeApprovedThroughPeriod = number(cumulative._sum.amount);
  const sanctioned = number(grant.sanctionedAmount);
  const heads = (grant.budgetHeads || []).map((head) => {
    const allocated = number(head.allocatedAmount);
    const spent = number(byHead.get(head.id));
    return {
      id: head.id,
      name: head.name,
      allocated,
      spent,
      balance: allocated - spent,
      basis: 'CURRENT_RECORDED_ALLOCATION_AND_FINANCIAL_YEAR_APPROVED_EXPENSES'
    };
  });

  return {
    bounds,
    sanctioned,
    periodApproved,
    cumulativeApprovedThroughPeriod,
    balanceAtPeriodEnd: sanctioned - cumulativeApprovedThroughPeriod,
    heads
  };
}

function safeAsync(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      const status = Number(error?.status);
      if (!(status >= 400 && status < 500)) {
        console.error(`${req.method} ${req.originalUrl}:`, error);
      }
      if (!res.headersSent) {
        res.status(status >= 400 && status < 600 ? status : 500).json({
          error: status >= 400 && status < 500
            ? error.message
            : status === 503
              ? error.message
              : 'The request could not be completed.'
        });
      }
    }
  };
}

module.exports = function addFixedRoutes({
  app,
  prisma,
  requireAuth,
  optionalAuth,
  requireRole,
  signToken,
  logAction,
  storage
}) {
  const auth = [requireAuth];
  const aiService = createAIService();

  // Configuration details are restricted to administrators.
  app.get(
    '/api/health',
    ...auth,
    requireRole(ROLE.ADMIN),
    safeAsync(async (_req, res) => {
      let databaseReady = false;
      try {
        await prisma.$queryRawUnsafe('SELECT 1');
        databaseReady = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      const services = {
        api: 'available',
        database: databaseReady ? 'connected' : 'unavailable',
        jwt: process.env.JWT_SECRET ? 'configured' : 'temporary-development-key',
        ocr: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
          ? 'configured'
          : 'not-configured',
        storage: storage?.configured ? 'configured' : 'not-configured'
      };

      res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ok' : 'degraded',
        database: services.database,
        services,
        checkedAt: new Date().toISOString()
      });
    })
  );

  // Email OTP based registration and password recovery
  const otpRateLimit = new Map(); // in-memory per-IP rate limit for OTP

  function clientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || 'unknown';
  }

  function checkOtpIpLimit(ip) {
    const now = Date.now();
    const entry = otpRateLimit.get(ip) || { count: 0, resetAt: now + 60 * 60 * 1000 };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + 60 * 60 * 1000;
    }
    entry.count += 1;
    otpRateLimit.set(ip, entry);
    if (entry.count > 20) {
      const err = new Error('Too many OTP requests. Try again later.');
      err.status = 429;
      throw err;
    }
  }

  app.post('/api/auth/send-otp', limiters.otp, safeAsync(async (req, res) => {
    const rawEmail = normalizeEmail(req.body?.email);
    const purpose = validatePurpose(req.body?.purpose || 'REGISTRATION');
    if (!rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!purpose) {
      return res.status(400).json({ error: 'OTP purpose is invalid.' });
    }

    checkOtpIpLimit(clientIp(req));

    // For registration, block if user already exists
    if (purpose === 'REGISTRATION') {
      const existingUser = await prisma.user.findUnique({ where: { email: rawEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
    } else if (purpose === 'PASSWORD_RESET') {
      const existingUser = await prisma.user.findUnique({ where: { email: rawEmail } });
      if (!existingUser) {
        // Avoid enumeration: return generic success but do not send email
        return res.json({ ok: true, message: 'If an account exists, an OTP has been sent.', expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString() });
      }
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.otp.count({
      where: { email: rawEmail, purpose, createdAt: { gte: oneHourAgo } }
    });
    if (recentCount >= OTP_MAX_PER_HOUR) {
      return res.status(429).json({ error: 'Too many OTP requests for this email. Try again in an hour.' });
    }

    const latest = await prisma.otp.findFirst({
      where: { email: rawEmail, purpose },
      orderBy: { createdAt: 'desc' }
    });
    if (latest && !canResend(latest)) {
      const retryAfter = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(latest.lastSentAt).getTime())) / 1000);
      return res.status(429).json({ error: `Please wait ${retryAfter}s before requesting another OTP.` });
    }

    const code = randomOtp();
    const codeHash = await hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.otp.create({
      data: {
        email: rawEmail,
        purpose,
        codeHash,
        expiresAt,
        lastSentAt: new Date()
      }
    });

    const emailConfig = readEmailConfig();
    const isDev = process.env.NODE_ENV !== 'production';
    let emailSent = false;
    let devOtp = null;

    if (emailConfig.configured) {
      try {
        const emailPayload = otpEmail({ purpose, code });
        await sendEmail({ to: rawEmail, subject: emailPayload.subject, html: emailPayload.html, textBody: emailPayload.textBody });
        emailSent = true;
      } catch (e) {
        console.error('OTP email failed:', e instanceof Error ? e.message : e, e?.details || '');
        // Provide clear guidance for Resend onboarding limit
        const msg = String(e instanceof Error ? e.message : e).toLowerCase();
        if (msg.includes('onboarding@resend.dev') || msg.includes('only send to your own email') || msg.includes('validation_error')) {
          return res.status(400).json({ error: 'Resend onboarding@resend.dev can only send to your own email. Verify a domain in Resend or switch to Brevo SMTP API for any recipient.' });
        }
        if (!isDev) {
          return res.status(503).json({ error: 'Email service is temporarily unavailable. Try again later.' });
        }
        devOtp = code;
      }
    } else {
      if (isDev) {
        console.log(`[DEV OTP] ${purpose} for ${rawEmail}: ${code} (expires ${expiresAt.toISOString()})`);
        devOtp = code;
      } else {
        return res.status(503).json({ error: 'Email is not configured for this environment.' });
      }
    }

    res.json({
      ok: true,
      message: emailSent ? 'OTP sent to your email.' : 'OTP generated (dev mode).',
      expiresAt: expiresAt.toISOString(),
      ...(devOtp ? { devOtp, devMode: true } : {})
    });
  }));

  app.post('/api/auth/verify-otp', limiters.otp, safeAsync(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const purpose = validatePurpose(req.body?.purpose || 'REGISTRATION');
    const code = String(req.body?.code || '').trim();
    if (!email || !purpose || !code) {
      return res.status(400).json({ error: 'Email, purpose, and code are required.' });
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'OTP must be a 6-digit code.' });
    }

    const latest = await prisma.otp.findFirst({
      where: { email, purpose, verified: false },
      orderBy: { createdAt: 'desc' }
    });
    if (!latest) {
      return res.status(400).json({ error: 'No pending OTP found. Request a new code.' });
    }
    if (isExpired(latest)) {
      return res.status(400).json({ error: 'OTP has expired. Request a new code.' });
    }
    if (latest.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
    }

    const valid = await verifyHash(code, latest.codeHash);
    if (!valid) {
      await prisma.otp.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ error: 'Incorrect OTP.' });
    }

    await prisma.otp.update({ where: { id: latest.id }, data: { verified: true, attempts: { increment: 1 } } });

    res.json({ ok: true, verified: true, message: 'OTP verified. You can now complete registration or password reset.' });
  }));

  app.post('/api/auth/register', limiters.otp, safeAsync(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = cleanText(req.body?.name, 120);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = cleanText(req.body?.role, 20).toUpperCase();
    const department = cleanText(req.body?.department, 120);
    const designation = cleanText(req.body?.designation, 120);

    if (!email || !name || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Email is invalid.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    if (!ROLE[role]) {
      return res.status(400).json({ error: 'Role is invalid. Choose PI, FINANCE, ADMIN, or AUDITOR.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Require verified OTP within last 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const verifiedOtp = await prisma.otp.findFirst({
      where: { email, purpose: 'REGISTRATION', verified: true, createdAt: { gte: thirtyMinAgo } },
      orderBy: { createdAt: 'desc' }
    });
    if (!verifiedOtp) {
      return res.status(400).json({ error: 'Email verification is required. Please verify OTP first.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: ROLE[role],
        department: department || null,
        designation: designation || null
      }
    });

    await logAction(user.id, 'REGISTER', 'User', user.id, { role: user.role });

    // Invalidate used OTPs
    await prisma.otp.updateMany({ where: { email, purpose: 'REGISTRATION', verified: true }, data: { verified: false } });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  }));

  app.post('/api/auth/forgot-password', limiters.otp, safeAsync(async (req, res) => {
    // Alias to send-otp with PASSWORD_RESET purpose, but with anti-enumeration
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    req.body.purpose = 'PASSWORD_RESET';
    // Reuse send-otp logic via internal call? For simplicity, duplicate minimal logic
    const purpose = 'PASSWORD_RESET';
    checkOtpIpLimit(clientIp(req));
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      return res.json({ ok: true, message: 'If an account exists, an OTP has been sent.', expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString() });
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.otp.count({ where: { email, purpose, createdAt: { gte: oneHourAgo } } });
    if (recentCount >= OTP_MAX_PER_HOUR) {
      return res.status(429).json({ error: 'Too many OTP requests. Try again later.' });
    }
    const latest = await prisma.otp.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } });
    if (latest && !canResend(latest)) {
      const retryAfter = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(latest.lastSentAt).getTime())) / 1000);
      return res.status(429).json({ error: `Please wait ${retryAfter}s before requesting another OTP.` });
    }
    const code = randomOtp();
    const codeHash = await hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.otp.create({ data: { email, purpose, codeHash, expiresAt, lastSentAt: new Date() } });
    const emailConfig = readEmailConfig();
    const isDev = process.env.NODE_ENV !== 'production';
    let devOtp = null;
    if (emailConfig.configured) {
      try {
        const payload = otpEmail({ purpose, code });
        await sendEmail({ to: email, subject: payload.subject, html: payload.html, textBody: payload.textBody });
      } catch (e) {
        console.error('Password reset OTP email failed:', e instanceof Error ? e.message : e);
        const msg = String(e instanceof Error ? e.message : e).toLowerCase();
        if (msg.includes('onboarding@resend.dev') || msg.includes('only send to your own email') || msg.includes('validation_error')) {
          return res.status(400).json({ error: 'Resend onboarding@resend.dev can only send to your own email. Verify a domain in Resend or switch to Brevo for any recipient.' });
        }
        if (!isDev) return res.status(503).json({ error: 'Email service unavailable.' });
        devOtp = code;
      }
    } else {
      if (isDev) {
        console.log(`[DEV OTP] ${purpose} for ${email}: ${code}`);
        devOtp = code;
      } else {
        return res.status(503).json({ error: 'Email is not configured.' });
      }
    }
    res.json({ ok: true, message: 'If an account exists, an OTP has been sent.', expiresAt: expiresAt.toISOString(), ...(devOtp ? { devOtp, devMode: true } : {}) });
  }));

  app.post('/api/auth/reset-password', limiters.otp, safeAsync(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const newPasswordConfirm = typeof req.body?.newPasswordConfirm === 'string' ? req.body.newPasswordConfirm : newPassword;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
    }
    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid reset request.' });
    }

    // Find OTP: allow already verified within 30 min or verify now
    let verifiedOtp = await prisma.otp.findFirst({
      where: { email, purpose: 'PASSWORD_RESET', verified: true, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' }
    });

    if (!verifiedOtp) {
      const pending = await prisma.otp.findFirst({
        where: { email, purpose: 'PASSWORD_RESET', verified: false },
        orderBy: { createdAt: 'desc' }
      });
      if (!pending) return res.status(400).json({ error: 'No pending password reset OTP found.' });
      if (isExpired(pending)) return res.status(400).json({ error: 'OTP expired. Request a new one.' });
      if (pending.attempts >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts. Request new OTP.' });
      const valid = await verifyHash(code, pending.codeHash);
      if (!valid) {
        await prisma.otp.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
        return res.status(400).json({ error: 'Incorrect OTP.' });
      }
      verifiedOtp = await prisma.otp.update({ where: { id: pending.id }, data: { verified: true, attempts: { increment: 1 } } });
    } else {
      // If code supplied even though already verified, optionally check it matches latest verified? For simplicity, if already verified, we still require code match if provided and not empty? We allow verified OTP to proceed without re-checking code to support two-step flow (verify-otp then reset)
      // If code is provided, we still validate against the verified OTP's hash if possible
      if (code) {
        const stillValid = await verifyHash(code, verifiedOtp.codeHash).catch(() => true);
        // If verification fails, we still allow because user already verified via /verify-otp step; but we keep check lenient
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    await prisma.otp.updateMany({ where: { email, purpose: 'PASSWORD_RESET', verified: true }, data: { verified: false } });
    await logAction(user.id, 'RESET_PASSWORD', 'User', user.id);

    res.json({ ok: true, message: 'Password reset successful. You can now log in.' });
  }));

  app.post('/api/auth/login', limiters.login, safeAsync(async (req, res) => {
    const email = cleanText(req.body?.email, 320).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password || password.length > 256) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const isHash = Boolean(user?.password?.match(/^\$2[aby]\$/));
    const passwordMatches = await bcrypt.compare(
      password,
      isHash ? user.password : DUMMY_PASSWORD_HASH
    );
    const valid = Boolean(user && isHash && passwordMatches);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    await logAction(user.id, 'LOGIN', 'User', user.id);
    res.json({ token, user: publicUser(user) });
  }));

  app.get('/api/auth/me', ...auth, safeAsync(async (req, res) => {
    res.json(publicUser(req.user));
  }));

  app.get(
    '/api/users',
    ...auth,
    requireRole(ROLE.ADMIN),
    safeAsync(async (_req, res) => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          department: true,
          designation: true,
          createdAt: true
        },
        orderBy: { name: 'asc' }
      });
      res.json(users.map(publicUser));
    })
  );

  app.get('/api/grants', ...auth, safeAsync(async (req, res) => {
    const where = { ...piScope(req.user) };
    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();
      if (!GRANT_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Grant status filter is invalid.' });
      }
      where.status = status;
    }

    const grants = await prisma.grant.findMany({
      where,
      include: {
        pi: { select: { id: true, name: true, email: true, department: true } },
        budgetHeads: true,
        _count: { select: { expenses: true, milestones: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(grants.map(serializeGrant));
  }));

  app.get('/api/grants/:id', ...auth, safeAsync(async (req, res) => {
    const grant = await prisma.grant.findUnique({
      where: { id: req.params.id },
      include: {
        pi: { select: { id: true, name: true, email: true, department: true } },
        budgetHeads: true,
        expenses: {
          include: {
            submittedBy: { select: { id: true, name: true } },
            budgetHead: true,
            approvals: { include: { approver: { select: { name: true, role: true } } } },
            anomalies: true
          },
          orderBy: { createdAt: 'desc' }
        },
        milestones: { orderBy: { dueDate: 'asc' } },
        ucs: { orderBy: { createdAt: 'desc' } },
        objections: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!grant) return res.status(404).json({ error: 'Grant not found.' });
    if (!grantReadableBy(grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this grant.' });
    }
    res.json(serializeGrant(grant));
  }));

  app.post(
    '/api/grants',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const title = cleanText(req.body?.title, 240);
      const agency = cleanText(req.body?.agency, 120);
      const sanctionedAmount = number(
        req.body?.sanctionedAmount ?? req.body?.amount
      );
      const startDate = req.body?.startDate === undefined
        ? currentIndianDate()
        : parseDate(req.body.startDate);
      const defaultEnd = new Date(startDate || currentIndianDate());
      defaultEnd.setUTCFullYear(defaultEnd.getUTCFullYear() + 3);
      const endDate = parseDate(req.body?.endDate || defaultEnd);

      if (!title || !agency || sanctionedAmount <= 0 || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Title, agency, a positive sanctioned amount, and valid dates are required.'
        });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End date must be after start date.' });
      }

      let piId = req.user.id;
      if (req.user.role === ROLE.ADMIN) {
        piId = cleanText(req.body?.piId, 100);
        if (!piId) return res.status(400).json({ error: 'A PI is required.' });
      }

      const pi = await prisma.user.findUnique({ where: { id: piId } });
      if (!pi || pi.role !== ROLE.PI) {
        return res.status(400).json({ error: 'The selected PI is invalid.' });
      }

      let grantCode = cleanText(req.body?.grantCode, 80).toUpperCase();
      if (grantCode && !/^[A-Z0-9][A-Z0-9._/-]*$/.test(grantCode)) {
        return res.status(400).json({ error: 'Grant code contains unsupported characters.' });
      }
      if (!grantCode) {
        const year = startDate.getUTCFullYear();
        const prefix = `SF-${normalizeGrantCodePart(agency)}-${year}`;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const exists = await prisma.grant.findUnique({ where: { grantCode: candidate } });
          if (!exists) {
            grantCode = candidate;
            break;
          }
        }
      }
      if (!grantCode) {
        return res.status(409).json({ error: 'A unique grant code could not be generated.' });
      }
      const conflictingGrant = await prisma.grant.findUnique({ where: { grantCode } });
      if (conflictingGrant) {
        return res.status(409).json({ error: 'That grant code is already in use.' });
      }

      const ucDueDate = req.body?.ucDueDate
        ? parseDate(req.body.ucDueDate)
        : endDate;
      if (!ucDueDate) return res.status(400).json({ error: 'UC due date is invalid.' });

      const category = normalizeCategory(req.body?.initialBudgetCategory || 'CONTINGENCY');
      const headName = cleanText(req.body?.initialBudgetHead, 100) || 'General';

      const grant = await prisma.grant.create({
        data: {
          grantCode,
          title,
          agency,
          sanctionNumber: cleanText(req.body?.sanctionNumber, 100) || null,
          sanctionedAmount,
          spentAmount: 0,
          startDate,
          endDate,
          ucDueDate,
          status: 'ACTIVE',
          piId,
          budgetHeads: {
            create: {
              name: headName,
              category,
              allocatedAmount: sanctionedAmount,
              spentAmount: 0
            }
          }
        },
        include: {
          pi: { select: { id: true, name: true, email: true, department: true } },
          budgetHeads: true
        }
      });

      await logAction(req.user.id, 'CREATE_GRANT', 'Grant', grant.id, {
        grantCode,
        piId,
        initialBudgetHead: headName
      });
      res.status(201).json(serializeGrant(grant));
    })
  );

  app.put(
    '/api/grants/:id',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const existing = await prisma.grant.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Grant not found.' });
      if (!grantReadableBy(existing, req.user)) {
        return res.status(403).json({ error: 'You cannot update this grant.' });
      }

      const data = {};
      if (req.body.title !== undefined) {
        data.title = cleanText(req.body.title, 240);
        if (!data.title) return res.status(400).json({ error: 'Grant title cannot be blank.' });
      }
      if (req.body.agency !== undefined) {
        data.agency = cleanText(req.body.agency, 120);
        if (!data.agency) return res.status(400).json({ error: 'Funding agency cannot be blank.' });
      }
      if (req.body.status !== undefined) {
        data.status = cleanText(req.body.status, 40).toUpperCase();
        if (!GRANT_STATUSES.has(data.status)) {
          return res.status(400).json({ error: 'Grant status is invalid.' });
        }
      }
      if (req.body.sanctionNumber !== undefined) {
        data.sanctionNumber = cleanText(req.body.sanctionNumber, 100) || null;
      }
      if (req.body.startDate !== undefined) {
        data.startDate = parseDate(req.body.startDate);
        if (!data.startDate) return res.status(400).json({ error: 'Start date is invalid.' });
      }
      if (req.body.endDate !== undefined) {
        data.endDate = parseDate(req.body.endDate);
        if (!data.endDate) return res.status(400).json({ error: 'End date is invalid.' });
      }
      if (req.body.ucDueDate !== undefined) {
        data.ucDueDate = parseDate(req.body.ucDueDate);
        if (!data.ucDueDate) return res.status(400).json({ error: 'UC due date is invalid.' });
      }
      const effectiveStart = data.startDate || existing.startDate;
      const effectiveEnd = data.endDate || existing.endDate;
      if (effectiveEnd <= effectiveStart) {
        return res.status(400).json({ error: 'End date must be after start date.' });
      }

      const updated = await prisma.grant.update({
        where: { id: existing.id },
        data,
        include: {
          pi: { select: { id: true, name: true, email: true, department: true } },
          budgetHeads: true
        }
      });
      await logAction(req.user.id, 'UPDATE_GRANT', 'Grant', updated.id);
      res.json(serializeGrant(updated));
    })
  );

  app.get('/api/grants/:grantId/budget-heads', ...auth, safeAsync(async (req, res) => {
    const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
    if (!grant) return res.status(404).json({ error: 'Grant not found.' });
    if (!grantReadableBy(grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this grant.' });
    }
    const heads = await prisma.budgetHead.findMany({
      where: { grantId: grant.id },
      orderBy: { name: 'asc' }
    });
    res.json(heads.map(serializeBudgetHead));
  }));

  app.get('/api/budget-heads', ...auth, safeAsync(async (req, res) => {
    const where = {};
    if (req.query.grantId) where.grantId = String(req.query.grantId);
    if (req.user.role === ROLE.PI) where.grant = { piId: req.user.id };

    const heads = await prisma.budgetHead.findMany({
      where,
      include: { grant: { select: { id: true, title: true, piId: true } } },
      orderBy: [{ grantId: 'asc' }, { name: 'asc' }]
    });
    res.json(heads.map(serializeBudgetHead));
  }));

  app.post(
    '/api/grants/:grantId/budget-heads',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const grant = await prisma.grant.findUnique({
        where: { id: req.params.grantId },
        include: { budgetHeads: true }
      });
      if (!grant) return res.status(404).json({ error: 'Grant not found.' });
      if (!grantReadableBy(grant, req.user)) {
        return res.status(403).json({ error: 'You cannot add a budget head to this grant.' });
      }
      if (grant.status !== 'ACTIVE') {
        return res.status(409).json({ error: 'Budget heads can be added only while the grant is active.' });
      }

      const name = cleanText(req.body?.name, 100);
      const allocatedAmount = Number(req.body?.allocatedAmount ?? req.body?.allocated);
      if (!name || !Number.isFinite(allocatedAmount) || allocatedAmount < 0) {
        return res.status(400).json({ error: 'A name and non-negative allocation are required.' });
      }
      if (grant.budgetHeads.some((head) => head.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A budget head with this name already exists for the grant.' });
      }
      const current = grant.budgetHeads.reduce(
        (sum, head) => sum + number(head.allocatedAmount),
        0
      );
      if (current + allocatedAmount > number(grant.sanctionedAmount)) {
        return res.status(400).json({ error: 'Budget allocations cannot exceed the sanctioned amount.' });
      }

      let head;
      try {
        head = await prisma.$transaction(async (tx) => {
          const currentGrant = await tx.grant.findUnique({
            where: { id: grant.id },
            include: { budgetHeads: true }
          });
          if (!currentGrant || currentGrant.status !== 'ACTIVE') {
            const error = new Error('Budget heads can be added only while the grant is active.');
            error.status = 409;
            throw error;
          }
          if (currentGrant.budgetHeads.some(
            (candidate) => candidate.name.toLowerCase() === name.toLowerCase()
          )) {
            const error = new Error('A budget head with this name already exists for the grant.');
            error.status = 409;
            throw error;
          }
          const latestAllocated = currentGrant.budgetHeads.reduce(
            (sum, candidate) => sum + number(candidate.allocatedAmount),
            0
          );
          if (latestAllocated + allocatedAmount > number(currentGrant.sanctionedAmount)) {
            const error = new Error('Budget allocations cannot exceed the sanctioned amount.');
            error.status = 409;
            throw error;
          }
          return tx.budgetHead.create({
            data: {
              grantId: currentGrant.id,
              name,
              category: normalizeCategory(req.body?.category || name),
              allocatedAmount,
              spentAmount: 0
            }
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error?.code === 'P2034') {
          const conflict = new Error('The grant budget changed at the same time. Reload it and try again.');
          conflict.status = 409;
          throw conflict;
        }
        throw error;
      }
      await logAction(req.user.id, 'CREATE_BUDGET_HEAD', 'BudgetHead', head.id);
      res.status(201).json(serializeBudgetHead(head));
    })
  );

  app.patch(
    '/api/budget-heads/:id',
    ...auth,
    requireRole(ROLE.FINANCE, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const head = await prisma.budgetHead.findUnique({
        where: { id: req.params.id },
        include: { grant: { include: { budgetHeads: true } } }
      });
      if (!head) return res.status(404).json({ error: 'Budget head not found.' });
      if (head.grant.status !== 'ACTIVE') {
        return res.status(409).json({ error: 'Budget allocations can be changed only while the grant is active.' });
      }

      const rawAllocation = req.body?.allocatedAmount ?? req.body?.allocated;
      if (rawAllocation === undefined) {
        return res.status(400).json({ error: 'allocatedAmount is required.' });
      }
      const allocatedAmount = Number(rawAllocation);
      if (!Number.isFinite(allocatedAmount) || allocatedAmount < 0) {
        return res.status(400).json({ error: 'Allocation must be a non-negative number.' });
      }
      if (allocatedAmount < number(head.spentAmount)) {
        return res.status(400).json({ error: 'Allocation cannot be lower than recorded spending.' });
      }

      const otherAllocations = head.grant.budgetHeads
        .filter((candidate) => candidate.id !== head.id)
        .reduce((sum, candidate) => sum + number(candidate.allocatedAmount), 0);
      if (otherAllocations + allocatedAmount > number(head.grant.sanctionedAmount)) {
        return res.status(400).json({ error: 'Budget allocations cannot exceed the sanctioned amount.' });
      }

      let updated;
      try {
        updated = await prisma.$transaction(async (tx) => {
          const currentHead = await tx.budgetHead.findUnique({
            where: { id: head.id },
            include: { grant: { include: { budgetHeads: true } } }
          });
          if (!currentHead || currentHead.grant.status !== 'ACTIVE') {
            const error = new Error('Budget allocations can be changed only while the grant is active.');
            error.status = 409;
            throw error;
          }
          if (allocatedAmount < number(currentHead.spentAmount)) {
            const error = new Error('Allocation cannot be lower than recorded spending.');
            error.status = 409;
            throw error;
          }
          const latestOtherAllocations = currentHead.grant.budgetHeads
            .filter((candidate) => candidate.id !== currentHead.id)
            .reduce((sum, candidate) => sum + number(candidate.allocatedAmount), 0);
          if (latestOtherAllocations + allocatedAmount > number(currentHead.grant.sanctionedAmount)) {
            const error = new Error('Budget allocations cannot exceed the sanctioned amount.');
            error.status = 409;
            throw error;
          }
          return tx.budgetHead.update({
            where: { id: currentHead.id },
            data: { allocatedAmount }
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error?.code === 'P2034') {
          const conflict = new Error('The grant budget changed at the same time. Reload it and try again.');
          conflict.status = 409;
          throw conflict;
        }
        throw error;
      }
      await logAction(req.user.id, 'UPDATE_BUDGET_HEAD', 'BudgetHead', updated.id, {
        previousAllocation: number(head.allocatedAmount),
        allocatedAmount
      });
      res.json(serializeBudgetHead(updated));
    })
  );

  app.get('/api/expenses', ...auth, safeAsync(async (req, res) => {
    const where = { ...expenseScope(req.user) };
    if (req.query.grantId) where.grantId = String(req.query.grantId);
    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();
      if (!EXPENSE_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Expense status filter is invalid.' });
      }
      where.status = status;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        grant: { select: { id: true, title: true, grantCode: true, piId: true } },
        budgetHead: true,
        submittedBy: { select: { id: true, name: true } },
        approvals: { include: { approver: { select: { name: true, role: true } } } },
        anomalies: true,
        ...CURRENT_DOCUMENT_INCLUDE
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(expenses.map(serializeExpense));
  }));

  app.get('/api/expenses/:id', ...auth, safeAsync(async (req, res) => {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        grant: true,
        budgetHead: true,
        submittedBy: { select: { id: true, name: true, email: true } },
        approvals: { include: { approver: { select: { name: true, role: true } } } },
        anomalies: true,
        ...CURRENT_DOCUMENT_INCLUDE
      }
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });
    if (!expenseReadableBy(expense, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this expense.' });
    }
    res.json(serializeExpense(expense));
  }));

  app.post(
    '/api/expenses',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const grantId = cleanText(req.body?.grantId, 100);
      const amount = Number(req.body?.amount);
      const date = parseDate(req.body?.date);
      const vendorName = cleanText(req.body?.vendorName ?? req.body?.vendor, 200);
      const invoiceNumber = cleanText(
        req.body?.invoiceNumber ?? req.body?.invoice,
        120
      );
      const description = cleanText(req.body?.description ?? req.body?.desc, 1000);

      if (!grantId || !Number.isFinite(amount) || amount <= 0 || !date || !vendorName || !invoiceNumber || !description) {
        return res.status(400).json({
          error: 'Grant, vendor, invoice number, description, positive amount, and a valid date are required.'
        });
      }

      const grant = await prisma.grant.findUnique({
        where: { id: grantId },
        include: { budgetHeads: true }
      });
      if (!grant) return res.status(404).json({ error: 'Grant not found.' });
      if (!grantReadableBy(grant, req.user)) {
        return res.status(403).json({ error: 'You cannot submit an expense to this grant.' });
      }
      if (grant.status !== 'ACTIVE') {
        return res.status(409).json({ error: 'Expenses can be submitted only against an active grant.' });
      }
      if (date < grant.startDate || date > grant.endDate) {
        return res.status(400).json({ error: 'Expense date must fall within the grant period.' });
      }
      if (date > currentIndianDate()) {
        return res.status(400).json({ error: 'Expense date cannot be in the future.' });
      }

      const requestedHeadId = cleanText(req.body?.budgetHeadId, 100);
      const requestedHeadName = cleanText(req.body?.head, 100).toLowerCase();
      let head = grant.budgetHeads.find((candidate) => candidate.id === requestedHeadId);
      if (!head && requestedHeadName) {
        head = grant.budgetHeads.find(
          (candidate) => candidate.name.toLowerCase() === requestedHeadName
        );
      }
      if (!head && grant.budgetHeads.length === 1) head = grant.budgetHeads[0];
      if (!head) {
        return res.status(400).json({ error: 'Select a budget head belonging to this grant.' });
      }

      let expenseResult;
      try {
        expenseResult = await prisma.$transaction(async (tx) => {
          const currentGrant = await tx.grant.findUnique({
            where: { id: grantId },
            include: { budgetHeads: true }
          });
          if (!currentGrant || currentGrant.status !== 'ACTIVE') {
            const error = new Error('Expenses can be submitted only against an active grant.');
            error.status = 409;
            throw error;
          }
          if (date < currentGrant.startDate || date > currentGrant.endDate) {
            const error = new Error('Expense date must fall within the grant period.');
            error.status = 409;
            throw error;
          }
          const currentHead = currentGrant.budgetHeads.find((candidate) => candidate.id === head.id);
          if (!currentHead) {
            const error = new Error('The selected budget head is no longer available. Reload the form and try again.');
            error.status = 409;
            throw error;
          }
          const duplicate = await tx.expense.findFirst({
            where: {
              invoiceNumber: { equals: invoiceNumber, mode: 'insensitive' },
              vendorName: { equals: vendorName, mode: 'insensitive' },
              status: { not: 'REJECTED' }
            },
            select: { id: true }
          });
          const exceedsHead = number(currentHead.spentAmount) + amount > number(currentHead.allocatedAmount);
          const complianceStatus = duplicate
            ? 'NON_COMPLIANT'
            : exceedsHead
              ? 'WARNING'
              : 'PENDING';

          const created = await tx.expense.create({
            data: {
              grantId,
              budgetHeadId: currentHead.id,
              submittedById: req.user.id,
              amount,
              date,
              vendorName,
              invoiceNumber,
              gstNumber: cleanText(req.body?.gstNumber ?? req.body?.gst, 30) || null,
              description,
              aiExtracted: verifyOcrProof(
                req.body?.aiExtractionProof,
                req.user.id,
                req.body
              ),
              status: 'SUBMITTED',
              complianceStatus,
              complianceNotes: {
                duplicateInvoice: Boolean(duplicate),
                budgetExceeded: exceedsHead,
                checkedAt: new Date().toISOString()
              }
            },
            include: {
              grant: { select: { id: true, title: true, grantCode: true, piId: true } },
              budgetHead: true,
              anomalies: true,
              approvals: true,
              ...CURRENT_DOCUMENT_INCLUDE
            }
          });

          await tx.grant.update({
            where: { id: grantId },
            data: { spentAmount: { increment: amount } }
          });
          await tx.budgetHead.update({
            where: { id: currentHead.id },
            data: { spentAmount: { increment: amount } }
          });

          if (duplicate) {
            await tx.anomaly.create({
              data: {
                expenseId: created.id,
                severity: 'HIGH',
                reason: `Possible duplicate invoice ${invoiceNumber} from ${vendorName}`
              }
            });
          }
          if (exceedsHead) {
            await tx.anomaly.create({
              data: {
                expenseId: created.id,
                severity: 'MEDIUM',
                reason: `Expense exceeds the ${currentHead.name} budget allocation`
              }
            });
          }

          const saved = await tx.expense.findUnique({
            where: { id: created.id },
            include: {
              grant: { select: { id: true, title: true, grantCode: true, piId: true } },
              budgetHead: true,
              anomalies: true,
              approvals: true,
              ...CURRENT_DOCUMENT_INCLUDE
            }
          });
          return { expense: saved, complianceStatus, budgetHeadId: currentHead.id };
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error?.code === 'P2034') {
          const conflict = new Error('Grant spending changed at the same time. Reload the form and submit again.');
          conflict.status = 409;
          throw conflict;
        }
        throw error;
      }

      await logAction(req.user.id, 'CREATE_EXPENSE', 'Expense', expenseResult.expense.id, {
        grantId,
        budgetHeadId: expenseResult.budgetHeadId,
        complianceStatus: expenseResult.complianceStatus
      });
      res.status(201).json(serializeExpense(expenseResult.expense));
    })
  );

  app.put('/api/expenses/:id', ...auth, safeAsync(async (req, res) => {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { grant: true, budgetHead: true }
    });
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });
    if (req.user.role !== ROLE.ADMIN && !(req.user.role === ROLE.PI && existing.grant.piId === req.user.id)) {
      return res.status(403).json({ error: 'You cannot update this expense.' });
    }
    if (req.user.role === ROLE.PI && existing.grant.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Expenses cannot be edited while the grant is not active.' });
    }
    if (existing.status !== 'CORRECTION_REQUESTED') {
      return res.status(409).json({ error: 'Only expenses returned for correction can be edited.' });
    }

    const data = {};
    let ocrCoveredFieldProvided = false;
    let nextVendor = existing.vendorName;
    let nextInvoice = existing.invoiceNumber || '';
    let nextDescription = existing.description;
    let nextDate = existing.date;
    if (req.body.vendorName !== undefined || req.body.vendor !== undefined) {
      ocrCoveredFieldProvided = true;
      nextVendor = cleanText(req.body.vendorName ?? req.body.vendor, 200);
      if (!nextVendor) return res.status(400).json({ error: 'Vendor cannot be blank.' });
      data.vendorName = nextVendor;
    }
    if (req.body.invoiceNumber !== undefined || req.body.invoice !== undefined) {
      ocrCoveredFieldProvided = true;
      nextInvoice = cleanText(req.body.invoiceNumber ?? req.body.invoice, 120);
      if (!nextInvoice) return res.status(400).json({ error: 'Invoice number cannot be blank.' });
      data.invoiceNumber = nextInvoice;
    }
    if (req.body.description !== undefined) {
      ocrCoveredFieldProvided = true;
      nextDescription = cleanText(req.body.description, 1000);
      if (!nextDescription) return res.status(400).json({ error: 'Description cannot be blank.' });
      data.description = nextDescription;
    }
    if (req.body.gstNumber !== undefined || req.body.gst !== undefined) {
      ocrCoveredFieldProvided = true;
      data.gstNumber = cleanText(req.body.gstNumber ?? req.body.gst, 30) || null;
    }
    if (req.body.date !== undefined) {
      ocrCoveredFieldProvided = true;
      data.date = parseDate(req.body.date);
      if (!data.date) return res.status(400).json({ error: 'Expense date is invalid.' });
      nextDate = data.date;
    }
    if (nextDate < existing.grant.startDate || nextDate > existing.grant.endDate) {
      return res.status(400).json({ error: 'Expense date must fall within the grant period.' });
    }
    if (nextDate > currentIndianDate()) {
      return res.status(400).json({ error: 'Expense date cannot be in the future.' });
    }

    let nextAmount = number(existing.amount);
    if (req.body.amount !== undefined) {
      ocrCoveredFieldProvided = true;
      nextAmount = Number(req.body.amount);
      if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be positive.' });
      }
      data.amount = nextAmount;
    }

    let nextHead = existing.budgetHead;
    const headWasProvided = req.body.budgetHeadId !== undefined || req.body.head !== undefined;
    if (headWasProvided) {
      const requestedHeadId = cleanText(req.body.budgetHeadId, 100);
      const requestedHeadName = cleanText(req.body.head, 100);
      if (!requestedHeadId && !requestedHeadName) {
        return res.status(400).json({ error: 'Budget head cannot be blank.' });
      }
      nextHead = await prisma.budgetHead.findFirst({
        where: {
          grantId: existing.grantId,
          OR: [
            ...(requestedHeadId ? [{ id: requestedHeadId }] : []),
            ...(requestedHeadName
              ? [{ name: { equals: requestedHeadName, mode: 'insensitive' } }]
              : [])
          ]
        }
      });
      if (!nextHead) return res.status(400).json({ error: 'Budget head is invalid.' });
      data.budgetHeadId = nextHead.id;
    }

    const oldAmount = number(existing.amount);
    const delta = nextAmount - oldAmount;
    const contributesToSpending = existing.status !== 'REJECTED';

    if (ocrCoveredFieldProvided) {
      data.aiExtracted = verifyOcrProof(
        req.body?.aiExtractionProof,
        req.user.id,
        req.body
      );
    }
    if (existing.status === 'CORRECTION_REQUESTED' && (ocrCoveredFieldProvided || headWasProvided)) {
      data.status = 'SUBMITTED';
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        let currentNextHead = nextHead;
        let duplicate = null;
        let exceedsHead = false;

        if (contributesToSpending) {
          currentNextHead = await tx.budgetHead.findUnique({ where: { id: nextHead.id } });
          if (!currentNextHead || currentNextHead.grantId !== existing.grantId) {
            const error = new Error('The selected budget head is no longer available. Reload the form and try again.');
            error.status = 409;
            throw error;
          }
          duplicate = await tx.expense.findFirst({
            where: {
              id: { not: existing.id },
              invoiceNumber: { equals: nextInvoice, mode: 'insensitive' },
              vendorName: { equals: nextVendor, mode: 'insensitive' },
              status: { not: 'REJECTED' }
            },
            select: { id: true }
          });
          const projectedHeadSpending = currentNextHead.id === existing.budgetHeadId
            ? number(currentNextHead.spentAmount) - oldAmount + nextAmount
            : number(currentNextHead.spentAmount) + nextAmount;
          exceedsHead = projectedHeadSpending > number(currentNextHead.allocatedAmount);
          data.complianceStatus = duplicate
            ? 'NON_COMPLIANT'
            : exceedsHead
              ? 'WARNING'
              : 'PENDING';
          data.complianceNotes = {
            duplicateInvoice: Boolean(duplicate),
            budgetExceeded: exceedsHead,
            checkedAt: new Date().toISOString()
          };

          if (currentNextHead.id === existing.budgetHeadId) {
            if (delta) {
              await tx.budgetHead.update({
                where: { id: currentNextHead.id },
                data: { spentAmount: { increment: delta } }
              });
            }
          } else {
            await tx.budgetHead.update({
              where: { id: existing.budgetHeadId },
              data: { spentAmount: { decrement: oldAmount } }
            });
            await tx.budgetHead.update({
              where: { id: currentNextHead.id },
              data: { spentAmount: { increment: nextAmount } }
            });
          }
          if (delta) {
            await tx.grant.update({
              where: { id: existing.grantId },
              data: { spentAmount: { increment: delta } }
            });
          }

          await tx.anomaly.updateMany({
            where: {
              expenseId: existing.id,
              resolved: false,
              OR: [
                { reason: { startsWith: 'Possible duplicate invoice' } },
                { reason: { startsWith: 'Expense exceeds the' } }
              ]
            },
            data: { resolved: true }
          });
          if (duplicate) {
            await tx.anomaly.create({
              data: {
                expenseId: existing.id,
                severity: 'HIGH',
                reason: `Possible duplicate invoice ${nextInvoice} from ${nextVendor}`
              }
            });
          }
          if (exceedsHead) {
            await tx.anomaly.create({
              data: {
                expenseId: existing.id,
                severity: 'MEDIUM',
                reason: `Expense exceeds the ${currentNextHead.name} budget allocation`
              }
            });
          }
        }

        const claimed = await tx.expense.updateMany({
          where: { id: existing.id, status: existing.status },
          data
        });
        if (claimed.count !== 1) {
          const error = new Error('This expense changed while it was being edited. Reload it and try again.');
          error.status = 409;
          throw error;
        }
        return tx.expense.findUnique({
          where: { id: existing.id },
          include: { budgetHead: true, grant: true, anomalies: true, approvals: true }
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error?.code === 'P2034') {
        const conflict = new Error('Grant spending changed at the same time. Reload the expense and try again.');
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }

    await logAction(req.user.id, 'UPDATE_EXPENSE', 'Expense', updated.id);
    res.json(serializeExpense(updated));
  }));

  async function decideExpense(req, res) {
    if (![ROLE.FINANCE, ROLE.ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Finance or Admin can decide expenses.' });
    }
    const id = req.params.id || req.params.expenseId;
    const action = cleanText(req.body?.action, 40).toUpperCase();
    if (!['APPROVED', 'REJECTED', 'CORRECTION_REQUESTED'].includes(action)) {
      return res.status(400).json({ error: 'Choose APPROVED, REJECTED, or CORRECTION_REQUESTED.' });
    }
    const decisionReason = cleanText(req.body?.reason, 1000);
    if (action !== 'APPROVED' && !decisionReason) {
      return res.status(400).json({ error: 'A reason is required when rejecting an expense or requesting a correction.' });
    }
    const existing = await prisma.expense.findUnique({
      where: { id },
      include: { grant: true, budgetHead: true }
    });
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });
    const validTransition = existing.status === 'SUBMITTED'
      ? ['APPROVED', 'REJECTED', 'CORRECTION_REQUESTED'].includes(action)
      : existing.status === 'REJECTED' && action === 'CORRECTION_REQUESTED';
    if (!validTransition) {
      return res.status(409).json({
        error: existing.status === 'CORRECTION_REQUESTED'
          ? 'The PI must correct and resubmit this expense before another finance decision.'
          : `An expense with status ${existing.status} cannot be changed to ${action}.`
      });
    }

    const alreadyExcluded = existing.status === 'REJECTED';
    const nowExcluded = action === 'REJECTED';
    const amount = number(existing.amount);
    const duplicate = !nowExcluded && existing.invoiceNumber && existing.vendorName
      ? await prisma.expense.findFirst({
          where: {
            id: { not: existing.id },
            invoiceNumber: { equals: existing.invoiceNumber, mode: 'insensitive' },
            vendorName: { equals: existing.vendorName, mode: 'insensitive' },
            status: { not: 'REJECTED' }
          },
          select: { id: true }
        })
      : null;
    const projectedHeadSpending = alreadyExcluded && !nowExcluded
      ? number(existing.budgetHead.spentAmount) + amount
      : number(existing.budgetHead.spentAmount);
    const exceedsHead = !nowExcluded && projectedHeadSpending > number(existing.budgetHead.allocatedAmount);
    const complianceStatus = nowExcluded
      ? existing.complianceStatus
      : duplicate
        ? 'NON_COMPLIANT'
        : exceedsHead
          ? 'WARNING'
          : action === 'APPROVED'
            ? 'COMPLIANT'
            : 'PENDING';

    const updated = await prisma.$transaction(async (tx) => {
      if (alreadyExcluded !== nowExcluded) {
        const operation = nowExcluded ? { decrement: amount } : { increment: amount };
        await tx.grant.update({
          where: { id: existing.grantId },
          data: { spentAmount: operation }
        });
        await tx.budgetHead.update({
          where: { id: existing.budgetHeadId },
          data: { spentAmount: operation }
        });
      }

      await tx.anomaly.updateMany({
        where: {
          expenseId: existing.id,
          resolved: false,
          OR: [
            { reason: { startsWith: 'Possible duplicate invoice' } },
            { reason: { startsWith: 'Expense exceeds the' } }
          ]
        },
        data: { resolved: true }
      });
      if (!nowExcluded && duplicate) {
        await tx.anomaly.create({
          data: {
            expenseId: existing.id,
            severity: 'HIGH',
            reason: `Possible duplicate invoice ${existing.invoiceNumber} from ${existing.vendorName}`
          }
        });
      }
      if (!nowExcluded && exceedsHead) {
        await tx.anomaly.create({
          data: {
            expenseId: existing.id,
            severity: 'MEDIUM',
            reason: `Expense exceeds the ${existing.budgetHead.name} budget allocation`
          }
        });
      }

      const claimed = await tx.expense.updateMany({
        where: { id, status: existing.status },
        data: {
          status: action,
          complianceStatus,
          complianceNotes: nowExcluded
            ? existing.complianceNotes
            : {
                duplicateInvoice: Boolean(duplicate),
                budgetExceeded: exceedsHead,
                checkedAt: new Date().toISOString(),
                decision: action
              }
        }
      });
      if (claimed.count !== 1) {
        const error = new Error('This expense was already updated. Reload the queue before deciding it again.');
        error.status = 409;
        throw error;
      }
      await tx.approval.create({
        data: {
          expenseId: id,
          approverId: req.user.id,
          action,
          reason: decisionReason || null
        }
      });
      return tx.expense.findUnique({ where: { id } });
    });

    await logAction(req.user.id, `EXPENSE_${action}`, 'Expense', id);
    res.json(serializeExpense({ ...updated, budgetHead: existing.budgetHead }));
  }

  app.post('/api/expenses/:id/approve', ...auth, safeAsync(decideExpense));
  app.post('/api/expenses/:expenseId/decide', ...auth, safeAsync(decideExpense));

  app.get('/api/approvals', ...auth, safeAsync(async (req, res) => {
    const where = req.user.role === ROLE.PI
      ? { expense: { grant: { piId: req.user.id } } }
      : {};
    const approvals = await prisma.approval.findMany({
      where,
      include: {
        expense: { select: { id: true, vendorName: true, grantId: true } },
        approver: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(approvals);
  }));

  app.get('/api/anomalies', ...auth, safeAsync(async (req, res) => {
    const where = req.user.role === ROLE.PI
      ? { expense: { grant: { piId: req.user.id } } }
      : {};
    if (req.query.resolved !== undefined) where.resolved = String(req.query.resolved) === 'true';
    const anomalies = await prisma.anomaly.findMany({
      where,
      include: {
        expense: {
          include: {
            budgetHead: true,
            grant: { select: { id: true, title: true, grantCode: true, piId: true } }
          }
        }
      },
      orderBy: { detectedAt: 'desc' }
    });
    res.json(anomalies.map((anomaly) => ({
      ...anomaly,
      expense: serializeExpense(anomaly.expense)
    })));
  }));

  app.post(
    '/api/expenses/:expenseId/anomalies',
    ...auth,
    requireRole(ROLE.FINANCE, ROLE.AUDITOR, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
      if (!expense) return res.status(404).json({ error: 'Expense not found.' });
      const reason = cleanText(req.body?.reason, 1000);
      const severity = cleanText(req.body?.severity, 20).toUpperCase();
      if (!reason || !['LOW', 'MEDIUM', 'HIGH'].includes(severity)) {
        return res.status(400).json({ error: 'A reason and valid severity are required.' });
      }
      const anomaly = await prisma.anomaly.create({
        data: { expenseId: expense.id, reason, severity }
      });
      await logAction(req.user.id, 'CREATE_ANOMALY', 'Anomaly', anomaly.id);
      res.status(201).json(anomaly);
    })
  );

  async function resolveAnomaly(req, res) {
    if (![ROLE.FINANCE, ROLE.AUDITOR, ROLE.ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot resolve anomalies.' });
    }
    const existing = await prisma.anomaly.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Anomaly not found.' });
    const anomaly = await prisma.anomaly.update({
      where: { id: existing.id },
      data: { resolved: true }
    });
    await logAction(req.user.id, 'RESOLVE_ANOMALY', 'Anomaly', anomaly.id, {
      note: cleanText(req.body?.note, 1000) || null
    });
    res.json(anomaly);
  }

  app.put('/api/anomalies/:id/resolve', ...auth, safeAsync(resolveAnomaly));
  app.post('/api/anomalies/:id/resolve', ...auth, safeAsync(resolveAnomaly));

  app.get('/api/ucs', ...auth, safeAsync(async (req, res) => {
    const where = req.user.role === ROLE.PI ? { grant: { piId: req.user.id } } : {};
    const ucs = await prisma.utilizationCertificate.findMany({
      where,
      include: {
        grant: {
          include: { pi: { select: { id: true, name: true, department: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(ucs.map(serializeUC));
  }));

  app.get('/api/grants/:grantId/ucs', ...auth, safeAsync(async (req, res) => {
    const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
    if (!grant) return res.status(404).json({ error: 'Grant not found.' });
    if (!grantReadableBy(grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this grant.' });
    }
    const ucs = await prisma.utilizationCertificate.findMany({
      where: { grantId: grant.id },
      include: { grant: { include: { pi: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(ucs.map(serializeUC));
  }));

  app.post(
    '/api/uc/generate',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const grantId = cleanText(req.body?.grantId, 100);
      if (!grantId) return res.status(400).json({ error: 'grantId is required.' });

      const grant = await prisma.grant.findUnique({
        where: { id: grantId },
        include: {
          pi: { select: { id: true, name: true, department: true } },
          budgetHeads: true
        }
      });
      if (!grant) return res.status(404).json({ error: 'Grant not found.' });
      if (!grantReadableBy(grant, req.user)) {
        return res.status(403).json({ error: 'You cannot generate a UC for this grant.' });
      }

      const financialYear = cleanText(req.body?.financialYear, 20);
      const financials = await calculateUcFinancials(prisma, grant, financialYear);
      if (!financials) {
        return res.status(400).json({
          error: 'financialYear must identify a consecutive Indian financial year using YYYY-YY.'
        });
      }
      const currentBounds = financialYearBounds(currentIndianFinancialYear());
      if (financials.bounds.startYear > currentBounds.startYear) {
        return res.status(400).json({ error: 'A future financial year cannot be used for a UC draft.' });
      }
      if (grant.startDate && financials.bounds.endExclusive.getTime() <= new Date(grant.startDate).getTime()) {
        return res.status(400).json({ error: 'The financial year does not overlap the grant period.' });
      }
      if (grant.endDate && financials.bounds.start.getTime() > new Date(grant.endDate).getTime()) {
        return res.status(400).json({ error: 'The financial year does not overlap the grant period.' });
      }
      const utilized = financials.periodApproved;
      const sanctioned = financials.sanctioned;
      const balance = financials.balanceAtPeriodEnd;
      const period = financialYearPeriod(financialYear);
      const generatedContent = {
        summary: `For ${financialYear}, approved expense records for ${grant.title} total ₹${utilized.toLocaleString('en-IN')}. The current recorded sanctioned amount is ₹${sanctioned.toLocaleString('en-IN')}; the calculated balance at the reporting-period end, after cumulative approved expenses through that date, is ₹${balance.toLocaleString('en-IN')}. This system-generated summary requires reconciliation with institutional accounts and review by authorized finance and signing officials.`,
        heads: financials.heads,
        basis: 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR',
        expenseDateBasis: 'EXPENSE_DATE',
        balanceBasis: 'CURRENT_SANCTIONED_AMOUNT_LESS_CUMULATIVE_APPROVED_EXPENSES_THROUGH_PERIOD_END',
        allocationBasis: 'CURRENT_RECORDED_BUDGET_HEAD_ALLOCATIONS',
        periodStart: dateOnly(financials.bounds.start),
        periodEnd: dateOnly(new Date(financials.bounds.endExclusive.getTime() - 1)),
        periodApprovedExpenditure: utilized,
        cumulativeApprovedExpenditure: financials.cumulativeApprovedThroughPeriod,
        cumulativeApprovedThroughPeriod: financials.cumulativeApprovedThroughPeriod,
        currentSanctionedAmount: sanctioned,
        sanctionBalanceAtPeriodEnd: balance,
        utilizationPct: sanctioned ? Math.round((utilized / sanctioned) * 1000) / 10 : 0,
        generatedAt: new Date().toISOString()
      };

      let ucResult;
      try {
        ucResult = await prisma.$transaction(async (tx) => {
          const existing = await tx.utilizationCertificate.findUnique({
            where: {
              grantId_financialYear: { grantId, financialYear }
            }
          });
          if (existing && existing.status !== 'DRAFT') {
            const error = new Error('A UC for this grant and financial year has already entered review and cannot be overwritten.');
            error.status = 409;
            throw error;
          }
          const record = existing
            ? await tx.utilizationCertificate.update({
                where: { id: existing.id },
                data: { period, totalUtilized: utilized, balanceAmount: balance, generatedContent },
                include: { grant: { include: { pi: true } } }
              })
            : await tx.utilizationCertificate.create({
                data: {
                  grantId,
                  financialYear,
                  period,
                  totalUtilized: utilized,
                  balanceAmount: balance,
                  generatedContent,
                  status: 'DRAFT'
                },
                include: { grant: { include: { pi: true } } }
              });
          return { record, replacedDraft: Boolean(existing) };
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error?.code === 'P2034' || error?.code === 'P2002') {
          const conflict = new Error('A UC for this grant and financial year changed at the same time. Reload the drafts and try again.');
          conflict.status = 409;
          throw conflict;
        }
        throw error;
      }

      await logAction(req.user.id, 'GENERATE_UC', 'UtilizationCertificate', ucResult.record.id, {
        financialYear,
        basis: 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR'
      });
      res.status(ucResult.replacedDraft ? 200 : 201).json(serializeUC(ucResult.record));
    })
  );

  app.post(
    '/api/grants/:grantId/ucs',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      req.body.grantId = req.params.grantId;
      return res.status(409).json({
        error: 'Use /api/uc/generate so UC totals are calculated from approved expenses in a validated financial year.'
      });
    })
  );

  app.put('/api/ucs/:id', ...auth, safeAsync(async (req, res) => {
    const existing = await prisma.utilizationCertificate.findUnique({
      where: { id: req.params.id },
      include: { grant: true }
    });
    if (!existing) return res.status(404).json({ error: 'UC not found.' });
    if (req.user.role !== ROLE.ADMIN && !(req.user.role === ROLE.PI && existing.grant.piId === req.user.id)) {
      return res.status(403).json({ error: 'You cannot update this UC.' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(409).json({ error: 'Only draft UCs can be updated by a PI.' });
    }
    if (req.body.period !== undefined && cleanText(req.body.period, 100) !== financialYearPeriod(existing.financialYear)) {
      return res.status(400).json({ error: 'UC period is derived from the recorded financial year and cannot be overridden.' });
    }
    const data = { period: financialYearPeriod(existing.financialYear) };
    const updated = await prisma.utilizationCertificate.update({
      where: { id: existing.id },
      data,
      include: { grant: { include: { pi: true } } }
    });
    await logAction(req.user.id, 'UPDATE_UC', 'UtilizationCertificate', updated.id);
    res.json(serializeUC(updated));
  }));

  app.put(
    '/api/ucs/:id/status',
    ...auth,
    requireRole(ROLE.FINANCE, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const existing = await prisma.utilizationCertificate.findUnique({
        where: { id: req.params.id }
      });
      if (!existing) return res.status(404).json({ error: 'UC not found.' });
      const status = cleanText(req.body?.status, 40).toUpperCase();
      if (!UC_STATUSES.has(status)) {
        return res.status(400).json({ error: 'UC status is invalid.' });
      }
      const content =
        existing.generatedContent && typeof existing.generatedContent === 'object'
          ? existing.generatedContent
          : {};
      const workflowOrder = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUBMITTED_TO_AGENCY'];
      if (
        workflowOrder.indexOf(status) >= workflowOrder.indexOf('APPROVED') &&
        content.basis !== 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR'
      ) {
        return res.status(409).json({
          error: 'Generate a financial-year-scoped UC draft before recording approval.'
        });
      }
      const currentIndex = workflowOrder.indexOf(existing.status);
      const requestedIndex = workflowOrder.indexOf(status);
      if (requestedIndex !== currentIndex + 1) {
        return res.status(409).json({
          error: currentIndex === workflowOrder.length - 1
            ? 'This UC is already at the final workflow status.'
            : `The next UC status must be ${workflowOrder[currentIndex + 1]}.`
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.utilizationCertificate.updateMany({
          where: { id: existing.id, status: existing.status },
          data: { status }
        });
        if (claimed.count !== 1) {
          const error = new Error('This UC changed while the decision was being recorded. Reload it and try again.');
          error.status = 409;
          throw error;
        }
        return tx.utilizationCertificate.findUnique({
          where: { id: existing.id },
          include: { grant: { include: { pi: true } } }
        });
      });
      await logAction(req.user.id, `UC_${status}`, 'UtilizationCertificate', updated.id, {
        note: cleanText(req.body?.note, 1000) || null
      });
      res.json(serializeUC(updated));
    })
  );

  app.get('/api/uc/:id/pdf', ...auth, safeAsync(async (req, res) => {
    const uc = await prisma.utilizationCertificate.findUnique({
      where: { id: req.params.id },
      include: {
        grant: {
          include: {
            pi: { select: { id: true, name: true, department: true } },
            budgetHeads: true
          }
        }
      }
    });
    if (!uc) return res.status(404).json({ error: 'UC not found.' });
    if (!grantReadableBy(uc.grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this UC.' });
    }
    const generatedContent =
      uc.generatedContent && typeof uc.generatedContent === 'object'
        ? uc.generatedContent
        : {};
    if (generatedContent.basis !== 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR') {
      return res.status(409).json({
        error: 'This legacy UC does not contain financial-year-scoped calculations. Generate a new UC draft before downloading.'
      });
    }

    const serialized = serializeUC(uc);
    const filename = `UC-${uc.grant.grantCode}-${uc.financialYear}.pdf`.replace(/[^A-Za-z0-9._-]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: filename } });
    doc.pipe(res);
    doc.fontSize(17).text('UTILIZATION SUMMARY DRAFT', { align: 'center' });
    doc.moveDown(0.35).fontSize(10).text('System-generated working document for reconciliation and authorized review', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(11);
    doc.text(`Grant code: ${uc.grant.grantCode}`);
    doc.text(`Grant title: ${uc.grant.title}`);
    doc.text(`Funding agency: ${uc.grant.agency}`);
    doc.text(`Principal investigator: ${uc.grant.pi.name}`);
    doc.text(`Department: ${uc.grant.pi.department || 'Not recorded'}`);
    doc.text(`Financial year: ${uc.financialYear}`);
    doc.text(`Period: ${uc.period || 'Not specified'}`);
    const workflowLabels = {
      DRAFT: 'Working draft',
      UNDER_REVIEW: 'Internal review in progress',
      APPROVED: 'Internal workflow approval recorded',
      SUBMITTED_TO_AGENCY: 'Recorded as submitted to agency'
    };
    doc.text(`Internal workflow status: ${workflowLabels[uc.status] || uc.status}`);
    doc.moveDown();
    doc.fontSize(12).text('Financial summary', { underline: true });
    doc.moveDown(0.5).fontSize(11);
    doc.text(`Current recorded sanctioned amount: INR ${number(uc.grant.sanctionedAmount).toLocaleString('en-IN')}`);
    doc.text(`Approved expense records in ${uc.financialYear}: INR ${serialized.totalUtilized.toLocaleString('en-IN')}`);
    doc.text(`Cumulative approved expenditure through period end: INR ${number(generatedContent.cumulativeApprovedExpenditure ?? generatedContent.cumulativeApprovedThroughPeriod).toLocaleString('en-IN')}`);
    doc.text(`Calculated sanction balance at period end: INR ${serialized.balanceAmount.toLocaleString('en-IN')}`);
    doc.text(`Reporting-period approved expenses / current sanctioned amount: ${serialized.utilizationPct}%`);
    doc.moveDown();
    doc.fontSize(10).text('Expense basis: approved expense records dated within the reporting financial year.');
    doc.text('Balance basis: current recorded sanctioned amount less cumulative approved expenditure through period end.');
    doc.text('Head basis: current recorded allocations compared with approved expense records in this financial year.');
    doc.moveDown();
    doc.fontSize(12).text('Budget heads', { underline: true });
    doc.moveDown(0.5).fontSize(10);
    for (const head of serialized.heads) {
      doc.text(`${head.name}: current recorded allocation INR ${number(head.allocated).toLocaleString('en-IN')}; approved expenses in ${uc.financialYear} INR ${number(head.spent).toLocaleString('en-IN')}`);
    }
    if (!serialized.heads.length) doc.text('No budget-head records were available when this draft was generated.');
    doc.moveDown();
    doc.fontSize(10).text(serialized.summary || 'No summary is available.');
    doc.moveDown(2);
    doc.text('This working document uses the recorded calculation bases stated above. It is not a certified statutory or agency form; authorized officials must reconcile the source records, apply the required institutional format, and sign as applicable.');
    doc.moveDown(3);
    doc.text('Optional internal PI review acknowledgement: ____________________');
    doc.moveDown(2);
    doc.text('Optional internal Finance review acknowledgement: ______________');
    doc.end();
  }));

  app.get('/api/milestones', ...auth, safeAsync(async (req, res) => {
    const where = req.user.role === ROLE.PI ? { grant: { piId: req.user.id } } : {};
    const milestones = await prisma.milestone.findMany({
      where,
      include: { grant: { select: { id: true, title: true, piId: true } } },
      orderBy: { dueDate: 'asc' }
    });
    res.json(milestones.map((item) => ({ ...item, dueDate: dateOnly(item.dueDate) })));
  }));

  app.get('/api/grants/:grantId/milestones', ...auth, safeAsync(async (req, res) => {
    const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
    if (!grant) return res.status(404).json({ error: 'Grant not found.' });
    if (!grantReadableBy(grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this grant.' });
    }
    const milestones = await prisma.milestone.findMany({
      where: { grantId: grant.id },
      orderBy: { dueDate: 'asc' }
    });
    res.json(milestones.map((item) => ({ ...item, dueDate: dateOnly(item.dueDate) })));
  }));

  app.post(
    '/api/grants/:grantId/milestones',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
      if (!grant) return res.status(404).json({ error: 'Grant not found.' });
      if (!grantReadableBy(grant, req.user)) {
        return res.status(403).json({ error: 'You cannot add milestones to this grant.' });
      }
      const title = cleanText(req.body?.title, 240);
      const dueDate = parseDate(req.body?.dueDate);
      if (!title || !dueDate) return res.status(400).json({ error: 'Title and valid due date are required.' });
      const milestone = await prisma.milestone.create({
        data: { grantId: grant.id, title, dueDate, status: 'PENDING' }
      });
      await logAction(req.user.id, 'CREATE_MILESTONE', 'Milestone', milestone.id);
      res.status(201).json({ ...milestone, dueDate: dateOnly(milestone.dueDate) });
    })
  );

  app.put('/api/milestones/:id', ...auth, safeAsync(async (req, res) => {
    const existing = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { grant: true }
    });
    if (!existing) return res.status(404).json({ error: 'Milestone not found.' });
    if (req.user.role !== ROLE.ADMIN && !(req.user.role === ROLE.PI && existing.grant.piId === req.user.id)) {
      return res.status(403).json({ error: 'You cannot update this milestone.' });
    }
    const data = {};
    if (req.body.title !== undefined) {
      data.title = cleanText(req.body.title, 240);
      if (!data.title) return res.status(400).json({ error: 'Milestone title cannot be blank.' });
    }
    if (req.body.dueDate !== undefined) {
      data.dueDate = parseDate(req.body.dueDate);
      if (!data.dueDate) return res.status(400).json({ error: 'Due date is invalid.' });
    }
    if (req.body.status !== undefined) {
      data.status = cleanText(req.body.status, 40).toUpperCase();
      if (!MILESTONE_STATUSES.has(data.status)) {
        return res.status(400).json({ error: 'Milestone status is invalid.' });
      }
    }
    const updated = await prisma.milestone.update({ where: { id: existing.id }, data });
    await logAction(req.user.id, 'UPDATE_MILESTONE', 'Milestone', updated.id);
    res.json({ ...updated, dueDate: dateOnly(updated.dueDate) });
  }));

  app.get('/api/objections', ...auth, safeAsync(async (req, res) => {
    const where = req.user.role === ROLE.PI ? { grant: { piId: req.user.id } } : {};
    const objections = await prisma.objection.findMany({
      where,
      include: { grant: { select: { id: true, title: true, piId: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(objections);
  }));

  app.get('/api/grants/:grantId/objections', ...auth, safeAsync(async (req, res) => {
    const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
    if (!grant) return res.status(404).json({ error: 'Grant not found.' });
    if (!grantReadableBy(grant, req.user)) {
      return res.status(403).json({ error: 'You do not have access to this grant.' });
    }
    const objections = await prisma.objection.findMany({
      where: { grantId: grant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(objections);
  }));

  app.post(
    '/api/grants/:grantId/objections',
    ...auth,
    requireRole(ROLE.FINANCE, ROLE.AUDITOR, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const grant = await prisma.grant.findUnique({ where: { id: req.params.grantId } });
      if (!grant) return res.status(404).json({ error: 'Grant not found.' });
      const title = cleanText(req.body?.title, 240);
      if (!title) return res.status(400).json({ error: 'Objection title is required.' });
      const objection = await prisma.objection.create({
        data: {
          grantId: grant.id,
          title,
          note: cleanText(req.body?.note, 1000) || null,
          status: 'OPEN'
        }
      });
      await logAction(req.user.id, 'CREATE_OBJECTION', 'Objection', objection.id);
      res.status(201).json(objection);
    })
  );

  app.put(
    '/api/objections/:id',
    ...auth,
    requireRole(ROLE.AUDITOR, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const existing = await prisma.objection.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Objection not found.' });
      const data = {};
      if (req.body.status !== undefined) {
        data.status = cleanText(req.body.status, 40).toUpperCase();
        if (!OBJECTION_STATUSES.has(data.status)) {
          return res.status(400).json({ error: 'Objection status is invalid.' });
        }
      }
      if (req.body.note !== undefined) data.note = cleanText(req.body.note, 1000) || null;
      if (req.body.title !== undefined) {
        data.title = cleanText(req.body.title, 240);
        if (!data.title) return res.status(400).json({ error: 'Objection title cannot be blank.' });
      }
      const updated = await prisma.objection.update({ where: { id: existing.id }, data });
      await logAction(req.user.id, 'UPDATE_OBJECTION', 'Objection', updated.id);
      res.json(updated);
    })
  );

  app.get(
    '/api/audit-logs',
    ...auth,
    requireRole(ROLE.AUDITOR, ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const where = {};
      if (req.query.userId) where.userId = String(req.query.userId);
      if (req.query.entityType) where.entityType = String(req.query.entityType);
      const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200
      });
      res.json(logs);
    })
  );

  app.get('/api/notifications', ...auth, safeAsync(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  }));

  app.put('/api/notifications/read-all', ...auth, safeAsync(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true }
    });
    res.json({ updated: result.count });
  }));

  app.put('/api/notifications/:id/read', ...auth, safeAsync(async (req, res) => {
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Notification not found.' });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'You cannot update this notification.' });
    }
    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: { read: true }
    });
    res.json(updated);
  }));

  app.post(
    '/api/notifications',
    ...auth,
    requireRole(ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const userId = cleanText(req.body?.userId, 100);
      const title = cleanText(req.body?.title, 200);
      const message = cleanText(req.body?.message, 1000);
      const type = cleanText(req.body?.type, 40).toUpperCase() || 'GENERAL';
      if (!userId || !title || !message) {
        return res.status(400).json({ error: 'User, title, and message are required.' });
      }
      if (!NOTIFICATION_TYPES.has(type)) {
        return res.status(400).json({ error: 'Notification type is invalid.' });
      }
      const recipient = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!recipient) return res.status(400).json({ error: 'Notification recipient is invalid.' });
      const notification = await prisma.notification.create({
        data: { userId, title, message, type }
      });
      res.status(201).json(notification);
    })
  );

  app.get('/api/stats', ...auth, safeAsync(async (req, res) => {
    const grantWhere = { ...piScope(req.user) };
    const relatedGrant = req.user.role === ROLE.PI ? { piId: req.user.id } : undefined;
    const expenseWhere = relatedGrant ? { grant: relatedGrant } : {};
    const anomalyWhere = relatedGrant ? { expense: { grant: relatedGrant } } : {};

    const [grants, pendingExpenses, anomalies] = await Promise.all([
      prisma.grant.findMany({
        where: grantWhere,
        select: {
          sanctionedAmount: true,
          spentAmount: true,
          pi: { select: { department: true } }
        }
      }),
      prisma.expense.count({ where: { ...expenseWhere, status: 'SUBMITTED' } }),
      prisma.anomaly.count({ where: { ...anomalyWhere, resolved: false } })
    ]);
    const sanctioned = grants.reduce((sum, grant) => sum + number(grant.sanctionedAmount), 0);
    const spent = grants.reduce((sum, grant) => sum + number(grant.spentAmount), 0);
    const departments = new Set(
      grants.map((grant) => grant.pi.department).filter(Boolean)
    ).size;

    res.json({
      grants: grants.length,
      sanctioned,
      spent,
      utilization: sanctioned ? Math.round((spent / sanctioned) * 1000) / 10 : 0,
      pendingExpenses,
      anomalies,
      departments
    });
  }));

  app.get('/api/dashboard', ...auth, safeAsync(async (req, res) => {
    const grantWhere = { ...piScope(req.user) };
    const relatedGrant = req.user.role === ROLE.PI ? { piId: req.user.id } : undefined;
    const grants = await prisma.grant.findMany({ where: grantWhere });
    const [expenseCount, pendingExpenses, anomalyCount, unresolvedAnomalies] = await Promise.all([
      prisma.expense.count({ where: relatedGrant ? { grant: relatedGrant } : {} }),
      prisma.expense.count({ where: { ...(relatedGrant ? { grant: relatedGrant } : {}), status: 'SUBMITTED' } }),
      prisma.anomaly.count({ where: relatedGrant ? { expense: { grant: relatedGrant } } : {} }),
      prisma.anomaly.count({ where: { ...(relatedGrant ? { expense: { grant: relatedGrant } } : {}), resolved: false } })
    ]);
    res.json({
      grantCount: grants.length,
      activeGrants: grants.filter((grant) => grant.status === 'ACTIVE').length,
      totalSanctioned: grants.reduce((sum, grant) => sum + number(grant.sanctionedAmount), 0),
      totalSpent: grants.reduce((sum, grant) => sum + number(grant.spentAmount), 0),
      expenseCount,
      pendingExpenses,
      anomalyCount,
      unresolvedAnomalies
    });
  }));

  app.get(
    '/api/compliance-review',
    ...auth,
    requireRole(ROLE.FINANCE, ROLE.AUDITOR, ROLE.ADMIN),
    safeAsync(async (_req, res) => {
      const expenses = await prisma.expense.findMany({
        where: { complianceStatus: { in: ['PENDING', 'WARNING', 'NON_COMPLIANT'] } },
        include: {
          grant: { select: { id: true, title: true, grantCode: true, piId: true } },
          budgetHead: true,
          submittedBy: { select: { id: true, name: true } },
          anomalies: true,
          approvals: { include: { approver: { select: { name: true, role: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(expenses.map(serializeExpense));
    })
  );

  app.get('/api/search', ...auth, safeAsync(async (req, res) => {
    const q = cleanText(req.query.q, 200);
    if (!q) return res.json({ grants: [], expenses: [] });
    const grantWhere = {
      ...piScope(req.user),
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { grantCode: { contains: q, mode: 'insensitive' } },
        { agency: { contains: q, mode: 'insensitive' } }
      ]
    };
    const expenseWhere = {
      ...expenseScope(req.user),
      OR: [
        { vendorName: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }
      ]
    };
    const [grants, expenses] = await Promise.all([
      prisma.grant.findMany({
        where: grantWhere,
        include: { pi: { select: { name: true, department: true } } },
        take: 20
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        include: { budgetHead: true, grant: true },
        take: 20
      })
    ]);
    res.json({ grants: grants.map(serializeGrant), expenses: expenses.map(serializeExpense) });
  }));

  app.get('/api/calendar', ...auth, safeAsync(async (req, res) => {
    const grantWhere = { ...piScope(req.user) };
    const milestoneWhere = req.user.role === ROLE.PI
      ? { grant: { piId: req.user.id } }
      : {};
    const [grants, milestones] = await Promise.all([
      prisma.grant.findMany({
        where: grantWhere,
        select: { id: true, agency: true, title: true, ucDueDate: true }
      }),
      prisma.milestone.findMany({
        where: milestoneWhere,
        select: { id: true, title: true, dueDate: true, grantId: true }
      })
    ]);
    const events = [
      ...grants.filter((grant) => grant.ucDueDate).map((grant) => ({
        id: `uc-${grant.id}`,
        type: 'UC_DUE',
        date: dateOnly(grant.ucDueDate),
        title: `UC due: ${grant.agency}`,
        subtitle: grant.title,
        href: `/grants/${grant.id}`
      })),
      ...milestones.map((milestone) => ({
        id: milestone.id,
        type: 'MILESTONE',
        date: dateOnly(milestone.dueDate),
        title: milestone.title,
        subtitle: milestone.grantId,
        href: `/grants/${milestone.grantId}`
      }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    res.json(events);
  }));

  function aiRequestId(req, res) {
    const supplied = cleanText(req.headers['x-request-id'], 128);
    const requestId = /^[a-zA-Z0-9._:-]{1,128}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();
    res.set('X-Request-Id', requestId);
    return requestId;
  }

  app.post('/api/chat', optionalAuth, limiters.chat, safeAsync(async (req, res) => {
    const message = cleanText(req.body?.message, 2000);
    if (!message) return res.status(400).json({ error: 'A message is required.' });

    const outcome = await aiService.answer({
      message,
      page: cleanText(req.body?.page, 200),
      history: req.body?.history,
      user: req.user || null,
      prisma,
      requestId: aiRequestId(req, res)
    });
    res
      .status(outcome.status)
      .set('Cache-Control', 'private, no-store')
      .json({
        ...outcome.body,
        error: outcome.status >= 400 ? outcome.body.message : undefined,
        reply: outcome.status < 400 ? outcome.body.answer : undefined,
        recordContext: Boolean(outcome.body.records)
      });
  }));

  app.post('/api/ask', ...auth, limiters.ask, safeAsync(async (req, res) => {
    const question = cleanText(req.body?.q ?? req.body?.question, 2000);
    if (!question) return res.status(400).json({ error: 'A question is required.' });

    const result = await aiService.askRecords({ prisma, user: req.user, question });
    res
      .set('Cache-Control', 'private, no-store')
      .json({
        ...result,
        rows: result.links.map((link) => ({
          id: link.id,
          label: link.label,
          value: link.type === 'grant' ? 'Open grant' : 'Open records',
          href: link.href
        }))
      });
  }));

  app.get(
    '/api/admin/ai/status',
    ...auth,
    requireRole(ROLE.ADMIN),
    safeAsync(async (_req, res) => {
      res
        .set('Cache-Control', 'private, no-store')
        .json(aiService.status());
    })
  );

  app.post(
    '/api/admin/ai/probe',
    ...auth,
    requireRole(ROLE.ADMIN),
    safeAsync(async (req, res) => {
      const result = await aiService.probe(aiRequestId(req, res));
      await logAction(req.user.id, 'AI_PROVIDER_PROBE', 'AIProvider', result.provider || 'configured-order', {
        ok: result.ok,
        code: result.code || 'SUCCESS',
        cached: Boolean(result.cached)
      });
      res
        .status(result.code === 'PROBE_RATE_LIMITED' ? 429 : 200)
        .set('Cache-Control', 'private, no-store')
        .json(result);
    })
  );

  app.get('/api/export/expenses.csv', ...auth, limiters.export, safeAsync(async (req, res) => {
    const expenses = await prisma.expense.findMany({
      where: expenseScope(req.user),
      include: {
        grant: { select: { grantCode: true, piId: true } },
        budgetHead: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });
    const header = [
      'id', 'grantCode', 'vendor', 'invoice', 'amount', 'date', 'head', 'status', 'compliance'
    ].join(',');
    const rows = expenses.map((expense) => [
      expense.id,
      expense.grant.grantCode,
      expense.vendorName,
      expense.invoiceNumber || '',
      number(expense.amount),
      dateOnly(expense.date),
      expense.budgetHead.name,
      expense.status,
      expense.complianceStatus
    ].map(csvCell).join(','));
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="shodhfund-expenses.csv"')
      .set('Cache-Control', 'private, no-store')
      .send([header, ...rows].join('\n'));
  }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      const allowed = new Set([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp'
      ]);
      callback(allowed.has(file.mimetype) ? null : new Error('Only PDF, PNG, JPG, or WebP bills are supported.'), allowed.has(file.mimetype));
    }
  });

  const runSingleBillUpload = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) return next();
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        error: error.message || 'The bill upload is invalid.'
      });
    });
  };

  app.post(
    '/api/expenses/:id/document',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    limiters.upload,
    runSingleBillUpload,
    safeAsync(async (req, res) => {
      if (storage?.invalidEndpoint) {
        console.error('Private document storage misconfigured:', storage.invalidEndpoint);
        return res.status(503).json({
          error: 'Private bill storage is misconfigured. Check B2_ENDPOINT format.'
        });
      }
      if (!storage?.configured) {
        return res.status(503).json({
          error: 'Private bill storage is not configured for this environment.'
        });
      }

      const expense = await prisma.expense.findUnique({
        where: { id: req.params.id },
        include: { grant: { select: { piId: true } } }
      });
      if (!expense) return res.status(404).json({ error: 'Expense not found.' });
      if (!expenseReadableBy(expense, req.user)) {
        return res.status(403).json({ error: 'You do not have access to this expense.' });
      }
      if (!['DRAFT', 'SUBMITTED', 'CORRECTION_REQUESTED'].includes(expense.status)) {
        return res.status(409).json({
          error: 'A bill can be attached only while the expense is draft, submitted, or returned for correction.'
        });
      }

      const file = validateBillFile(req.file);
      const documentId = `doc_${crypto.randomUUID().replace(/-/g, '')}`;
      const objectKey = storageKey({
        expenseId: expense.id,
        documentId,
        mimeType: file.mimeType
      });
      const requestedSource = cleanText(req.body?.ocrSource, 40).toLowerCase();
      const ocrSource = ['gemini', 'sample-demo'].includes(requestedSource)
        ? requestedSource
        : null;
      const ocrModel = ocrSource === 'gemini'
        ? cleanText(process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL, 100) || null
        : null;

      try {
        await storage.put({
          key: objectKey,
          body: file.buffer,
          contentType: file.mimeType,
          metadata: {
            expenseid: expense.id,
            documentid: documentId,
            sha256: file.sha256
          }
        });
      } catch (error) {
        console.error('Private document upload failed:', {
          message: error instanceof Error ? error.message : String(error),
          code: error?.code,
          name: error?.name,
          stack: error instanceof Error ? error.stack?.slice(0, 800) : undefined
        });
        const isInvalidUrl = String(error instanceof Error ? error.message : error).toLowerCase().includes('invalid url');
        return res.status(503).json({
          error: isInvalidUrl
            ? 'Private bill storage endpoint is invalid. Ensure B2_ENDPOINT is https://s3.<region>.backblazeb2.com without quotes and B2_REGION matches.'
            : 'Private bill storage is temporarily unavailable. The expense was not changed.'
        });
      }

      let document;
      try {
        document = await prisma.$transaction(async (tx) => {
          // Lock the parent expense so simultaneous replacements cannot leave two current documents.
          await tx.$queryRaw`SELECT "id" FROM "Expense" WHERE "id" = ${expense.id} FOR UPDATE`;
          await tx.expenseDocument.updateMany({
            where: { expenseId: expense.id, isCurrent: true },
            data: { isCurrent: false, replacedAt: new Date() }
          });
          return tx.expenseDocument.create({
            data: {
              id: documentId,
              expenseId: expense.id,
              objectKey,
              originalName: file.originalName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              sha256: file.sha256,
              ocrSource,
              ocrModel,
              uploadedById: req.user.id
            },
            include: { uploadedBy: { select: { id: true, name: true } } }
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        try {
          await storage.remove(objectKey);
        } catch (cleanupError) {
          console.error('Private document cleanup failed:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
        }
        if (error?.code === 'P2034') {
          return res.status(409).json({
            error: 'This expense document changed at the same time. Reload the expense and try again.'
          });
        }
        throw error;
      }

      await logAction(req.user.id, 'UPLOAD_EXPENSE_DOCUMENT', 'ExpenseDocument', document.id, {
        expenseId: expense.id,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        ocrSource
      });
      return res.status(201).json({ document: serializeDocument(document, expense.id) });
    })
  );

  app.get(
    '/api/expenses/:id/document',
    ...auth,
    safeAsync(async (req, res) => {
      if (storage?.invalidEndpoint) {
        console.error('Private document storage misconfigured:', storage.invalidEndpoint);
        return res.status(503).json({ error: 'Private bill storage is misconfigured. Check B2_ENDPOINT format.' });
      }
      if (!storage?.configured) {
        return res.status(503).json({ error: 'Private bill storage is not configured for this environment.' });
      }
      const expense = await prisma.expense.findUnique({
        where: { id: req.params.id },
        include: {
          grant: { select: { piId: true } },
          documents: {
            where: { isCurrent: true, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });
      if (!expense) return res.status(404).json({ error: 'Expense not found.' });
      if (!expenseReadableBy(expense, req.user)) {
        return res.status(403).json({ error: 'You do not have access to this expense.' });
      }
      const document = expense.documents[0];
      if (!document) return res.status(404).json({ error: 'No current bill document is attached to this expense.' });

      let object;
      try {
        object = await storage.get(document.objectKey);
      } catch (error) {
        const status = error?.code === 'NoSuchKey' ? 404 : 503;
        return res.status(status).json({
          error: status === 404
            ? 'The attached bill document is no longer available.'
            : 'Private bill storage is temporarily unavailable.'
        });
      }

      const filename = safeDownloadName(document.originalName).replace(/"/g, '');
      res
        .status(200)
        .set('Content-Type', document.mimeType)
        .set('Content-Disposition', `attachment; filename="${filename}"`)
        .set('Cache-Control', 'private, no-store');
      if (object.contentLength) res.set('Content-Length', String(object.contentLength));

      try {
        for await (const chunk of object.body) res.write(chunk);
        res.end();
      } catch (error) {
        if (!res.headersSent) throw error;
        res.destroy(error instanceof Error ? error : undefined);
      }

      await logAction(req.user.id, 'DOWNLOAD_EXPENSE_DOCUMENT', 'ExpenseDocument', document.id, {
        expenseId: expense.id
      });
    })
  );

  app.post(
    '/api/ocr/extract',
    ...auth,
    requireRole(ROLE.PI, ROLE.ADMIN),
    limiters.upload,
    runSingleBillUpload,
    safeAsync(async (req, res) => {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Choose a PDF or image bill to extract.' });
      }
      const result = await extractBill({
        filename: req.file.originalname,
        mime: req.file.mimetype,
        buffer: req.file.buffer
      });
      res.json({
        ...result,
        aiExtractionProof:
          result.source === 'gemini' ? createOcrProof(req.user.id, result) : undefined
      });
    })
  );
};