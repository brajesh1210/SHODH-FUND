import { Download, Paperclip } from "lucide-react";
import type { Expense } from "@/lib/types";

type ExpenseDocumentLinkProps = {
  expense: Expense;
  compact?: boolean;
};

/** A same-origin download link; the HttpOnly workspace session stays private. */
export function ExpenseDocumentLink({ expense, compact = false }: ExpenseDocumentLinkProps) {
  if (!expense.document?.downloadUrl) return null;

  return (
    <a
      href={expense.document.downloadUrl}
      className={
        compact
          ? "inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
          : "inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
      }
      title={`Download ${expense.document.originalName}`}
    >
      {compact ? <Paperclip className="h-3 w-3" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
      {compact ? "Bill attached" : "Download bill"}
    </a>
  );
}
