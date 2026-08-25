"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { useList } from "@/lib/useList";
import type { BudgetHead, Expense, Grant } from "@/lib/types";

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type FormState = {
  grantId: string;
  date: string;
  amount: string;
  vendor: string;
  invoice: string;
  budgetHeadId: string;
  gst: string;
  description: string;
};

function blankForm(): FormState {
  return {
    grantId: "",
    date: today(),
    amount: "",
    vendor: "",
    invoice: "",
    budgetHeadId: "",
    gst: "",
    description: "",
  };
}

function formFromExpense(expense?: Expense): FormState {
  if (!expense) return blankForm();
  return {
    grantId: expense.grantId,
    date: expense.date || today(),
    amount: String(expense.amount),
    vendor: expense.vendor || "",
    invoice: expense.invoice || "",
    budgetHeadId: expense.budgetHeadId || expense.budgetHead?.id || "",
    gst: expense.gst || "",
    description: expense.description || "",
  };
}

type AddExpenseProps = {
  onAdded?: () => void;
  onCreated?: () => void;
  expense?: Expense;
  compact?: boolean;
};

export function AddExpense({ onAdded, onCreated, expense, compact = false }: AddExpenseProps) {
  const editing = Boolean(expense);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [budgetHeads, setBudgetHeads] = useState<BudgetHead[]>([]);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNotice, setOcrNotice] = useState("");
  const [ocrSource, setOcrSource] = useState("");
  const [ocrProof, setOcrProof] = useState("");
  const [suggestedHead, setSuggestedHead] = useState("");
  const [error, setError] = useState("");
  const [selectedBill, setSelectedBill] = useState<File | null>(null);
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: grants, error: grantsError } = useList<Grant>("/api/grants");

  useEffect(() => {
    if (!form.grantId) {
      setBudgetHeads([]);
      setForm((current) => ({ ...current, budgetHeadId: "" }));
      return;
    }

    let active = true;
    api<BudgetHead[]>(`/api/grants/${form.grantId}/budget-heads`)
      .then((heads) => {
        if (!active) return;
        const items = Array.isArray(heads) ? heads : [];
        setBudgetHeads(items);
        setForm((current) => {
          const matchedSuggestion = items.find(
            (head) => head.name.toLowerCase() === suggestedHead.toLowerCase()
          );
          return {
            ...current,
            budgetHeadId: items.some((head) => head.id === current.budgetHeadId)
              ? current.budgetHeadId
              : matchedSuggestion?.id || items[0]?.id || "",
          };
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setBudgetHeads([]);
        setError(cause instanceof Error ? cause.message : "Could not load budget heads");
      });

    return () => {
      active = false;
    };
  }, [form.grantId, suggestedHead]);

  const grantOptions = useMemo(
    () => grants.filter((grant) => grant.status === "ACTIVE" || grant.id === expense?.grantId),
    [expense?.grantId, grants]
  );

  function updateCoveredField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setOcrProof("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function extractBill(file?: File) {
    if (!file) return;
    setSelectedBill(file);
    setOcrBusy(true);
    setError("");
    setOcrNotice("");
    setOcrSource("");
    setOcrProof("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      const extracted = await api<{
        vendor?: string;
        amount?: number | string;
        invoice?: string;
        invoiceNumber?: string;
        date?: string;
        gst?: string;
        gstNumber?: string;
        head?: string;
        desc?: string;
        description?: string;
        source?: string;
        demo?: boolean;
        notes?: string;
        aiExtractionProof?: string;
      }>("/api/ocr/extract", { method: "POST", body: payload });

      const extractedHead = String(extracted.head || "");
      setSuggestedHead(extractedHead);
      setOcrSource(String(extracted.source || ""));
      setOcrProof(String(extracted.aiExtractionProof || ""));
      setOcrNotice(
        extracted.notes ||
          (extracted.demo
            ? "Bundled sample values were loaded; live OCR was not performed."
            : "Fields were extracted from the uploaded document. Review every value before saving.")
      );
      setForm((current) => {
        const matchedHead = budgetHeads.find(
          (head) => head.name.toLowerCase() === extractedHead.toLowerCase()
        );
        return {
          ...current,
          vendor: extracted.vendor || current.vendor,
          amount: extracted.amount ? String(extracted.amount) : current.amount,
          invoice: extracted.invoiceNumber || extracted.invoice || current.invoice,
          date: extracted.date ? String(extracted.date).slice(0, 10) : current.date,
          gst: extracted.gstNumber || extracted.gst || current.gst,
          budgetHeadId: matchedHead?.id || current.budgetHeadId,
          description: extracted.description || extracted.desc || current.description,
        };
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Bill extraction failed");
    } finally {
      setOcrBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function uploadSelectedBill(expenseId: string) {
    if (!selectedBill) return;
    const payload = new FormData();
    payload.append("file", selectedBill);
    if (ocrSource) payload.append("ocrSource", ocrSource);
    await api(`/api/expenses/${encodeURIComponent(expenseId)}/document`, {
      method: "POST",
      body: payload,
    });
  }

  function closeAndReset() {
    setOpen(false);
    setForm(blankForm());
    setBudgetHeads([]);
    setSuggestedHead("");
    setOcrNotice("");
    setOcrSource("");
    setOcrProof("");
    setSelectedBill(null);
    setSavedExpenseId(null);
    setError("");
  }

  async function submit() {
    if (busy) return;

    // A previous create succeeded but the document storage request failed.
    // Retrying must never create a duplicate expense.
    if (savedExpenseId) {
      if (!selectedBill) {
        setError("Choose the bill again, then retry the private attachment upload.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await uploadSelectedBill(savedExpenseId);
        closeAndReset();
        onAdded?.();
        onCreated?.();
      } catch (cause: unknown) {
        setError(
          `Expense was already saved, but the bill could not be attached: ${
            cause instanceof Error ? cause.message : "Storage upload failed"
          }`
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    const amount = Number(form.amount);
    if (
      !form.grantId ||
      !form.budgetHeadId ||
      !form.date ||
      !form.vendor.trim() ||
      !form.invoice.trim() ||
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Select a grant and budget head, then enter a valid date, positive amount, vendor, invoice number, and description.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api<Expense>(editing && expense ? `/api/expenses/${encodeURIComponent(expense.id)}` : "/api/expenses", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          grantId: form.grantId,
          budgetHeadId: form.budgetHeadId,
          date: form.date,
          amount,
          vendor: form.vendor.trim(),
          invoice: form.invoice.trim(),
          gst: form.gst.trim() || undefined,
          description: form.description.trim(),
          aiExtractionProof: ocrSource === "gemini" ? ocrProof : undefined,
        }),
      });

      if (selectedBill) {
        try {
          await uploadSelectedBill(saved.id);
        } catch (cause: unknown) {
          setSavedExpenseId(saved.id);
          setError(
            `Expense was saved, but the bill could not be attached: ${
              cause instanceof Error ? cause.message : "Storage upload failed"
            }. You can retry the attachment without creating another expense.`
          );
          // Show the saved expense in the register even if attachment storage is unavailable.
          onAdded?.();
          onCreated?.();
          return;
        }
      }

      closeAndReset();
      onAdded?.();
      onCreated?.();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : editing ? "Expense correction failed" : "Expense submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            : "btn btn-primary inline-flex items-center gap-2"
        }
        onClick={() => {
          setError("");
          setOcrNotice("");
          setOcrSource("");
          setOcrProof("");
          setSelectedBill(null);
          setSavedExpenseId(null);
          setSuggestedHead(expense?.head || "");
          setForm(formFromExpense(expense));
          setOpen(true);
        }}
      >
        {editing ? <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {editing ? "Correct & resubmit" : "Add Expense"}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-3 sm:p-5">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => !busy && closeAndReset()}
              aria-label="Close expense dialog"
            />

            <section
              className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_70px_rgba(10,37,64,0.28)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-title"
            >
              <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 id="expense-title" className="text-lg font-semibold">{editing ? "Correct Expense" : "Add Expense"}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {editing
                      ? "Review the requested correction. Saving sends the updated expense back to Finance as submitted."
                      : "Record spending against one of your grant budget heads."}
                  </p>
                </div>
                <button type="button" className="rounded-lg p-2 hover:bg-gray-100" onClick={() => !busy && closeAndReset()} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="min-h-0 overflow-y-auto p-5">
                <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                  <Upload className="mx-auto h-5 w-5 text-muted" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold">Extract fields from a bill</p>
                  <p className="mt-1 text-[11px] text-muted">Upload a PDF, JPG, PNG, or WebP file. Review every extracted field before saving.</p>
                  <button type="button" className="btn btn-secondary mt-3" disabled={ocrBusy} onClick={() => fileRef.current?.click()}>
                    {ocrBusy ? "Extracting…" : "Choose bill"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => extractBill(event.target.files?.[0])}
                  />
                  {selectedBill && (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] leading-5 text-slate-600" role="status">
                      Selected bill: <strong>{selectedBill.name}</strong>. A private copy will be attached after the expense is saved.
                    </p>
                  )}
                  {ocrNotice && (
                    <p className="mt-3 rounded-lg bg-white px-3 py-2 text-left text-[11px] leading-5 text-slate-600" role="status">
                      {ocrNotice}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field sm:col-span-2">Grant
                    <select className="input" value={form.grantId} disabled={editing} onChange={(event) => setForm({ ...form, grantId: event.target.value })}>
                      <option value="">Select grant</option>
                      {grantOptions.map((grant) => <option key={grant.id} value={grant.id}>{grant.title}</option>)}
                    </select>
                  </label>
                  <label className="field">Date
                    <input className="input" type="date" value={form.date} onChange={(event) => updateCoveredField("date", event.target.value)} />
                  </label>
                  <label className="field">Amount
                    <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => updateCoveredField("amount", event.target.value)} />
                  </label>
                  <label className="field">Vendor
                    <input className="input" value={form.vendor} onChange={(event) => updateCoveredField("vendor", event.target.value)} />
                  </label>
                  <label className="field">Invoice number
                    <input className="input" value={form.invoice} onChange={(event) => updateCoveredField("invoice", event.target.value)} />
                  </label>
                  <label className="field">Budget head
                    <select className="input" value={form.budgetHeadId} disabled={!form.grantId} onChange={(event) => setForm({ ...form, budgetHeadId: event.target.value })}>
                      <option value="">{form.grantId ? "Select budget head" : "Select a grant first"}</option>
                      {budgetHeads.map((head) => <option key={head.id} value={head.id}>{head.name}</option>)}
                    </select>
                  </label>
                  <label className="field">GST number <span className="font-normal text-muted">(optional)</span>
                    <input className="input" value={form.gst} onChange={(event) => updateCoveredField("gst", event.target.value)} />
                  </label>
                  <label className="field sm:col-span-2">Description
                    <textarea className="input min-h-20 resize-y" value={form.description} onChange={(event) => updateCoveredField("description", event.target.value)} />
                  </label>
                </div>

                {(error || grantsError) && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error || grantsError}</p>}
              </div>

              <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-white px-5 py-4">
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={closeAndReset}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy || ocrBusy} onClick={submit}>
                  {busy ? "Saving…" : savedExpenseId ? "Retry bill attachment" : editing ? "Save & resubmit" : "Save Expense"}
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}

export default AddExpense;
