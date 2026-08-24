"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { inr } from "@/lib/types";

type Stats = {
  grants: number;
  sanctioned: number;
  spent: number;
  utilization: number;
  departments: number;
};

export default function P() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/api/stats")
      .then(setS)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Research metrics are unavailable.");
      });
  }, []);

  if (error) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }
  if (!s) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-muted">Loading research metrics…</div></AppShell>;
  }

  const score = Number.isFinite(s.utilization)
    ? Math.max(0, Math.round(s.utilization))
    : 0;

  const scoreLabel = score > 100
    ? "Over 100% recorded"
    : score >= 85
      ? "High utilization"
      : score >= 50
        ? "Moderate utilization"
        : "Low utilization";

  const scoreProgress = Math.min(100, score);

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
                  Research Metrics
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  Review grant counts, sanctioned funding, departments, and utilization from current portfolio records.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  Metrics calculated from authenticated grant records
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#09232D] text-white shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#C8F51A]" />

                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Reporting cycle
                  </p>

                  <p className="text-[13px] font-medium mt-0.5">
                    Research performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            TOP KPI CARDS
        ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Score */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)] sm:col-span-2 xl:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8B9CA4]">
                  Portfolio utilization
                </p>

                <p className="mt-4 text-[38px] leading-none font-semibold tracking-[-0.04em]">
                  {score}%
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100] text-lg">
                ↗
              </div>
            </div>

            <div className="mt-5 h-2 rounded-full bg-[#203D46] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#C8F51A]"
                style={{
                  width: `${scoreProgress}%`,
                }}
              />
            </div>

            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-[#B5C2C7]">
                Recorded spend / sanctioned
              </span>

              <span className="text-[11px] font-semibold text-[#C8F51A]">
                {scoreLabel}
              </span>
            </div>
          </div>

          {/* Grants */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Grant records
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {s.grants}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                ◆
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#315DCE]">
              Research funding portfolio
            </p>
          </div>

          {/* Funding */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Research funding
                </p>

                <p className="mt-4 text-[27px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {inr(s.sanctioned)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                ₹
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#638D00]">
              Total sanctioned funding
            </p>
          </div>

          {/* Departments */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Departments
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {s.departments}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED]">
                ◇
              </div>
            </div>

            <p className="mt-7 text-[12px] text-[#7C3AED]">
              Departments represented in records
            </p>
          </div>
        </div>

        {/* =====================================================
            MAIN REPORT SECTION
        ====================================================== */}
        <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-5 mt-5">

          {/* Research performance */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-5 border-b border-[#E8EDF2]">
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                Financial utilization
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Recorded expenditure as a share of sanctioned funding
              </p>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-8">

                {/* Score circle */}
                <div className="relative w-40 h-40 shrink-0">
                  <div className="absolute inset-0 rounded-full border-[12px] border-[#EEF2F5]" />

                  <div
                    className="absolute inset-0 rounded-full border-[12px] border-[#C8F51A]"
                    style={{
                      clipPath: `inset(0 ${100 - scoreProgress}% 0 0)`,
                    }}
                  />

                  <div className="absolute inset-[12px] rounded-full bg-[#F8FAFB] flex flex-col items-center justify-center">
                    <span className="text-[34px] leading-none font-semibold tracking-[-0.04em] text-[#102A43]">
                      {score}
                    </span>

                    <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5] mt-2">
                      Utilized
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#102A43]">
                        Portfolio utilization
                      </p>

                      <p className="text-[11px] text-[#8291A5] mt-1">
                        Derived from recorded spend and sanctioned amounts
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-[#F2FCE3] text-[#638D00] text-[10px] font-semibold">
                      {scoreLabel}
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-[10px] text-[#8291A5] mb-2">
                      <span>0</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>

                    <div className="relative h-2 rounded-full bg-[#EEF1F4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#C8F51A]"
                        style={{
                          width: `${scoreProgress}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="rounded-xl bg-[#F7F9FB] p-3">
                      <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                        Utilization
                      </p>

                      <p className="text-[18px] font-semibold text-[#102A43] mt-1">
                        {s.utilization}%
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F7F9FB] p-3">
                      <p className="text-[9px] uppercase tracking-[0.07em] text-[#8291A5] font-semibold">
                        Funding base
                      </p>

                      <p className="text-[18px] font-semibold text-[#102A43] mt-1">
                        {inr(s.sanctioned)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reporting readiness */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-5 border-b border-[#E8EDF2]">
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                Recorded data availability
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Current data availability
              </p>
            </div>

            <div className="p-5 space-y-4">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                    ✓
                  </div>

                  <div>
                    <p className="text-[12px] font-semibold text-[#40566D]">
                      Grant portfolio
                    </p>

                    <p className="text-[10px] text-[#8291A5]">
                      {s.grants} grant record{s.grants === 1 ? "" : "s"} available
                    </p>
                  </div>
                </div>

                <span className={`text-[10px] font-semibold ${s.grants > 0 ? "text-[#638D00]" : "text-[#8291A5]"}`}>
                  {s.grants > 0 ? "AVAILABLE" : "NO RECORDS"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                    ✓
                  </div>

                  <div>
                    <p className="text-[12px] font-semibold text-[#40566D]">
                      Funding data
                    </p>

                    <p className="text-[10px] text-[#8291A5]">
                      {inr(s.sanctioned)} sanctioned in current records
                    </p>
                  </div>
                </div>

                <span className={`text-[10px] font-semibold ${s.sanctioned > 0 ? "text-[#638D00]" : "text-[#8291A5]"}`}>
                  {s.sanctioned > 0 ? "AVAILABLE" : "NO AMOUNT"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF7E8] flex items-center justify-center text-[#C26A00]">
                    !
                  </div>

                  <div>
                    <p className="text-[12px] font-semibold text-[#40566D]">
                      Official framework mapping
                    </p>

                    <p className="text-[10px] text-[#8291A5]">
                      Not implemented in this application
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-semibold text-[#C26A00]">
                  UNAVAILABLE
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-[#F7F9FB] p-4">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                  Reporting note
                </p>

                <p className="text-[12px] leading-5 text-[#64748B] mt-2">
                  This page reports only grant-finance metrics present in ShodhFund records. It is not an official institutional ranking or regulatory submission, and no official framework mapping is currently implemented.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            FUNDING SNAPSHOT
        ====================================================== */}
        <div className="mt-5 rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-5 border-b border-[#E8EDF2]">
            <h2 className="text-[16px] font-semibold text-[#102A43]">
              Funding snapshot
            </h2>

            <p className="text-[11px] text-[#8291A5] mt-1">
              High-level indicators supporting institutional research reporting
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E8EDF2]">

            <div className="p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                Sanctioned funding
              </p>

              <p className="text-[25px] font-semibold tracking-[-0.03em] text-[#102A43] mt-2">
                {inr(s.sanctioned)}
              </p>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Total research funding captured
              </p>
            </div>

            <div className="p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                Utilization
              </p>

              <div className="flex items-end gap-2 mt-2">
                <p className="text-[25px] font-semibold tracking-[-0.03em] text-[#102A43]">
                  {s.utilization}%
                </p>

                <span className="text-[11px] text-[#638D00] mb-1">
                  current
                </span>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-[#EEF1F4] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0F766E]"
                  style={{
                    width: `${Math.min(100, s.utilization)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-5">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                Institutional coverage
              </p>

              <p className="text-[25px] font-semibold tracking-[-0.03em] text-[#102A43] mt-2">
                {s.departments}
              </p>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Departments represented in portfolio
              </p>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}