# ShodhFund staging and demo environment

## Purpose

Production is intentionally clean: it contains only authorized users and real records. Staging is a separate, disposable environment for the six seeded demonstration users, dashboard sample records, previews, migrations, and browser testing.

Never point a staging deployment, seed command, preview deployment, or test script at the production Neon database.

## Free-tier topology

```text
staging Git branch
  ├─ Vercel Preview deployment (frontend)
  ├─ Render Free Web Service (backend)
  └─ separate Neon Free project/database (PostgreSQL)
```

This is suitable for an on-demand demo/test environment. A Render Free service can sleep after inactivity and shares the workspace's free runtime allowance with production. Do not treat staging as an always-on service.

## 1. Create the staging branch

From a clean checkout:

```powershell
cd F:\Desktop\SHODH-FUND-NEW
git switch main
git pull --ff-only origin main
git switch -c staging
git push -u origin staging
```

Future staging changes go to `staging`. Merge selected changes from `staging` into `main` only after normal checks and review.

## 2. Create an isolated Neon staging database

Create a **new Neon project**, not a copy/branch of production, in the same region as production. Suggested names:

```text
Project:  shodhfund-staging
Database: shodhfund_staging
Role:     shodhfund_staging_owner
```

Retain two connection URLs privately:

| Use | URL type |
| --- | --- |
| Render runtime | pooled URL (`-pooler` host) |
| migrations and staging seed | direct/unpooled URL (no `-pooler`) |

Do not paste either URL into source control, Vercel, screenshots, chat, or PRs.

### Migrate and seed the staging database

Run these only against the direct staging URL. The `db:seed:staging` helper refuses a non-Neon target, a pooled URL, a database name other than `shodhfund_staging`, or a missing explicit staging marker.

```powershell
cd F:\Desktop\SHODH-FUND-NEW\backend

# Copy the direct staging URL in Neon first. This command reads it from the clipboard.
$env:DATABASE_URL = (Get-Clipboard).Trim()
$env:SHODHFUND_DEPLOYMENT_ENV = 'staging'

npm ci
npm run db:generate
npm run db:preflight:staging
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed:staging

Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:SHODHFUND_DEPLOYMENT_ENV -ErrorAction SilentlyContinue
Set-Clipboard -Value 'cleared'
```

Expected demo password for this staging-only database:

```text
demo1234
```

Do **not** run `npm run db:seed` or `npm run db:seed:staging` against production.

## 3. Create the staging Render backend

Create a separate Render **Free Web Service**:

| Setting | Value |
| --- | --- |
| Name | `shodhfund-staging-backend` |
| Branch | `staging` |
| Root Directory | `backend` |
| Region | Singapore |
| Instance | Free |
| Build Command | `npm ci --include=dev && npm run db:generate && DATABASE_URL="$DIRECT_DATABASE_URL" npm run db:migrate:deploy` |
| Start Command | `npm start` |
| Health Check Path | `/api/ready` |

Use a new staging-only JWT secret and the staging Neon URLs:

```text
NODE_VERSION=22.23.2
NODE_ENV=production
SHODHFUND_DEPLOYMENT_ENV=staging
DATABASE_URL=<staging pooled Neon URL>
DIRECT_DATABASE_URL=<staging direct Neon URL>
JWT_SECRET=<new staging-only secret>
CORS_ORIGIN=https://placeholder.invalid
AI_PROVIDER_ORDER=
AI_BUILTIN_GUIDANCE_ENABLED=true
AI_RECORD_CONTEXT_ENABLED=false
```

Keeping `AI_PROVIDER_ORDER` blank avoids consuming the production Gemini quota from a seeded demo environment. Built-in guidance and deterministic Ask Records remain available. If live AI testing is required later, use a separately approved staging provider key.

`GET /api/ready` is deliberately public and returns only service availability plus `staging`; it does not expose users, secrets, provider state, or database metadata.

## 4. Connect a Vercel Preview deployment

Use the existing Vercel project and the `staging` Git branch:

1. Vercel project → **Settings** → **Environment Variables**.
2. Add `NEXT_PUBLIC_API_URL` as **Config** visibility, not Secret.
3. Set its value to the staging Render backend URL, without a trailing slash.
4. Select **Preview** and scope it to the `staging` branch only.
5. Push a commit to `staging`; Vercel creates a Preview deployment.

The production variable must continue to point to the production Render backend. Do not replace it with the staging URL.

A Vercel preview URL can change after each deployment. That is normal. If a stable public demo URL is needed later, create a second Vercel project connected only to the `staging` branch; do not repoint the production Vercel project.

## 5. Staging smoke checklist

- `/api/ready` returns HTTP 200 with `environment: "staging"`.
- The staging landing page and login load.
- The six staging demo accounts can sign in with `demo1234`.
- Sample grants, expenses, notifications, UCs, and roles appear only in staging.
- No production Admin or production records appear in staging.
- Production `main` remains pointed to the production Render URL.
- Staging AI is visibly built-in guidance unless an explicit staging provider key is configured.

## 6. Teardown and hygiene

When staging is not needed, suspend/delete the staging Render service and delete the staging Neon project/database. Keep production untouched.

Before any future schema change:

1. test the migration locally;
2. push it to `staging`;
3. run staging migration + browser smoke checks;
4. create/confirm a current production Neon snapshot;
5. merge to `main` only after it works;
6. production Render applies the checked-in migration on its next deployment. See [DATABASE-OPERATIONS.md](DATABASE-OPERATIONS.md).
