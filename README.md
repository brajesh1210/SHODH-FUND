# ShodhFund

ShodhFund is a research-grant workflow application for Indian universities and research institutions. It provides role-scoped grant, expense, budget, utilization-certificate, review, anomaly, notification, calendar, reporting, and audit-record workflows.

The application provides workflow and review aids. It does not by itself certify GFR, procurement, accounting, statutory, agency, audit, or information-security compliance.

## Project structure

```text
frontend/             Next.js application and same-origin API/session proxy
backend/              Express API and Prisma/PostgreSQL data layer
backend/prisma/       Schema, checked-in migrations, and deterministic demo seed
demo-bills/           Exact-byte sample PDFs for the documented OCR fallback
compose.yaml          Optional local PostgreSQL 17 service
```

## Environments

- **Production** uses authorized users and real data only. Do not run the demo seed there.
- **Staging/demo** is a separate Neon database and Render/Vercel deployment that can use the deterministic demo seed.
- Follow [STAGING.md](STAGING.md) for the free-tier isolation, migration, preview, and smoke-test flow.

## Requirements

- Node.js 22.23.2 (pinned in `.nvmrc` and `.node-version`)
- npm 10.9.8 (bundled with the pinned Node release)
- PostgreSQL 17 (the same major version used by local Compose and CI)
- A production `JWT_SECRET` containing at least 32 characters

## Local setup

### 1. Start PostgreSQL

If Docker Compose is available, start the repository's real PostgreSQL 17 service from the repository root:

```bash
docker compose up -d postgres
```

Its local-only credentials match `backend/.env.example`, and its named volume preserves development data between restarts. Alternatively, create a PostgreSQL database and user yourself and put that connection in `backend/.env`.

### 2. Migrate, seed, and start the backend

```bash
cd backend
npm ci
cp .env.example .env
# PowerShell alternative: Copy-Item .env.example .env
# Edit .env when not using the provided Compose database.
npm run db:generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed
npm run dev
```

The checked-in initial migration is authoritative; normal setup does not use `prisma db push`. When intentionally developing a schema change, use `npm run db:migrate:dev -- --name <migration-name>` against a disposable development database and review the generated SQL before committing it.

The demo seed uses reserved IDs and upserts, so rerunning it reconciles its own records without deleting unrelated rows. It refuses to run when `NODE_ENV` is `production` or `staging`, against PostgreSQL system databases, or against a non-local host unless an explicit remote-demo override is supplied. Never enable that override for shared, staging, production, or otherwise valuable data.

The API listens on `http://localhost:4000` by default.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
# PowerShell alternative: Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Browser requests go through the frontend's same-origin `/api` proxy; the JWT is held in an HttpOnly session cookie rather than browser-readable storage.

## Demo access

The seed command creates the following demonstration accounts. Each uses the password `demo1234`:

- Principal Investigator: `arjun.sharma@university.edu`
- Principal Investigator: `priya.verma@university.edu`
- Principal Investigator: `kumar.iyer@university.edu`
- Finance Officer: `rohit.mehta@university.edu`
- Research Admin: `meera.iyer@university.edu`
- Auditor: `sk.verma@university.edu`

Accounts have one assigned role. To test another workspace, log out and sign in with that role's demonstration account; authenticated users cannot select an unauthorized workspace.

## Database operations

Use the checked-in migration history, test schema changes locally and on staging first, and use a current Neon production snapshot before a production schema change. The complete target checks, migration order, and recovery guidance are in [DATABASE-OPERATIONS.md](DATABASE-OPERATIONS.md).

## Database integration tests

The backend test suite includes provider-unit coverage and starts the Express application on an ephemeral port for PostgreSQL-backed checks. It covers AI success/error/retry/circuit/probe paths, truthful provenance, deterministic record queries and PI cross-ownership denial, plus seed invariants, database constraints, authentication and role scopes, concurrent expense submissions, duplicate detection, competing finance decisions, stale correction writes, UC uniqueness and workflow transitions, owner-scoped notification reads, and audit-record access.

The suite intentionally mutates its database. Use only a newly created disposable database whose name begins with `shodhfund_test`, `shodhfund_ci`, or `shodhfund_phase3_clean_`. It also requires both safety flags below and refuses any database name outside that policy.

Example for a fresh `shodhfund_test_local` database when using Compose:

```bash
docker compose exec postgres createdb -U shodhfund shodhfund_test_local
cd backend
export DATABASE_URL="postgresql://shodhfund:shodhfund-local-only@localhost:5432/shodhfund_test_local?schema=public"
export NODE_ENV=test
export SHODHFUND_TEST_DATABASE=true
export JWT_SECRET="local-test-secret-at-least-32-characters"
npm run db:migrate:deploy
npm run db:seed
npm run db:seed
npm test
```

Create the disposable database before running those commands. In PowerShell, use `$env:NAME="value"` instead of `export NAME="value"`. CI performs the same migration, double-seed, and runtime test sequence with PostgreSQL 17.

## Ask AI and authenticated records

Ask AI uses a server-only Gemini provider when `AI_PROVIDER_ORDER` and `GEMINI_API_KEY` are configured. Responses identify themselves as live AI or built-in guidance; if both modes are unavailable, the API returns an explicit `503 AI_PROVIDER_UNAVAILABLE` response. Admin settings separates configuration state from a cached, rate-limited connectivity probe. It never returns key values.

Authenticated Ask Records queries rehydrated-user-scoped PostgreSQL data deterministically and works with all external AI providers disabled. Structured record values and links remain authoritative and separate from optional model prose. `AI_RECORD_CONTEXT_ENABLED` defaults to `false`; do not enable external record context until institutional privacy/legal review is complete. When explicitly enabled, external context is capped, role-scoped, redacts common personal identifiers, and is delimited and treated as untrusted record data. See `INSTALL.md` and `backend/.env.example` for the bounded timeout, retry, model, fallback, probe-cache, and context settings.

## Optional OCR provider

Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in `backend/.env` to enable Gemini bill extraction. Without a working provider, extraction fails honestly except for the exact bundled demonstration PDFs documented in `demo-bills/README.md`. The fallback matches file SHA-256 digests, not filenames, and is labeled as sample data.

OCR is an input aid only. Users must review all extracted fields before submitting an expense. The current expense workflow records extracted fields but does not persist the uploaded source bill.

## Health and optional configuration

The protected Admin health view checks database connectivity and reports whether JWT, OCR-provider, and optional R2/S3 environment variables are configured. The separate Admin Ask AI panel reports sanitized provider configuration and last-attempt state; its explicit connectivity probe is cached and rate-limited because it may consume provider quota. Provider/storage configuration labels are not external connectivity, upload, uptime, or security tests.

## Validation commands

```bash
cd frontend
npm run lint
npm run typecheck
npm run build

cd ../backend
npm run check:syntax
npm run db:generate
npm run db:validate
npm run db:migrate:status
# npm test requires the guarded, migrated, seeded disposable database described above.
```
