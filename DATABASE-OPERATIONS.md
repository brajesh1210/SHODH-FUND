# ShodhFund database operations and migration runbook

## Scope

This runbook applies to the separated environments already in use:

```text
Production: shodhfund_prod on the production Neon project
Staging:    shodhfund_staging on the separate staging Neon project
Local/CI:   disposable local or CI PostgreSQL databases
```

It does not replace institution-specific backup, audit, retention, legal-hold, or disaster-recovery requirements.

## Current baseline

- The production operator created a manual Neon snapshot before Phase 6 work.
- Prisma migrations under `backend/prisma/migrations/` are the authoritative schema history.
- `prisma db push`, `prisma migrate reset`, `prisma migrate dev`, and all demo seed commands are prohibited against production.
- Production and staging use separate Neon projects/databases and separate Render services.

Record the Neon snapshot label/ID in your password manager or deployment notes, not in source control.

## Migration target preflight

The repository now wraps `npm run db:migrate:deploy` with a non-secret preflight.

For named production or staging Neon targets it requires:

- the expected database name;
- a direct/unpooled URL, not a `-pooler` URL;
- `sslmode=require`;
- the matching deployment label (`production` or `staging`).

It prints only target metadata such as `production`, `staging`, database name, and direct/pooled classification. It never prints a connection URL or password.

Useful commands:

```bash
# In the relevant backend environment
npm run db:preflight
npm run db:preflight:staging
npm run db:preflight:production
npm run db:migrate:status
```

## Normal schema-change flow

1. Create the schema change only against a disposable local database:

   ```bash
   npm run db:migrate:dev -- --name meaningful_change_name
   ```

2. Review and commit the generated migration SQL. Never edit a migration that was already deployed to production.
3. Push the change to `staging` and let the staging Render build use its direct staging URL for `npm run db:migrate:deploy`.
4. Run staging smoke tests against demo users/data, including the affected UI flow.
5. Before merging to `main`, create a fresh manual Neon production snapshot if the migration changes data, types, constraints, indexes, nullability, or deletes data.
6. Merge to `main`. The production Render build runs the same preflight and deploy command with `DIRECT_DATABASE_URL`.
7. Verify production:

   ```text
   GET /api/ready → environment: production
   npm run db:migrate:status → schema up to date
   ```

## Rollback principle

A code rollback does **not** roll back an already applied database migration.

Preferred recovery order:

1. stop or disable the affected application feature if necessary;
2. inspect the deployed migration and database state;
3. apply a reviewed **forward-fix migration** when possible;
4. restore from the Neon snapshot only when the impact warrants restoring the whole database and the operator understands the data-loss window;
5. redeploy a known-good application commit after the database state is compatible.

Never use `git revert` as an assumed database rollback. Never run a reset command against production.

## Render settings

Production Render build command:

```bash
npm ci --include=dev && npm run db:generate && DATABASE_URL="$DIRECT_DATABASE_URL" npm run db:migrate:deploy
```

Production runtime environment:

```text
NODE_ENV=production
SHODHFUND_DEPLOYMENT_ENV=production   # optional if NODE_ENV already identifies production
DATABASE_URL=<pooled production Neon URL>
DIRECT_DATABASE_URL=<direct production Neon URL>
```

Staging uses the same command but separate staging URLs and:

```text
NODE_ENV=production
SHODHFUND_DEPLOYMENT_ENV=staging
```

## Demo-data rule

```text
Production: never seed demo users/data.
Staging:    use npm run db:seed:staging only.
Local:      use npm run db:seed on a local disposable database.
CI:         seeds its ephemeral PostgreSQL service automatically.
```

## Before every production migration

- [ ] Confirm production frontend and backend currently pass `/api/ready`.
- [ ] Confirm the new migration was tested on local and staging first.
- [ ] Confirm the staging migration status is up to date.
- [ ] Create/confirm a current Neon production manual snapshot.
- [ ] Confirm `DIRECT_DATABASE_URL` is direct (not pooled) and has TLS.
- [ ] Confirm no demo seed command is part of build/deploy commands.
- [ ] Review migration SQL for destructive behavior and data backfills.
- [ ] Keep a known-good Render/Vercel deployment available for application rollback.

## After every production migration

- [ ] Check Render build output for preflight approval and successful migration deployment.
- [ ] Check `GET /api/ready` returns `environment: production`.
- [ ] Check relevant logged-in application workflow and one read-only production view.
- [ ] Record commit SHA, deployment IDs, migration name, snapshot label, and operator notes outside source control.
