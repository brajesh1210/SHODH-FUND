-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PI', 'FINANCE', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('EQUIPMENT', 'CONSUMABLES', 'TRAVEL', 'CONTINGENCY', 'MANPOWER', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'WARNING', 'NON_COMPLIANT', 'PENDING');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "UCStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUBMITTED_TO_AGENCY');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('UC_DUE', 'APPROVAL_PENDING', 'ANOMALY_DETECTED', 'BUDGET_THRESHOLD', 'GENERAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "grantCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "sanctionNumber" TEXT,
    "sanctionedAmount" DECIMAL(14,2) NOT NULL,
    "spentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "sanctionLetterUrl" TEXT,
    "ucDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "piId" TEXT NOT NULL,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetHead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "spentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grantId" TEXT NOT NULL,

    CONSTRAINT "BudgetHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "gstNumber" TEXT,
    "description" TEXT NOT NULL,
    "billUrl" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "complianceNotes" JSONB,
    "aiExtracted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantId" TEXT NOT NULL,
    "budgetHeadId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilizationCertificate" (
    "id" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "period" TEXT,
    "totalUtilized" DECIMAL(14,2) NOT NULL,
    "balanceAmount" DECIMAL(14,2) NOT NULL,
    "generatedContent" JSONB,
    "pdfUrl" TEXT,
    "status" "UCStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantId" TEXT NOT NULL,

    CONSTRAINT "UtilizationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "reason" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "expenseId" TEXT NOT NULL,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "grantId" TEXT NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantId" TEXT NOT NULL,

    CONSTRAINT "Objection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Grant_grantCode_key" ON "Grant"("grantCode");

-- CreateIndex
CREATE INDEX "Grant_piId_status_idx" ON "Grant"("piId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetHead_grantId_name_key" ON "BudgetHead"("grantId", "name");

-- CreateIndex
CREATE INDEX "Expense_grantId_status_date_idx" ON "Expense"("grantId", "status", "date");

-- CreateIndex
CREATE INDEX "Expense_budgetHeadId_idx" ON "Expense"("budgetHeadId");

-- CreateIndex
CREATE INDEX "Expense_submittedById_idx" ON "Expense"("submittedById");

-- CreateIndex
CREATE INDEX "Approval_expenseId_createdAt_idx" ON "Approval"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_approverId_idx" ON "Approval"("approverId");

-- CreateIndex
CREATE INDEX "UtilizationCertificate_status_idx" ON "UtilizationCertificate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UtilizationCertificate_grantId_financialYear_key" ON "UtilizationCertificate"("grantId", "financialYear");

-- CreateIndex
CREATE INDEX "Anomaly_expenseId_resolved_idx" ON "Anomaly"("expenseId", "resolved");

-- CreateIndex
CREATE INDEX "Milestone_grantId_dueDate_idx" ON "Milestone"("grantId", "dueDate");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Objection_grantId_status_idx" ON "Objection"("grantId", "status");

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_piId_fkey" FOREIGN KEY ("piId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetHead" ADD CONSTRAINT "BudgetHead_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetHeadId_fkey" FOREIGN KEY ("budgetHeadId") REFERENCES "BudgetHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilizationCertificate" ADD CONSTRAINT "UtilizationCertificate_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objection" ADD CONSTRAINT "Objection_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Database-level financial and date invariants that Prisma 5 cannot express.
ALTER TABLE "Grant"
  ADD CONSTRAINT "Grant_sanctionedAmount_positive" CHECK ("sanctionedAmount" > 0),
  ADD CONSTRAINT "Grant_spentAmount_nonnegative" CHECK ("spentAmount" >= 0),
  ADD CONSTRAINT "Grant_dates_ordered" CHECK ("endDate" > "startDate");

ALTER TABLE "BudgetHead"
  ADD CONSTRAINT "BudgetHead_allocatedAmount_nonnegative" CHECK ("allocatedAmount" >= 0),
  ADD CONSTRAINT "BudgetHead_spentAmount_nonnegative" CHECK ("spentAmount" >= 0);

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "UtilizationCertificate"
  ADD CONSTRAINT "UtilizationCertificate_totalUtilized_nonnegative" CHECK ("totalUtilized" >= 0),
  ADD CONSTRAINT "UtilizationCertificate_financialYear_format" CHECK ("financialYear" ~ '^[0-9]{4}-[0-9]{2}$');
