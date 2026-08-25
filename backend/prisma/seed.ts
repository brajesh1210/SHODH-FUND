import { PrismaClient, Role, GrantStatus, BudgetCategory, ExpenseStatus, ComplianceStatus, Severity, MilestoneStatus, NotificationType, ApprovalAction } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

function assertSafeDemoTarget() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for the demo seed.");

  const nodeEnvironment = (process.env.NODE_ENV || "").toLowerCase();
  const deploymentEnvironment = (process.env.SHODHFUND_DEPLOYMENT_ENV || "").toLowerCase();
  const approvedStagingSeed = process.env.SHODHFUND_STAGING_SEED === "true";

  if (nodeEnvironment === "production") {
    throw new Error("The demo seed is disabled when NODE_ENV is production.");
  }
  if (nodeEnvironment === "staging" && !approvedStagingSeed) {
    throw new Error("The demo seed is disabled when NODE_ENV is staging outside the explicit staging helper.");
  }

  const url = new URL(rawUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (["postgres", "template0", "template1"].includes(databaseName)) {
    throw new Error(`Refusing to seed the PostgreSQL system database ${databaseName}.`);
  }
  if (["shodhfund_prod", "shodhfund_production"].includes(databaseName.toLowerCase())) {
    throw new Error("Refusing to seed the named production ShodhFund database.");
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (isLocal) return;

  const approvedRemoteStagingTarget =
    approvedStagingSeed &&
    deploymentEnvironment === "staging" &&
    databaseName === "shodhfund_staging" &&
    url.hostname.endsWith(".neon.tech") &&
    !url.hostname.includes("-pooler") &&
    process.env.SHODHFUND_ALLOW_REMOTE_DEMO_SEED === "true";

  if (!approvedRemoteStagingTarget) {
    throw new Error(
      "Refusing to seed a non-local database. Remote demo seeding is allowed only through the explicit staging helper against the direct Neon shodhfund_staging database."
    );
  }
}

// Each reserved demo ID is reconciled without deleting unrelated records.
async function upsertById(delegate: any, data: any) {
  return delegate.upsert({ where: { id: data.id }, update: data, create: data });
}

async function main() {
  assertSafeDemoTarget();
  console.log("🌱 Seeding deterministic ShodhFund demo records...");

  const demoPasswordHash = await bcrypt.hash("demo1234", 12);
  const pi  = await upsertById(prisma.user, { id: "u-pi",  name: "Dr. Arjun Sharma", email: "arjun.sharma@university.edu", password: demoPasswordHash, role: Role.PI, department: "Biotechnology", designation: "Associate Professor" });
  const fin = await upsertById(prisma.user, { id: "u-fin", name: "Rohit Mehta", email: "rohit.mehta@university.edu", password: demoPasswordHash, role: Role.FINANCE, department: "Accounts", designation: "Senior Finance Officer" });
  const adm = await upsertById(prisma.user, { id: "u-adm", name: "Dr. Meera Iyer", email: "meera.iyer@university.edu", password: demoPasswordHash, role: Role.ADMIN, department: "Research Office", designation: "Dean — Research" });
  const aud = await upsertById(prisma.user, { id: "u-aud", name: "S.K. Verma", email: "sk.verma@university.edu", password: demoPasswordHash, role: Role.AUDITOR, department: "Internal Audit", designation: "Senior Auditor" });
  const pi2 = await upsertById(prisma.user, { id: "u-pi2", name: "Dr. Priya Verma", email: "priya.verma@university.edu", password: demoPasswordHash, role: Role.PI, department: "Computer Science", designation: "Professor" });
  const pi3 = await upsertById(prisma.user, { id: "u-pi3", name: "Dr. Kumar Iyer", email: "kumar.iyer@university.edu", password: demoPasswordHash, role: Role.PI, department: "Chemistry", designation: "Assistant Professor" });

  const g1 = await upsertById(prisma.grant, { id: "GR-DST-2401", grantCode: "GR-DST-2401", title: "CRISPR-based diagnostics for AMR pathogens", agency: "DST", sanctionedAmount: 8450000, spentAmount: 5620000, startDate: new Date("2024-04-01"), endDate: new Date("2027-03-31"), status: GrantStatus.ACTIVE, piId: pi.id, ucDueDate: new Date("2026-09-30") });
  const g2 = await upsertById(prisma.grant, { id: "GR-SERB-2318", grantCode: "GR-SERB-2318", title: "Metabolic engineering of microbial hosts", agency: "SERB", sanctionedAmount: 6200000, spentAmount: 4180000, startDate: new Date("2023-10-01"), endDate: new Date("2026-09-30"), status: GrantStatus.ACTIVE, piId: pi.id, ucDueDate: new Date("2026-08-31") });
  const g3 = await upsertById(prisma.grant, { id: "GR-ICMR-2512", grantCode: "GR-ICMR-2512", title: "Point-of-care TB assay validation", agency: "ICMR", sanctionedAmount: 9850000, spentAmount: 6900000, startDate: new Date("2025-01-15"), endDate: new Date("2028-01-14"), status: GrantStatus.ACTIVE, piId: pi.id, ucDueDate: new Date("2026-10-15") });
  const g4 = await upsertById(prisma.grant, { id: "GR-UGC-2209", grantCode: "GR-UGC-2209", title: "Computational genomics core facility", agency: "UGC", sanctionedAmount: 4120000, spentAmount: 4010000, startDate: new Date("2022-07-01"), endDate: new Date("2026-06-30"), status: GrantStatus.ACTIVE, piId: pi2.id, ucDueDate: new Date("2026-08-20") });
  const g5 = await upsertById(prisma.grant, { id: "GR-CSIR-2411", grantCode: "GR-CSIR-2411", title: "Green catalysis for pharma intermediates", agency: "CSIR", sanctionedAmount: 5300000, spentAmount: 2100000, startDate: new Date("2024-08-01"), endDate: new Date("2027-07-31"), status: GrantStatus.ACTIVE, piId: pi3.id, ucDueDate: new Date("2026-11-01") });
  const g6 = await upsertById(prisma.grant, { id: "GR-DST-2390", grantCode: "GR-DST-2390", title: "National biorepository network node", agency: "DST", sanctionedAmount: 15200000, spentAmount: 9800000, startDate: new Date("2023-04-01"), endDate: new Date("2026-03-31"), status: GrantStatus.ACTIVE, piId: pi2.id, ucDueDate: new Date("2026-09-01") });

  const bh1  = await upsertById(prisma.budgetHead, { id: "bh-1",  name: "Equipment",   category: BudgetCategory.EQUIPMENT,   allocatedAmount: 3500000, spentAmount: 2100000, grantId: g1.id });
  const bh2  = await upsertById(prisma.budgetHead, { id: "bh-2",  name: "Consumables", category: BudgetCategory.CONSUMABLES, allocatedAmount: 1800000, spentAmount: 1200000, grantId: g1.id });
  const bh3  = await upsertById(prisma.budgetHead, { id: "bh-3",  name: "Travel",      category: BudgetCategory.TRAVEL,      allocatedAmount: 600000,  spentAmount: 180000,  grantId: g1.id });
  const bh4  = await upsertById(prisma.budgetHead, { id: "bh-4",  name: "Contingency", category: BudgetCategory.CONTINGENCY, allocatedAmount: 400000,  spentAmount: 140000,  grantId: g1.id });
  const bh5  = await upsertById(prisma.budgetHead, { id: "bh-5",  name: "Manpower",    category: BudgetCategory.MANPOWER,    allocatedAmount: 1500000, spentAmount: 1500000, grantId: g1.id });
  const bh6  = await upsertById(prisma.budgetHead, { id: "bh-6",  name: "Overhead",    category: BudgetCategory.OVERHEAD,    allocatedAmount: 650000,  spentAmount: 500000,  grantId: g1.id });
  const bh7  = await upsertById(prisma.budgetHead, { id: "bh-7",  name: "Equipment",   category: BudgetCategory.EQUIPMENT,   allocatedAmount: 2200000, spentAmount: 1600000, grantId: g2.id });
  const bh8  = await upsertById(prisma.budgetHead, { id: "bh-8",  name: "Consumables", category: BudgetCategory.CONSUMABLES, allocatedAmount: 1800000, spentAmount: 1100000, grantId: g2.id });
  const bh9  = await upsertById(prisma.budgetHead, { id: "bh-9",  name: "Travel",      category: BudgetCategory.TRAVEL,      allocatedAmount: 500000,  spentAmount: 220000,  grantId: g2.id });
  const bh10 = await upsertById(prisma.budgetHead, { id: "bh-10", name: "Equipment",   category: BudgetCategory.EQUIPMENT,   allocatedAmount: 4000000, spentAmount: 2800000, grantId: g3.id });
  const bh11 = await upsertById(prisma.budgetHead, { id: "bh-11", name: "Consumables", category: BudgetCategory.CONSUMABLES, allocatedAmount: 2500000, spentAmount: 1900000, grantId: g3.id });
  const bh12 = await upsertById(prisma.budgetHead, { id: "bh-12", name: "Equipment",   category: BudgetCategory.EQUIPMENT,   allocatedAmount: 2300000, spentAmount: 2200000, grantId: g4.id });
  const bh13 = await upsertById(prisma.budgetHead, { id: "bh-13", name: "Consumables", category: BudgetCategory.CONSUMABLES, allocatedAmount: 1800000, spentAmount: 700000,  grantId: g5.id });
  await upsertById(prisma.budgetHead, { id: "bh-14", name: "Manpower", category: BudgetCategory.MANPOWER, allocatedAmount: 1700000, spentAmount: 1260000, grantId: g2.id });
  await upsertById(prisma.budgetHead, { id: "bh-15", name: "Project Support", category: BudgetCategory.OVERHEAD, allocatedAmount: 3350000, spentAmount: 2200000, grantId: g3.id });
  await upsertById(prisma.budgetHead, { id: "bh-16", name: "Project Support", category: BudgetCategory.OVERHEAD, allocatedAmount: 1820000, spentAmount: 1810000, grantId: g4.id });
  await upsertById(prisma.budgetHead, { id: "bh-17", name: "Project Support", category: BudgetCategory.OVERHEAD, allocatedAmount: 3500000, spentAmount: 1400000, grantId: g5.id });
  await upsertById(prisma.budgetHead, { id: "bh-18", name: "Project Expenditure", category: BudgetCategory.CONTINGENCY, allocatedAmount: 15200000, spentAmount: 9800000, grantId: g6.id });

  const exp1 = await upsertById(prisma.expense, { id: "EXP-1042", amount: 428500, date: new Date("2026-07-12"), vendorName: "Thermo Fisher Scientific", invoiceNumber: "TFS/DEL/88421", gstNumber: "07AABCT3518Q1Z4", description: "QuantStudio reagents", status: ExpenseStatus.SUBMITTED, complianceStatus: ComplianceStatus.COMPLIANT, budgetHeadId: bh1.id, grantId: g1.id, submittedById: pi.id });
  const exp2 = await upsertById(prisma.expense, { id: "EXP-1041", amount: 48200, date: new Date("2026-07-08"), vendorName: "MakeMyTrip Business", invoiceNumber: "MMT-B2B-9921", gstNumber: "07AADCM5146R1ZV", description: "Conference travel Delhi-Pune", status: ExpenseStatus.APPROVED, complianceStatus: ComplianceStatus.WARNING, budgetHeadId: bh3.id, grantId: g1.id, submittedById: pi.id });
  const exp3 = await upsertById(prisma.expense, { id: "EXP-1039", amount: 91200, date: new Date("2026-07-02"), vendorName: "Sigma-Aldrich", invoiceNumber: "SA-IN-12011", gstNumber: "27AABCS1234A1Z9", description: "Culture media lot", status: ExpenseStatus.APPROVED, complianceStatus: ComplianceStatus.COMPLIANT, budgetHeadId: bh8.id, grantId: g2.id, submittedById: pi.id });
  const exp4 = await upsertById(prisma.expense, { id: "EXP-1038", amount: 18500, date: new Date("2026-06-28"), vendorName: "Office Depot India", invoiceNumber: "ODI-44190", gstNumber: "07AAACO0000A1Z1", description: "Stationery - GSTIN checksum fail", status: ExpenseStatus.CORRECTION_REQUESTED, complianceStatus: ComplianceStatus.WARNING, budgetHeadId: bh4.id, grantId: g1.id, submittedById: pi.id });
  const exp5 = await upsertById(prisma.expense, { id: "EXP-1035", amount: 428500, date: new Date("2026-07-14"), vendorName: "Thermo Fisher Scientific", invoiceNumber: "TFS/DEL/88421", gstNumber: "07AABCT3518Q1Z4", description: "Duplicate of EXP-1042", status: ExpenseStatus.SUBMITTED, complianceStatus: ComplianceStatus.NON_COMPLIANT, budgetHeadId: bh1.id, grantId: g1.id, submittedById: pi.id });
  const exp6 = await upsertById(prisma.expense, { id: "EXP-1028", amount: 186000, date: new Date("2026-06-11"), vendorName: "Dell Technologies", invoiceNumber: "DELL-IN-7721", gstNumber: "29AABCD1234E1Z5", description: "Workstation", status: ExpenseStatus.APPROVED, complianceStatus: ComplianceStatus.COMPLIANT, budgetHeadId: bh12.id, grantId: g4.id, submittedById: pi2.id });
  const exp7 = await upsertById(prisma.expense, { id: "EXP-1021", amount: 12400, date: new Date("2026-05-22"), vendorName: "IRCTC Tourism", invoiceNumber: "IR-88921", gstNumber: "07AAACI0000A1Z8", description: "Unapproved personal travel", status: ExpenseStatus.REJECTED, complianceStatus: ComplianceStatus.WARNING, budgetHeadId: bh9.id, grantId: g2.id, submittedById: pi.id });
  const exp8 = await upsertById(prisma.expense, { id: "EXP-1019", amount: 265000, date: new Date("2026-07-01"), vendorName: "Qiagen India", invoiceNumber: "QI-77210", gstNumber: "07AAACQ1234A1Z8", description: "Extraction kits", status: ExpenseStatus.SUBMITTED, complianceStatus: ComplianceStatus.COMPLIANT, budgetHeadId: bh13.id, grantId: g5.id, submittedById: pi3.id });

  await upsertById(prisma.anomaly, { id: "AN-01", severity: Severity.HIGH, reason: "Duplicate invoice TFS/DEL/88421 (EXP-1042 & EXP-1035)", expenseId: exp5.id });
  await upsertById(prisma.anomaly, { id: "AN-02", severity: Severity.MEDIUM, reason: "Travel claim requires policy and authorization review", expenseId: exp2.id });
  await upsertById(prisma.anomaly, { id: "AN-03", severity: Severity.HIGH, reason: "Vendor GSTIN checksum failed", expenseId: exp4.id });

  await upsertById(prisma.approval, { id: "ap-1", action: ApprovalAction.APPROVED, expenseId: exp2.id, approverId: fin.id });
  await upsertById(prisma.approval, { id: "ap-2", action: ApprovalAction.APPROVED, expenseId: exp3.id, approverId: fin.id });
  await upsertById(prisma.approval, { id: "ap-3", action: ApprovalAction.REJECTED, expenseId: exp7.id, approverId: fin.id, reason: "Personal travel not approved" });

  await upsertById(prisma.milestone, { id: "m1", title: "Assay protocol locked", dueDate: new Date("2026-09-15"), status: MilestoneStatus.IN_PROGRESS, grantId: g1.id });
  await upsertById(prisma.milestone, { id: "m2", title: "Field validation n=200", dueDate: new Date("2026-12-01"), status: MilestoneStatus.PENDING, grantId: g1.id });
  await upsertById(prisma.milestone, { id: "m3", title: "Strain library deposit", dueDate: new Date("2026-08-20"), status: MilestoneStatus.DELAYED, grantId: g2.id });

  await upsertById(prisma.objection, { id: "ob-1", title: "Duplicate equipment invoice", status: "OPEN", note: "Recommend recovery of 4,28,500", grantId: g1.id });
  await upsertById(prisma.objection, { id: "ob-2", title: "Missing asset tag on PCR", status: "OPEN", note: "Asset register entry or tag has not been recorded", grantId: g1.id });

  await upsertById(prisma.notification, { id: "n1", userId: pi.id, title: "UC due in 41 days", message: "DST CRISPR grant UC for FY 2025-26 is due 30 Sep 2026.", type: NotificationType.UC_DUE });
  await upsertById(prisma.notification, { id: "n2", userId: pi.id, title: "Expense pending approval", message: "Thermo Fisher invoice 4,28,500 awaits finance verification.", type: NotificationType.APPROVAL_PENDING });
  await upsertById(prisma.notification, { id: "n3", userId: fin.id, title: "Anomaly flagged", message: "Duplicate bill detected on GR-DST-2401.", type: NotificationType.ANOMALY_DETECTED });
  await upsertById(prisma.notification, { id: "n4", userId: adm.id, title: "Research metrics review", message: "Recorded research metrics are available for review.", type: NotificationType.GENERAL });

  await upsertById(prisma.auditLog, { id: "al-1", action: "SEED", entityType: "System", entityId: "init", userId: adm.id, metadata: { note: "Database seeded" } });

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
