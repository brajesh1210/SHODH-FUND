'use strict';

const MAX_RESULTS = 8;

function contextText(value, max = 180) {
  const limit = Math.min(Math.max(Number(max) || 1, 1), 1000);
  const input = String(value || '').slice(0, Math.min(Math.max(limit * 8, 2000), 8000));
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/gi, ' ')
    .replace(/AUTHORIZED_RECORD_DATA_(?:BEGIN|END)/gi, '[redacted-boundary]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/gi, '[redacted-gstin]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[redacted-pan]')
    .replace(/(^|[^\d])((?:(?:\+?91[\s-]?|0)?[6-9]\d(?:[\s-]?\d){8}))(?!\d)/g, '$1[redacted-phone]')
    .replace(/\b(?:\d[ -]?){12,16}\b/g, '[redacted-number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function date(value) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).format(new Date(value));
}

function grantScope(user) {
  return user.role === 'PI' ? { piId: user.id } : {};
}

function expenseScope(user) {
  return user.role === 'PI' ? { grant: { piId: user.id } } : {};
}

function rolePath(user, section) {
  const role = String(user.role || '').toLowerCase();
  const allowed = {
    PI: { expenses: '/dashboard/pi/expenses', milestones: '/dashboard/pi/milestones', grants: '/dashboard/pi/grants' },
    FINANCE: { expenses: '/dashboard/finance/verify', uc: '/dashboard/finance/uc', grants: '/dashboard/finance/grants', anomalies: '/dashboard/finance/anomalies' },
    ADMIN: { grants: '/dashboard/admin/grants' },
    AUDITOR: { anomalies: '/dashboard/auditor/compliance', grants: '/dashboard/auditor/assignments' }
  };
  return allowed[user.role]?.[section] || `/dashboard/${role}`;
}

function grantLink(grant) {
  return { type: 'grant', id: grant.id, label: grant.grantCode, href: `/grants/${encodeURIComponent(grant.id)}` };
}

function sectionLink(user, section, label) {
  return { type: section, id: section, label, href: rolePath(user, section) };
}

function contextFor(type, items) {
  return {
    type,
    generatedAt: new Date().toISOString(),
    records: items.slice(0, MAX_RESULTS)
  };
}

function extractRecordId(message, prefix) {
  const match = String(message || '').match(new RegExp(`\\b${prefix}-[A-Z0-9-]+\\b`, 'i'));
  return match ? match[0].toUpperCase() : null;
}

function searchTerm(message) {
  const terms = String(message || '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 4 && ![
      'show', 'find', 'search', 'grant', 'grants', 'expense', 'expenses', 'record', 'records',
      'what', 'which', 'with', 'from', 'have', 'about', 'please', 'status', 'detail', 'details'
    ].includes(term.toLowerCase()));
  return terms[0]?.slice(0, 60) || '';
}

async function grantDetail(prisma, user, id) {
  const grant = await prisma.grant.findFirst({
    where: { ...grantScope(user), OR: [{ id }, { grantCode: id }] },
    select: {
      id: true,
      grantCode: true,
      title: true,
      agency: true,
      sanctionedAmount: true,
      spentAmount: true,
      status: true,
      startDate: true,
      endDate: true,
      ucDueDate: true,
      budgetHeads: { select: { name: true, allocatedAmount: true, spentAmount: true }, orderBy: { name: 'asc' }, take: 8 }
    }
  });
  if (!grant) return null;
  const balance = Number(grant.sanctionedAmount) - Number(grant.spentAmount);
  const budget = grant.budgetHeads.map((head) => ({
    name: head.name,
    allocated: Number(head.allocatedAmount),
    spent: Number(head.spentAmount),
    balance: Number(head.allocatedAmount) - Number(head.spentAmount)
  }));
  return {
    answer: [
      `${grant.grantCode} — ${grant.title}`,
      `Agency: ${grant.agency}. Status: ${grant.status}.`,
      `Sanctioned: ${money(grant.sanctionedAmount)}. Recorded spent: ${money(grant.spentAmount)}. Balance: ${money(balance)}.`,
      `Period: ${date(grant.startDate)} to ${date(grant.endDate)}. UC due: ${date(grant.ucDueDate)}.`,
      budget.length ? `Budget heads: ${budget.map((item) => `${item.name} ${money(item.balance)} remaining`).join('; ')}.` : ''
    ].filter(Boolean).join('\n'),
    links: [grantLink(grant)],
    context: contextFor('grant-detail', [{
      id: grant.id,
      code: grant.grantCode,
      title: contextText(grant.title, 160),
      agency: contextText(grant.agency, 80),
      status: grant.status,
      sanctionedAmount: Number(grant.sanctionedAmount),
      spentAmount: Number(grant.spentAmount),
      balance,
      budgetHeads: budget.map((item) => ({ ...item, name: contextText(item.name, 80) }))
    }])
  };
}

