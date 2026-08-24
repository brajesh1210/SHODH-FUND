"use client";

import { AppShell, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import { inr, type Grant } from "@/lib/types";
import Link from "next/link";
import { useMemo } from "react";

export default function P() {
  const { data, loading, error } = useList<Grant>("/api/grants");

  const summary = useMemo(() => {
    const totalAmount = data.reduce(
      (sum, g) => sum + Number(g.amount || 0),
      0
    );

    const totalSpent = data.reduce(
      (sum, g) => sum + Number(g.spent || 0),
      0
    );

    const active = data.filter(
      (g) =>
        String(g.status || "").toUpperCase() === "ACTIVE"
    ).length;

    const utilization =
      totalAmount > 0
        ? Math.round((totalSpent / totalAmount) * 100)
        : 0;

    return {
      totalAmount,
      totalSpent,
      active,
      utilization,
    };
  }, [data]);

  if (loading) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-muted">Loading grant records…</div></AppShell>;
  }
  if (error) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }

  return (
    <AppShell role="ADMIN">
      <div className="min-h-full bg-[#F4F7FB]">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative pt-1 pb-7">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ✦
              </span>
              Research Administration
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Grant Portfolio
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  View and monitor all university research grants,
                  funding allocation and utilization.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  Current grant portfolio records
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-[#09232D] text-white shadow-sm min-w-[150px]">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                  Total grants
                </p>

                <p className="text-[24px] font-semibold mt-0.5">
                  {loading ? "—" : data.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Total grants
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : data.length}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                ◆
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#315DCE]">
              University research portfolio
            </p>
          </div>

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Active grants
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : summary.active}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                ✓
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#638D00]">
              Currently active funding
            </p>
          </div>

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Total sanctioned
                </p>

                <p className="mt-4 text-[27px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : inr(summary.totalAmount)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488]">
                ₹
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#0F766E]">
              Approved research funding
            </p>
          </div>

          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8B9CA4]">
                  Portfolio utilization
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em]">
                  {loading ? "—" : `${summary.utilization}%`}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100]">
                ↗
              </div>
            </div>

            <div className="mt-5 h-2 rounded-full bg-[#203D46] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#C8F51A]"
                style={{
                  width: `${loading ? 0 : Math.min(100, summary.utilization)}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-[#B5C2C7] mt-2">
              {loading ? "Loading records…" : `${inr(summary.totalSpent)} utilized`}
            </p>
          </div>
        </div>

        {/* =====================================================
            GRANTS TABLE
        ====================================================== */}
        <div className="mt-5 rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

          <div className="px-5 py-5 border-b border-[#E8EDF2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                All grants
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Complete university research funding portfolio
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9BE500]" />

              <span className="text-[11px] text-[#718096]">
                {loading ? "Loading grant records…" : `${data.length} records`}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[12px] text-[#8291A5]">Loading grant records…</div>
          ) : error ? (
            <div className="py-16 px-5 text-center text-[12px] text-red-700">{error}</div>
          ) : data.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#8291A5] text-xl">
                ◌
              </div>

              <p className="mt-4 text-[14px] font-semibold text-[#40566D]">
                No grants available
              </p>

              <p className="mt-1 text-[12px] text-[#8291A5]">
                Grant records will appear here once they are added.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F7F9FB] text-left">
                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Grant
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Department
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Principal Investigator
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Funding
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Utilization
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.map((g, index) => {
                      const amount = Number(g.amount || 0);
                      const spent = Number(g.spent || 0);

                      const utilization =
                        amount > 0
                          ? Math.round((spent / amount) * 100)
                          : 0;

                      return (
                        <tr
                          key={g.id}
                          className="border-t border-[#E8EDF2] hover:bg-[#FAFCFE] transition-colors"
                        >
                          {/* Grant */}
                          <td className="px-5 py-4 min-w-[280px]">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-semibold ${
                                  index % 3 === 0
                                    ? "bg-[#EEF4FF] text-[#2454D6]"
                                    : index % 3 === 1
                                    ? "bg-[#ECFAF8] text-[#0F766E]"
                                    : "bg-[#F3EEFF] text-[#7C3AED]"
                                }`}
                              >
                                {String(g.title || "G")
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((x) => x[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <Link
                                  href={`/grants/${g.id}`}
                                  className="font-semibold text-[#102A43] hover:text-[#2454D6] transition-colors line-clamp-1"
                                >
                                  {g.title}
                                </Link>

                                <p className="font-mono text-[10px] text-[#8291A5] mt-1">
                                  {g.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-5 py-4">
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#40566D] text-[11px] font-medium whitespace-nowrap">
                              {g.department || "Unassigned"}
                            </span>
                          </td>

                          {/* PI */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#EAF0F7] flex items-center justify-center text-[9px] font-semibold text-[#40566D]">
                                {String(g.pi || "PI")
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((x) => x[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>

                              <span className="text-[#40566D] whitespace-nowrap">
                                {g.pi || "Not assigned"}
                              </span>
                            </div>
                          </td>

                          {/* Funding */}
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-semibold tabular text-[#102A43]">
                                {inr(amount)}
                              </p>

                              <p className="text-[10px] text-[#8291A5] mt-1">
                                Spent {inr(spent)}
                              </p>
                            </div>
                          </td>

                          {/* Utilization */}
                          <td className="px-5 py-4 min-w-[180px]">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] text-[#8291A5]">
                                Utilized
                              </span>

                              <span className="text-[11px] font-semibold text-[#102A43]">
                                {utilization}%
                              </span>
                            </div>

                            <div className="h-1.5 rounded-full bg-[#EEF1F4] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  utilization >= 85
                                    ? "bg-[#D97706]"
                                    : utilization >= 60
                                    ? "bg-[#7C3AED]"
                                    : "bg-[#0F766E]"
                                }`}
                                style={{
                                  width: `${Math.min(100, utilization)}%`,
                                }}
                              />
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <StatusChip s={g.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-[#E8EDF2]">
                {data.map((g) => {
                  const amount = Number(g.amount || 0);
                  const spent = Number(g.spent || 0);

                  const utilization =
                    amount > 0
                      ? Math.round((spent / amount) * 100)
                      : 0;

                  return (
                    <Link
                      key={g.id}
                      href={`/grants/${g.id}`}
                      className="block p-4 hover:bg-[#FAFCFE]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-[#EEF4FF] text-[#2454D6] flex items-center justify-center text-[10px] font-semibold">
                            {String(g.title || "G")
                              .split(" ")
                              .slice(0, 2)
                              .map((x) => x[0])
                              .join("")
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#102A43] line-clamp-2">
                              {g.title}
                            </p>

                            <p className="font-mono text-[9px] text-[#8291A5] mt-1">
                              {g.id}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-[12px] font-semibold text-[#102A43]">
                          {utilization}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl bg-[#F7F9FB] p-3">
                          <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                            Department
                          </p>

                          <p className="text-[12px] font-medium text-[#40566D] mt-1 truncate">
                            {g.department || "Unassigned"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#F7F9FB] p-3">
                          <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                            PI
                          </p>

                          <p className="text-[12px] font-medium text-[#40566D] mt-1 truncate">
                            {g.pi || "Not assigned"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#F7F9FB] p-3">
                          <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                            Sanctioned
                          </p>

                          <p className="text-[12px] font-semibold text-[#102A43] mt-1">
                            {inr(amount)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#F7F9FB] p-3">
                          <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                            Spent
                          </p>

                          <p className="text-[12px] font-semibold text-[#102A43] mt-1">
                            {inr(spent)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#8291A5]">
                            Utilization
                          </span>

                          <span className="font-semibold text-[#40566D]">
                            {utilization}%
                          </span>
                        </div>

                        <div className="h-1.5 rounded-full bg-[#EEF1F4] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0F766E]"
                            style={{
                              width: `${Math.min(100, utilization)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <StatusChip s={g.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}