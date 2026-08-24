"use client";

import { AppShell, Stat, StatusChip } from "@/components/AppShell";
import { api } from "@/lib/api";
import { rolePath } from "@/lib/session";
import {
  inr,
  type BudgetHead,
  type Expense,
  type Grant,
  type Role,
  type User,
} from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Milestone = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description?: string;
};

type Detail = Grant & {
  grantCode?: string;
  budgetHeads?: BudgetHead[];
  expenses?: Expense[];
  milestones?: Milestone[];
};

type Tab = "Overview" | "Financials" | "Milestones";

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function boundedPercent(spent: unknown, allocated: unknown) {
  const total = finite(allocated);
  if (total <= 0) return null;
  const raw = Math.round((finite(spent) / total) * 100);
  return {
    raw,
    width: Math.min(100, Math.max(0, raw)),
  };
}

function readableDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function GrantDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [grant, setGrant] = useState<Detail | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const user = await api<User>("/api/auth/me");
        if (!active) return;
        setRole(user.role);

        const record = await api<Detail>(`/api/grants/${encodeURIComponent(id)}`);
        if (active) setGrant(record);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "The grant could not be loaded.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const budgetHeads = useMemo(
    () => (Array.isArray(grant?.budgetHeads) ? grant.budgetHeads : []),
    [grant],
  );
  const expenses = useMemo(
    () => (Array.isArray(grant?.expenses) ? grant.expenses : []),
    [grant],
  );
  const milestones = useMemo(
    () => (Array.isArray(grant?.milestones) ? grant.milestones : []),
    [grant],
  );

  if (!role) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F4F7FB] px-5 text-center">
        <div>
          <p className="text-sm font-medium text-[#40566D]">
            {loading ? "Verifying workspace access…" : "Workspace access could not be verified."}
          </p>
          {!loading && (
            <>
              <p className="mt-2 max-w-md text-xs leading-5 text-[#718096]">{error}</p>
              <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[#102A43] px-4 py-2.5 text-xs font-semibold text-white">
                Return to sign in
              </Link>
            </>
          )}
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <div className="flex min-h-[55vh] items-center justify-center text-sm text-[#718096]">
          Loading grant record…
        </div>
      </AppShell>
    );
  }

  if (error || !grant) {
    return (
      <AppShell role={role}>
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">Grant unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-red-700">
            {error || "The requested grant record was not returned."}
          </p>
          <Link href={rolePath(role)} className="mt-5 inline-flex rounded-xl bg-[#102A43] px-4 py-2.5 text-xs font-semibold text-white">
            Back to workspace
          </Link>
        </section>
      </AppShell>
    );
  }

  const amount = finite(grant.amount);
  const spent = finite(grant.spent);
  const balance = amount - spent;
  const utilization = boundedPercent(spent, amount);

  return (
    <AppShell role={role}>
      <div className="min-h-full bg-[#F4F7FB]">
        <Link href={rolePath(role)} className="inline-flex text-xs font-semibold text-[#2454D6] hover:underline">
          ← Back to workspace
        </Link>

        <header className="mt-4 rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2454D6]">
                  Grant record
                </span>
                <StatusChip s={grant.status || "UNKNOWN"} />
              </div>
              <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight text-[#102A43] sm:text-3xl">
                {grant.title || "Untitled grant"}
              </h1>
              <p className="mt-2 break-words text-xs leading-6 text-[#718096] sm:text-sm">
                <span className="font-mono">{grant.grantCode || grant.id}</span>
                {grant.agency ? ` · ${grant.agency}` : ""}
                {grant.pi ? ` · PI ${grant.pi}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="rounded-xl bg-[#F7F9FB] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[#8291A5]">Start</p>
                <p className="mt-1 text-xs font-medium text-[#40566D]">{readableDate(grant.start)}</p>
              </div>
              <div className="rounded-xl bg-[#F7F9FB] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[#8291A5]">End</p>
                <p className="mt-1 text-xs font-medium text-[#40566D]">{readableDate(grant.end)}</p>
              </div>
            </div>
          </div>
        </header>

        <nav className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white p-1" aria-label="Grant details sections">
          {(["Overview", "Financials", "Milestones"] as Tab[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setTab(item)}
              className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                tab === item ? "bg-[#102A43] text-white" : "text-[#64748B] hover:bg-[#F4F7FA]"
              }`}
              aria-current={tab === item ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sanctioned" value={inr(amount)} />
          <Stat label="Recorded spent" value={inr(spent)} />
          <Stat label="Calculated balance" value={inr(balance)} />
          <Stat label="Utilization" value={utilization ? `${utilization.raw}%` : "Not available"} />
        </div>

        {tab === "Overview" && (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
              <h2 className="text-base font-semibold text-[#102A43]">Grant overview</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["Funding agency", grant.agency || "Not recorded"],
                  ["Principal investigator", grant.pi || "Not recorded"],
                  ["Department", grant.department || "Not recorded"],
                  ["UC due date", readableDate(grant.ucDue)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#F7F9FB] p-4">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8291A5]">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-[#40566D]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-[20px] bg-[#09232D] p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#91A4AD]">Recorded utilization</p>
              <p className="mt-3 text-3xl font-semibold">{utilization ? `${utilization.raw}%` : "—"}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#C8F51A]" style={{ width: `${utilization?.width ?? 0}%` }} />
              </div>
              <p className="mt-4 text-xs leading-6 text-[#B5C2C7]">
                Calculated from the grant’s recorded spent and sanctioned amounts. The bar is bounded visually at 100%; the displayed percentage preserves an over-allocation if one is recorded.
              </p>
            </div>
          </section>
        )}

        {tab === "Financials" && (
          <section className="mt-5 space-y-4">
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#102A43]">Budget heads</h2>
                  <p className="mt-1 text-xs text-[#8291A5]">Recorded allocation and expenditure by head</p>
                </div>
                <span className="text-xs text-[#718096]">{budgetHeads.length} record{budgetHeads.length === 1 ? "" : "s"}</span>
              </div>

              {budgetHeads.length === 0 ? (
                <EmptyState title="No budget heads" description="No budget-head records are attached to this grant." />
              ) : (
                <div className="mt-5 space-y-4">
                  {budgetHeads.map((head, index) => {
                    const progress = boundedPercent(head.spent, head.allocated);
                    return (
                      <div key={head.id || `${head.name}-${index}`} className="rounded-xl border border-[#E8EDF2] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="break-words text-sm font-semibold text-[#40566D]">{head.name || "Unnamed head"}</p>
                          <p className="text-xs tabular-nums text-[#526477]">{inr(finite(head.spent))} / {inr(finite(head.allocated))}</p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF1F4]">
                          <div className="h-full rounded-full bg-[#2454D6]" style={{ width: `${progress?.width ?? 0}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] text-[#8291A5]">
                          {progress ? `${progress.raw}% recorded utilization` : "No positive allocation is recorded"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white">
              <div className="border-b border-[#E8EDF2] px-5 py-4">
                <h2 className="text-base font-semibold text-[#102A43]">Expenses</h2>
                <p className="mt-1 text-xs text-[#8291A5]">Latest expense records attached to this grant</p>
              </div>

              {expenses.length === 0 ? (
                <EmptyState title="No expenses" description="No expense records are attached to this grant." />
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F9FB] text-[10px] uppercase tracking-wider text-[#8291A5]">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Expense</th>
                          <th className="px-5 py-3 font-semibold">Head</th>
                          <th className="px-5 py-3 font-semibold">Amount</th>
                          <th className="px-5 py-3 font-semibold">Workflow</th>
                          <th className="px-5 py-3 font-semibold">Recorded check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="border-t border-[#EDF1F4]">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#40566D]">{expense.vendor || "Vendor not recorded"}</p>
                              <p className="mt-1 font-mono text-[10px] text-[#8291A5]">{expense.invoice || expense.id}</p>
                            </td>
                            <td className="px-5 py-4 text-[#526477]">{expense.head || "Not assigned"}</td>
                            <td className="px-5 py-4 font-semibold tabular-nums text-[#102A43]">{inr(finite(expense.amount))}</td>
                            <td className="px-5 py-4"><StatusChip s={expense.status || "UNKNOWN"} /></td>
                            <td className="px-5 py-4"><StatusChip s={expense.compliance || "PENDING"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-[#EDF1F4] md:hidden">
                    {expenses.map((expense) => (
                      <article key={expense.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#40566D]">{expense.vendor || "Vendor not recorded"}</p>
                            <p className="mt-1 break-all font-mono text-[10px] text-[#8291A5]">{expense.invoice || expense.id}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-[#102A43]">{inr(finite(expense.amount))}</p>
                        </div>
                        <p className="mt-3 text-xs text-[#718096]">{expense.head || "Budget head not assigned"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusChip s={expense.status || "UNKNOWN"} />
                          <StatusChip s={expense.compliance || "PENDING"} />
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {tab === "Milestones" && (
          <section className="mt-5 rounded-[20px] border border-[#E2E8F0] bg-white p-5">
            <h2 className="text-base font-semibold text-[#102A43]">Milestones</h2>
            <p className="mt-1 text-xs text-[#8291A5]">Recorded grant deliverables and dates</p>

            {milestones.length === 0 ? (
              <EmptyState title="No milestones" description="No milestone records are attached to this grant." />
            ) : (
              <div className="mt-4 divide-y divide-[#E8EDF2]">
                {milestones.map((milestone) => (
                  <article key={milestone.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[#40566D]">{milestone.title || "Untitled milestone"}</p>
                      {milestone.description && <p className="mt-1 text-xs leading-5 text-[#718096]">{milestone.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-xs tabular-nums text-[#718096]">{readableDate(milestone.dueDate)}</span>
                      <StatusChip s={milestone.status || "UNKNOWN"} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#8291A5]">—</div>
      <p className="mt-3 text-sm font-semibold text-[#40566D]">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#8291A5]">{description}</p>
    </div>
  );
}
