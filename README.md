# ShodhFund

ShodhFund is a research-grant workflow application for Indian universities and research institutions. It provides role-scoped grant, expense, budget, utilization-certificate, review, anomaly, notification, calendar, reporting, and audit-record workflows.

The application provides workflow and review aids. It does not by itself certify GFR, procurement, accounting, statutory, agency, audit, or information-security compliance.

## Project structure

```text
frontend/   Next.js application and same-origin API/session proxy
backend/    Express API and Prisma/PostgreSQL data layer
demo-bills/ Exact-byte sample PDFs for the documented OCR fallback
```

## Requirements

- Node.js 22.23.2 (pinned in `.nvmrc` and `.node-version`)
- npm 10.9.8 (bundled with the pinned Node release)
- PostgreSQL
- A production `JWT_SECRET` containing at least 32 characters

## Local setup

### 1. Configure and start the backend

```bash
cd backend
npm ci
cp .env.example .env
# Edit .env and provide DATABASE_URL and JWT_SECRET.
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The API listens on `http://localhost:4000` by default.

### 2. Configure and start the frontend

In a second terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Browser requests go through the frontend's same-origin `/api` proxy; the JWT is held in an HttpOnly session cookie rather than browser-readable storage.

## Demo access

The seed command creates these demonstration accounts. Each uses the password `demo1234`:

- Principal Investigator: `arjun.sharma@university.edu`
- Finance Officer: `rohit.mehta@university.edu`
- Research Admin: `meera.iyer@university.edu`
- Auditor: `sk.verma@university.edu`

Accounts have one assigned role. To test another workspace, log out and sign in with that role's demonstration account; authenticated users cannot select an unauthorized workspace.

## Optional OCR provider

Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in `backend/.env` to enable Gemini bill extraction. Without a working provider, extraction fails honestly except for the exact bundled demonstration PDFs documented in `demo-bills/README.md`. The fallback matches file SHA-256 digests, not filenames, and is labeled as sample data.

OCR is an input aid only. Users must review all extracted fields before submitting an expense. The current expense workflow records extracted fields but does not persist the uploaded source bill.

## Health and optional configuration

The protected Admin health view checks database connectivity and reports whether JWT, OCR-provider, and optional R2/S3 environment variables are configured. Provider/storage configuration labels are not external connectivity, upload, uptime, or security tests.

## Validation commands

```bash
cd frontend
npm run build

cd ../backend
node --check src/server.js
node --check src/fixed-routes.js
node --check src/ocr.js
npm run db:generate
npx prisma validate
```

Database-backed role and mutation checks require a reachable PostgreSQL instance.
