"use client";

import { AppShell, StatusChip } from "@/components/AppShell";
import { ExpenseDocumentLink } from "@/components/ExpenseDocumentLink";
import { api } from "@/lib/api";
import { useList } from "@/lib/useList";
import { inr, type Expense } from "@/lib/types";
import { useEffect, useState } from "react";

export default function Page() {
  const { data, reload, error, loading } = useList<Expense>("/api/expenses");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pendingDecision, setPendingDecision] = useState<{ id: string; action: "REJECTED" | "CORRECTION_REQUESTED" } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");

  useEffect(() => {
    if (!pendingDecision) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyId) setPendingDecision(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pendingDecision, busyId]);

  function requestReason(id: string, action: "REJECTED" | "CORRECTION_REQUESTED") {
    setActionError("");
    setDecisionReason("");
    setPendingDecision({ id, action });
  }

  async function decide(id: string, action: string, reason = "") {
    setActionError("");
    setBusyId(id);
    try {
      await api(`/api/expenses/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      setPendingDecision(null);
      setDecisionReason("");
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The finance decision could not be saved.");
    } finally {
      setBusyId("");
    }
  }

  const pending = data.filter((e) => e.status === "SUBMITTED");

  const submitted = data.filter(
    (e) => e.status === "SUBMITTED"
  );

  const approved = data.filter(
    (e) => e.status === "APPROVED"
  );

  const rejected = data.filter(
    (e) => e.status === "REJECTED"
  );

  const pendingAmount = pending.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const approvedAmount = approved.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const flagged = pending.filter((e) =>
    ["WARNING", "NON_COMPLIANT"].includes(String(e.compliance).toUpperCase())
  ).length;
  const pendingChecks = pending.filter(
    (e) => String(e.compliance).toUpperCase() === "PENDING"
  ).length;

  if (loading) {
    return <AppShell role="FINANCE"><div className="card p-8 text-sm text-muted">Loading submitted expenses…</div></AppShell>;
  }
  if (error) {
    return <AppShell role="FINANCE"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }

  return (
    <AppShell role="FINANCE">
      <div className="min-h-full bg-[#F4F7FB]">
        {/* =========================================================
            HEADER
        ========================================================== */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#F0F9E8]" />

          <div className="relative pt-1 pb-7">
            {/* Workspace */}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[12px] font-medium text-[#475569] mb-5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#D9FF38] text-[#17324D]">
                ✦
              </span>
              ShodhFund Workspace
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-[#102A43]">
                  Expense verification
                </h1>

                <p className="mt-3 text-[15px] text-[#64748B]">
                  Review submitted expenses, inspect recorded checks and
                  record an authorized finance decision.
                </p>

                <div className="flex items-center gap-2 mt-4 text-[12px] text-[#718096]">
                  <span className="w-2 h-2 rounded-full bg-[#9BE500]" />
                  Finance approval queue · Current expense records
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                  Queue
                </p>

                <p className="text-[20px] font-semibold text-[#102A43] mt-0.5">
                  {pending.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            SUMMARY CARDS
        ========================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Pending */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Pending review
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {pending.length}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#FFF3E8] flex items-center justify-center text-[#C76A00] text-xl">
                !
              </div>
            </div>

            <div className="mt-7 flex items-center gap-2 text-[12px] text-[#B45D00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
              {submitted.length} newly submitted
            </div>
          </div>

          {/* Amount awaiting */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Amount in queue
                </p>

                <p className="mt-4 text-[29px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {inr(pendingAmount)}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6] text-xl">
                ₹
              </div>
            </div>

            <div className="mt-7 text-[12px] text-[#315DCE]">
              Awaiting finance decision
            </div>
          </div>

          {/* Approved */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#718096]">
                  Approved
                </p>

                <p className="mt-4 text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#102A43]">
                  {approved.length}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488] text-xl">
                ✓
              </div>
            </div>

            <div className="mt-7 text-[12px] text-[#0D9488]">
              {inr(approvedAmount)} authorized
            </div>
          </div>

          {/* Compliance */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white shadow-[0_8px_24px_rgba(7,32,42,0.12)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#8B9CA4]">
                  Recorded checks
                </p>

                <p className="mt-4 text-[25px] leading-none font-semibold tracking-[-0.02em]">
                  {loading
                    ? "—"
                    : pending.length === 0
                      ? "No queue"
                      : `${flagged} flagged`}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100] text-xl">
                {flagged > 0 ? "!" : "i"}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-[#B5C2C7]">
              <span className={`w-2 h-2 rounded-full ${flagged > 0 ? "bg-amber-400" : "bg-[#94A3B8]"}`} />

              {pending.length === 0
                ? "No submitted expenses in the queue"
                : `${pendingChecks} pending; ${flagged} with recorded flags`}
            </div>
          </div>
        </div>

        {/* =========================================================
            ERROR
        ========================================================== */}
        {(error || actionError) && (
          <div className="mt-4 rounded-2xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
              !
            </div>

            <p className="text-[12px] text-[#B91C1C]">
              {actionError || error}
            </p>
          </div>
        )}

        {/* =========================================================
            VERIFICATION QUEUE
        ========================================================== */}
        <div className="mt-5 rounded-[20px] bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
          {/* Section header */}
          <div className="px-5 py-4 border-b border-[#E7ECF2] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-[#2454D6] text-lg">
                ✓
              </div>

              <div>
                <h2 className="font-semibold text-[16px] text-[#102A43]">
                  Verification queue
                </h2>

                <p className="text-[11px] text-[#7B8BA0] mt-0.5">
                  Approve, request corrections or reject submitted expenses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FFF7E8] text-[#B45D00] text-[10px] font-semibold">
                {pending.length} pending
              </span>

              <span className="px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#15803D] text-[10px] font-semibold">
                {approved.length} approved
              </span>

              <span className="px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#B91C1C] text-[10px] font-semibold">
                {rejected.length} rejected
              </span>
            </div>
          </div>

          {/* Empty state */}
          {loading ? (
            <div className="min-h-[320px] flex items-center justify-center text-[12px] text-[#8291A5]">Loading expenses…</div>
          ) : data.length === 0 ? (
            <div className="min-h-[320px] flex flex-col items-center justify-center text-center px-5">
              <div className="w-14 h-14 rounded-2xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488] text-2xl mb-4">
                ✓
              </div>

              <h3 className="text-[15px] font-semibold text-[#102A43]">
                No expenses available
              </h3>

              <p className="text-[12px] text-[#8291A5] mt-1 max-w-md">
                Expense submissions will appear here when they are ready for
                finance verification.
              </p>
            </div>
          ) : (
            <>
              {/* =====================================================
                  DESKTOP TABLE
              ====================================================== */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E7ECF2]">
                      <th className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Expense
                      </th>

                      <th className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Vendor
                      </th>

                      <th className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Amount
                      </th>

                      <th className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Recorded check
                      </th>

                      <th className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Status
                      </th>

                      <th className="px-5 py-3.5 text-right text-[10px] uppercase tracking-[0.08em] font-semibold text-[#8291A5]">
                        Decision
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.map((e) => {
                      const actionable = e.status === "SUBMITTED";
                      const reopenable = e.status === "REJECTED";

                      return (
                        <tr
                          key={e.id}
                          className={`border-b border-[#EDF1F4] last:border-0 transition ${
                            actionable
                              ? "hover:bg-[#FBFCFD]"
                              : "opacity-75"
                          }`}
                        >
                          {/* ID */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  actionable
                                    ? "bg-[#FFF3E8] text-[#C76A00]"
                                    : "bg-[#F2F6FA] text-[#52708D]"
                                }`}
                              >
                                {actionable ? "!" : "₹"}
                              </div>

                              <div>
                                <p className="text-[12px] font-medium text-[#18324D]">
                                  Expense claim
                                </p>

                                <p className="text-[10px] font-mono text-[#8291A5] mt-1">
                                  {e.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Vendor */}
                          <td className="px-5 py-4">
                            <p className="font-medium text-[#40566D]">
                              {e.vendor}
                            </p>

                            <p className="text-[10px] font-mono text-[#8291A5] mt-1">
                              {e.grantId}
                            </p>
                            <div className="mt-2"><ExpenseDocumentLink expense={e} compact /></div>
                          </td>

                          {/* Amount */}
                          <td className="px-5 py-4">
                            <span className="font-semibold tabular text-[#102A43]">
                              {inr(e.amount)}
                            </span>
                          </td>

                          {/* Recorded check */}
                          <td className="px-5 py-4">
                            <StatusChip s={e.compliance} />
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <StatusChip s={e.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            {actionable ? (
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#102A43] text-white text-[11px] font-semibold hover:bg-[#173B5A] transition shadow-sm"
                                  onClick={() => decide(e.id, "APPROVED")}
                                  disabled={busyId === e.id}
                                >
                                  ✓ Approve
                                </button>

                                <button
                                  className="inline-flex items-center justify-center h-9 px-3 rounded-xl bg-[#FFF8EB] border border-[#F5D9A7] text-[#B45D00] text-[11px] font-semibold hover:bg-[#FFF2D7] transition"
                                  onClick={() => requestReason(e.id, "CORRECTION_REQUESTED")}
                                  disabled={busyId === e.id}
                                >
                                  Fix
                                </button>

                                <button
                                  className="inline-flex items-center justify-center h-9 px-3 rounded-xl bg-[#FFF5F5] border border-[#F5CACA] text-[#C24141] text-[11px] font-semibold hover:bg-[#FEECEC] transition"
                                  onClick={() => requestReason(e.id, "REJECTED")}
                                  disabled={busyId === e.id}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : reopenable ? (
                              <div className="flex justify-end">
                                <button
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                                  onClick={() => requestReason(e.id, "CORRECTION_REQUESTED")}
                                  disabled={busyId === e.id}
                                >
                                  Reopen for correction
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <span className="px-2.5 py-1 rounded-full bg-[#F3F5F7] text-[#8291A5] text-[10px]">
                                  No action required
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* =====================================================
                  MOBILE CARDS
              ====================================================== */}
              <div className="md:hidden p-3 space-y-3">
                {data.map((e) => {
                  const actionable = e.status === "SUBMITTED";
                      const reopenable = e.status === "REJECTED";

                  return (
                    <div
                      key={e.id}
                      className={`rounded-2xl border border-[#E5EBF0] p-4 ${
                        actionable
                          ? "bg-[#FAFCFD]"
                          : "bg-[#F7F9FA]"
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              actionable
                                ? "bg-[#FFF3E8] text-[#C76A00]"
                                : "bg-[#EEF4F7] text-[#52708D]"
                            }`}
                          >
                            {actionable ? "!" : "₹"}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#18324D]">
                              {e.vendor}
                            </p>

                            <p className="text-[9px] font-mono text-[#8291A5] mt-1">
                              {e.id}
                            </p>
                            <div className="mt-2"><ExpenseDocumentLink expense={e} compact /></div>
                          </div>
                        </div>

                        <StatusChip s={e.status} />
                      </div>

                      {/* Grant */}
                      <div className="mt-4">
                        <p className="text-[9px] uppercase tracking-wider text-[#9AA7B5]">
                          Grant
                        </p>

                        <p className="text-[11px] font-mono text-[#40566D] mt-1">
                          {e.grantId}
                        </p>
                      </div>

                      {/* Financial info */}
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#9AA7B5]">
                            Amount
                          </p>

                          <p className="text-[16px] font-semibold tabular text-[#102A43] mt-1">
                            {inr(e.amount)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#9AA7B5]">
                            Recorded checks
                          </p>

                          <div className="mt-1">
                            <StatusChip s={e.compliance} />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {actionable ? (
                        <div className="grid grid-cols-3 gap-2 mt-5">
                          <button
                            className="h-10 rounded-xl bg-[#102A43] text-white text-[10px] font-semibold hover:bg-[#173B5A] transition"
                            onClick={() => decide(e.id, "APPROVED")}
                            disabled={busyId === e.id}
                          >
                            ✓ Approve
                          </button>

                          <button
                            className="h-10 rounded-xl bg-[#FFF8EB] border border-[#F5D9A7] text-[#B45D00] text-[10px] font-semibold hover:bg-[#FFF2D7] transition"
                            onClick={() => requestReason(e.id, "CORRECTION_REQUESTED")}
                            disabled={busyId === e.id}
                          >
                            Fix
                          </button>

                          <button
                            className="h-10 rounded-xl bg-[#FFF5F5] border border-[#F5CACA] text-[#C24141] text-[10px] font-semibold hover:bg-[#FEECEC] transition"
                            onClick={() => requestReason(e.id, "REJECTED")}
                            disabled={busyId === e.id}
                          >
                            Reject
                          </button>
                        </div>
                      ) : reopenable ? (
                        <button
                          className="mt-4 h-10 w-full rounded-xl border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                          onClick={() => requestReason(e.id, "CORRECTION_REQUESTED")}
                          disabled={busyId === e.id}
                        >
                          Reopen for correction
                        </button>
                      ) : (
                        <div className="mt-4 px-3 py-2.5 rounded-xl bg-white border border-[#E6EBEF] text-center text-[10px] text-[#8291A5]">
                          No further action required
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* =========================================================
            BOTTOM FINANCE SUMMARY
        ========================================================== */}
        <div className="grid md:grid-cols-2 gap-4 mt-4 pb-5">
          {/* Workflow */}
          <div className="rounded-[20px] bg-[#09232D] p-5 text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-[#C8F51A] flex items-center justify-center text-[#193100]">
                ✓
              </div>

              <div>
                <p className="text-[13px] font-semibold">
                  Verification workflow
                </p>

                <p className="text-[11px] leading-5 text-[#AAB9BF] mt-1.5">
                  Recorded duplicate-invoice and budget-cap flags are review aids,
                  not a GFR certification. Finance remains responsible for checking
                  source evidence and recording the decision.
                </p>
              </div>
            </div>
          </div>

          {/* Queue health */}
          <div className="rounded-[20px] bg-white border border-[#E2E8F0] p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ECFAF8] flex items-center justify-center text-[#0D9488]">
                ✓
              </div>

              <div>
                <p className="text-[13px] font-semibold text-[#102A43]">
                  Finance queue status
                </p>

                <p className="text-[11px] text-[#8291A5] mt-1">
                  Current expense verification overview
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-[21px] font-semibold text-[#B45D00]">
                  {pending.length}
                </p>

                <p className="text-[9px] text-[#8291A5] mt-0.5">
                  Pending
                </p>
              </div>

              <div>
                <p className="text-[21px] font-semibold text-[#0F766E]">
                  {approved.length}
                </p>

                <p className="text-[9px] text-[#8291A5] mt-0.5">
                  Approved
                </p>
              </div>

              <div>
                <p className="text-[21px] font-semibold text-[#C24141]">
                  {rejected.length}
                </p>

                <p className="text-[9px] text-[#8291A5] mt-0.5">
                  Rejected
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingDecision && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/45 p-3 sm:p-5">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close decision dialog"
            onClick={() => !busyId && setPendingDecision(null)}
          />
          <section
            className="relative my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
          >
            <h2 id="decision-title" className="text-lg font-semibold text-[#102A43]">
              {pendingDecision.action === "REJECTED" ? "Reject expense" : "Request correction"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#718096]">
              Record a clear reason for the PI. It will appear with the expense and its correction action.
            </p>
            <label className="mt-4 block text-xs font-semibold text-[#40566D]">
              Reason
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#DDE5EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#A3CF00] focus:ring-4 focus:ring-lime-100"
                value={decisionReason}
                maxLength={1000}
                autoFocus
                onChange={(event) => setDecisionReason(event.target.value)}
                placeholder="Explain the correction or rejection reason"
              />
            </label>
            {actionError && <p className="mt-3 text-xs text-red-700" role="alert">{actionError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="h-10 rounded-xl border border-[#DDE5EC] px-4 text-xs font-semibold text-[#52677D]"
                disabled={Boolean(busyId)}
                onClick={() => setPendingDecision(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-[#102A43] px-4 text-xs font-semibold text-white disabled:opacity-50"
                disabled={Boolean(busyId) || !decisionReason.trim()}
                onClick={() => decide(pendingDecision.id, pendingDecision.action, decisionReason)}
              >
                {busyId ? "Saving…" : pendingDecision.action === "REJECTED" ? "Reject expense" : "Send correction request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}