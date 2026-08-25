'use strict';

function builtInAssistantReply(message, recordResult = null, authenticated = false) {
  if (recordResult) return recordResult.answer;

  const q = String(message || '').toLowerCase();
  const signInNotice = authenticated
    ? ' Use Ask Records when you need exact values from your accessible database records.'
    : ' Sign in and use Ask Records when you need exact values from your own workspace.';

  if (/\b(my|our)\b.*(grant|expense|budget|uc|milestone|anomal)|pending expense|how much.*spent/.test(q)) {
    return `I cannot provide account-specific values without an authenticated record query.${signInNotice}`;
  }
  if (/utili[sz]ation certificate|\buc\b/.test(q)) {
    return `In ShodhFund, a PI selects an owned grant and Indian financial year to generate a working utilization calculation. The server derives the 1 April–31 March period from approved expenses, while Finance controls review and approval. Reconcile source records and use the institution or funding agency's required certified format before signature or submission.${signInNotice}`;
  }
  if (/expense|invoice|bill|vendor/.test(q)) {
    return `Expense workflow: a PI records a bill against an owned grant and budget head, Finance reviews the submitted record, and authorized audit users inspect compliance fields and anomalies. Bill extraction is an aid only; verify the vendor, amount, invoice, date, GST value, description, and budget head before saving.${signInNotice}`;
  }
  if (/gfr|compliance|audit/.test(q)) {
    return `ShodhFund's compliance status, issue flags, approval history, and audit trail are review aids. They do not replace formal GFR, finance, procurement, or audit assessment. Check the source evidence, authorization, procurement route, applicable thresholds, and institutional policy before deciding.${signInNotice}`;
  }
  if (/grant|fund|budget/.test(q)) {
    return `A ShodhFund grant connects sanctioned funding, budget heads, expenses, milestones, utilization certificates, objections, and audit history. Access is role- and ownership-scoped; exact totals and statuses should come from authenticated records rather than generated prose.${signInNotice}`;
  }
  return `I can provide built-in workflow guidance for grants, expenses, budget heads, utilization certificates, and recorded compliance checks.${signInNotice}`;
}

module.exports = { builtInAssistantReply };
