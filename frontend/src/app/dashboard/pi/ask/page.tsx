"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Database,
  Search,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";

const suggestions = [
  "how much spent on DST",
  "pending expenses",
  "open anomalies",
  "UC due",
];

type AskResult = {
  answer: string;
  mode: "record-data";
  source: string;
  rows: { id: string; label: string; value: string; href: string }[];
};

export default function AskPage() {
  const [query, setQuery] = useState("how much spent on DST");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    if (!query.trim() || busy) return;

    setBusy(true);
    setError("");
    try {
      setResult(
        await api<AskResult>("/api/ask", {
          method: "POST",
          body: JSON.stringify({ q: query.trim() }),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The grant-data query could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell role="PI">
      <div className="relative min-h-full overflow-hidden">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#B7F51A]/15 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <header className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE8CB] bg-[#F7FBEF] px-3 py-1.5 text-[11px] font-medium text-[#62751D]">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              Authenticated record query
            </div>
            <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-[#071C2C] sm:text-[40px]">
              Ask your grant records.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
              Search accessible grants, expenses, recorded anomalies, and UC deadlines in plain language.
              This workspace queries your records directly and does not require Gemini.
            </p>
          </header>

          <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_35px_rgba(7,28,44,0.06)] sm:p-5" aria-label="Grant data query">
            <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="grant-query" className="sr-only">Question about grant records</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  id="grant-query"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (error) setError("");
                  }}
                  className="h-12 rounded-xl border-border bg-[#F8F9F5] pr-4 text-sm"
                  style={{ paddingLeft: "2.75rem" }}
                  placeholder="Ask about pending expenses, spending, anomalies, or UCs"
                  disabled={busy}
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#0D1220] bg-[#C9FF24] px-5 text-sm font-semibold text-[#0D1220] transition hover:-translate-y-0.5 hover:bg-[#BDEA18] disabled:translate-y-0"
                disabled={busy || !query.trim()}
              >
                {busy ? "Searching…" : "Run query"}
                {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Try</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-border bg-[#F8F9F5] px-3 py-1.5 text-[11px] text-ink-2 transition hover:border-[#B7F51A] hover:bg-[#F4FFD7]"
                  onClick={() => {
                    setQuery(suggestion);
                    setError("");
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_30px_rgba(7,28,44,0.05)]" aria-live="polite">
              <div className="border-b border-border p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0D1220] text-[#C9FF24]">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
                      {result.source || "Authorized ShodhFund records"}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-7 text-[#26302A]">{result.answer}</p>
                  </div>
                </div>
              </div>

              <div>
                {result.rows.length > 0 ? (
                  result.rows.map((row) => (
                    <Link
                      key={row.id}
                      href={row.href}
                      className="group flex items-center justify-between gap-5 border-b border-border px-5 py-4 last:border-0 transition hover:bg-[#F8FAF5] sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#071C2C]">{row.label}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted">{row.id}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-ink-2">
                        <span>{row.value}</span>
                        <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="px-6 py-8 text-center text-sm text-muted">No matching grant records were returned.</p>
                )}
              </div>
            </section>
          ) : (
            <section className="mt-5 grid min-h-52 place-content-center justify-items-center rounded-2xl border border-dashed border-[#CED2C8] bg-white/45 px-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#EDEFE8] text-[#737A70]">
                <Database className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-[#071C2C]">Your answer will appear here</h2>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted">Run a query to summarize relevant records and open matching grants.</p>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
