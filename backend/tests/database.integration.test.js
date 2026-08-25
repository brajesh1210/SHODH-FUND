'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

if (process.env.NODE_ENV !== 'test' || process.env.SHODHFUND_TEST_DATABASE !== 'true') {
  throw new Error(
    'Database integration tests require NODE_ENV=test and SHODHFUND_TEST_DATABASE=true.'
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for database integration tests.');
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
if (!/^shodhfund_(ci|test|phase3_clean_)/.test(databaseName)) {
  throw new Error(`Refusing to use non-test database ${databaseName}.`);
}

process.env.JWT_SECRET ||= 'phase-3-integration-test-secret-at-least-32-characters';
process.env.CORS_ORIGIN ||= '';

let apiBase;
let appServer;
let prisma;
let request;
const tokens = {};
const stamp = `${Date.now()}-${process.pid}`;
const testGrantCode = `TST-PHASE3-${stamp}`.toUpperCase();
let testGrant;
let testHead;

function indianDateParts(date = new Date()) {
  const indiaTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return {
    year: indiaTime.getUTCFullYear(),
    month: indiaTime.getUTCMonth() + 1,
    day: indiaTime.getUTCDate()
  };
}

function isoDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function currentIndianFinancialYear() {
  const { year, month } = indianDateParts();
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function login(email) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'demo1234' }
  });
  assert.equal(response.status, 200, `login failed for ${email}: ${JSON.stringify(response.body)}`);
  return response.body.token;
}

function authenticated(role, path, options = {}) {
  return request(path, { ...options, token: tokens[role] });
}

async function createExpense({ amount, invoice, vendor = 'Phase 3 Test Vendor' }) {
  return authenticated('pi', '/api/expenses', {
    method: 'POST',
    body: {
      grantId: testGrant.id,
      budgetHeadId: testHead.id,
      amount,
      date: isoDate(indianDateParts()),
      vendorName: vendor,
      invoiceNumber: invoice,
      description: `Database integration record ${invoice}`
    }
  });
}

