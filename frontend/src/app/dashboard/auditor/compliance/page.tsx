"use client";

import { AppShell, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import { inr, type Expense } from "@/lib/types";

export default function P() {
  const { data, loading, error } = useList<Expense>("/api/expenses");

  const compliant = data.filter(
    (e) => e.compliance === "COMPLIANT"
  ).length;

  const warning = data.filter(
    (e) => e.compliance === "WARNING"
  ).length;

  const nonCompliant = data.filter(
    (e) => e.compliance === "NON_COMPLIANT"
  ).length;

  const pendingStatus = data.filter(
    (e) => !["COMPLIANT", "WARNING", "NON_COMPLIANT"].includes(e.compliance)
  ).length;

  const score = data.length
    ? Math.round((compliant / data.length) * 100)
    : 0;

  const scoreLabel = loading
    ? "Loading"
    : data.length === 0
      ? "No records"
      : "Marked compliant";

  const scoreColor =
    score >= 80
      ? "#0D8178"
      : score >= 50
      ? "#C77912"
      : "#C2410C";

  if (loading) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-muted">Loading expense check statuses…</div></AppShell>;
  }
  if (error) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }

  return (
    <AppShell role="AUDITOR">
      <div className="space-y-6">

        {/* =========================================================
            HEADER
        ========================================================= */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#E2E8EF] bg-gradient-to-br from-white via-white to-[#F4F8EF] px-7 py-7 shadow-[0_6px_28px_rgba(16,36,58,0.04)]">

          {/* Decorative accents */}
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#DFFF63]/25 blur-2xl" />
          <div className="absolute right-20 bottom-[-70px] h-40 w-40 rounded-full bg-[#D7F1EE]/40 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-7">

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE5EC] bg-white px-3 py-1.5 text-[12px] font-medium text-[#51627A] shadow-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#BDF500] text-[10px] font-bold text-[#294000]">
                  ✓
                </span>
                Research Audit Office
              </div>

              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.035em] text-[#10243A] sm:text-[35px]">
                Compliance review
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F8198]">
                Review recorded expense evidence and check-status fields,
                then identify transactions requiring audit attention.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-[#71849B]">
                <span className="h-2 w-2 rounded-full bg-[#C2410C]" />
                Current recorded check statuses

                <span className="text-[#CAD2DA]">•</span>

                <span>{data.length} documents under review</span>

                <span className="text-[#CAD2DA]">•</span>

                <span className="text-[#0D8178]">
                  {compliant} marked compliant
                </span>
              </div>
            </div>

            {/* Marked-compliant rate */}
            <div className="relative min-w-[220px] overflow-hidden rounded-[20px] bg-[#0B2530] px-5 py-5 shadow-[0_8px_25px_rgba(11,37,48,0.12)]">

              <div className="absolute right-[-25px] top-[-25px] h-24 w-24 rounded-full bg-[#BDF500]/10" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#91A6B5]">
                    Marked-compliant rate
                  </p>

                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: scoreColor }}
                  />
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-semibold tracking-tight text-white">
                    {loading || data.length === 0 ? "—" : `${score}%`}
                  </span>

                  <span
                    className="mb-1 text-[11px] font-medium"
                    style={{ color: score >= 80 ? "#BDF500" : "#F5C26B" }}
                  >
                    {scoreLabel}
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${score}%`,
                      backgroundColor:
                        score >= 80
                          ? "#BDF500"
                          : score >= 50
                          ? "#F5C26B"
                          : "#F0784A",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Expense status records could not be loaded: {error}
          </div>
        )}

        {/* =========================================================
            SUMMARY CARDS
        ========================================================= */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {/* Documents */}
          <div className="rounded-[20px] border border-[#E3E9F0] bg-white p-5 shadow-[0_4px_18px_rgba(16,36,58,0.035)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8090A4]">
                  Documents
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#10243A]">
                  {data.length}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#536A82]">
                <span className="text-sm">▣</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#75879D]">
              Expenditure documents
            </p>
          </div>

          {/* Compliant */}
          <div className="rounded-[20px] border border-[#D9ECE9] bg-[#F5FBFA] p-5 shadow-[0_4px_18px_rgba(13,129,120,0.04)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B8F8B]">
                  Compliant
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#0D8178]">
                  {compliant}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DFF4F0] text-[#0D8178]">
                ✓
              </div>
            </div>

            <p className="mt-2 text-xs text-[#658B86]">
              Recorded as compliant
            </p>
          </div>

          {/* Warning */}
          <div className="rounded-[20px] border border-[#F0E2C9] bg-[#FFFBF3] p-5 shadow-[0_4px_18px_rgba(199,121,18,0.035)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A47B3C]">
                  Warning
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#C77912]">
                  {warning}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0D5] text-[#C77912]">
                !
              </div>
            </div>

            <p className="mt-2 text-xs text-[#967646]">
              Requires reviewer attention
            </p>
          </div>

          {/* Non-compliant */}
          <div className="rounded-[20px] border border-[#F1D9D2] bg-[#FFF7F4] p-5 shadow-[0_4px_18px_rgba(194,65,12,0.035)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A56A56]">
                  Non-compliant
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#C2410C]">
                  {nonCompliant}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFE4DB] text-[#C2410C]">
                !
              </div>
            </div>

            <p className="mt-2 text-xs text-[#9A6A5C]">
              Requires corrective action
            </p>
          </div>
        </section>

        {/* =========================================================
            COMPLIANCE DISTRIBUTION
        ========================================================= */}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Distribution */}
          <div className="rounded-[24px] border border-[#E3E9F0] bg-white p-6 shadow-[0_5px_24px_rgba(16,36,58,0.04)]">

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold text-[#10243A]">
                  Compliance distribution
                </h2>

                <p className="mt-1 text-xs text-[#7B8DA2]">
                  Recorded status fields on expenditure entries
                </p>
              </div>

              <span className="rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[11px] font-semibold text-[#687C93]">
                {data.length} total
              </span>
            </div>

            <div className="mt-7">
              <div className="h-3 overflow-hidden rounded-full bg-[#F0F3F6]">
                {data.length > 0 && (
                  <div className="flex h-full">
                    <div
                      className="bg-[#0D9488]"
                      style={{
                        width: `${(compliant / data.length) * 100}%`,
                      }}
                    />

                    <div
                      className="bg-[#D99024]"
                      style={{
                        width: `${(warning / data.length) * 100}%`,
                      }}
                    />

                    <div
                      className="bg-[#E0522D]"
                      style={{
                        width: `${(nonCompliant / data.length) * 100}%`,
                      }}
                    />

                    <div
                      className="bg-[#94A3B8]"
                      style={{
                        width: `${(pendingStatus / data.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

                <div className="rounded-2xl bg-[#F3FAF8] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#0D9488]" />
                    <span className="text-[11px] font-medium text-[#668B86]">
                      Compliant
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#0D8178]">
                    {compliant}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FFFAF1] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#D99024]" />
                    <span className="text-[11px] font-medium text-[#9A7B48]">
                      Warning
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#C77912]">
                    {warning}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FFF6F3] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#E0522D]" />
                    <span className="text-[11px] font-medium text-[#A56D5B]">
                      Non-compliant
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#C2410C]">
                    {nonCompliant}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F5F7FA] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
                    <span className="text-[11px] font-medium text-[#66788A]">
                      Pending
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#526477]">
                    {pendingStatus}
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Audit attention */}
          <div className="rounded-[24px] border border-[#E3E9F0] bg-[#10243A] p-6 text-white shadow-[0_5px_24px_rgba(16,36,58,0.08)]">

            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8FA3B6]">
                  Audit attention
                </p>

                <h2 className="mt-2 text-[20px] font-semibold">
                  Review queue
                </h2>

                <p className="mt-2 text-xs leading-5 text-[#AAB8C6]">
                  Recorded flags and pending statuses requiring human verification.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BDF500] text-sm font-bold text-[#294000]">
                !
              </div>
            </div>

            <div className="mt-6 space-y-3">

              <div className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F5C26B]" />
                  <span className="text-xs text-[#D5DEE7]">
                    Warning documents
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {warning}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F0784A]" />
                  <span className="text-xs text-[#D5DEE7]">
                    Non-compliant
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {nonCompliant}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#BDF500]" />
                  <span className="text-xs text-[#D5DEE7]">
                    Pending status
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {pendingStatus}
                </span>
              </div>

            </div>
          </div>
        </section>

        {/* =========================================================
            EXPENSE REVIEW
        ========================================================= */}
        <section className="overflow-hidden rounded-[24px] border border-[#E3E9F0] bg-white shadow-[0_5px_24px_rgba(16,36,58,0.045)]">

          <div className="flex flex-col gap-3 border-b border-[#E8EDF2] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-[17px] font-semibold text-[#10243A]">
                Expense check-status review
              </h2>

              <p className="mt-1 text-xs text-[#7B8DA2]">
                Recorded review status across submitted expenditure; not a GFR certification
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[11px] font-semibold text-[#687C93]">
              {data.length} expenses
            </span>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-xs text-[#8191A4]">Loading expense records…</div>
          ) : data.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F7E0] text-[#557400]">
                ✓
              </div>

              <p className="mt-4 text-sm font-medium text-[#30455D]">
                No expenses to review
              </p>

              <p className="mt-1 text-xs text-[#8191A4]">
                New expenditure documents will appear here.
              </p>
            </div>
          ) : (
            <div>

              {/* Desktop table heading */}
              <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.9fr] gap-4 bg-[#F7F9FB] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8493A5] md:grid">
                <span>Expense</span>
                <span>Vendor</span>
                <span>Amount</span>
                <span>Recorded status</span>
              </div>

              <div className="divide-y divide-[#EDF0F4]">
                {data.map((e) => {

                  const isCompliant = e.compliance === "COMPLIANT";
                  const isWarning = e.compliance === "WARNING";
                  const isNonCompliant =
                    e.compliance === "NON_COMPLIANT";

                  return (
                    <div
                      key={e.id}
                      className="group px-6 py-4 transition-colors hover:bg-[#FAFBFC]"
                    >
                      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_0.8fr_0.9fr] md:items-center">

                        {/* Expense */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                              isCompliant
                                ? "bg-[#E5F5F1] text-[#0D8178]"
                                : isWarning
                                ? "bg-[#FFF0D5] text-[#C77912]"
                                : isNonCompliant
                                ? "bg-[#FFE4DB] text-[#C2410C]"
                                : "bg-[#EEF3F8] text-[#536A82]"
                            }`}
                          >
                            {isCompliant
                              ? "✓"
                              : isWarning
                              ? "!"
                              : isNonCompliant
                              ? "!"
                              : "•"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[13px] text-[#19324B]">
                              {e.id}
                            </p>

                            <p className="mt-1 text-[11px] font-mono text-[#8A99AA]">
                              {e.grantId}
                            </p>
                          </div>
                        </div>

                        {/* Vendor */}
                        <div>
                          <p className="text-[13px] text-[#40556D]">
                            {e.vendor}
                          </p>

                          <p className="mt-1 text-[10px] uppercase tracking-wide text-[#9AA7B5] md:hidden">
                            Vendor
                          </p>
                        </div>

                        {/* Amount */}
                        <div>
                          <p className="tabular text-[13px] font-semibold text-[#18314A]">
                            {inr(e.amount)}
                          </p>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between gap-3 md:justify-start">
                          <StatusChip s={e.compliance} />

                          {isNonCompliant && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#C2410C] md:hidden">
                              Review
                            </span>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}