-- CreateTable
CREATE TABLE "ExpenseDocument" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "ocrSource" TEXT,
    "ocrModel" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "replacedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "ExpenseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDocument_objectKey_key" ON "ExpenseDocument"("objectKey");

-- CreateIndex
CREATE INDEX "ExpenseDocument_expenseId_isCurrent_createdAt_idx" ON "ExpenseDocument"("expenseId", "isCurrent", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseDocument_uploadedById_createdAt_idx" ON "ExpenseDocument"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseDocument_sha256_idx" ON "ExpenseDocument"("sha256");

-- AddForeignKey
ALTER TABLE "ExpenseDocument" ADD CONSTRAINT "ExpenseDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseDocument" ADD CONSTRAINT "ExpenseDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
