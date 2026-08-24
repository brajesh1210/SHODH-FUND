"use client";

import { AppShell } from "@/components/AppShell";
import { downloadFile } from "@/lib/download";
import { useList } from "@/lib/useList";
import { useState } from "react";

type ExpenseRecord = { id: string };

export default function P() {
  const { data, loading, error } = useList<ExpenseRecord>("/api/expenses");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const accessLabel = loading
    ? "Checking record access…"
    : error
      ? "Expense records unavailable"
      : data.length === 0
        ? "No expense records currently available"
        : `${data.length} expense record${data.length === 1 ? "" : "s"} available`;

  async function downloadExpenses() {
    setDownloadError("");
    setDownloading(true);
    try {
      await downloadFile("/api/export/expenses.csv", "university-expenses.csv");
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : "The expense export failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppShell role="ADMIN">
      <div className="min-h-full bg-[#F4F7FB]">

        {/* Header */}
        <div className="relative overflow-hidden pt-1 pb-7">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ✦
              </span>
              Research Analytics
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Analytics
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  Access university-wide research finance data and
                  download consolidated expense records.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  {accessLabel}
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#09232D] text-white shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#C8F51A]" />

                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Data access
                  </p>

                  <p className="text-[13px] font-medium mt-0.5">
                    Authenticated admin scope
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main analytics area */}
        <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-5">

          {/* Export panel */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

            <div className="px-5 py-5 border-b border-[#E8EDF2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                  ↓
                </div>

                <div>
                  <h2 className="text-[16px] font-semibold text-[#102A43]">
                    Expense data export
                  </h2>

                  <p className="text-[11px] text-[#8291A5] mt-1">
                    Consolidated university-wide expense extract
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-2xl bg-[#F7F9FB] border border-[#E8EDF2] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F766E] shadow-sm">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                        <path d="M8 13h8" />
                        <path d="M8 17h6" />
                      </svg>
                    </div>

                    <div>
                      <p className="text-[13px] font-semibold text-[#102A43]">
                        University expenses
                      </p>

                      <p className="text-[11px] leading-5 text-[#8291A5] mt-1 max-w-md">
                        Download the complete expense dataset for
                        analysis, reconciliation, reporting, or
                        external processing.
                      </p>
                    </div>
                  </div>

                  <button
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#102A43] text-white text-[12px] font-semibold hover:bg-[#173B59] transition-colors shrink-0"
                    onClick={downloadExpenses}
                    disabled={downloading}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>

                    {downloading ? "Preparing…" : "Download CSV"}
                  </button>
                </div>
              </div>

              {downloadError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700" role="alert">
                  {downloadError}
                </p>
              )}

              {/* Format information */}
              <div className="grid sm:grid-cols-3 gap-3 mt-5">

                <div className="rounded-xl border border-[#E8EDF2] p-4">
                  <p className="text-[9px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                    Format
                  </p>

                  <p className="text-[14px] font-semibold text-[#102A43] mt-2">
                    CSV
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    Spreadsheet compatible
                  </p>
                </div>

                <div className="rounded-xl border border-[#E8EDF2] p-4">
                  <p className="text-[9px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                    Scope
                  </p>

                  <p className="text-[14px] font-semibold text-[#102A43] mt-2">
                    Admin-visible records
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    University-wide extract
                  </p>
                </div>

                <div className="rounded-xl border border-[#E8EDF2] p-4">
                  <p className="text-[9px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                    Source
                  </p>

                  <p className="text-[14px] font-semibold text-[#102A43] mt-2">
                    Current records
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    {loading ? "Checking access" : error ? "Unavailable" : `${data.length} expense rows`}
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Data information panel */}
          <div className="rounded-[20px] bg-[#09232D] overflow-hidden shadow-[0_8px_24px_rgba(7,32,42,0.12)] text-white">

            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Analytics workspace
                  </p>

                  <h2 className="text-[18px] font-semibold mt-2">
                    {loading ? "Checking data" : error ? "Data unavailable" : data.length ? "Records available" : "No records yet"}
                  </h2>
                </div>

                <div className="w-10 h-10 rounded-xl bg-[#C8F51A] text-[#193100] flex items-center justify-center font-semibold">
                  {loading ? "…" : error ? "!" : data.length ? "✓" : "0"}
                </div>
              </div>
            </div>

            <div className="p-5">

              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-[#C8F51A] mt-1.5 shrink-0" />

                <div>
                  <p className="text-[12px] font-semibold text-white">
                    Consolidated expense records
                  </p>

                  <p className="text-[10px] leading-5 text-[#9BAEB5] mt-1">
                    When available, the export contains expense records within
                    this authenticated administrator workspace.
                  </p>
                </div>
              </div>

              <div className="h-px bg-white/10 my-5" />

              <div className="space-y-4">

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#9BAEB5]">
                    Data availability
                  </span>

                  <span className="text-[10px] font-semibold text-[#C8F51A]">
                    {loading ? "CHECKING" : error ? "UNAVAILABLE" : data.length ? "AVAILABLE" : "EMPTY"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#9BAEB5]">
                    Export type
                  </span>

                  <span className="text-[10px] font-semibold text-white">
                    CSV
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#9BAEB5]">
                    Coverage
                  </span>

                  <span className="text-[10px] font-semibold text-white">
                    ADMIN SCOPE
                  </span>
                </div>

              </div>

              <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                  Recommended use
                </p>

                <p className="text-[11px] leading-5 text-[#AEBBC0] mt-2">
                  Use the exported dataset for offline analysis,
                  finance reconciliation, research reporting, and
                  institutional analytics.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div className="mt-5 rounded-[16px] border border-[#E2E8F0] bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F2FCE3] flex items-center justify-center text-[#638D00] shrink-0">
            ✓
          </div>

          <div>
            <p className="text-[12px] font-semibold text-[#40566D]">
              Export uses the current research finance dataset
            </p>

            <p className="text-[10px] text-[#8291A5] mt-0.5">
              No changes are made to the underlying records when
              downloading the CSV.
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}