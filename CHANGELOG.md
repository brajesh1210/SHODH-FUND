# Changelog

## Unreleased — cumulative security, data-integrity, and UX remediation

This tree contains the cumulative implementation based on the Phase 3 `main` commit `43521eef5e8af554468085939f0848069d560215`.

### Authentication and authorization

- Replaced browser-readable token/profile persistence with an HttpOnly same-origin session proxy.
- Rehydrate authenticated users from PostgreSQL before applying role checks.
- Enforced role and record-ownership controls across audited datasets and mutations.
- Added verified workspace guards and role-correct navigation/logout behavior.
- Removed plaintext-password login compatibility; seeded demonstration passwords are bcrypt hashes.
- Require a production JWT secret of at least 32 characters; development uses a temporary random secret if none is supplied.
- Replaced raw Prisma/internal failures with safer client responses on corrected routes.

### Grants, budgets, and expenses

- Normalized shared Grant, Expense, BudgetHead, anomaly, milestone, notification, and stats contracts.
- Repaired Register Grant, Add Expense, expense correction, grant details, vendor filtering, totals, and false/non-finite financial displays.
- Enforced active-grant, grant-date, Indian-calendar future-date, positive-amount, current-head, sanctioned-total, spending-floor, and duplicate-head rules.
- Added serializable transaction boundaries and stale/conflict handling to budget allocation, expense creation/correction, and relevant status claims.
- Kept counters, compliance values, anomaly replacement/creation, and expense mutations atomic.
- Added reason-backed Finance rejection/correction decisions and safe rejected-expense reopening.
- Added responsive decision/correction dialogs for desktop and mobile layouts.

### Utilization certificates

- Added record-derived Indian-financial-year calculations and grant-overlap validation.
- Calculate utilization from approved expenditure and balance from cumulative approved expenditure through the selected financial year.
- Made same-grant/year draft generation serializable and conflict-aware.
- Enforced the adjacent workflow `DRAFT → UNDER_REVIEW → APPROVED → SUBMITTED_TO_AGENCY` with status-conditional claims.
- Added protected UC PDF download and blocked legacy records from unsafe approval/submission/PDF use.
- Repaired PI generation and Finance review interfaces with explicit review qualifications.

### Ask Records, assistant, OCR, and exports

- Added a server-only Gemini provider abstraction with validated configuration, header authentication, bounded retries and timeout, circuit breaking, normalized responses, token metadata, and sanitized request logging.
- Added truthful `live-ai`, `built-in-guidance`, `record-data`, and explicit unavailable response modes with visible UI provenance.
- Repaired Ask Records to query rehydrated-user-scoped PostgreSQL data deterministically, deny PI cross-ownership access, cap and interleave combined results, and return de-duplicated authoritative links.
- Kept external record context disabled by default; when approved and enabled, context is minimal, capped, role-scoped, identifier-redacted, and delimited as untrusted data.
- Added Admin-only passive provider state plus an explicit cached and rate-limited connectivity probe that never returns key values.
- Added Gemini bill extraction with strict output normalization, canonical aliases, proof verification, and honest provider failures.
- Added exact-SHA-256 bundled sample fallback with visible provenance; filenames are not used to infer bill values.
- Corrected multipart and binary forwarding through the frontend proxy.
- Scoped PI calendar and CSV/report exports to PI-owned records.

### Interface and product claims

- Preserved the approved landing hero, logo treatments, university marquee, feature presentation, full-screen compact Ask AI experience, navigation, and dashboard behavior.
- Wired landing feature anchors and Privacy/Security routes.
- Removed obsolete event references and unqualified AI, compliance, monitoring, NIRF, uptime, and security claims.
- Replaced hardcoded dashboard/platform metrics with record-derived values, qualified illustrative values, explicit configuration status, or honest unavailable/error states.
- Repaired notification “Mark all as read,” grant links, loading/empty/error states, responsive forms, mobile actions, downloads, and role-aware dashboards.

### Continuous integration and dependency safety

- Pinned the repository runtime to Node.js 22.23.2 and npm 10.9.8.
- Added least-privilege GitHub Actions checks for frontend lint, TypeScript, build, backend syntax, Prisma generation/schema validation, and production dependency audits.
- Added pull-request dependency review with high-severity blocking and immutable action commit references.
- Added weekly grouped Dependabot updates for both npm applications and GitHub Actions.
- Added a pull-request template covering secrets, validation, database impact, deployment evidence, and rollback.

### Documentation and cleanup

- Updated setup documentation for PostgreSQL, current API/session behavior, OCR provider behavior, and production secret requirements.
- Removed the unreferenced frontend JSON data snapshot, obsolete plaintext seed script, obsolete JSON-mode script, stale empty root lockfile, generated TypeScript build metadata, and unused provider/storage dependencies.
- Pinned patched transitive PostCSS and Sharp releases for the retained Next.js 15 application; final dependency audits report no known vulnerabilities.
- Documented that optional R2/S3 health output reports environment configuration only and that uploaded OCR source bills are not currently persisted.

### Validation status

- Frontend ESLint, TypeScript checking, and the Next.js production build pass.
- Backend JavaScript syntax checks pass.
- Prisma Client generation and schema validation pass with Prisma 5.22.0.
- The final frontend production build completes without warnings.
- The guarded PostgreSQL suite covers deterministic seeding, role and ownership isolation, Ask AI provenance and records, financial invariants, and concurrency-sensitive workflows; it requires a migrated, seeded disposable PostgreSQL test database.
