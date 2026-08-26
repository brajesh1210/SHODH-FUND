<div align="center">

# 🌟 ShodhFund — Research Funding, Simplified.

### 🎓 AI-Powered Grant Lifecycle Management for Indian Universities

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-green?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-316192?style=for-the-badge&logo=postgresql)](https://postgresql.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Hobby-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![Render](https://img.shields.io/badge/Render-Free-46E3B7?style=for-the-badge&logo=render)](https://render.com/)
[![Neon](https://img.shields.io/badge/Neon-Free-00E599?style=for-the-badge&logo=neon)](https://neon.tech/)

**🚀 Live Production:** [shodh-fund-sigma.vercel.app](https://shodh-fund-sigma.vercel.app)  
**🧪 Staging Demo:** [shodh-fund-git-staging...vercel.app](https://shodh-fund-git-staging-brajeshupadhyay1210-8075s-projects.vercel.app)  
**🔧 Backend:** [shodhfund-backend.onrender.com](https://shodhfund-backend.onrender.com)

*Less administration. More research momentum.*

</div>

---

## 📖 Table of Contents

- [🎯 What is ShodhFund?](#-what-is-shodhfund)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🔐 Roles & Workspaces](#-roles--workspaces)
- [🔄 Complete Workflow](#-complete-workflow)
- [🧠 AI Implementation](#-ai-implementation)
- [💾 Database & Security](#-database--security)
- [📦 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🌍 Free Tier Deployment](#-free-tier-deployment)
- [📧 Email OTP Auth](#-email-otp-auth)
- [📎 Private Bill Storage](#-private-bill-storage)
- [🧪 Testing](#-testing)
- [📂 Project Structure](#-project-structure)
- [🔒 Security](#-security)
- [🤝 Contributing](#-contributing)

---

## 🎯 What is ShodhFund?

**ShodhFund** is an end-to-end **research grant lifecycle platform** built for **Indian universities and research institutions**. It replaces scattered Excel sheets, email approvals, and last-minute audit panic with one connected, **role-aware, record-based, human-reviewed** workspace.

> **Research. Comply. Impact.** — From sanction letter to Utilization Certificate, without the chaos.

### 💡 The Problem We Solve

- 📊 Grant tracking in Excel graveyards
- 🧾 Bill verification without evidence
- ⚠️ GFR compliance checked after spending
- 📑 UC generation takes weeks
- 🔍 Audit trail missing
- 👥 No role-based visibility

### ✅ Our Solution

- 🏦 Live budget tracking by head
- 🤖 AI bill OCR + compliance checks
- 🛡️ GFR-aware review aids
- 📄 One-click UC draft generation
- 🔗 Complete sanction-to-spend trail
- 👨‍🔬 Role-scoped dashboards

---

## ✨ Features

### 🏦 Grant Management
- 📝 Register sanctions with auto-generated codes
- 💰 Split budget heads (Equipment, Consumables, Travel, etc.)
- 📈 Live utilization & balance tracking
- 📅 UC due date monitoring

### 🧾 Expense Management
- 📤 Add expenses against owned grants
- 🔍 Vendor, invoice, GSTIN, amount validation
- 📎 Private bill attachment (Backblaze B2)
- 🔄 Correction workflow (Submit → Approve/Reject/Correction → Resubmit)

### 🤖 AI Automation
- **Bill OCR:** Gemini extracts vendor, invoice, amount, date, GSTIN from PDFs/images
- **Ask ShodhFund AI Bot:** Full-screen chat, user right, bot left, logo + loader, no Gemini branding
- **Ask Records:** Deterministic DB queries for exact grant/expense values
- **Anomaly Detection:** Duplicate invoice & budget-cap flags

### 📑 UC Generation
- 🗓️ Indian Financial Year scoped (1 Apr - 31 Mar)
- 🧮 Calculated from approved expenses only
- 📊 Head-wise breakdown
- 📥 PDF download (qualified working draft)

### 🔔 Smart Notifications
- 📬 UC due, approval pending, anomaly alerts
- ✅ Mark individual / Mark all as read (real DB updates)
- 👤 Owner-scoped

### 📊 Analytics & Reports
- 💹 Role-scoped stats (sanctioned, spent, utilization)
- 📥 CSV exports (scoped by ownership)
- 🏫 Department & NIRF demo reports

---

## 🏗️ Architecture

```mermaid
Browser
  ↓
Vercel (Next.js 15.5, frontend)
  ↓ same-origin /api proxy (HttpOnly cookie sf_session)
Render (Express 4.21, backend)
  ├─→ Neon PostgreSQL 17 (pooled + direct URLs)
  ├─→ Gemini 3.1 Flash-Lite (live-ai)
  ├─→ Backblaze B2 (private bill storage, S3-compatible)
  └─→ Brevo (email OTP, HTTPS API, any recipient)
```

**Why this split?**
- 🔒 No secrets in browser bundle
- 🍪 JWT in HttpOnly, Secure, SameSite cookie
- 🔄 Vercel → Render proxy preserves bytes for PDF/CSV
- 🌏 Singapore region for low latency (Render + Neon)

---

## 🔐 Roles & Workspaces

| Role | Emoji | Access | Key Pages |
|------|-------|--------|-----------|
| **PI** | 👨‍🔬 | Own grants only | My Grants, Expenses, UC Generator, Milestones |
| **FINANCE** | 💼 | Institution-wide review | Grant Management, Verify, Budget, UC Verify, Anomalies |
| **ADMIN** | 🏫 | Full oversight | All Grants, Departments, NIRF, Reports, Settings, Users |
| **AUDITOR** | 🔍 | Read + compliance | Assignments, Compliance, Trail, Objections |

> 🔑 **Security:** Role comes from authenticated DB account, not browser localStorage. PI cannot access another PI's data.

---

## 🔄 Complete Workflow

```
1. 📧 Register → OTP (Brevo) → Verify → Role select → Account created
   ↓
2. 🔑 Login → /select-role → Auto redirect to assigned workspace
   ↓
3. 🏦 PI creates Grant → Budget Head auto-created
   ↓
4. 🧾 PI adds Expense + Bill PDF → OCR extracts → Private B2 upload
   ↓
5. 💼 Finance reviews → Approve / Reject (reason) / Correction Request
   ↓
6. 📑 PI generates UC (FY) → Finance reviews → Under Review → Approved
   ↓
7. 🔍 Auditor checks compliance, anomalies, audit trail
   ↓
8. 🔔 Notifications + 📊 Reports + 📥 Exports
```

---

## 🧠 AI Implementation

### 💬 Ask ShodhFund AI Bot
- **Provider:** Gemini 3.1 Flash-Lite (current stable, multimodal)
- **Auth:** `x-goog-api-key` header, never in URL/logs
- **Features:**
  - Bounded timeout 15s, 2 retries with exponential backoff + jitter
  - Circuit breaker after 3 failures
  - Truthful labels: `Live AI` vs `Built-in guidance` (never mislabels template as AI)
  - No model name exposed in UI (only "ShodhFund AI Bot")
  - Fast loader: logo + 3 dots bounce (dot 2 lemon yellow) — CSS only
  - User right, Bot left, light UI, no black/yellow border

### 🔍 Ask Records (Deterministic, No AI)
- Works with **all AI providers disabled**
- Role & ownership scoped, never crosses PI boundaries
- Exact amounts, statuses, links are DB-authoritative

### 🧾 Bill OCR
- Gemini extraction when `GEMINI_API_KEY` configured
- Fallback: exact SHA-256 match for 4 bundled sample PDFs only (labeled as demo)
- No filename trick — renamed arbitrary file won't trigger demo
- Proof token (HMAC) binds extracted fields to submitter for 10 min

---

## 💾 Database & Security

### 📊 Schema (Prisma)
```
User (id, email unique, password bcrypt, name, role, dept)
Grant (grantCode unique, sanctionedAmount, spentAmount, piId, status)
BudgetHead (grantId + name unique, allocatedAmount, spentAmount)
Expense (grantId, budgetHeadId, vendorName, invoiceNumber, complianceStatus)
ExpenseDocument (objectKey unique, sha256, isCurrent, ocrSource, uploadedById)
UtilizationCertificate (grantId + financialYear unique, status workflow)
Anomaly, Milestone, Approval, AuditLog, Notification, Objection, Otp
```

### 🔒 Security Highlights
- 🔑 Passwords: bcrypt 12, no plaintext compare
- 🍪 Session: HttpOnly, Secure, SameSite cookie `sf_session`, 8h expiry
- 🚧 Production requires `JWT_SECRET` >= 32 chars
- 🛡️ Role + ownership checks on every route
- 📎 Private B2: magic-byte validation, 8MB max, object key never exposed, 403 for other PI
- 📧 OTP: bcrypt hash, 10min expiry, 60s cooldown, 5 attempts, 5/hour, IP limit 20/hour, anti-enumeration
- 🚫 No raw Prisma errors to client
- 📝 Audit logs for login, register, expense decisions, UC, document upload/download, AI probe

---

## 📦 Tech Stack

| Layer | Tech | Version | Purpose |
|-------|------|---------|---------|
| Frontend | Next.js | 15.5 | App Router, 35 routes |
| UI | Tailwind CSS | 4 | Styling |
| Icons | Lucide React | latest | Icons |
| Backend | Express | 4.21 | API |
| DB | Prisma + PostgreSQL | 5.22 + 17 | ORM + DB |
| AI | Gemini | 3.1 Flash-Lite | Chat + OCR |
| Storage | Backblaze B2 | S3-compatible | Private bills, no card, 10GB free |
| Email | Brevo | HTTPS API | OTP any recipient, 300/day free |
| Deploy | Vercel + Render + Neon | Hobby + Free + Free | Free tier pilot |

---

## 🚀 Quick Start

### 1️⃣ Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps # should be healthy
```

### 2️⃣ Backend

```bash
cd backend
npm ci
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET (32+ chars), GEMINI_API_KEY, B2_*, BREVO_*
npm run db:generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed # local only, creates 6 demo users with demo1234
npm run dev # http://localhost:4000
```

### 3️⃣ Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev # http://localhost:3000
```

### 👥 Demo Accounts (local/staging only, password: demo1234)

- 👨‍🔬 PI: arjun.sharma@university.edu, priya.verma@university.edu, kumar.iyer@university.edu
- 💼 Finance: rohit.mehta@university.edu
- 🏫 Admin: meera.iyer@university.edu
- 🔍 Auditor: sk.verma@university.edu

---

## 🌍 Free Tier Deployment

| Component | Provider | Plan | Cost | Sleep? |
|-----------|----------|------|------|--------|
| Frontend | Vercel | Hobby | ₹0 | No, always awake |
| Backend | Render | Free | ₹0 | Yes, 15min inactivity → 30-60s cold start |
| DB | Neon | Free | ₹0 | Scale to zero, 0.5GB, 1 snapshot |
| Storage | Backblaze B2 | Free | ₹0 | No, 10GB |
| Email | Brevo | Free | ₹0 | 300/day, HTTPS |

**Production URLs:**
- Prod: https://shodh-fund-sigma.vercel.app
- Prod API: https://shodhfund-backend.onrender.com
- Staging (permanent branch URL): https://shodh-fund-git-staging-brajeshupadhyay1210-8075s-projects.vercel.app
- Staging API: https://shodhfund-staging-backend.onrender.com

**Why allow sleep?**
- 1 always-awake service = 720h/month (within 750h free) ✅
- 2 always-awake = 1440h → quota exceed ❌
- We accept cold start to keep free tier for other projects.

---

## 📧 Email OTP Auth

**Flow:**
```
Register: name, email, role → Send OTP (Brevo) → Verify (6-digit, 10min) → Password → Create
Login: email + password → workspace
Forgot: email → OTP → new password → login
```

**Security:**
- OTP bcrypt hash, never plaintext
- 10min expiry, 60s resend cooldown, 5 attempts, 5/hour per email
- IP rate limit 20/hour
- Verified OTP valid 30min for next step
- Anti-enumeration for password reset (generic response)

**Brevo Setup (any recipient, no card):**
1. https://app.brevo.com → free account
2. Senders & Domains → Add sender → verify your Gmail
3. SMTP & API → API Keys → Generate → `xkeysib-...`
4. Security → Authorized IPs → Deactivate for API keys (allow Render IP)
5. Render env:
```
EMAIL_PROVIDER=brevo
EMAIL_FROM=ShodhFund <your-verified-email@gmail.com>
BREVO_API_KEY=xkeysib-...
```

---

## 📎 Private Bill Storage

- **Provider:** Backblaze B2 private bucket (no card, S3-compatible)
- **Bucket:** Separate prod & staging, e.g., `shodhfund-production-bills-...` (Private)
- **Key:** Bucket-scoped app key, Read+Write+Delete
- **Endpoint:** `https://s3.us-west-004.backblazeb2.com` (must have https://, no quotes, no trailing /)
- **Region:** `us-west-004` (middle of endpoint)
- **Validation:** Magic bytes (PDF/JPG/PNG/WebP), 8MB max, SHA-256 digest
- **Access:** PI own only, Finance/Admin/Auditor via expense policy, 403 for other PI
- **Routes:** POST /api/expenses/:id/document, GET /api/expenses/:id/document (same-origin, no public URL)

---

## 🧪 Testing

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck
npm run build # 35 routes

# Backend syntax
cd backend
npm run check:syntax
npm run db:generate
npm run db:validate
npm run db:migrate:status

# DB integration (requires disposable DB + safety flags)
# See DATABASE-OPERATIONS.md for guarded procedure
npm test
```

---

## 📂 Project Structure

```
frontend/
  src/app/ (page.tsx landing, login, register, forgot-password, dashboard/*, grants/[id], api/*)
  src/components/ (AppShell, VirtualAssistant, Logo, AddExpense, ExpenseDocumentLink)
  src/lib/ (api, session, types, download, format)
  public/landing/ (logos, university images)
backend/
  src/server.js (Express + security headers + /api/ready)
  src/fixed-routes.js (all API routes, auth, OTP, grants, expenses, UC, etc.)
  src/storage/ (object-storage.js, documents.js)
  src/ai/ (config, errors, guidance, prompts, providers/gemini, retrieval, service)
  src/middleware/ (security, rate-limit)
  src/email.js, otp.js, ocr.js, runtime.js
  prisma/schema.prisma, migrations/*, seed.ts
  scripts/ (db-target, db-preflight, migrate-deploy, seed-staging)
  tests/ (ai.unit, storage.unit, migration-preflight.unit, staging.unit, database.integration)
demo-bills/ (4 exact-byte sample PDFs)
compose.yaml (optional local PG 17)
STAGING.md, DATABASE-OPERATIONS.md, DOCUMENT-STORAGE.md, PRODUCTION-CHECKLIST.md
```

---

## 🔒 Security

- No `NEXT_PUBLIC_` secrets
- No secrets in Git, bundles, logs, screenshots
- Security headers: nosniff, DENY frame, strict referrer, no camera/mic
- CORS exact origin only
- Rate limiting in-memory (free tier), Redis later for distributed
- Audit logs, safe errors, no stack leak
- See [SECURITY.md](frontend/src/app/security/page.tsx) and [PRIVACY.md](frontend/src/app/privacy/page.tsx) for implementation details (not certification)

---

## 🤝 Contributing

```bash
git switch -c feat/your-feature
# Make changes, ensure lint/type/build pass
git push -u origin feat/your-feature
# Open PR to main, wait for CI green
```

**Rules:**
- Never force-push to main
- Never commit .env, keys, node_modules, .next
- Test migrations on disposable DB first
- Never run demo seed on production

---

<div align="center">

### 💙 Built with love for Indian research ecosystem

**Less administration. More research momentum.** 🚀

[🌐 Live Demo](https://shodh-fund-sigma.vercel.app) · [📧 Contact](mailto:hello@shodhfund.in) · [🔒 Security](https://shodh-fund-sigma.vercel.app/security) · [🔐 Privacy](https://shodh-fund-sigma.vercel.app/privacy)

</div>
