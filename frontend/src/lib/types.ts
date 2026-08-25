export type Role = "PI" | "FINANCE" | "ADMIN" | "AUDITOR";

export type User = {
  id: string;
  name: string;
  email: string;
  dept: string;
  designation?: string;
  role: Role;
};

export type Grant = {
  id: string;
  title: string;
  agency: string;
  amount: number;
  spent: number;
  start: string;
  end: string;
  status: string;
  piId: string;
  pi: string;
  department: string;
  ucDue: string;
};

export type ExpenseDocument = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  ocrSource?: string | null;
  ocrModel?: string | null;
  createdAt?: string;
  downloadUrl: string;
};

export type Expense = {
  id: string;
  grantId: string;
  vendor: string;
  invoice: string;
  amount: number;
  date: string;
  head: string;
  budgetHeadId?: string;
  budgetHead?: BudgetHead;
  status: string;
  compliance: string;
  gst: string;
  description?: string;
  submittedById?: string;
  document?: ExpenseDocument | null;
  approvals?: Array<{
    id?: string;
    action: string;
    reason?: string | null;
    createdAt?: string;
  }>;
};

export type Anomaly = {
  id: string;
  severity: string;
  reason: string;
  expenseId: string;
  resolved: boolean;
};

export type BudgetHead = {
  id?: string;
  grantId?: string;
  name: string;
  allocated: number;
  spent: number;
};

export function inr(n: number) {
  const amount = Number(n);
  if (!Number.isFinite(amount)) return "—";
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (absolute >= 10000000) return `${sign}₹${(absolute / 10000000).toFixed(2)} Cr`;
  if (absolute >= 100000) return `${sign}₹${(absolute / 100000).toFixed(2)} L`;
  return `${sign}₹${absolute.toLocaleString("en-IN")}`;
}
