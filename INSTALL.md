# ShodhFund installation guide

## Prerequisites

- Node.js 22.23.2 (pinned in `.nvmrc` and `.node-version`)
- npm 10.9.8 (bundled with the pinned Node release)
- PostgreSQL 17

The application does not fall back to a JSON database. A reachable PostgreSQL database is required for backend startup and runtime workflows.

## 1. PostgreSQL and backend

For local development, either supply your own PostgreSQL database or start the optional PostgreSQL 17 service from the repository root:

```bash
docker compose up -d postgres
```

The Compose service listens only on `127.0.0.1:5432`, and its credentials match `backend/.env.example`.

Install and configure the backend:

```bash
cd backend
npm ci
cp .env.example .env
# PowerShell alternative: Copy-Item .env.example .env
```

When not using the provided Compose database, edit `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
NODE_ENV="development"
PORT=4000
```

Optional server-side Ask AI and Gemini OCR:

```env
AI_PROVIDER_ORDER="gemini"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash-lite"
AI_TIMEOUT_MS="15000"
AI_MAX_RETRIES="2"
AI_BUILTIN_GUIDANCE_ENABLED="true"
AI_RECORD_CONTEXT_ENABLED="false"
AI_PROBE_CACHE_SECONDS="300"
GEMINI_OCR_MODEL="gemini-2.5-flash"
```

Keep `GEMINI_API_KEY` on the backend only. The application sends it with the official `x-goog-api-key` header; never place it in browser variables, URLs, logs, or committed files. `GOOGLE_API_KEY` remains a compatibility alias. Built-in guidance works without Gemini. Keep external record context disabled until institutional privacy/legal review is complete; authenticated Ask Records remains deterministic and provider-independent. If context is approved and enabled, the server sends only a capped, role-scoped summary, redacts common personal identifiers, and treats all record text as untrusted data. Optional R2/S3 variables are reported as configuration only, not as a storage connectivity or upload test.

Prepare and start the backend:

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed
npm run dev
```

The checked-in Prisma migrations are the schema baseline for development, CI, and deployment; do not substitute `prisma db push`. Create intentional development migrations with `npm run db:migrate:dev -- --name <migration-name>` against a disposable development database, then review and commit the SQL.

The demo seed is non-destructive toward unrelated rows and reconciles reserved fixed IDs. It refuses production/staging, PostgreSQL system databases, and non-local targets unless an explicit remote-demo override is supplied. Never enable that override for shared or valuable data.

## 2. Frontend

In another terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
# PowerShell alternative: Copy-Item .env.example .env.local
npm run dev
```

The default backend target is `http://localhost:4000`. Override it only when needed:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Open `http://localhost:3000`.

## 3. Demo accounts

After `npm run db:seed`, use password `demo1234` with one of:

- `arjun.sharma@university.edu` — PI
- `priya.verma@university.edu` — PI
- `kumar.iyer@university.edu` — PI
- `rohit.mehta@university.edu` — Finance
- `meera.iyer@university.edu` — Admin
- `sk.verma@university.edu` — Auditor

Use the matching account for each role. Role access comes from the authenticated database account and cannot be changed from the browser.

## 4. Production notes

- Do not run the demo seed in production or staging.
- Apply reviewed, checked-in migrations with `npm run db:migrate:deploy`.
- Use HTTPS so the secure HttpOnly session cookie is transmitted safely.
- Set a unique `JWT_SECRET` of at least 32 characters. Backend startup fails in production when the secret is absent or too short.
- Restrict `CORS_ORIGIN` to the real frontend origin if the backend is exposed directly.
- Keep PostgreSQL credentials and provider keys out of source control.
- Review backup, retention, logging, key rotation, incident response, and deployment controls for your environment.
- ShodhFund's workflow checks do not constitute statutory, agency, audit, procurement, accounting, or security certification.

## 5. Verification

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck
npm run build

# Backend syntax, schema, and migration status
cd ../backend
npm run check:syntax
npm run db:generate
npm run db:validate
npm run db:migrate:status
```

The database integration suite deliberately mutates its target. Follow the guarded disposable-database procedure in `README.md` before running `npm test`. Then verify the browser workflows against development or test data as appropriate.
