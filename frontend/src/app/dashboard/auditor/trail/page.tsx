"use client";

import { AppShell } from "@/components/AppShell";
import { useList } from "@/lib/useList";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  userId: string;
};

export default function P() {
  const { data, loading, error } = useList<AuditLog>("/api/audit-logs");

  const latest = data[0];

  if (loading) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-muted">Loading recorded activity…</div></AppShell>;
  }

  if (error) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }

  return (
    <AppShell role="AUDITOR">
      <div className="space-y-6">

        {/* ───────────────── Header ───────────────── */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#E3E9F0] bg-gradient-to-br from-white via-white to-[#F1F8DE] px-7 py-7 shadow-[0_5px_24px_rgba(16,36,58,0.04)]">

          {/* Decorative accents */}
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#BDF500]/15 blur-2xl" />
          <div className="absolute right-20 bottom-[-40px] h-28 w-28 rounded-full bg-[#C2410C]/10 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-[#DCE5ED] shadow-sm text-[12px] font-medium text-[#51627A]">
                <span className="w-2 h-2 rounded-full bg-[#8EB300]" />
                Research audit office
              </div>

              <h1 className="text-[30px] sm:text-[34px] font-semibold tracking-[-0.035em] text-[#10243A] mt-4">
                Audit trail
              </h1>

              <p className="text-sm text-[#6F8198] mt-2 max-w-2xl leading-6">
                A chronological record of actions performed across the
                research funding platform, providing a transparent history
                of system activity.
              </p>
            </div>

            {/* Event count */}
            <div className="relative overflow-hidden bg-[#0B2530] rounded-[20px] px-5 py-4 min-w-[200px] shadow-[0_8px_22px_rgba(11,37,48,0.12)]">
              <div className="absolute right-0 top-0 w-20 h-20 rounded-full bg-[#BDF500]/10 blur-xl" />

              <p className="relative text-[10px] uppercase tracking-[0.12em] font-semibold text-[#91A6B5]">
                Audit events
              </p>

              <p className="relative text-3xl font-semibold text-white mt-1">
                {data.length}
              </p>

              <div className="relative flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#BDF500]" />
                <span className="text-[11px] text-[#BDF500]">
                  Recorded activity log
                </span>
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 mt-6 text-[12px] text-[#71849B]">
            <span className="w-2 h-2 rounded-full bg-[#BDF500]" />
            Recorded activity history

            <span className="text-[#CBD3DC]">•</span>

            <span>{data.length} recorded events</span>

            {latest?.createdAt && (
              <>
                <span className="text-[#CBD3DC]">•</span>
                <span>Latest activity recorded</span>
              </>
            )}
          </div>
        </div>

        {/* ───────────────── Error ───────────────── */}
        {error && (
          <div className="rounded-[18px] border border-[#F2C9B8] bg-[#FFF5F0] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-[#FFE5D8] text-[#C2410C] flex items-center justify-center font-semibold">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-[#7C3015]">
                  Unable to load audit trail
                </p>

                <p className="text-xs text-[#9A634E] mt-1">
                  The audit log could not be retrieved from the server.
                  Please refresh and try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────── Summary strip ───────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

          <div className="bg-white border border-[#E3E9F0] rounded-[20px] p-5 shadow-[0_4px_18px_rgba(16,36,58,0.035)]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8090A4]">
                Total events
              </p>

              <div className="w-8 h-8 rounded-lg bg-[#EEF6D8] text-[#638000] flex items-center justify-center">
                <span className="text-sm">✓</span>
              </div>
            </div>

            <p className="text-3xl font-semibold text-[#10243A] mt-3">
              {data.length}
            </p>

            <p className="text-xs text-[#75879D] mt-2">
              Recorded platform actions
            </p>
          </div>

          <div className="bg-white border border-[#E3E9F0] rounded-[20px] p-5 shadow-[0_4px_18px_rgba(16,36,58,0.035)]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8090A4]">
                Latest action
              </p>

              <div className="w-8 h-8 rounded-lg bg-[#FFF0E8] text-[#C2410C] flex items-center justify-center">
                <span className="text-sm">↗</span>
              </div>
            </div>

            <p className="text-sm font-semibold text-[#19324B] mt-4 truncate">
              {latest?.action || "—"}
            </p>

            <p className="text-xs text-[#75879D] mt-2">
              Most recent recorded activity
            </p>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-white border border-[#E3E9F0] rounded-[20px] p-5 shadow-[0_4px_18px_rgba(16,36,58,0.035)]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8090A4]">
                Audit status
              </p>

              <div className="w-8 h-8 rounded-lg bg-[#EEF4FA] text-[#41647E] flex items-center justify-center">
                <span className="text-sm">●</span>
              </div>
            </div>

            <p className="text-lg font-semibold text-[#0D8178] mt-3">
              Records loaded
            </p>

            <p className="text-xs text-[#75879D] mt-1">
              Audit-history records returned by the server
            </p>
          </div>
        </div>

        {/* ───────────────── Activity ───────────────── */}
        <div className="bg-white border border-[#E3E9F0] rounded-[24px] overflow-hidden shadow-[0_5px_24px_rgba(16,36,58,0.045)]">

          <div className="px-6 py-5 border-b border-[#E8EDF2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-[#10243A]">
                Recent activity
              </h2>

              <p className="text-xs text-[#7B8DA2] mt-1">
                System actions and changes captured across the platform
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-[#F3F7E7] text-[#658000] text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8EB300]" />
              Current records
            </div>
          </div>

          {data.length === 0 ? (
            <div className="px-6 py-16 text-center">

              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F4F7FA] border border-[#E7ECF1] flex items-center justify-center text-[#8293A7]">
                <span className="text-lg">—</span>
              </div>

              <p className="text-sm font-semibold text-[#30455D] mt-4">
                No audit events
              </p>

              <p className="text-xs text-[#8191A4] mt-1 max-w-sm mx-auto">
                Activity will appear here as actions are performed across
                the research funding platform.
              </p>
            </div>
          ) : (
            <div className="relative">

              {/* Timeline rail */}
              <div className="absolute left-[42px] top-6 bottom-6 w-px bg-[#E7EDF2] hidden sm:block" />

              <div className="divide-y divide-[#EDF0F4]">
                {data.map((r, index) => {
                  const date = r.createdAt
                    ? new Date(r.createdAt)
                    : null;

                  const validDate =
                    date && !Number.isNaN(date.getTime());

                  const dateLabel = validDate
                    ? date.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  const timeLabel = validDate
                    ? date.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <div
                      key={r.id}
                      className="relative px-6 py-5 hover:bg-[#FAFBFC] transition-colors"
                    >
                      <div className="flex items-start gap-4">

                        {/* Timeline marker */}
                        <div className="relative z-10 shrink-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              index === 0
                                ? "bg-[#EEF7D9] text-[#638000]"
                                : "bg-[#F3F6F8] text-[#6F8194]"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                index === 0
                                  ? "bg-[#8EB300]"
                                  : "bg-[#9AA8B7]"
                              }`}
                            />
                          </div>
                        </div>

                        {/* Event content */}
                        <div className="flex-1 min-w-0">

                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">

                            <div className="min-w-0">

                              <div className="flex flex-wrap items-center gap-2">

                                <span className="font-semibold text-[13px] text-[#19324B]">
                                  {r.action}
                                </span>

                                <span className="px-2 py-1 rounded-md bg-[#F2F5F8] text-[10px] font-semibold text-[#697C90]">
                                  {r.entityType}
                                </span>

                                {index === 0 && (
                                  <span className="px-2 py-1 rounded-md bg-[#F1F8DE] text-[#658000] text-[9px] font-bold uppercase tracking-wide">
                                    Latest
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                                <span className="text-[11px] text-[#8997A7]">
                                  Entity
                                </span>

                                <span className="font-mono text-[11px] text-[#50657C]">
                                  {r.entityId}
                                </span>

                                <span className="text-[#D4DAE1]">
                                  •
                                </span>

                                <span className="text-[11px] text-[#8997A7]">
                                  User
                                </span>

                                <span className="font-mono text-[11px] text-[#50657C]">
                                  {r.userId}
                                </span>
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="shrink-0 lg:text-right">
                              <p className="text-[11px] font-semibold text-[#4C6178]">
                                {dateLabel}
                              </p>

                              <p className="text-[10px] text-[#91A0B0] mt-1">
                                {timeLabel}
                              </p>
                            </div>
                          </div>

                          {/* Event ID */}
                          <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAFBFC] border border-[#EEF1F4]">
                            <span className="text-[9px] uppercase tracking-wide font-semibold text-[#A0ACB9]">
                              Event ID
                            </span>

                            <span className="text-[10px] font-mono text-[#8997A7]">
                              {r.id}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}