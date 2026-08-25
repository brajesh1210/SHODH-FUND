"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type HealthResponse = {
  status: "ok" | "degraded";
  database: "connected" | "unavailable";
  services: {
    api: "available";
    database: "connected" | "unavailable";
    jwt: "configured" | "temporary-development-key";
    ocr: "configured" | "not-configured";
    storage: "configured" | "not-configured";
  };
  checkedAt: string;
};

type Health = {
  api: boolean;
  ok: boolean;
  jwt: boolean;
  gemini: boolean;
  r2: boolean;
  store: string;
  checkedAt?: string;
};

type AIProviderStatus = {
  provider: string;
  configured: boolean;
  enabled: boolean;
  model: string;
  state: "not-configured" | "circuit-open" | "available-at-last-attempt" | "failed-at-last-attempt" | "not-probed";
  lastAttempt: null | {
    ok: boolean;
    code: string;
    latencyMs: number;
    requestId: string | null;
    at: string;
  };
  circuitOpenUntil: string | null;
};

type AIStatus = {
  providerOrder: string[];
  builtInGuidanceEnabled: boolean;
  externalRecordContextEnabled: boolean;
  providers: AIProviderStatus[];
  checkedAt: string;
  note: string;
};

type AIProbe = {
  ok: boolean;
  provider?: string | null;
  model?: string | null;
  code?: string;
  message?: string;
  latencyMs?: number;
  requestId?: string | null;
  cached: boolean;
  checkedAt?: string;
};

