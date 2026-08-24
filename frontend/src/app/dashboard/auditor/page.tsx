"use client";

import { AppShell, Stat, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import type { Expense, Anomaly } from "@/lib/types";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function AuditorDash() {
  const expenses = useList<Expense>("/api/expenses");
  const anomalies = useList<Anomaly>("/api/anomalies");

  const objections = useList<{
    id: string;
    title: string;
    status: string;
    grantId: string;
    note: string;
  }>("/api/objections");

  const grants = useList<{ id: string }>("/api/grants");
  const auditLogs = useList<{ id: string }>("/api/audit-logs");

  // ============================================================
  // RECORDED, ACCESSIBLE DATASET SUMMARY
  // ============================================================

  const stats = useMemo(() => {
    const compliant = expenses.data.filter(
      (e) => e.compliance === "COMPLIANT"
    ).length;

    const warning = expenses.data.filter(
      (e) => e.compliance === "WARNING"
    ).length;

    const nonCompliant = expenses.data.filter(
      (e) => e.compliance === "NON_COMPLIANT"
    ).length;

    const total = expenses.data.length;
    const pending = Math.max(0, total - compliant - warning - nonCompliant);

    const openObjections = objections.data.filter(
      (o) => o.status === "OPEN"
    ).length;

    const complianceScore = total > 0 ? Math.round((compliant / total) * 100) : 0;

    return {
      accessibleGrants: grants.data.length,
      documentsToReview: expenses.data.filter(
        (e) => e.status === "SUBMITTED"
      ).length,
      objectionsRaised: openObjections,
      complianceScore,
      compliant,
      warning,
      nonCompliant,
      pending,
      total,
    };
  }, [expenses.data, objections.data, grants.data]);

  // ============================================================
  // COMPLIANCE DONUT — CORE LOGIC UNCHANGED
  // ============================================================

  const donut = useMemo(() => {
    const values = [
      { name: "Compliant", value: stats.compliant, fill: "#0D9488" },
      { name: "Partial", value: stats.warning, fill: "#D97706" },
      { name: "Non-compliant", value: stats.nonCompliant, fill: "#E11D48" },
      { name: "Pending", value: stats.pending, fill: "#94A3B8" },
    ];
    return values.some((item) => item.value > 0)
      ? values
      : [{ name: "No classified records", value: 1, fill: "#E8EDF2" }];
  }, [stats]);

  // ============================================================
  // OBJECTION CATEGORIES — CORE LOGIC UNCHANGED
  // ============================================================

  const cats = useMemo(() => {
    const dup = anomalies.data.filter(
      (a) =>
        a.reason?.toLowerCase().includes("duplicate") && !a.resolved
    ).length;

    const gst = anomalies.data.filter(
      (a) => a.reason?.toLowerCase().includes("gst") && !a.resolved
    ).length;

    const travel = anomalies.data.filter(
      (a) =>
        a.reason?.toLowerCase().includes("travel") && !a.resolved
    ).length;

    return [
      {
        n: "Duplicate bills",
        v: dup,
      },
      {
        n: "GST-related flags",
        v: gst,
      },
      {
        n: "Travel-related flags",
        v: travel || 0,
      },
      {
        n: "Open objections",
        v: objections.data.filter((o) => o.status === "OPEN").length,
      },
    ];
  }, [anomalies.data, objections.data]);

  // These checks are derived only from fields and issue records the app actually has.
  const recordChecks = useMemo(() => {
    const rows = expenses.data;
    const complete = (test: (expense: Expense) => boolean) => rows.every(test);
    const noOpenIssue = (term: string) =>
      !anomalies.data.some(
        (anomaly) => !anomaly.resolved && anomaly.reason?.toLowerCase().includes(term)
      );
    const status = (test: boolean, failed: "WARN" | "FAIL") =>
      rows.length === 0 ? "NO_DATA" : test ? "PASS" : failed;

    return [
      { rule: "Invoice numbers recorded", status: status(complete((expense) => Boolean(expense.invoice)), "WARN") },
      { rule: "Vendors recorded", status: status(complete((expense) => Boolean(expense.vendor)), "WARN") },
      { rule: "Budget heads assigned", status: status(complete((expense) => Boolean(expense.head)), "WARN") },
      { rule: "No open GST issue flags", status: status(noOpenIssue("gst"), "FAIL") },
      { rule: "No open duplicate-bill flags", status: status(noOpenIssue("duplicate"), "FAIL") },
    ];
  }, [anomalies.data, expenses.data]);

  const recordChecksPassed = recordChecks.filter((check) => check.status === "PASS").length;

  const openAnomalies = anomalies.data.filter(
    (a) => !a.resolved
  ).length;
  const resourcesLoading = expenses.loading || anomalies.loading || objections.loading || grants.loading || auditLogs.loading;
  const resourceError = expenses.error || anomalies.error || objections.error || grants.error || auditLogs.error;

  if (resourcesLoading) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-muted">Loading audit-accessible records…</div></AppShell>;
  }
  if (resourceError) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-red-700" role="alert">{resourceError}</div></AppShell>;
  }

  return (
    <AppShell role="AUDITOR">
      <div className="min-h-full bg-[#F4F7FB]">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <div className="relative overflow-hidden pt-1 pb-7">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative">

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ✓
              </span>
              Research Audit Office
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Audit workspace
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  Review research expenditure, recorded status fields,
                  and exceptions requiring audit attention.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stats.total === 0
                        ? "bg-[#94A3B8]"
                        : stats.complianceScore >= 80
                        ? "bg-[#9BE500]"
                        : stats.complianceScore >= 60
                        ? "bg-[#D97706]"
                        : "bg-[#E11D48]"
                    }`}
                  />

                  Recorded check statuses
                  <span className="text-[#CBD5E1]">•</span>
                  {auditLogs.loading ? "Checking audit events" : auditLogs.error ? "Audit events unavailable" : `${auditLogs.data.length} audit events`}
                </div>
              </div>

              {/* Score panel */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#09232D] text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">

                <div className="w-10 h-10 rounded-lg bg-[#C8F51A] text-[#193100] flex items-center justify-center font-bold">
                  {stats.total > 0 ? stats.complianceScore : "—"}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Marked-compliant rate
                  </p>

                  <p className="text-[13px] font-medium mt-0.5">
                    {expenses.loading
                      ? "Loading expense records"
                      : stats.total === 0
                        ? "No classified expenses"
                        : `${stats.compliant} of ${stats.total} records`}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {(expenses.error || anomalies.error || objections.error || grants.error || auditLogs.error) && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700" role="alert">
            Some audit records could not be loaded. {expenses.error || anomalies.error || objections.error || grants.error || auditLogs.error}
          </div>
        )}

        {/* ======================================================
            STAT CARDS
        ======================================================= */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <Stat
            label="Accessible Grants"
            value={String(stats.accessibleGrants)}
          />

          <Stat
            label="Documents to Review"
            value={expenses.loading ? "—" : String(stats.documentsToReview)}
          />

          <Stat
            label="Open Objections"
            value={objections.loading ? "—" : String(stats.objectionsRaised)}
          />

          <Stat
            label="Marked-compliant Rate"
            value={expenses.loading ? "—" : stats.total > 0 ? `${stats.complianceScore}%` : "No data"}
          />

        </div>

        {/* ======================================================
            MAIN ANALYTICS
        ======================================================= */}

        <div className="grid lg:grid-cols-[1.05fr_1.05fr_0.9fr] gap-4 mt-5">

          {/* Compliance */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

            <div className="px-5 pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#102A43]">
                    Recorded check-status overview
                  </h3>

                  <p className="text-[11px] text-[#8291A5] mt-1">
                    Status fields across accessible expense records
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-[#F5F8FA] text-[10px] font-semibold text-[#718096]">
                  {stats.total === 0 ? "NO DATA" : `${stats.total} EXPENSES`}
                </span>
              </div>
            </div>

            <div className="relative h-[220px]">

              {expenses.loading ? (
                <div className="flex items-center justify-center h-full text-[12px] text-[#8291A5]">
                  Loading compliance data…
                </div>
              ) : (
                <>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        innerRadius={58}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {donut.map((d) => (
                          <Cell
                            key={d.name}
                            fill={d.fill}
                          />
                        ))}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center mt-1">
                      <p className="text-[27px] font-semibold tracking-[-0.04em] text-[#102A43]">
                        {stats.total > 0 ? `${stats.complianceScore}%` : "—"}
                      </p>

                      <p className="text-[9px] uppercase tracking-[0.08em] text-[#8291A5] font-semibold">
                        Marked compliant
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 pb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">

              {[
                ["Compliant", stats.compliant, "#0D9488"],
                ["Warning", stats.warning, "#D97706"],
                ["Non-compliant", stats.nonCompliant, "#E11D48"],
                ["Pending", stats.pending, "#94A3B8"],
              ].map(([label, value, fill]) => (
                <div
                  key={label as string}
                  className="rounded-xl bg-[#F8FAFC] px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: fill as string }}
                    />

                    <span className="text-[9px] text-[#8291A5]">
                      {label}
                    </span>
                  </div>

                  <p className="text-[16px] font-semibold text-[#102A43] mt-1">
                    {value as number}
                  </p>
                </div>
              ))}

            </div>
          </div>

          {/* Objections */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

            <div className="px-5 pt-5">
              <div className="flex items-start justify-between">

                <div>
                  <h3 className="text-[15px] font-semibold text-[#102A43]">
                    Objections by category
                  </h3>

                  <p className="text-[11px] text-[#8291A5] mt-1">
                    Recorded open issue categories
                  </p>
                </div>

                <div className="px-2.5 py-1 rounded-full bg-[#FFF7ED] text-[#C2410C] text-[10px] font-semibold">
                  {openAnomalies} OPEN
                </div>

              </div>
            </div>

            <div className="h-[250px] px-2 pb-3">
              <ResponsiveContainer>
                <BarChart
                  data={cats}
                  layout="vertical"
                  margin={{
                    top: 15,
                    right: 20,
                    bottom: 5,
                    left: 10,
                  }}
                >
                  <CartesianGrid
                    stroke="#E8EDF2"
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    hide
                  />

                  <YAxis
                    type="category"
                    dataKey="n"
                    width={105}
                    tick={{
                      fontSize: 10,
                      fill: "#64748B",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="v"
                    fill="#C2410C"
                    radius={[0, 5, 5, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Record-field checks */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

            <div className="px-5 pt-5 pb-4 border-b border-[#E8EDF2]">

              <div className="flex justify-between items-start">

                <div>
                  <h3 className="text-[15px] font-semibold text-[#102A43]">
                    Record checks
                  </h3>

                  <p className="text-[11px] text-[#8291A5] mt-1">
                    Checks supported by current record fields
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[19px] font-semibold text-[#102A43]">
                    {recordChecksPassed}/{recordChecks.length}
                  </p>

                  <p className="text-[9px] uppercase tracking-[0.08em] text-[#8291A5]">
                    Passed
                  </p>
                </div>

              </div>
            </div>

            <div className="px-5">

              {recordChecks.map(({ rule, status }, index) => (
                <div
                  key={rule}
                  className={`flex items-center justify-between gap-3 py-3 ${
                    index !== recordChecks.length - 1
                      ? "border-b border-[#EDF0F3]"
                      : ""
                  }`}
                >

                  <div className="flex items-center gap-2.5">

                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                        status === "PASS"
                          ? "bg-[#F2FCE3] text-[#638D00]"
                          : status === "WARN"
                          ? "bg-[#FFF7ED] text-[#C2410C]"
                          : "bg-[#FDECEC] text-[#C24141]"
                      }`}
                    >
                      {status === "PASS"
                        ? "✓"
                        : status === "WARN"
                        ? "!"
                        : "×"}
                    </span>

                    <span className="text-[11px] font-medium text-[#40566D]">
                      {rule}
                    </span>

                  </div>

                  <StatusChip
                    s={
                      status === "PASS"
                        ? "PASS"
                        : status === "WARN"
                        ? "WARNING"
                        : "FLAGGED"
                    }
                  />

                </div>
              ))}

            </div>
          </div>

        </div>

        {/* ======================================================
            RECENT OBSERVATIONS
        ======================================================= */}

        <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)] mt-5">

          <div className="px-5 py-5 border-b border-[#E8EDF2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div>
              <h3 className="text-[15px] font-semibold text-[#102A43]">
                Recent observations
              </h3>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Latest recorded observations from expense review
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-[#F7F9FB] border border-[#E8EDF2] text-[10px] font-semibold text-[#718096]">
              {anomalies.data.length} TOTAL
            </div>

          </div>

          <div className="px-5">

            {anomalies.loading ? (
              <div className="py-7 text-[12px] text-[#8291A5]">
                Loading observations…
              </div>
            ) : anomalies.data.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">

                <div className="w-10 h-10 rounded-xl bg-[#F2FCE3] flex items-center justify-center text-[#638D00] mb-3">
                  ✓
                </div>

                <p className="text-[12px] font-semibold text-[#40566D]">
                  No anomalies detected
                </p>

                <p className="text-[10px] text-[#8291A5] mt-1">
                  Current expense records have no reported observations.
                </p>

              </div>
            ) : (
              anomalies.data.slice(0, 6).map((a, index) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 py-3.5 ${
                    index !==
                    Math.min(anomalies.data.length, 6) - 1
                      ? "border-b border-[#EDF0F3]"
                      : ""
                  }`}
                >

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      a.severity === "HIGH"
                        ? "bg-[#FDECEC] text-[#C24141]"
                        : a.severity === "MEDIUM"
                        ? "bg-[#FFF7ED] text-[#C2410C]"
                        : "bg-[#EEF7F5] text-[#0D766E]"
                    }`}
                  >
                    {a.severity === "HIGH"
                      ? "!"
                      : a.severity === "MEDIUM"
                      ? "•"
                      : "✓"}
                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2">
                      <StatusChip s={a.severity} />

                      <span className="text-[10px] font-mono text-[#9AA8B6]">
                        {a.expenseId}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#40566D] mt-1.5">
                      {a.reason}
                    </p>

                  </div>

                  {a.resolved ? (
                    <span className="shrink-0 text-[10px] font-semibold text-[#638D00] bg-[#F2FCE3] px-2.5 py-1 rounded-full">
                      Resolved
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold text-[#C2410C] bg-[#FFF7ED] px-2.5 py-1 rounded-full">
                      Open
                    </span>
                  )}

                </div>
              ))
            )}

          </div>
        </div>

        {/* ======================================================
            OPEN OBJECTIONS
        ======================================================= */}

        {objections.data.length > 0 && (
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)] mt-5 mb-2">

            <div className="px-5 py-5 border-b border-[#E8EDF2] flex items-center justify-between">

              <div>
                <h3 className="text-[15px] font-semibold text-[#102A43]">
                  Open objections
                </h3>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Matters requiring auditor review or follow-up
                </p>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] text-[#C2410C] flex items-center justify-center font-semibold">
                {stats.objectionsRaised}
              </div>

            </div>

            <div className="px-5">

              {objections.data
                .filter((o) => o.status === "OPEN")
                .map((o, index, arr) => (
                  <div
                    key={o.id}
                    className={`py-4 ${
                      index !== arr.length - 1
                        ? "border-b border-[#EDF0F3]"
                        : ""
                    }`}
                  >

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                      <div className="min-w-0">

                        <div className="flex items-center gap-2 flex-wrap">

                          <span className="text-[12px] font-semibold text-[#40566D]">
                            {o.title}
                          </span>

                          <StatusChip s={o.status} />

                        </div>

                        <p className="text-[11px] leading-5 text-[#64748B] mt-2">
                          {o.note}
                        </p>

                      </div>

                      <span className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#F7F9FB] text-[#718096]">
                        {o.grantId}
                      </span>

                    </div>

                  </div>
                ))}

            </div>
          </div>
        )}

        {/* Bottom status */}
        <div className="mt-5 mb-2 rounded-[16px] border border-[#E2E8F0] bg-white px-5 py-4 flex items-center gap-3">

          <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#2454D6] flex items-center justify-center shrink-0">
            ✓
          </div>

          <div>
            <p className="text-[12px] font-semibold text-[#40566D]">
              Audit workspace uses current records
            </p>

            <p className="text-[10px] text-[#8291A5] mt-0.5">
              Status indicators reflect recorded fields and issue records. They do
              not independently certify policy or regulatory compliance.
            </p>
          </div>

        </div>

      </div>
    </AppShell>
  );
}