before(async () => {
  const serverModule = require('../src/server');
  prisma = serverModule.prisma;
  appServer = await new Promise((resolve, reject) => {
    const listener = serverModule.app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  apiBase = `http://127.0.0.1:${appServer.address().port}`;

  request = async (path, { method = 'GET', token, body } = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const contentType = response.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    return { status: response.status, body: responseBody, headers: response.headers };
  };

  tokens.pi = await login('arjun.sharma@university.edu');
  tokens.pi2 = await login('priya.verma@university.edu');
  tokens.finance = await login('rohit.mehta@university.edu');
  tokens.admin = await login('meera.iyer@university.edu');
  tokens.auditor = await login('sk.verma@university.edu');
});

after(async () => {
  if (appServer) {
    await new Promise((resolve, reject) => appServer.close((error) => error ? reject(error) : resolve()));
  }
  if (prisma) await prisma.$disconnect();
});

test('migration and deterministic seed enforce authoritative database invariants', async () => {
  assert.equal(await prisma.user.count(), 6);
  assert.equal(await prisma.grant.count({ where: { id: { startsWith: 'GR-' } } }), 6);
  assert.equal(await prisma.budgetHead.count({ where: { id: { startsWith: 'bh-' } } }), 18);
  assert.equal(await prisma.expense.count({ where: { id: { startsWith: 'EXP-' } } }), 8);
  assert.equal(await prisma.approval.count({ where: { id: { startsWith: 'ap-' } } }), 3);

  const demoGrants = await prisma.grant.findMany({
    where: { id: { startsWith: 'GR-' } },
    include: { budgetHeads: true, expenses: true }
  });
  for (const grant of demoGrants) {
    const allocated = grant.budgetHeads.reduce(
      (sum, head) => sum + Number(head.allocatedAmount),
      0
    );
    const spent = grant.budgetHeads.reduce((sum, head) => sum + Number(head.spentAmount), 0);
    assert.equal(allocated, Number(grant.sanctionedAmount), `${grant.id} allocation mismatch`);
    assert.equal(spent, Number(grant.spentAmount), `${grant.id} spending mismatch`);
    assert.ok(
      grant.expenses.every((expense) => expense.submittedById === grant.piId),
      `${grant.id} contains an expense attributed to a different PI`
    );
  }

  await assert.rejects(
    prisma.notification.create({
      data: {
        id: `orphan-${stamp}`,
        userId: `missing-${stamp}`,
        title: 'Must fail',
        message: 'Foreign-key regression check',
        type: 'GENERAL'
      }
    }),
    (error) => error?.code === 'P2003'
  );

  await assert.rejects(
    prisma.grant.create({
      data: {
        id: `negative-${stamp}`,
        grantCode: `NEGATIVE-${stamp}`.toUpperCase(),
        title: 'Must fail',
        agency: 'TEST',
        sanctionedAmount: -1,
        spentAmount: 0,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        piId: 'u-pi'
      }
    }),
    (error) => String(error).includes('Grant_sanctionedAmount_positive')
  );
});

test('authentication, roles, and PI ownership are enforced by live database records', async () => {
  const unauthenticated = await request('/api/grants');
  assert.equal(unauthenticated.status, 401);

  const piGrants = await authenticated('pi', '/api/grants');
  assert.equal(piGrants.status, 200);
  assert.ok(piGrants.body.length >= 3);
  assert.ok(piGrants.body.every((grant) => grant.piDetails?.id === 'u-pi'));

  const otherPiGrant = await authenticated('pi', '/api/grants/GR-UGC-2209');
  assert.equal(otherPiGrant.status, 403);

  const financeGrants = await authenticated('finance', '/api/grants');
  assert.equal(financeGrants.status, 200);
  assert.ok(financeGrants.body.some((grant) => grant.id === 'GR-UGC-2209'));

  const auditorCreate = await authenticated('auditor', '/api/grants', {
    method: 'POST',
    body: { title: 'Forbidden', agency: 'TEST', sanctionedAmount: 1000 }
  });
  assert.equal(auditorCreate.status, 403);
});

test('concurrent expense submissions preserve grant and budget-head totals', async () => {
  const created = await authenticated('pi', '/api/grants', {
    method: 'POST',
    body: {
      grantCode: testGrantCode,
      title: 'Phase 3 PostgreSQL Concurrency Grant',
      agency: 'TEST',
      sanctionedAmount: 100000,
      startDate: '2020-04-01',
      endDate: '2099-03-31',
      ucDueDate: '2099-03-31',
      initialBudgetHead: 'General',
      initialBudgetCategory: 'CONTINGENCY'
    }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  testGrant = created.body;
  testHead = created.body.budgetHeads[0];

  const otherPiRead = await authenticated('pi2', `/api/grants/${testGrant.id}`);
  assert.equal(otherPiRead.status, 403);
  const otherPiExpense = await authenticated('pi2', '/api/expenses', {
    method: 'POST',
    body: {
      grantId: testGrant.id,
      amount: 100,
      date: isoDate(indianDateParts()),
      vendorName: 'Forbidden vendor',
      invoiceNumber: `FORBIDDEN-${stamp}`,
      description: 'Must not be created'
    }
  });
  assert.equal(otherPiExpense.status, 403);

  const attempts = await Promise.all(
    Array.from({ length: 6 }, (_, index) => createExpense({
      amount: 100,
      invoice: `CONCURRENT-${stamp}-${index}`
    }))
  );
  assert.ok(attempts.every((response) => [201, 409].includes(response.status)));
  const successful = attempts.filter((response) => response.status === 201);
  assert.ok(successful.length >= 1);

  const [grantAfter, headAfter] = await Promise.all([
    prisma.grant.findUnique({ where: { id: testGrant.id } }),
    prisma.budgetHead.findUnique({ where: { id: testHead.id } })
  ]);
  assert.equal(Number(grantAfter.spentAmount), successful.length * 100);
  assert.equal(Number(headAfter.spentAmount), successful.length * 100);
});

test('duplicate detection and competing finance decisions cannot double-apply totals', async () => {
  const first = await createExpense({
    amount: 250,
    invoice: `DUPLICATE-${stamp}`,
    vendor: 'Duplicate Detection Vendor'
  });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const duplicate = await createExpense({
    amount: 250,
    invoice: `DUPLICATE-${stamp}`,
    vendor: 'Duplicate Detection Vendor'
  });
  assert.equal(duplicate.status, 201, JSON.stringify(duplicate.body));
  assert.equal(duplicate.body.complianceStatus, 'NON_COMPLIANT');
  assert.ok(duplicate.body.anomalies.some((anomaly) => anomaly.severity === 'HIGH'));

  const beforeDecision = await prisma.grant.findUnique({ where: { id: testGrant.id } });
  const decisions = await Promise.all([
    authenticated('finance', `/api/expenses/${duplicate.body.id}/decide`, {
      method: 'POST',
      body: { action: 'APPROVED' }
    }),
    authenticated('finance', `/api/expenses/${duplicate.body.id}/decide`, {
      method: 'POST',
      body: { action: 'REJECTED', reason: 'Concurrent rejection regression' }
    })
  ]);
  assert.deepEqual(decisions.map((response) => response.status).sort(), [200, 409]);

  const finalExpense = await prisma.expense.findUnique({
    where: { id: duplicate.body.id },
    include: { approvals: true }
  });
  assert.ok(['APPROVED', 'REJECTED'].includes(finalExpense.status));
  assert.equal(finalExpense.approvals.length, 1);

  const [grantAfter, headAfter] = await Promise.all([
    prisma.grant.findUnique({ where: { id: testGrant.id } }),
    prisma.budgetHead.findUnique({ where: { id: testHead.id } })
  ]);
  const expectedAfter = Number(beforeDecision.spentAmount) -
    (finalExpense.status === 'REJECTED' ? 250 : 0);
  assert.equal(Number(grantAfter.spentAmount), expectedAfter);
  assert.equal(Number(headAfter.spentAmount), expectedAfter);
});

test('stale correction writes have one winner and adjust financial totals once', async () => {
  const created = await createExpense({
    amount: 400,
    invoice: `STALE-${stamp}`,
    vendor: 'Stale Write Vendor'
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const correction = await authenticated('finance', `/api/expenses/${created.body.id}/decide`, {
    method: 'POST',
    body: { action: 'CORRECTION_REQUESTED', reason: 'Exercise optimistic workflow claim' }
  });
  assert.equal(correction.status, 200, JSON.stringify(correction.body));

  const beforeEdit = await prisma.grant.findUnique({ where: { id: testGrant.id } });
  const edits = await Promise.all([
    authenticated('pi', `/api/expenses/${created.body.id}`, {
      method: 'PUT',
      body: { amount: 450 }
    }),
    authenticated('pi', `/api/expenses/${created.body.id}`, {
      method: 'PUT',
      body: { amount: 475 }
    })
  ]);
  assert.deepEqual(edits.map((response) => response.status).sort(), [200, 409]);

  const winner = edits.find((response) => response.status === 200);
  const [expenseAfter, grantAfter, headAfter] = await Promise.all([
    prisma.expense.findUnique({ where: { id: created.body.id } }),
    prisma.grant.findUnique({ where: { id: testGrant.id } }),
    prisma.budgetHead.findUnique({ where: { id: testHead.id } })
  ]);
  assert.equal(Number(expenseAfter.amount), winner.body.amount);
  assert.equal(expenseAfter.status, 'SUBMITTED');
  const expectedTotal = Number(beforeEdit.spentAmount) - 400 + winner.body.amount;
  assert.equal(Number(grantAfter.spentAmount), expectedTotal);
  assert.equal(Number(headAfter.spentAmount), expectedTotal);
});

test('one UC per grant/year and conditional workflow transitions survive concurrency', async () => {
  const financialYear = currentIndianFinancialYear();
  const generations = await Promise.all(
    Array.from({ length: 5 }, () => authenticated('pi', '/api/uc/generate', {
      method: 'POST',
      body: { grantId: testGrant.id, financialYear }
    }))
  );
  assert.ok(generations.some((response) => response.status === 201));
  assert.ok(generations.every((response) => [200, 201, 409].includes(response.status)));

  const records = await prisma.utilizationCertificate.findMany({
    where: { grantId: testGrant.id, financialYear }
  });
  assert.equal(records.length, 1);
  const uc = records[0];

  const piTransition = await authenticated('pi', `/api/ucs/${uc.id}/status`, {
    method: 'PUT',
    body: { status: 'UNDER_REVIEW' }
  });
  assert.equal(piTransition.status, 403);

  const review = await authenticated('finance', `/api/ucs/${uc.id}/status`, {
    method: 'PUT',
    body: { status: 'UNDER_REVIEW' }
  });
  assert.equal(review.status, 200, JSON.stringify(review.body));

  const approvals = await Promise.all([
    authenticated('finance', `/api/ucs/${uc.id}/status`, {
      method: 'PUT', body: { status: 'APPROVED' }
    }),
    authenticated('finance', `/api/ucs/${uc.id}/status`, {
      method: 'PUT', body: { status: 'APPROVED' }
    })
  ]);
  assert.deepEqual(approvals.map((response) => response.status).sort(), [200, 409]);

  const submitted = await authenticated('finance', `/api/ucs/${uc.id}/status`, {
    method: 'PUT',
    body: { status: 'SUBMITTED_TO_AGENCY' }
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

  const overwrite = await authenticated('pi', '/api/uc/generate', {
    method: 'POST',
    body: { grantId: testGrant.id, financialYear }
  });
  assert.equal(overwrite.status, 409);
});

test('bulk notification reads are user-scoped and audit records remain role-scoped', async () => {
  const created = await Promise.all([1, 2].map((index) =>
    authenticated('admin', '/api/notifications', {
      method: 'POST',
      body: {
        userId: 'u-pi',
        title: `Phase 3 notification ${index}`,
        message: `Database notification ${stamp}-${index}`,
        type: 'GENERAL'
      }
    })
  ));
  assert.ok(created.every((response) => response.status === 201));

  const forbidden = await authenticated('pi2', `/api/notifications/${created[0].body.id}/read`, {
    method: 'PUT'
  });
  assert.equal(forbidden.status, 403);

  const financeUnreadBefore = await prisma.notification.count({
    where: { userId: 'u-fin', read: false }
  });
  const marked = await authenticated('pi', '/api/notifications/read-all', { method: 'PUT' });
  assert.equal(marked.status, 200);
  assert.ok(marked.body.updated >= 2);
  assert.equal(await prisma.notification.count({ where: { userId: 'u-pi', read: false } }), 0);
  assert.equal(
    await prisma.notification.count({ where: { userId: 'u-fin', read: false } }),
    financeUnreadBefore
  );

  const piAudit = await authenticated('pi', '/api/audit-logs');
  assert.equal(piAudit.status, 403);
  const auditorAudit = await authenticated('auditor', '/api/audit-logs');
  assert.equal(auditorAudit.status, 200);
  assert.ok(auditorAudit.body.some(
    (record) => record.entityType === 'Grant' && record.entityId === testGrant.id
  ));
  assert.ok(auditorAudit.body.some(
    (record) => record.entityType === 'Expense' && record.action === 'CREATE_EXPENSE'
  ));
});
