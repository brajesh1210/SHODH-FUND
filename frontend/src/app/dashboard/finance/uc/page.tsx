'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  RefreshCw,
  Send
} from 'lucide-react';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { formatINR } from '@/lib/format';
import { AppShell } from '@/components/AppShell';

type UCContent = {
  basis?: string;
  balanceBasis?: string;
  periodStart?: string;
  periodEnd?: string;
  periodApprovedExpenditure?: number;
  cumulativeApprovedExpenditure?: number;
  cumulativeApprovedThroughPeriod?: number;
  currentSanctionedAmount?: number;
  sanctionBalanceAtPeriodEnd?: number;
  utilizationPct?: number;
};

type UC = {
  id: string;
  financialYear: string;
  period: string;
  totalUtilized: number;
  balanceAmount: number;
  status: string;
  generatedContent?: UCContent;
  grant: {
    id: string;
    projectTitle: string;
    grantCode: string;
    agency: string;
    sanctionedAmount: number;
    pi: { name: string; email: string; department?: string };
  };
};

type Filter = 'ALL' | 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'SUBMITTED_TO_AGENCY';

const statusMeta: Record<string, { label: string; classes: string }> = {
  DRAFT: { label: 'Draft', classes: 'bg-zinc-100 text-zinc-700' },
  UNDER_REVIEW: { label: 'Under review', classes: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Internally approved', classes: 'bg-emerald-100 text-emerald-800' },
  SUBMITTED_TO_AGENCY: { label: 'Recorded as submitted', classes: 'bg-blue-100 text-blue-800' }
};

const nextStep: Record<string, { status: string; label: string; icon: typeof CheckCircle2 }> = {
  DRAFT: { status: 'UNDER_REVIEW', label: 'Start review', icon: Clock3 },
  UNDER_REVIEW: { status: 'APPROVED', label: 'Record internal approval', icon: CheckCircle2 },
  APPROVED: { status: 'SUBMITTED_TO_AGENCY', label: 'Record agency submission', icon: Send }
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
}

export default function FinanceUCPage() {
  const [ucs, setUcs] = useState<UC[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<UC[]>('/api/ucs');
      setUcs(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load UC records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => (filter === 'ALL' ? ucs : ucs.filter((uc) => uc.status === filter)),
    [filter, ucs]
  );

  const counts = useMemo(
    () => ({
      all: ucs.length,
      review: ucs.filter((uc) => uc.status === 'DRAFT' || uc.status === 'UNDER_REVIEW').length,
      approved: ucs.filter((uc) => uc.status === 'APPROVED').length,
      submitted: ucs.filter((uc) => uc.status === 'SUBMITTED_TO_AGENCY').length
    }),
    [ucs]
  );

  const advance = async (uc: UC) => {
    const step = nextStep[uc.status];
    if (!step) return;
    const prompts: Record<string, string> = {
      UNDER_REVIEW: 'Start review of this financial-year-scoped working draft?',
      APPROVED:
        'Record internal approval? This records a workflow decision only; it does not certify a statutory or agency form.',
      SUBMITTED_TO_AGENCY:
        'Record that the document was submitted to the agency? Continue only if submission occurred outside this system.'
    };
    if (!window.confirm(prompts[step.status])) return;

    setBusyId(uc.id);
    setError('');
    setNotice('');
    try {
      const response = await api<UC>(`/api/ucs/${uc.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: step.status })
      });
      setUcs((current) => current.map((item) => (item.id === uc.id ? response : item)));
      setNotice(`Workflow status updated to ${statusMeta[response.status]?.label || response.status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update UC status.');
    } finally {
      setBusyId('');
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
    <AppShell role="FINANCE">
      <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Finance workflow</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-950 sm:text-3xl">Utilization drafts</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Review financial-year-scoped calculations and record forward-only internal workflow decisions. Source reconciliation and authorized institutional sign-off remain separate controls.
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

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['All records', counts.all],
          ['Awaiting internal decision', counts.review],
          ['Internally approved', counts.approved],
          ['Recorded as submitted', counts.submitted]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter utilization drafts">
        {([
          ['ALL', 'All'],
          ['DRAFT', 'Draft'],
          ['UNDER_REVIEW', 'Under review'],
          ['APPROVED', 'Approved'],
          ['SUBMITTED_TO_AGENCY', 'Submitted']
        ] as [Filter, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
              filter === value ? 'bg-zinc-950 text-white' : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading utilization records…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <FileCheck2 className="mx-auto text-zinc-400" size={30} />
          <p className="mt-3 font-semibold text-zinc-900">No records in this view</p>
          <p className="mt-1 text-sm text-zinc-500">UC drafts appear here after a PI generates them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((uc) => {
            const meta = statusMeta[uc.status] || { label: uc.status, classes: 'bg-zinc-100 text-zinc-700' };
            const step = nextStep[uc.status];
            const content = uc.generatedContent || {};
            const scoped = content.basis === 'APPROVED_EXPENSES_IN_FINANCIAL_YEAR';
            const StepIcon = step?.icon;
            return (
              <article key={uc.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-zinc-950">{uc.grant.projectTitle}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.classes}`}>{meta.label}</span>
                      {!scoped && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">PI recalculation required</span>}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {uc.grant.grantCode} · {uc.grant.agency} · FY {uc.financialYear}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDate(content.periodStart || '')} to {formatDate(content.periodEnd || '')} · PI: {uc.grant.pi.name}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => void download(uc)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      <Download size={16} /> Working PDF
                    </button>
                    {step && StepIcon && (
                      <button
                        onClick={() => void advance(uc)}
                        disabled={busyId === uc.id || !scoped}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <StepIcon size={16} /> {busyId === uc.id ? 'Updating…' : step.label}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-px bg-zinc-200 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current sanction</p><p className="mt-1 text-lg font-bold text-zinc-950">{formatINR(amount(uc.grant.sanctionedAmount))}</p></div>
                  <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Approved expenses in FY</p><p className="mt-1 text-lg font-bold text-zinc-950">{scoped ? formatINR(amount(uc.totalUtilized)) : 'Unavailable'}</p></div>
                  <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cumulative approved to period end</p><p className="mt-1 text-lg font-bold text-zinc-950">{scoped ? formatINR(amount(content.cumulativeApprovedExpenditure ?? content.cumulativeApprovedThroughPeriod)) : 'Unavailable'}</p></div>
                  <div className="bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Calculated sanction balance</p><p className="mt-1 text-lg font-bold text-zinc-950">{scoped ? formatINR(amount(uc.balanceAmount)) : 'Unavailable'}</p></div>
                </div>

                <div className={`mx-5 my-4 rounded-xl border p-3 text-xs leading-5 ${scoped ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {scoped
                    ? 'Calculation basis: approved expense records dated inside the selected financial year; cumulative balance uses approved records through the reporting-period end and the current recorded sanctioned amount.'
                    : 'This legacy record does not contain the required financial-year-scoped calculation basis. It cannot be approved or downloaded until the PI regenerates an eligible draft.'}
                </div>
              </article>
            );
          })}
        </div>
      )}
      </div>
    </AppShell>
  );
}
