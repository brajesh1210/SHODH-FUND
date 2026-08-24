"use client";

import { AppShell } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import { inr, type Expense, type Grant } from "@/lib/types";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function AdminDash() {
  const grants = useList<Grant>("/api/grants");
  const expenses = useList<Expense>("/api/expenses");

  const stats = useMemo(() => {
    const sanctioned = grants.data.reduce((sum, grant) => sum + Number(grant.amount || 0), 0);
    const spent = grants.data.reduce((sum, grant) => sum + Number(grant.spent || 0), 0);
    const departments = new Set(grants.data.map((grant) => grant.department).filter(Boolean)).size;
    return {
      grants: grants.data.length,
      sanctioned,
      spent,
      utilization: sanctioned ? Math.round((spent / sanctioned) * 1000) / 10 : 0,
      departments,
    };
  }, [grants.data]);

  /*
   * IMPORTANT:
   * /api/grants already flattens Prisma relations on the backend:
   * department: grant.pi?.department || ""
   *
   * Therefore this intentionally uses g.department rather than
   * trying to render a Prisma relation object.
   */
  const depts = useMemo(() => {
    const map = new Map<string, number>();

    for (const g of grants.data) {
      const department = g.department || "Unassigned";
      map.set(
        department,
        (map.get(department) || 0) + Number(g.amount || 0)
      );
    }

    const colors = [
      "#102A43",
      "#2454D6",
      "#0F766E",
      "#D97706",
      "#7C3AED",
    ];

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: colors[i % colors.length],
      }));
  }, [grants.data]);

  const activeGrants = grants.data.filter(
    (g) =>
      String(g.status).toUpperCase() !== "COMPLETED" &&
      String(g.status).toUpperCase() !== "CLOSED"
  );

  const topDepartment = depts[0];

  const trend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1);
      const year = month.getFullYear();
      const monthIndex = month.getMonth();
      const value = expenses.data.reduce((sum, expense) => {
        const date = new Date(expense.date);
        return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === monthIndex
          ? sum + Number(expense.amount || 0)
          : sum;
      }, 0);
      return {
        m: month.toLocaleDateString("en-IN", { month: "short" }),
        v: value,
      };
    });
  }, [expenses.data]);

  const currentTrend = trend[trend.length - 1]?.v || 0;
  const previousTrend = trend[trend.length - 2]?.v || 0;
  const trendChange = currentTrend - previousTrend;
  const dataLoading = grants.loading || expenses.loading;
  const dataError = grants.error || expenses.error;

  if (dataLoading) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-muted">Loading administration records…</div></AppShell>;
  }
  if (dataError) {
    return <AppShell role="ADMIN"><div className="card p-8 text-sm text-red-700" role="alert">{dataError}</div></AppShell>;
  }

  return (
    <AppShell role="ADMIN">
      <div className="min-h-full bg-[#F4F7FB]">
        {/* =========================================================
            HEADER
        ========================================================== */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative pt-1 pb-7">
            {/* Workspace pill */}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ✦
              </span>
              ShodhFund Workspace
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Research administration
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  University-wide view of research funding, grant activity and
                  departmental performance.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  {dataLoading ? "Loading portfolio records…" : dataError ? "Portfolio records unavailable" : "Research office · Current portfolio records"}
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-white border border-[#E2E8F0] shadow-sm min-w-[125px]">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                  Active portfolio
                </p>

                <p className="text-[20px] font-semibold text-[#102A43] mt-0.5">
                  {grants.loading ? "—" : activeGrants.length}
                </p>

                <p className="text-[10px] text-[#8291A5] mt-0.5">
                  active grants
                </p>
              </div>
            </div>
          </div>
        </div>

        {dataError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700" role="alert">
            {dataError}
          </p>
        )}

        {/* =========================================================
            KPI CARDS
        ========================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Grants */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Research grants
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {grants.loading ? "—" : stats.grants}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6] text-lg">
                ◆
              </div>
            </div>

            <div className="mt-7 flex items-center gap-2 text-[12px] text-[#315DCE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2454D6]" />
              University research portfolio
            </div>
          </div>

          {/* Funding */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Total funding
                </p>

                <p className="mt-4 text-[28px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {grants.loading ? "—" : inr(stats.sanctioned)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488] text-lg">
                ₹
              </div>
            </div>

            <div className="mt-7 text-[12px] text-[#0F766E]">
              Sanctioned research funding
            </div>
          </div>

          {/* Utilization */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Utilization
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {grants.loading ? "—" : `${stats.utilization}%`}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED] text-lg">
                ↗
              </div>
            </div>

            <div className="mt-5">
              <div className="h-2 rounded-full bg-[#EEF1F4] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#7C3AED] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, stats.utilization)
                    )}%`,
                  }}
                />
              </div>

              <div className="flex justify-between mt-2 text-[10px] text-[#8291A5]">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Departments */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#8B9CA4]">
                  Departments
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em]">
                  {grants.loading ? "—" : stats.departments}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100] text-lg">
                ✦
              </div>
            </div>

            <div className="mt-7 text-[12px] text-[#B5C2C7]">
              Research-active departments
            </div>
          </div>
        </div>

        {/* =========================================================
            ANALYTICS
        ========================================================== */}
        <div className="grid lg:grid-cols-[1.05fr_1.45fr] gap-4 mt-5">
          {/* Department funding */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-[16px] text-[#102A43]">
                  Funding by department
                </h3>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Distribution of sanctioned research funding
                </p>
              </div>

              <div className="px-2.5 py-1 rounded-full bg-[#F4F7FA] text-[10px] font-semibold text-[#718096]">
                {depts.length} departments
              </div>
            </div>

            {grants.loading ? (
              <div className="h-[270px] flex items-center justify-center text-[12px] text-[#8291A5]">Loading department records…</div>
            ) : depts.length === 0 ? (
              <div className="h-[270px] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#8291A5] mb-3">
                  ◌
                </div>

                <p className="text-[13px] font-medium text-[#40566D]">
                  No department data
                </p>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Funding distribution will appear here.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-[1fr_1fr] items-center gap-2">
                <div className="h-[270px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={depts}
                        dataKey="value"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {depts.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>

                      <Tooltip
  formatter={(value) => [
    inr(Number(value ?? 0)),
    "Funding",
  ]}
/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {depts.slice(0, 5).map((d) => (
                    <div key={d.name} className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.fill }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3">
                          <span className="text-[11px] font-medium text-[#40566D] truncate">
                            {d.name}
                          </span>

                          <span className="text-[10px] font-semibold tabular text-[#102A43]">
                            {inr(d.value)}
                          </span>
                        </div>

                        <div className="h-1.5 bg-[#EEF1F4] rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${
                                topDepartment?.value
                                  ? Math.min(
                                      100,
                                      (d.value /
                                        topDepartment.value) *
                                        100
                                    )
                                  : 0
                              }%`,
                              backgroundColor: d.fill,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grant progress */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[16px] text-[#102A43]">
                  Monthly recorded expenditure
                </h3>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Expense amounts recorded in the last seven calendar months
                </p>
              </div>

              <div className="px-3 py-2 rounded-xl bg-[#F5F8FB]">
                <p className="text-[9px] uppercase tracking-[0.08em] text-[#8291A5] font-semibold">
                  Latest
                </p>

                <p className="text-[17px] font-semibold text-[#102A43] mt-0.5">
                  {expenses.loading ? "—" : inr(currentTrend)}
                </p>

                <p className="text-[9px] text-[#0F766E] mt-0.5">
                  {expenses.loading
                    ? "Checking records"
                    : trendChange === 0
                      ? "No change from previous month"
                      : `${trendChange > 0 ? "+" : "−"}${inr(Math.abs(trendChange))} vs previous month`}
                </p>
              </div>
            </div>

            <div className="h-[255px] mt-2">
              <ResponsiveContainer>
                <LineChart
                  data={trend}
                  margin={{
                    top: 15,
                    right: 8,
                    left: -18,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    stroke="#E6EBF1"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="m"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#8291A5",
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#8291A5",
                    }}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      boxShadow:
                        "0 8px 24px rgba(15,23,42,0.08)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      inr(Number(value ?? 0)),
                      "Recorded expenditure",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#7C3AED"
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: "#7C3AED",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 5,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* =========================================================
            PORTFOLIO SNAPSHOT
        ========================================================== */}
        <div className="grid lg:grid-cols-3 gap-4 mt-4 pb-5">
          {/* Active portfolio */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                ◆
              </div>

              <div>
                <p className="text-[13px] font-semibold text-[#102A43]">
                  Active portfolio
                </p>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Grants currently in progress
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-end gap-2">
              <p className="text-[28px] font-semibold text-[#102A43]">
                {grants.loading ? "—" : activeGrants.length}
              </p>

              <p className="text-[11px] text-[#8291A5] pb-1">
                active grants
              </p>
            </div>
          </div>

          {/* Leading department */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED]">
                ↗
              </div>

              <div>
                <p className="text-[13px] font-semibold text-[#102A43]">
                  Leading department
                </p>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Highest funding allocation
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[19px] font-semibold text-[#102A43] truncate">
                {topDepartment?.name || "—"}
              </p>

              <p className="text-[11px] text-[#7C3AED] mt-1">
                {topDepartment
                  ? inr(topDepartment.value)
                  : "No funding data"}
              </p>
            </div>
          </div>

          {/* Administrative status */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100]">
                ✓
              </div>

              <div>
                <p className="text-[13px] font-semibold">
                  Portfolio record status
                </p>

                <p className="text-[11px] text-[#AAB9BF] mt-1">
                  University research portfolio overview
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5 text-[11px] text-[#B5C2C7]">
              <span className={`w-2 h-2 rounded-full ${dataLoading ? "bg-[#94A3B8]" : dataError ? "bg-red-400" : "bg-[#BDF21A]"}`} />
              {dataLoading ? "Checking portfolio records" : dataError ? "Portfolio records unavailable" : `${grants.data.length} grant record${grants.data.length === 1 ? "" : "s"} available`}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}