async function expenseDetail(prisma, user, id) {
  const expense = await prisma.expense.findFirst({
    where: { id, ...expenseScope(user) },
    select: {
      id: true,
      amount: true,
      date: true,
      vendorName: true,
      description: true,
      status: true,
      complianceStatus: true,
      grant: { select: { id: true, grantCode: true, title: true } },
      budgetHead: { select: { name: true } },
      anomalies: { where: { resolved: false }, select: { severity: true, reason: true }, take: 5 }
    }
  });
  if (!expense) return null;
  return {
    answer: [
      `${expense.id}: ${money(expense.amount)} on ${date(expense.date)} for ${expense.description}.`,
      `Grant: ${expense.grant.grantCode}. Budget head: ${expense.budgetHead.name}.`,
      `Workflow status: ${expense.status}. Recorded compliance: ${expense.complianceStatus}.`,
      expense.anomalies.length ? `Open anomaly flags: ${expense.anomalies.map((item) => `${item.severity} — ${item.reason}`).join('; ')}.` : 'Open anomaly flags: none recorded.'
    ].join('\n'),
    links: [grantLink(expense.grant), sectionLink(user, 'expenses', 'Open expenses')],
    context: contextFor('expense-detail', [{
      id: expense.id,
      amount: Number(expense.amount),
      date: expense.date.toISOString(),
      description: contextText(expense.description, 180),
      status: expense.status,
      complianceStatus: expense.complianceStatus,
      grantCode: expense.grant.grantCode,
      budgetHead: contextText(expense.budgetHead.name, 80),
      openAnomalies: expense.anomalies.map((item) => ({ severity: item.severity, reason: contextText(item.reason, 160) }))
    }])
  };
}

async function pendingExpenses(prisma, user) {
  const items = await prisma.expense.findMany({
    where: { ...expenseScope(user), status: { in: ['SUBMITTED', 'CORRECTION_REQUESTED'] } },
    orderBy: [{ date: 'desc' }, { id: 'asc' }],
    take: MAX_RESULTS,
    select: {
      id: true,
      amount: true,
      date: true,
      description: true,
      status: true,
      complianceStatus: true,
      grant: { select: { id: true, grantCode: true } }
    }
  });
  return {
    answer: items.length
      ? `Pending expense records (${items.length}${items.length === MAX_RESULTS ? ', capped' : ''}):\n${items.map((item) => `• ${item.id} — ${money(item.amount)}, ${item.status}, ${item.grant.grantCode}, ${date(item.date)}`).join('\n')}`
      : 'No submitted or correction-requested expense records are accessible to you.',
    links: [sectionLink(user, 'expenses', 'Open expenses'), ...items.slice(0, 3).map((item) => grantLink(item.grant))],
    context: contextFor('pending-expenses', items.map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      date: item.date.toISOString(),
      status: item.status,
      complianceStatus: item.complianceStatus,
      grantCode: item.grant.grantCode,
      description: contextText(item.description, 120)
    })))
  };
}

async function budgetBalances(prisma, user) {
  const grants = await prisma.grant.findMany({
    where: grantScope(user),
    orderBy: [{ status: 'asc' }, { grantCode: 'asc' }],
    take: MAX_RESULTS,
    select: { id: true, grantCode: true, title: true, sanctionedAmount: true, spentAmount: true, status: true }
  });
  return {
    answer: grants.length
      ? `Accessible grant balances:\n${grants.map((grant) => `• ${grant.grantCode} — ${money(Number(grant.sanctionedAmount) - Number(grant.spentAmount))} remaining (${money(grant.spentAmount)} recorded spent of ${money(grant.sanctionedAmount)})`).join('\n')}`
      : 'No accessible grant balances were found.',
    links: [sectionLink(user, 'grants', 'Open grants'), ...grants.slice(0, 4).map(grantLink)],
    context: contextFor('grant-balances', grants.map((grant) => ({
      id: grant.id,
      code: grant.grantCode,
      title: contextText(grant.title, 140),
      status: grant.status,
      sanctionedAmount: Number(grant.sanctionedAmount),
      spentAmount: Number(grant.spentAmount),
      balance: Number(grant.sanctionedAmount) - Number(grant.spentAmount)
    })))
  };
}

