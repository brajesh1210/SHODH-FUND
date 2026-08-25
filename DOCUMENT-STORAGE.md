# ShodhFund private bill storage (Cloudflare R2)

## What this phase implements

Expense source bills can be stored in a **private** Cloudflare R2 bucket after an expense is created. The browser never receives R2 credentials, R2 object keys, a public bucket URL, or a presigned public URL.

```text
PI uploads a bill
  -> ShodhFund backend validates file bytes and size
  -> private R2 object is written
  -> ExpenseDocument metadata/provenance is saved in PostgreSQL
  -> authorized user downloads through the authenticated backend route
```

The current document route is:

```text
POST /api/expenses/:id/document
GET  /api/expenses/:id/document
```

PI access is limited to the PI's own grant records. Finance, Admin, and Auditor access follows the existing institution-level expense-read policy. Object keys are not returned in API responses.

## File policy

Accepted source bill formats:

```text
PDF, JPG/JPEG, PNG, WebP
```

Maximum size:

```text
8 MB per file
```

The backend validates magic bytes rather than trusting a browser-supplied extension or MIME type. A replacement creates a new current document and retains earlier metadata for audit history; only the current document is downloadable through the normal endpoint.

## R2 bucket setup

Create **two private Standard-class buckets** in Cloudflare R2:

```text
Production: shodhfund-production-bills
Staging:    shodhfund-staging-bills
```

Do not enable public development URLs, r2.dev public access, or a public custom domain for either bucket.

Create an R2 API token/access key scoped only to the relevant bucket with object read/write/delete access. Use separate staging and production keys. Do not use the Cloudflare global API key.

Each Render service receives only its own bucket values:

```text
R2_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<bucket-scoped-access-key>
R2_SECRET_ACCESS_KEY=<bucket-scoped-secret>
R2_BUCKET=shodhfund-production-bills   # production only
R2_REGION=auto
```

For staging, use the staging bucket and staging key instead.

Never put these values in Vercel, frontend `.env` files, GitHub, browser code, screenshots, or chat.

## Deployment order

This phase contains a Prisma migration (`expense_documents`). Follow the existing Phase 6 runbook.

1. Push the reviewed code to `staging` first.
2. Configure the **staging Render** R2 variables and staging bucket key.
3. Let staging Render apply the migration with its direct Neon URL.
4. Upload a disposable sample bill using the staging PI demo account.
5. Verify the attached-bill indicator and authenticated download work for PI and Finance.
6. Verify a different PI cannot download the document.
7. Create a fresh production Neon snapshot.
8. Merge the same reviewed migration to `main`.
9. Configure the **production Render** R2 variables and production bucket key before/with the deployment.
10. Let production Render run the migration preflight/deploy wrapper, then verify `/api/ready` and one authorized upload/download.

The migration does not copy existing legacy `billUrl` values into R2. Existing public URLs are intentionally not treated as trusted private bill records.

## Failure behavior

- If R2 is not configured, normal expense creation still works; attempting an attachment returns a clear storage-unavailable message.
- If an object upload fails, no document database record is created.
- If PostgreSQL metadata creation fails after the object upload, ShodhFund attempts to delete the new R2 object.
- The app never silently claims a document was retained when storage failed.

## Current limitations

- There is no user-facing document deletion/retention-management screen yet.
- Earlier replacement object bytes are retained privately for audit history; lifecycle/retention controls are a later operational phase.
- OCR extraction remains an input aid. A stored document does not certify the extracted fields, tax data, accounting treatment, GFR compliance, or approval decision.
