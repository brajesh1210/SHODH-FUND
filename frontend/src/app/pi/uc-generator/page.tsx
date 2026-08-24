'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { formatINR } from '@/lib/format';
import { AppShell } from '@/components/AppShell';

type Grant = {
  id: string;
  projectTitle: string;
  grantCode: string;
  agency: string;
  sanctionedAmount: number;
  startDate?: string;
  endDate?: string;
};

type HeadSummary = {
  id?: string;
  name: string;
  allocated: number;
  spent: number;
  balance: number;
};

type GeneratedContent = {
  basis?: string;
  expenseDateBasis?: string;
  allocationBasis?: string;
  balanceBasis?: string;
  periodStart?: string;
  periodEnd?: string;
  periodApprovedExpenditure?: number;
  cumulativeApprovedExpenditure?: number;
  cumulativeApprovedThroughPeriod?: number;
  currentSanctionedAmount?: number;
  sanctionBalanceAtPeriodEnd?: number;
  utilizationPct?: number;
  heads?: HeadSummary[];
};

type UC = {
  id: string;
  grantId: string;
  financialYear: string;
  period: string;
  totalUtilized: number;
  balanceAmount: number;
  status: string;
  generatedContent?: GeneratedContent;
  grant: Grant;
  heads?: HeadSummary[];
};

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
}

function financialYearStart(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return month >= 4 ? year : year - 1;
}

function dateFinancialYearStart(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : financialYearStart(date);
}

function fyLabel(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function financialYearPeriod(financialYear: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!match) return 'Select a valid financial year';
  const startYear = Number(match[1]);
  return `1 Apr ${startYear} – 31 Mar ${startYear + 1}`;
}

function grantFinancialYears(grant?: Grant) {
  const currentStart = financialYearStart(new Date());
  const first = dateFinancialYearStart(grant?.startDate) ?? currentStart;
  const grantEnd = dateFinancialYearStart(grant?.endDate) ?? currentStart;
  const last = Math.min(grantEnd, currentStart);
  const years: string[] = [];
  for (let year = last; year >= first; year -= 1) years.push(fyLabel(year));
  return years;
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  SUBMITTED_TO_AGENCY: 'Submitted to agency'
};