async function milestoneStatus(prisma, user) {
  const items = await prisma.milestone.findMany({
    where: { grant: grantScope(user) },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    take: MAX_RESULTS,
    select: { id: true, title: true, dueDate: true, status: true, grant: { select: { id: true, grantCode: true } } }
  });
  return {
    answer: items.length
      ? `Accessible milestones:\n${items.map((item) => `• ${item.title} — ${item.status}, due ${date(item.dueDate)}, ${item.grant.grantCode}`).join('\n')}`
      : 'No accessible milestones were found.',
    links: [sectionLink(user, 'milestones', 'Open milestones'), ...items.slice(0, 3).map((item) => grantLink(item.grant))],
    context: contextFor('milestones', items.map((item) => ({ id: item.id, title: contextText(item.title, 160), dueDate: item.dueDate.toISOString(), status: item.status, grantCode: item.grant.grantCode })))
  };
}

async function ucStatus(prisma, user) {
  const items = await prisma.utilizationCertificate.findMany({
    where: { grant: grantScope(user) },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: MAX_RESULTS,
    select: { id: true, financialYear: true, totalUtilized: true, balanceAmount: true, status: true, grant: { select: { id: true, grantCode: true } } }
  });
  return {
    answer: items.length
      ? `Accessible utilization certificates:\n${items.map((item) => `• ${item.grant.grantCode}, FY ${item.financialYear} — ${item.status}; utilized ${money(item.totalUtilized)}; balance ${money(item.balanceAmount)}`).join('\n')}`
      : 'No accessible utilization certificates were found.',
    links: [sectionLink(user, 'uc', 'Open utilization certificates'), ...items.slice(0, 3).map((item) => grantLink(item.grant))],
    context: contextFor('utilization-certificates', items.map((item) => ({ id: item.id, financialYear: item.financialYear, status: item.status, totalUtilized: Number(item.totalUtilized), balanceAmount: Number(item.balanceAmount), grantCode: item.grant.grantCode })))
  };
}

async function anomalyStatus(prisma, user) {
  const items = await prisma.anomaly.findMany({
    where: { resolved: false, expense: expenseScope(user) },
    orderBy: [{ detectedAt: 'desc' }, { id: 'asc' }],
    take: MAX_RESULTS,
    select: { id: true, severity: true, reason: true, detectedAt: true, expense: { select: { id: true, grant: { select: { id: true, grantCode: true } } } } }
  });
  return {
    answer: items.length
      ? `Open accessible anomaly flags:\n${items.map((item) => `• ${item.severity} — ${item.reason} (${item.expense.id}, ${item.expense.grant.grantCode})`).join('\n')}`
      : 'No open anomaly flags are accessible to you.',
    links: [sectionLink(user, 'anomalies', 'Open anomaly review'), ...items.slice(0, 3).map((item) => grantLink(item.expense.grant))],
    context: contextFor('anomalies', items.map((item) => ({ id: item.id, severity: item.severity, reason: contextText(item.reason, 180), expenseId: item.expense.id, grantCode: item.expense.grant.grantCode })))
  };
}

