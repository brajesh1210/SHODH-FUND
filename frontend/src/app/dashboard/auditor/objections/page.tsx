"use client";

import { AppShell, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";

type Objection = {
  id: string;
  title: string;
  status: string;
  grantId: string;
  note: string;
};

export default function P() {
  const { data, loading, error } = useList<Objection>("/api/objections");

  const open = data.filter((o) => o.status === "OPEN").length;

  const resolved = data.filter(
    (o) => o.status === "RESOLVED" || o.status === "CLOSED"
  ).length;

  const resolutionRate = data.length
    ? Math.round((resolved / data.length) * 100)
    : 0;

  if (loading) {
    return <AppShell role="AUDITOR"><div className="card p-8 text-sm text-muted">Loading recorded objections…</div></AppShell>;
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
        <section className="relative overflow-hidden rounded-[28px] border border-[#E2E8EF] bg-gradient-to-br from-white via-white to-[#FFF7F1] px-7 py-7 shadow-[0_6px_28px_rgba(16,36,58,0.04)]">

          {/* Decorative background accents */}
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#FFD9C8]/30 blur-2xl" />
          <div className="absolute right-24 bottom-[-80px] h-44 w-44 rounded-full bg-[#DFFF63]/20 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-7">

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E1E7EE] bg-white px-3 py-1.5 text-[12px] font-medium text-[#51627A] shadow-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF0E8] text-[10px] font-bold text-[#C2410C]">
                  !
                </span>
                Audit exceptions
              </div>

              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.035em] text-[#10243A] sm:text-[35px]">
                Objections
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F8198]">
                Review expenditure exceptions and audit observations raised
                against research grants.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-[#71849B]">
                <span className="h-2 w-2 rounded-full bg-[#C2410C]" />
                Current recorded audit exceptions

                <span className="text-[#CBD3DC]">•</span>

                <span>{data.length} total records</span>

                <span className="text-[#CBD3DC]">•</span>

                <span className="text-[#C2410C]">
                  {open} require attention
                </span>
              </div>
            </div>

            {/* Open objections score */}
            <div className="relative min-w-[220px] overflow-hidden rounded-[20px] bg-[#0B2530] px-5 py-5 shadow-[0_8px_25px_rgba(11,37,48,0.12)]">

              <div className="absolute right-[-25px] top-[-25px] h-24 w-24 rounded-full bg-[#C2410C]/10" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#91A6B5]">
                    Open objections
                  </p>

                  <span className="h-2.5 w-2.5 rounded-full bg-[#F0784A]" />
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[34px] font-semibold tracking-tight text-white">
                    {open}
                  </span>

                  <span className="mb-1 text-[11px] font-medium text-[#F5A17E]">
                    {open > 0 ? "Attention required" : "All clear"}
                  </span>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#F0784A] transition-all"
                    style={{
                      width: `${data.length ? (open / data.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SUMMARY CARDS
        ========================================================= */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">

          {/* Total */}
          <div className="rounded-[20px] border border-[#E3E9F0] bg-white p-5 shadow-[0_4px_18px_rgba(16,36,58,0.035)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8090A4]">
                  Total objections
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
              Recorded audit observations
            </p>
          </div>

          {/* Open */}
          <div className="rounded-[20px] border border-[#F1D9D2] bg-[#FFF7F4] p-5 shadow-[0_4px_18px_rgba(194,65,12,0.04)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A56A56]">
                  Open
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#C2410C]">
                  {open}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFE4DB] text-[#C2410C]">
                !
              </div>
            </div>

            <p className="mt-2 text-xs text-[#9A6A5C]">
              Require resolution
            </p>
          </div>

          {/* Resolved */}
          <div className="col-span-2 rounded-[20px] border border-[#D9ECE9] bg-[#F5FBFA] p-5 shadow-[0_4px_18px_rgba(13,129,120,0.035)] lg:col-span-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B8F8B]">
                  Resolved
                </p>

                <p className="mt-2 text-3xl font-semibold text-[#0D8178]">
                  {resolved}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DFF4F0] text-[#0D8178]">
                ✓
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-[#658B86]">
                Closed audit observations
              </p>

              <span className="text-[11px] font-semibold text-[#0D8178]">
                {resolutionRate}% resolved
              </span>
            </div>
          </div>
        </section>

        {/* =========================================================
            EXCEPTION OVERVIEW
        ========================================================= */}
        <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">

          {/* Status distribution */}
          <div className="rounded-[24px] border border-[#E3E9F0] bg-white p-6 shadow-[0_5px_24px_rgba(16,36,58,0.04)]">

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold text-[#10243A]">
                  Exception overview
                </h2>

                <p className="mt-1 text-xs text-[#7B8DA2]">
                  Current resolution status across audit observations
                </p>
              </div>

              <span className="rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[11px] font-semibold text-[#687C93]">
                {data.length} records
              </span>
            </div>

            <div className="mt-7">

              {/* Distribution bar */}
              <div className="h-3 overflow-hidden rounded-full bg-[#F0F3F6]">
                {data.length > 0 && (
                  <div className="flex h-full">
                    <div
                      className="bg-[#E0522D]"
                      style={{
                        width: `${(open / data.length) * 100}%`,
                      }}
                    />

                    <div
                      className="bg-[#0D9488]"
                      style={{
                        width: `${(resolved / data.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">

                <div className="rounded-2xl bg-[#FFF6F3] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#E0522D]" />

                    <span className="text-[11px] font-medium text-[#A56D5B]">
                      Open
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#C2410C]">
                    {open}
                  </p>

                  <p className="mt-1 text-[10px] text-[#A47768]">
                    Requires action
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F3FAF8] p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#0D9488]" />

                    <span className="text-[11px] font-medium text-[#668B86]">
                      Resolved
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-[#0D8178]">
                    {resolved}
                  </p>

                  <p className="mt-1 text-[10px] text-[#658B86]">
                    Closed observations
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Attention panel */}
          <div className="rounded-[24px] border border-[#E3E9F0] bg-[#10243A] p-6 text-white shadow-[0_5px_24px_rgba(16,36,58,0.08)]">

            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8FA3B6]">
                  Audit attention
                </p>

                <h2 className="mt-2 text-[20px] font-semibold">
                  Resolution queue
                </h2>

                <p className="mt-2 text-xs leading-5 text-[#AAB8C6]">
                  Open objections remain visible here until their
                  underlying audit observation is resolved.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BDF500] text-sm font-bold text-[#294000]">
                !
              </div>
            </div>

            <div className="mt-6 space-y-3">

              <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F0784A]" />

                  <span className="text-xs text-[#D5DEE7]">
                    Open objections
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {open}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#BDF500]" />

                  <span className="text-xs text-[#D5DEE7]">
                    Resolved
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {resolved}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8EA5BA]" />

                  <span className="text-xs text-[#D5DEE7]">
                    Resolution rate
                  </span>
                </div>

                <span className="text-sm font-semibold text-white">
                  {resolutionRate}%
                </span>
              </div>

            </div>
          </div>
        </section>

        {/* =========================================================
            AUDIT OBSERVATIONS
        ========================================================= */}
        <section className="overflow-hidden rounded-[24px] border border-[#E3E9F0] bg-white shadow-[0_5px_24px_rgba(16,36,58,0.045)]">

          <div className="flex flex-col gap-3 border-b border-[#E8EDF2] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-[17px] font-semibold text-[#10243A]">
                Audit observations
              </h2>

              <p className="mt-1 text-xs text-[#7B8DA2]">
                Exceptions and issues identified during research expenditure review
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[11px] font-semibold text-[#687C93]">
              {data.length} observations
            </span>
          </div>

          {data.length === 0 ? (
            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F8DE] text-[#658000]">
                ✓
              </div>

              <p className="mt-4 text-sm font-medium text-[#30455D]">
                No objections raised
              </p>

              <p className="mt-1 text-xs text-[#8191A4]">
                Your audit portfolio currently has no recorded exceptions.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EDF0F4]">

              {data.map((o) => {
                const isOpen = o.status === "OPEN";
                const isResolved =
                  o.status === "RESOLVED" ||
                  o.status === "CLOSED";

                return (
                  <div
                    key={o.id}
                    className={`group px-6 py-5 transition-colors ${
                      isOpen
                        ? "hover:bg-[#FFFDFC]"
                        : "hover:bg-[#FAFBFC]"
                    }`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                      {/* Main content */}
                      <div className="flex min-w-0 items-start gap-4">

                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            isOpen
                              ? "bg-[#FFF0E8] text-[#C2410C]"
                              : "bg-[#E5F5F1] text-[#0D8178]"
                          }`}
                        >
                          <span className="text-sm font-bold">
                            {isOpen ? "!" : "✓"}
                          </span>
                        </div>

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-[#19324B]">
                              {o.title}
                            </h3>

                            <StatusChip s={o.status} />
                          </div>

                          <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[#65788E]">
                            {o.note}
                          </p>

                          {/* Metadata */}
                          <div className="mt-4 flex flex-wrap items-center gap-2">

                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8B99AA]">
                              Grant
                            </span>

                            <span className="rounded-md bg-[#F5F7F9] px-2 py-1 font-mono text-[10px] text-[#66788C]">
                              {o.grantId}
                            </span>

                            <span className="text-[#D4DAE1]">
                              •
                            </span>

                            <span className="font-mono text-[10px] text-[#8B99AA]">
                              {o.id}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status action */}
                      <div className="shrink-0 lg:pt-1">

                        {isOpen ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF2EA] px-3 py-1.5 text-[10px] font-semibold text-[#B94A12]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />
                            Attention required
                          </span>
                        ) : isResolved ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#F1F8DE] px-3 py-1.5 text-[10px] font-semibold text-[#658000]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#8FB500]" />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F7FA] px-3 py-1.5 text-[10px] font-semibold text-[#687C93]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#8191A4]" />
                            {o.status}
                          </span>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}