export default function UCGeneratorPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [ucs, setUcs] = useState<UC[]>([]);
  const [grantId, setGrantId] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [grantResponse, ucResponse] = await Promise.all([
        api<Grant[]>('/api/grants'),
        api<UC[]>('/api/ucs')
      ]);
      const nextGrants = Array.isArray(grantResponse) ? grantResponse : [];
      setGrants(nextGrants);
      setUcs(Array.isArray(ucResponse) ? ucResponse : []);
      setGrantId((current) =>
        current && nextGrants.some((grant) => grant.id === current)
          ? current
          : nextGrants[0]?.id || ''
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load UC records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedGrant = useMemo(
    () => grants.find((grant) => grant.id === grantId),
    [grants, grantId]
  );
  const financialYears = useMemo(() => grantFinancialYears(selectedGrant), [selectedGrant]);

  useEffect(() => {
    setFinancialYear((current) =>
      current && financialYears.includes(current) ? current : financialYears[0] || ''
    );
  }, [financialYears]);

  const generate = async () => {
    if (!grantId || !financialYear) {
      setError('Select a grant and financial year.');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const response = await api<UC>('/api/uc/generate', {
        method: 'POST',
        body: JSON.stringify({ grantId, financialYear })
      });
      setUcs((current) => [response, ...current.filter((item) => item.id !== response.id)]);
      setNotice(
        `Draft calculated for ${response.financialYear}. Review the recorded expenses and calculation bases before workflow submission.`
      );
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate UC draft.');
    } finally {
      setGenerating(false);
    }
  };

  const download = async (uc: UC) => {
    setError('');
    try {
      await downloadFile(`/api/uc/${uc.id}/pdf`, `uc-${uc.grant.grantCode}-${uc.financialYear}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download UC draft.');
    }
  };

  return (
    <AppShell role="PI">
      <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Utilization workflow</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-950 sm:text-3xl">UC draft generator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Calculate a review draft from approved expense records in one Indian financial year. The reporting period is derived by the server and cannot be entered manually.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-zinc-950 p-2.5 text-white"><FileText size={20} /></div>
          <div>
            <h2 className="font-bold text-zinc-950">Create or refresh a draft</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Regenerating an existing draft for the same grant and financial year refreshes its recorded calculations. A draft already in review or later is not overwritten.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Grant</span>
            <select
              value={grantId}
              onChange={(event) => setGrantId(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-700"
            >
              {grants.map((grant) => (
                <option key={grant.id} value={grant.id}>
                  {grant.grantCode} — {grant.projectTitle}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-800">Financial year</span>
            <select
              value={financialYear}
              onChange={(event) => setFinancialYear(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-700"
            >
              {financialYears.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
          <button
            onClick={() => void generate()}
            disabled={generating || loading || !grantId || !financialYear}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck size={17} /> {generating ? 'Calculating…' : 'Generate draft'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Derived period</p><p className="mt-1 font-semibold text-zinc-900">{financialYearPeriod(financialYear)}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current sanction</p><p className="mt-1 font-semibold text-zinc-900">{formatINR(asNumber(selectedGrant?.sanctionedAmount))}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Grant window</p><p className="mt-1 font-semibold text-zinc-900">{formatDate(selectedGrant?.startDate)} – {formatDate(selectedGrant?.endDate)}</p></div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-950">Generated drafts</h2>
          <span className="text-sm text-zinc-500">{ucs.length} record{ucs.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Loading UC records…</div>
        ) : ucs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <FileText className="mx-auto text-zinc-400" size={28} />
            <p className="mt-3 font-semibold text-zinc-900">No UC drafts recorded</p>
            <p className="mt-1 text-sm text-zinc-500">Choose a grant and financial year to calculate the first draft.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ucs.map((uc) => {
              const content = uc.generatedContent || {};
              const isFinancialYearScoped = content.basis === 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR';
              const heads = isFinancialYearScoped ? content.heads || uc.heads || [] : [];
              const cumulative = isFinancialYearScoped
                ? formatINR(asNumber(content.cumulativeApprovedExpenditure ?? content.cumulativeApprovedThroughPeriod))
                : 'Recalculate draft';
              return (
                <article key={uc.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-zinc-950">{uc.grant?.projectTitle || 'Grant UC'}</h3>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {statusLabel[uc.status] || uc.status}
                        </span>
                        {!isFinancialYearScoped && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Recalculation required
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {uc.grant?.grantCode} · FY {uc.financialYear} · {formatDate(content.periodStart)} to {formatDate(content.periodEnd)}
                      </p>
                    </div>
                    <button
                      onClick={() => void download(uc)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      <Download size={16} /> Download working PDF
                    </button>
                  </div>

                  <div className="grid gap-px bg-zinc-200 sm:grid-cols-3">
                    <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Approved in this FY</p><p className="mt-1 text-lg font-bold text-zinc-950">{isFinancialYearScoped ? formatINR(asNumber(uc.totalUtilized)) : 'Recalculate draft'}</p></div>
                    <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cumulative approved through period end</p><p className="mt-1 text-lg font-bold text-zinc-950">{cumulative}</p></div>
                    <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Calculated sanction balance</p><p className="mt-1 text-lg font-bold text-zinc-950">{isFinancialYearScoped ? formatINR(asNumber(uc.balanceAmount)) : 'Recalculate draft'}</p></div>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Head calculation for this financial year</p>
                    {heads.length ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-zinc-500">
                            <tr><th className="pb-2 pr-5">Budget head</th><th className="pb-2 pr-5">Current allocation</th><th className="pb-2 pr-5">Approved in FY</th><th className="pb-2">Current allocation less FY expenses</th></tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {heads.map((head, index) => (
                              <tr key={head.id || `${head.name}-${index}`}>
                                <td className="py-2.5 pr-5 font-medium text-zinc-900">{head.name}</td>
                                <td className="py-2.5 pr-5 text-zinc-700">{formatINR(asNumber(head.allocated))}</td>
                                <td className="py-2.5 pr-5 text-zinc-700">{formatINR(asNumber(head.spent))}</td>
                                <td className="py-2.5 text-zinc-700">{formatINR(asNumber(head.balance))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">No budget-head records were available when this draft was generated.</p>
                    )}
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      This is a system-calculated working draft, not a certified statutory or agency form. Reconcile source records and apply the required institutional format before authorized review, signature, or submission.
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </AppShell>
  );
}
