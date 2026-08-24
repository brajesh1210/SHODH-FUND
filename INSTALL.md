# ShodhFund installation guide

## Prerequisites

- Node.js 22.23.2 (pinned in `.nvmrc` and `.node-version`)
- npm 10.9.8 (bundled with the pinned Node release)
- PostgreSQL

The application does not fall back to a JSON database. A reachable PostgreSQL database is required for backend startup and runtime workflows.

## 1. Backend

```bash
cd backend
npm ci
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
PORT=4000
```

Optional Gemini OCR:

```env
GEMINI_API_KEY=""
# GEMINI_MODEL="gemini-2.0-flash"
```

`GOOGLE_API_KEY` can be used instead of `GEMINI_API_KEY`. Optional R2/S3 variables are reported as configuration only; that health label is not a storage connectivity or upload test.

Prepare and start the backend:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

For managed production databases, use your reviewed migration/deployment process instead of treating `db:push` as a production migration strategy.

## 2. Frontend

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
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
- `rohit.mehta@university.edu` — Finance
- `meera.iyer@university.edu` — Admin
- `sk.verma@university.edu` — Auditor

Use the matching account for each role. Role access comes from the authenticated database account and cannot be changed from the browser.

## 4. Production notes

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
npm run build

# Backend syntax and Prisma schema
cd ../backend
npm run check:syntax
npm run db:generate
npm run db:validate
```

Then start both applications and verify login, role restrictions, grant ownership, expense submission/correction/decisions, UC transitions/PDFs, CSV exports, OCR, downloads, and safe error responses against a disposable PostgreSQL database.
