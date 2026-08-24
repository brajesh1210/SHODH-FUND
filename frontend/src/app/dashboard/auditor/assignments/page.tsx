"use client";

import { AppShell, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import type { Grant } from "@/lib/types";

export default function P() {
  const { data, loading, error } = useList<Grant>("/api/grants");

  const active = data.filter(
    (g) => g.status === "ACTIVE" || g.status === "APPROVED"
  ).length;

  const completed = data.filter(
    (g) => g.status === "COMPLETED" || g.status === "CLOSED"
  ).length;

  const totalFunding = data.reduce((sum, g) => sum + (g.amount || 0), 0);

  if (loading) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-muted">Loading grant records…</div></AppShell>;
  }
  if (error) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }

  const getStatusStyle = (status: string) => {
    if (status === "ACTIVE" || status === "APPROVED") {
      return {
        bg: "bg-[#F1F8D8]",
        border: "border-[#D8EE8A]",
        icon: "bg-[#BDF500]",
        text: "text-[#466100]",
      };
    }

    if (status === "COMPLETED" || status === "CLOSED") {
      return {
        bg: "bg-[#EAF7F5]",
        border: "border-[#CBEAE5]",
        icon: "bg-[#1FA89A]",
        text: "text-[#126E66]",
      };
    }

    return {
      bg: "bg-[#FFF5ED]",
      border: "border-[#F4D8C3]",
      icon: "bg-[#F59E0B]",
      text: "text-[#9A4D0B]",
    };
  };

  return (
    <AppShell role="AUDITOR">
      <div className="space-y-6">

        {/* =========================================================
            HERO
        ========================================================= */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#E1E8EF] bg-gradient-to-br from-white via-white to-[#F4F9E8] px-7 py-7">

          {/* Decorative accents */}
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#BDF500]/15 blur-2xl" />
          <div className="absolute right-28 bottom-[-70px] h-40 w-40 rounded-full bg-[#2BB7A8]/10 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">

            <div className="max-w-3xl">

              <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE6EC] bg-white/90 px-3.5 py-2 shadow-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#BDF500] text-[10px] font-bold text-[#294000]">
                  ✓
                </span>

                <span className="text-[12px] font-semibold text-[#53677D]">
                  Research Audit Office
                </span>

                <span className="h-1 w-1 rounded-full bg-[#C6D0DA]" />

                <span className="text-[11px] text-[#8190A2]">
                  Portfolio
                </span>
              </div>

              <h1 className="mt-5 text-[31px] sm:text-[36px] font-semibold tracking-[-0.035em] text-[#102A43]">
                Grant review portfolio
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687D93]">
                Review accessible research-grant records and recorded programme statuses. This list does not itself constitute an audit assignment.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">

                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-medium text-[#64788E] border border-white">
                  <span className="h-2 w-2 rounded-full bg-[#BDF500]" />
                  Current grant records
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF7F5] px-3 py-1.5 text-[11px] font-medium text-[#14756C]">
                  <span className="h-2 w-2 rounded-full bg-[#21A99B]" />
                  {loading ? "Loading records…" : `${active} active grants`}
                </div>

              </div>
            </div>

            {/* Hero metric */}
            <div className="relative shrink-0 overflow-hidden rounded-[22px] bg-[#0B2832] px-5 py-4 min-w-[205px] shadow-[0_10px_30px_rgba(11,40,50,0.12)]">

              <div className="absolute right-[-20px] top-[-20px] h-20 w-20 rounded-full bg-[#BDF500]/10" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#BDF500]" />
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#9EB2BF]">
                    Accessible grants
                  </p>
                </div>

                <p className="mt-1 text-[34px] leading-none font-semibold text-white">
                  {loading ? "—" : data.length}
                </p>

                <p className="mt-2 text-[11px] text-[#8FA6B3]">
                  Grant records available for review
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            STAT CARDS
        ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Assigned */}
          <div className="group rounded-[20px] border border-[#E2E9EF] bg-white p-5 shadow-[0_5px_20px_rgba(16,36,58,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(16,36,58,0.07)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8393A6]">
                  Accessible grants
                </p>

                <p className="mt-2 text-[30px] font-semibold tracking-tight text-[#102A43]">
                  {loading ? "—" : data.length}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#4568A8]">
                <span className="text-lg">◫</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#75879A]">
              Available to this auditor account
            </p>
          </div>

          {/* Active */}
          <div className="group rounded-[20px] border border-[#DDE9C1] bg-gradient-to-br from-white to-[#F7FBEF] p-5 shadow-[0_5px_20px_rgba(16,36,58,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(16,36,58,0.07)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#71853E]">
                  Active
                </p>

                <p className="mt-2 text-[30px] font-semibold tracking-tight text-[#102A43]">
                  {loading ? "—" : active}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BDF500] text-[#3F5900]">
                <span className="text-sm font-bold">✓</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#75879A]">
              Recorded as active
            </p>
          </div>

          {/* Completed */}
          <div className="group rounded-[20px] border border-[#D8ECE9] bg-gradient-to-br from-white to-[#F3FBFA] p-5 shadow-[0_5px_20px_rgba(16,36,58,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(16,36,58,0.07)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#53847E]">
                  Completed
                </p>

                <p className="mt-2 text-[30px] font-semibold tracking-tight text-[#102A43]">
                  {loading ? "—" : completed}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF3EF] text-[#158579]">
                <span className="text-sm font-bold">✓</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#75879A]">
              Recorded as closed
            </p>
          </div>

          {/* Funding */}
          <div className="group rounded-[20px] border border-[#F0DFD2] bg-gradient-to-br from-white to-[#FFF7F1] p-5 shadow-[0_5px_20px_rgba(16,36,58,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(16,36,58,0.07)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A06B45]">
                  Portfolio funding
                </p>

                <p className="mt-2 text-[25px] font-semibold tracking-tight text-[#102A43]">
                  {loading ? "—" : `₹${(totalFunding / 10000000).toFixed(2)} Cr`}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFE9D9] text-[#C15D20]">
                <span className="text-sm font-bold">₹</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#75879A]">
              Combined sanctioned value
            </p>
          </div>
        </div>

        {/* =========================================================
            ASSIGNMENTS LIST
        ========================================================= */}
        <section className="overflow-hidden rounded-[24px] border border-[#E1E8EF] bg-white shadow-[0_6px_26px_rgba(16,36,58,0.045)]">

          {/* Section header */}
          <div className="border-b border-[#E7ECF1] bg-gradient-to-r from-white to-[#FAFCFD] px-6 py-5">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#BDF500]" />
                  <h2 className="text-[17px] font-semibold text-[#102A43]">
                    Research grant records
                  </h2>
                </div>

                <p className="mt-1 text-xs text-[#7A8DA1]">
                  Accessible research-grant records; formal assignment and audit scope must be confirmed separately.
                </p>
              </div>

              <div className="flex items-center gap-2">

                <div className="rounded-full border border-[#E2E8EE] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#687C91]">
                  {loading ? "Loading…" : `${data.length} records`}
                </div>

                {active > 0 && (
                  <div className="rounded-full bg-[#F1F8D8] px-3 py-1.5 text-[11px] font-semibold text-[#527000]">
                    {active} active
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Empty state */}
          {loading ? (
            <div className="px-6 py-16 text-center text-xs text-[#8191A4]">Loading grant records…</div>
          ) : error ? (
            <div className="px-6 py-16 text-center text-xs text-red-700">{error}</div>
          ) : data.length === 0 ? (
            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F8D8] text-[#557400]">
                <span className="text-lg font-bold">✓</span>
              </div>

              <p className="mt-4 text-sm font-semibold text-[#30455D]">
                No grant records available
              </p>

              <p className="mt-1 text-xs text-[#8191A4]">
                Accessible grant records will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EDF1F4]">

              {data.map((g, index) => {
                const statusStyle = getStatusStyle(g.status);

                return (
                  <div
                    key={g.id}
                    className="group px-6 py-5 transition-colors hover:bg-[#FAFCFD]"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                      {/* Grant information */}
                      <div className="flex items-start gap-4 min-w-0">

                        <div
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${statusStyle.border} ${statusStyle.bg}`}
                        >
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg ${statusStyle.icon} ${statusStyle.text} text-[11px] font-bold`}
                          >
                            {index + 1}
                          </span>
                        </div>

                        <div className="min-w-0">

                          <h3 className="truncate text-[14px] font-semibold text-[#172E46] group-hover:text-[#0C6370] transition-colors">
                            {g.title}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">

                            <span className="rounded-md bg-[#F3F6F8] px-2 py-1 text-[10px] font-mono font-medium text-[#75879A]">
                              {g.id}
                            </span>

                            <span className="hidden sm:inline text-[#D2D9E1]">
                              •
                            </span>

                            <span className="text-[12px] text-[#667B92]">
                              <span className="text-[#95A2B1]">PI</span>{" "}
                              {g.pi}
                            </span>

                            <span className="hidden sm:inline text-[#D2D9E1]">
                              •
                            </span>

                            <span className="text-[12px] text-[#667B92]">
                              {g.department}
                            </span>

                          </div>
                        </div>
                      </div>

                      {/* Grant metadata */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 lg:min-w-[330px]">

                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#91A0B0]">
                            Grant amount
                          </p>

                          <p className="mt-1 text-sm font-semibold text-[#18314A]">
                            ₹{((g.amount || 0) / 10000000).toFixed(2)} Cr
                          </p>
                        </div>

                        <div className="h-8 w-px bg-[#E5EAF0] hidden sm:block" />

                        <StatusChip s={g.status} />

                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}

          {/* Footer */}
          {data.length > 0 && (
            <div className="border-t border-[#E7ECF1] bg-[#FAFBFC] px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[11px] text-[#8494A6]">
                Showing accessible research-grant records
              </p>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-[#BDF500]" />
                <span className="text-[#63778D]">
                  {active} active
                </span>

                <span className="text-[#D0D7DF]">•</span>

                <span className="text-[#63778D]">
                  {completed} completed
                </span>
              </div>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}