async function searchAccessible(prisma, user, message) {
  const term = searchTerm(message);
  const grantTerm = term ? {
    OR: [
      { grantCode: { contains: term, mode: 'insensitive' } },
      { title: { contains: term, mode: 'insensitive' } },
      { agency: { contains: term, mode: 'insensitive' } }
    ]
  } : {};
  const expenseTerm = term ? {
    OR: [
      { id: { contains: term, mode: 'insensitive' } },
      { vendorName: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } }
    ]
  } : null;

  const [grantMatches, expenseMatches] = await Promise.all([
    prisma.grant.findMany({
      where: { ...grantScope(user), ...grantTerm },
      orderBy: { grantCode: 'asc' },
      take: MAX_RESULTS,
      select: { id: true, grantCode: true, title: true, agency: true, status: true, sanctionedAmount: true, spentAmount: true }
    }),
    expenseTerm
      ? prisma.expense.findMany({
          where: { ...expenseScope(user), ...expenseTerm },
          orderBy: [{ date: 'desc' }, { id: 'asc' }],
          take: MAX_RESULTS,
          select: { id: true, amount: true, date: true, description: true, status: true, grant: { select: { id: true, grantCode: true } } }
        })
      : Promise.resolve([])
  ]);

  // Interleave both authorized result types so a full grant result set cannot
  // hide a matching expense (or vice versa), while retaining one global cap.
  const combined = [];
  for (let index = 0; combined.length < MAX_RESULTS; index += 1) {
    const grant = grantMatches[index];
    const expense = expenseMatches[index];
    if (!grant && !expense) break;
    if (grant) combined.push({ kind: 'grant', value: grant });
    if (expense && combined.length < MAX_RESULTS) combined.push({ kind: 'expense', value: expense });
  }
  const grants = combined.filter((item) => item.kind === 'grant').map((item) => item.value);
  const expenses = combined.filter((item) => item.kind === 'expense').map((item) => item.value);
  const answerRows = [
    ...grants.map((grant) => `• Grant ${grant.grantCode} — ${grant.title}; ${grant.agency}; ${grant.status}; ${money(Number(grant.sanctionedAmount) - Number(grant.spentAmount))} remaining`),
    ...expenses.map((expense) => `• Expense ${expense.id} — ${money(expense.amount)}; ${expense.status}; ${expense.grant.grantCode}; ${expense.description}`)
  ];
  const linkedGrants = new Map();
  for (const grant of grants) linkedGrants.set(grant.id, grant);
  for (const expense of expenses) linkedGrants.set(expense.grant.id, expense.grant);

  return {
    answer: answerRows.length
      ? `${term ? `Accessible records matching “${term}”` : 'Accessible grants'}:
${answerRows.join('\n')}`
      : `No accessible records${term ? ` matching “${term}”` : ''} were found.`,
    links: [
      sectionLink(user, 'grants', 'Open grants'),
      ...(expenses.length ? [sectionLink(user, 'expenses', 'Open expenses')] : []),
      ...[...linkedGrants.values()].slice(0, 5).map(grantLink)
    ],
    context: contextFor('accessible-record-search', [
      ...grants.map((grant) => ({ kind: 'grant', id: grant.id, code: grant.grantCode, title: contextText(grant.title, 160), agency: contextText(grant.agency, 80), status: grant.status, balance: Number(grant.sanctionedAmount) - Number(grant.spentAmount) })),
      ...expenses.map((expense) => ({ kind: 'expense', id: expense.id, amount: Number(expense.amount), date: expense.date.toISOString(), description: contextText(expense.description, 160), status: expense.status, grantCode: expense.grant.grantCode }))
    ])
  };
}

async function retrieveAuthorizedRecords({ prisma, user, message }) {
  if (!user?.id || !user?.role) throw new Error('Authenticated user required for record retrieval');
  const text = String(message || '').trim();
  const grantId = extractRecordId(text, 'GR');
  const expenseId = extractRecordId(text, 'EXP');

  if (expenseId) {
    const result = await expenseDetail(prisma, user, expenseId);
    if (result) return { ...result, intent: 'expense-detail' };
    return { answer: `Expense ${expenseId} was not found or is not accessible to your account.`, links: [], context: null, intent: 'not-found' };
  }
  if (grantId) {
    const result = await grantDetail(prisma, user, grantId);
    if (result) return { ...result, intent: 'grant-detail' };
    return { answer: `Grant ${grantId} was not found or is not accessible to your account.`, links: [], context: null, intent: 'not-found' };
  }
  if (/\b(pending|submitted|correction)\b.*\b(expense|bill)|\b(expense|bill).*(pending|submitted|correction)\b/i.test(text)) {
    return { ...(await pendingExpenses(prisma, user)), intent: 'pending-expenses' };
  }
  if (/\b(budget|balance|remaining|spent|sanctioned|available)\b/i.test(text)) {
    return { ...(await budgetBalances(prisma, user)), intent: 'budget-balances' };
  }
  if (/\bmilestones?\b|\bdue dates?\b/i.test(text)) {
    return { ...(await milestoneStatus(prisma, user)), intent: 'milestones' };
  }
  if (/utili[sz]ation certificate|\buc\b/i.test(text)) {
    return { ...(await ucStatus(prisma, user)), intent: 'utilization-certificates' };
  }
  if (/\banomal|\bflag|non[- ]?compliant/i.test(text)) {
    return { ...(await anomalyStatus(prisma, user)), intent: 'anomalies' };
  }
  return { ...(await searchAccessible(prisma, user, text)), intent: 'accessible-record-search' };
}

module.exports = {
  MAX_RESULTS,
  budgetBalances,
  contextText,
  expenseDetail,
  grantDetail,
  money,
  retrieveAuthorizedRecords,
  searchAccessible
};