export default function SettingsPage() {
  const [h, setH] = useState<Health | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiError, setAiError] = useState("");
  const [probe, setProbe] = useState<AIProbe | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);

  useEffect(() => {
    api<HealthResponse>("/api/health")
      .then((health) =>
        setH({
          api: true,
          ok: health.status === "ok" && health.database === "connected",
          jwt: health.services.jwt === "configured",
          gemini: health.services.ocr === "configured",
          r2: health.services.storage === "configured",
          store: health.database,
          checkedAt: health.checkedAt,
        })
      )
      .catch(() =>
        setH({
          api: false,
          ok: false,
          jwt: false,
          gemini: false,
          r2: false,
          store: "unavailable",
        })
      );

    api<AIStatus>("/api/admin/ai/status")
      .then((status) => {
        setAiStatus(status);
        setAiError("");
      })
      .catch((error) => {
        setAiError(error instanceof Error ? error.message : "AI status is unavailable.");
      });
  }, []);

  async function runAIProbe() {
    if (probeBusy) return;
    setProbeBusy(true);
    setAiError("");
    try {
      const result = await api<AIProbe>("/api/admin/ai/probe", { method: "POST" });
      setProbe(result);
      const status = await api<AIStatus>("/api/admin/ai/status");
      setAiStatus(status);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "The AI connectivity probe failed.");
    } finally {
      setProbeBusy(false);
    }
  }

  const services = [
    {
      key: "api",
      label: "API Service",
      value: !!h?.api,
      hint: "Whether the protected health endpoint answered this request",
      meta: "Application API",
      icon: "↗",
    },
    {
      key: "jwt",
      label: "JWT Authentication",
      value: !!h?.jwt,
      hint: "Authentication and secure session signing",
      meta: "JWT_SECRET",
      icon: "◆",
    },
    {
      key: "gemini",
      label: "Gemini OCR",
      value: !!h?.gemini,
      hint: "Optional Gemini provider configuration for bill extraction",
      meta: "GEMINI_API_KEY",
      icon: "✦",
    },
    {
      key: "r2",
      label: "Private bill storage",
      value: !!h?.r2,
      hint: "Whether the backend has a private S3-compatible storage client configuration; use an authorized bill upload to prove object operations.",
      meta: "Private object storage client",
      icon: "◇",
    },
  ];

  const activeServices = services.filter((s) => s.value).length;
  const totalServices = services.length;
  const overallHealthy = !!h?.api && h.store === "connected";

  const overallLabel = useMemo(() => {
    if (!h) return "Checking";
    if (overallHealthy && activeServices === totalServices) return "API reached; database connected; optional services configured";
    if (overallHealthy) return "API reached and database connected";
    if (h.api) return "API reached; database unavailable";
    return "Health check unavailable";
  }, [h, activeServices, totalServices, overallHealthy]);

  const aiProvider = aiStatus?.providers[0] || null;
  const aiStateLabel = !aiProvider
    ? "Checking"
    : aiProvider.state.replaceAll("-", " ");

  return (
    <AppShell role="ADMIN">
      <div className="min-h-full bg-[#F4F7FB]">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="relative overflow-hidden pt-1 pb-7">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative">

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ⚙
              </span>
              Platform Administration
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Platform status
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B] max-w-2xl">
                  View the latest database reachability check and reported
                  authentication, OCR-provider, and storage configuration.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      h === null
                        ? "bg-[#CBD5E1]"
                        : overallHealthy
                        ? "bg-[#9BE500]"
                        : "bg-[#EF4444]"
                    }`}
                  />

                  {h === null
                    ? "Checking platform services..."
                    : overallLabel}
                </div>
              </div>

              {/* Overall status */}
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-sm ${
                  overallHealthy
                    ? "bg-[#09232D]"
                    : "bg-[#3A2024]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold ${
                    overallHealthy
                      ? "bg-[#C8F51A] text-[#193100]"
                      : "bg-[#FCA5A5] text-[#641B1B]"
                  }`}
                >
                  {h === null ? "…" : overallHealthy ? "✓" : "!"}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                    Latest core check
                  </p>

                  <p className="text-[13px] font-medium mt-0.5">
                    {h === null
                      ? "Checking..."
                      : overallHealthy
                      ? "Checks passed"
                      : "Check failed"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            OVERVIEW CARDS
        ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Overall */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                  Core checks
                </p>

                <p className="text-[26px] font-semibold tracking-[-0.03em] mt-3">
                  {h === null
                    ? "..."
                    : overallHealthy
                    ? "Passed"
                    : "Failed"}
                </p>
              </div>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${overallHealthy ? "bg-[#C8F51A] text-[#193100]" : "bg-[#FCA5A5] text-[#641B1B]"}`}>
                {h === null ? "…" : overallHealthy ? "✓" : "!"}
              </div>
            </div>

            <p className="text-[11px] text-[#9BAEB5] mt-5">
              Latest API reachability and database check
            </p>
          </div>

          {/* Services */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                  Checks reported
                </p>

                <p className="text-[30px] leading-none font-semibold tracking-[-0.03em] text-[#102A43] mt-4">
                  {h === null ? "—" : activeServices}
                  <span className="text-[16px] text-[#9AA8B6]">
                    /{services.length}
                  </span>
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[#F2FCE3] flex items-center justify-center text-[#638D00]">
                ◉
              </div>
            </div>

            <div className="h-1.5 bg-[#EEF1F4] rounded-full mt-5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0F766E] transition-all"
                style={{
                  width: `${(activeServices / services.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Store */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                  Data store
                </p>

                <p className="text-[20px] font-semibold tracking-[-0.02em] text-[#102A43] mt-4">
                  {h?.store || "Checking..."}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6]">
                DB
              </div>
            </div>

            <p className="text-[11px] text-[#8291A5] mt-5">
              Current application storage
            </p>
          </div>
        </div>

        {/* =====================================================
            SERVICE HEALTH
        ====================================================== */}
        <div className="mt-5 rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

          <div className="px-5 py-5 border-b border-[#E8EDF2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                Service checks and configuration
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Reachability and configuration reported by the protected health endpoint
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-[#F7F9FB] border border-[#E8EDF2] text-[10px] font-semibold text-[#718096]">
              {h === null ? "CHECKING" : `${activeServices} / ${services.length} CHECKS POSITIVE`}
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">

            {services.map((service) => (
              <div
                key={service.key}
                className={`rounded-2xl border p-4 transition-colors ${
                  service.value
                    ? "border-[#E2EAD8] bg-[#FBFDF8]"
                    : "border-[#F1D9DC] bg-[#FFFAFA]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">

                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        service.value
                          ? "bg-[#F2FCE3] text-[#638D00]"
                          : "bg-[#FDECEC] text-[#C24141]"
                      }`}
                    >
                      {service.icon}
                    </div>

                    <div>
                      <p className="text-[13px] font-semibold text-[#102A43]">
                        {service.label}
                      </p>

                      <p className="text-[11px] leading-5 text-[#8291A5] mt-1">
                        {service.hint}
                      </p>

                      <p className="text-[10px] font-mono text-[#9AA8B6] mt-2">
                        {service.meta}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                    service.value
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {h === null
                      ? "CHECKING"
                      : service.value
                        ? service.key === "api" ? "REACHABLE" : "CONFIGURED"
                        : service.key === "api" ? "UNAVAILABLE" : "NOT CONFIGURED"}
                  </span>
                </div>
              </div>
            ))}

          </div>
        </div>

        <section className="mt-5 overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.03)]" aria-labelledby="ai-status-title">
          <div className="flex flex-col gap-4 border-b border-[#E8EDF2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="ai-status-title" className="text-[16px] font-semibold text-[#102A43]">Ask AI configuration and connectivity</h2>
              <p className="mt-1 text-[11px] text-[#8291A5]">
                Configuration status does not prove connectivity. The explicit probe may consume provider quota and is cached and rate-limited.
              </p>
            </div>
            <button
              type="button"
              onClick={runAIProbe}
              disabled={probeBusy || !aiProvider?.configured || !aiProvider.enabled}
              className="h-10 rounded-xl border border-[#0D1220] bg-[#C9FF24] px-4 text-xs font-semibold text-[#0D1220] transition hover:bg-[#BDEA18] disabled:cursor-not-allowed disabled:border-[#D7DCE2] disabled:bg-[#EEF1F4] disabled:text-[#8A97A5]"
            >
              {probeBusy ? "Running probe…" : "Test provider connectivity"}
            </button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8291A5]">Configuration</p>
              <p className="mt-3 text-sm font-semibold text-[#102A43]">
                {aiProvider?.configured
                  ? aiProvider.enabled ? "Provider configured and enabled" : "Provider configured but disabled"
                  : aiProvider ? "Provider not configured" : "Checking…"}
              </p>
              <dl className="mt-3 space-y-2 text-[11px] text-[#64748B]">
                <div className="flex justify-between gap-4"><dt>Order</dt><dd className="font-mono text-right">{aiStatus?.providerOrder.join(" → ") || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt>Model</dt><dd className="font-mono text-right">{aiProvider?.model || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt>Built-in guidance</dt><dd>{aiStatus ? (aiStatus.builtInGuidanceEnabled ? "Enabled" : "Disabled") : "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt>External record context</dt><dd>{aiStatus ? (aiStatus.externalRecordContextEnabled ? "Enabled" : "Disabled") : "—"}</dd></div>
              </dl>
            </div>

            <div className="rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8291A5]">Last known provider state</p>
              <p className="mt-3 capitalize text-sm font-semibold text-[#102A43]">{aiStateLabel}</p>
              <p className="mt-2 text-[11px] leading-5 text-[#64748B]">
                {aiProvider?.lastAttempt
                  ? `${aiProvider.lastAttempt.code} · ${aiProvider.lastAttempt.latencyMs} ms · ${new Date(aiProvider.lastAttempt.at).toLocaleString()}`
                  : "No live provider attempt has been recorded in this server process."}
              </p>
              {aiProvider?.circuitOpenUntil && (
                <p className="mt-2 text-[11px] font-medium text-amber-700">Circuit paused until {new Date(aiProvider.circuitOpenUntil).toLocaleString()}.</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 ${probe?.ok ? "border-emerald-200 bg-emerald-50" : probe ? "border-amber-200 bg-amber-50" : "border-[#E5EAF0] bg-[#F8FAFC]"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8291A5]">Connectivity probe</p>
              <p className="mt-3 text-sm font-semibold text-[#102A43]">
                {!probe ? "Not run in this page" : probe.ok ? "Provider responded" : probe.code || "Probe failed"}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[#64748B]">
                {!probe
                  ? "Use the button only when a live connectivity check is needed."
                  : probe.ok
                    ? `${probe.provider} · ${probe.model} · ${probe.latencyMs} ms${probe.cached ? " · cached" : ""}`
                    : `${probe.message || "The provider did not respond successfully."}${probe.cached ? " Cached result." : ""}`}
              </p>
            </div>
          </div>

          {aiError && <p className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{aiError}</p>}
          <p className="border-t border-[#E8EDF2] px-5 py-3 text-[10px] leading-5 text-[#8291A5]">
            No key value is returned to this page. Record context remains separate and should stay disabled until institutional privacy and legal review is complete.
          </p>
        </section>

        {/* =====================================================
            DEPLOYMENT INFORMATION
        ====================================================== */}
        <div className="grid lg:grid-cols-[1fr_0.8fr] gap-5 mt-5">

          {/* Environment */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">

            <div className="px-5 py-5 border-b border-[#E8EDF2]">
              <h2 className="text-[16px] font-semibold text-[#102A43]">
                Environment
              </h2>

              <p className="text-[11px] text-[#8291A5] mt-1">
                Current deployment configuration
              </p>
            </div>

            <div className="p-5 space-y-3">

              <div className="flex items-center justify-between py-3 border-b border-[#EDF0F3]">
                <div>
                  <p className="text-[12px] font-semibold text-[#40566D]">
                    API service
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    Backend application endpoint
                  </p>
                </div>

                <span className="font-mono text-[10px] px-2.5 py-1 rounded-lg bg-[#F7F9FB] text-[#64748B]">
                  PROXIED
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#EDF0F3]">
                <div>
                  <p className="text-[12px] font-semibold text-[#40566D]">
                    Authentication
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    JWT-based session security
                  </p>
                </div>

                <span
                  className={`text-[10px] font-semibold ${
                    h?.jwt
                      ? "text-[#638D00]"
                      : "text-[#C24141]"
                  }`}
                >
                  {h?.jwt ? "CONFIGURED" : "MISSING"}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[12px] font-semibold text-[#40566D]">
                    Data storage
                  </p>

                  <p className="text-[10px] text-[#8291A5] mt-1">
                    Application persistence layer
                  </p>
                </div>

                <span className="font-mono text-[10px] px-2.5 py-1 rounded-lg bg-[#F7F9FB] text-[#64748B]">
                  {h?.store || "…"}
                </span>
              </div>

            </div>
          </div>

          {/* Deployment note */}
          <div className="rounded-[20px] bg-[#09232D] text-white overflow-hidden shadow-[0_8px_24px_rgba(7,32,42,0.12)]">

            <div className="p-5 border-b border-white/10">
              <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                Deployment guide
              </p>

              <h2 className="text-[18px] font-semibold mt-2">
                Environment configuration
              </h2>
            </div>

            <div className="p-5">

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#C8F51A] text-[#193100] flex items-center justify-center font-semibold shrink-0">
                  i
                </div>

                <div>
                  <p className="text-[12px] font-semibold">
                    Configuration depends on environment
                  </p>

                  <p className="text-[11px] leading-5 text-[#AEBBC0] mt-2">
                    Configure a strong JWT secret for production. OCR and
                    cloud-storage environment variables are optional unless
                    those features are enabled in the deployment.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8FA2AA]">
                  Reference
                </p>

                <p className="text-[12px] font-mono text-[#C8F51A] mt-2">
                  INSTALL.md
                </p>

                <p className="text-[10px] leading-5 text-[#9BAEB5] mt-2">
                  Refer to the repository deployment guide for
                  local, Vercel, Render, and environment-variable
                  configuration.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-5 mb-2 rounded-[16px] border border-[#E2E8F0] bg-white px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F2FCE3] flex items-center justify-center text-[#638D00] shrink-0">
            ✓
          </div>

          <div>
            <p className="text-[12px] font-semibold text-[#40566D]">
              Status snapshot is read-only
            </p>

            <p className="text-[10px] text-[#8291A5] mt-0.5">
              This page requests a point-in-time reachability and configuration
              snapshot without changing configuration or application data.
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}