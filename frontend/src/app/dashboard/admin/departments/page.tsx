"use client";

import { AppShell } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import { inr, type Grant } from "@/lib/types";
import { useMemo } from "react";

export default function P() {
  const { data, loading, error } = useList<Grant>("/api/grants");

  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        n: number;
        amount: number;
        spent: number;
      }
    >();

    for (const g of data) {
      const department = g.department || "Unassigned";

      const cur = map.get(department) || {
        n: 0,
        amount: 0,
        spent: 0,
      };

      cur.n += 1;
      cur.amount += Number(g.amount || 0);
      cur.spent += Number(g.spent || 0);

      map.set(department, cur);
    }

    return [...map.entries()]
      .map(([name, r]) => ({
        name,
        ...r,
        utilization:
          r.amount > 0
            ? Math.round((r.spent / r.amount) * 100)
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.grants += row.n;
        acc.amount += row.amount;
        acc.spent += row.spent;
        return acc;
      },
      {
        grants: 0,
        amount: 0,
        spent: 0,
      }
    );
  }, [rows]);

  const overallUtilization =
    totals.amount > 0
      ? Math.round((totals.spent / totals.amount) * 100)
      : 0;

  if (loading) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-muted">Loading department records…</div></AppShell>;
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
                  Departments
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  Monitor research funding, grant activity and utilization
                  across university departments.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  Current portfolio records grouped by department
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-3 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                    Departments
                  </p>

                  <p className="text-[20px] font-semibold text-[#102A43] mt-0.5">
                    {loading ? "—" : rows.length}
                  </p>
                </div>

                <div className="px-4 py-3 rounded-xl bg-[#09232D] text-white shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Total grants
                  </p>

                  <p className="text-[20px] font-semibold mt-0.5">
                    {loading ? "—" : totals.grants}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            KPI CARDS
        ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Departments
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : rows.length}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                ◆
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#315DCE]">
              Research-active units
            </p>
          </div>

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Sanctioned funding
                </p>

                <p className="mt-4 text-[27px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : inr(totals.amount)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                ₹
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#638D00]">
              Across all departments
            </p>
          </div>

          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Total spent
                </p>

                <p className="mt-4 text-[27px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {loading ? "—" : inr(totals.spent)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488]">
                ↗
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#0F766E]">
              Recorded expenditure
            </p>
          </div>

          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8B9CA4]">
                  Utilization
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em]">
                  {loading ? "—" : `${overallUtilization}%`}
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
                  width: `${loading ? 0 : Math.min(100, overallUtilization)}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-[#B5C2C7] mt-2">
              Overall department utilization
            </p>
          </div>
        </div>

        {/* =====================================================
            DEPARTMENT TABLE
        ====================================================== */}
        <div className="mt-5 rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

          {/* Table header */}
          <div className="px-5 py-5 border-b border-[#E8EDF2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                Department portfolio
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Funding and expenditure summary by department
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9BE500]" />

              <span className="text-[11px] text-[#718096]">
                {loading ? "Loading department records…" : `${rows.length} departments tracked`}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[12px] text-[#8291A5]">Loading department records…</div>
          ) : error ? (
            <div className="py-16 px-5 text-center text-[12px] text-red-700">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#8291A5] text-xl">
                ◌
              </div>

              <p className="mt-4 text-[14px] font-semibold text-[#40566D]">
                No department data available
              </p>

              <p className="mt-1 text-[12px] text-[#8291A5]">
                Departments will appear once grants are available.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F7F9FB] text-left">
                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Department
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Grants
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Sanctioned
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Spent
                      </th>

                      <th className="px-5 py-3.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Utilization
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={row.name}
                        className="border-t border-[#E8EDF2] hover:bg-[#FAFCFE] transition-colors"
                      >
                        {/* Department */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-semibold ${
                                index % 3 === 0
                                  ? "bg-[#EEF4FF] text-[#2454D6]"
                                  : index % 3 === 1
                                  ? "bg-[#ECFAF8] text-[#0F766E]"
                                  : "bg-[#F3EEFF] text-[#7C3AED]"
                              }`}
                            >
                              {row.name
                                .split(" ")
                                .slice(0, 2)
                                .map((x) => x[0])
                                .join("")
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-semibold text-[#102A43]">
                                {row.name}
                              </p>

                              <p className="text-[10px] text-[#8291A5] mt-0.5">
                                Research department
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Grants */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#40566D] text-[11px] font-semibold">
                            {row.n}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4">
                          <span className="font-semibold tabular text-[#102A43]">
                            {inr(row.amount)}
                          </span>
                        </td>

                        {/* Spent */}
                        <td className="px-5 py-4">
                          <span className="font-medium tabular text-[#40566D]">
                            {inr(row.spent)}
                          </span>
                        </td>

                        {/* Utilization */}
                        <td className="px-5 py-4 min-w-[190px]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-[#8291A5]">
                              Utilized
                            </span>

                            <span className="text-[11px] font-semibold text-[#102A43]">
                              {row.utilization}%
                            </span>
                          </div>

                          <div className="h-1.5 rounded-full bg-[#EEF1F4] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.utilization >= 85
                                  ? "bg-[#D97706]"
                                  : row.utilization >= 60
                                  ? "bg-[#7C3AED]"
                                  : "bg-[#0F766E]"
                              }`}
                              style={{
                                width: `${Math.min(100, row.utilization)}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#E8EDF2]">
                {rows.map((row) => (
                  <div key={row.name} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-xl bg-[#EEF4FF] text-[#2454D6] flex items-center justify-center text-[11px] font-semibold">
                          {row.name
                            .split(" ")
                            .slice(0, 2)
                            .map((x) => x[0])
                            .join("")
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] text-[#102A43] truncate">
                            {row.name}
                          </p>

                          <p className="text-[10px] text-[#8291A5]">
                            {row.n} grant{row.n !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <span className="text-[13px] font-semibold tabular text-[#102A43]">
                        {row.utilization}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="rounded-xl bg-[#F7F9FB] p-3">
                        <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                          Sanctioned
                        </p>

                        <p className="text-[13px] font-semibold text-[#102A43] mt-1">
                          {inr(row.amount)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F7F9FB] p-3">
                        <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                          Spent
                        </p>

                        <p className="text-[13px] font-semibold text-[#102A43] mt-1">
                          {inr(row.spent)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-[#EEF1F4] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0F766E]"
                          style={{
                            width: `${Math.min(100, row.utilization)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}