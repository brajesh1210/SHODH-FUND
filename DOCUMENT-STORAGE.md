# ShodhFund private bill storage (Backblaze B2 / S3-compatible)

## What this phase implements

Expense source bills can be stored in a **private** S3-compatible bucket after an expense is created. The browser never receives R2 credentials, R2 object keys, a public bucket URL, or a presigned public URL.

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

## No-card storage setup: Backblaze B2

Cloudflare R2 asks for a billing method before activation, so the no-card default is **Backblaze B2**. B2 provides a private S3-compatible API and 10 GB of free storage for a no-card account. Keep the bucket private; ShodhFund always serves downloads through the authenticated backend rather than a public object URL.

Create two private B2 buckets with globally unique names, for example:

```text
Staging:    shodhfund-staging-bills-<your-unique-suffix>
Production: shodhfund-production-bills-<your-unique-suffix>
```

Create a separate bucket-restricted B2 Application Key for each bucket with read/write/delete access. If the Backblaze key form offers **Allow List All Bucket Names**, enable it for S3 SDK compatibility. Use the bucket's S3 endpoint and its region, for example `https://s3.us-west-004.backblazeb2.com` and `us-west-004`.

Each Render service receives only its own B2 values:

```text
OBJECT_STORAGE_PROVIDER=backblaze-b2
B2_ENDPOINT=https://s3.<region>.backblazeb2.com
B2_KEY_ID=<bucket-scoped-key-id>
B2_APPLICATION_KEY=<bucket-scoped-application-key>
B2_BUCKET=<private-bucket-name>
B2_REGION=<region>
```

Never put these values in Vercel, frontend `.env` files, GitHub, browser code, screenshots, or chat.

### Optional Cloudflare R2

The same adapter also supports R2 when an R2 subscription is available. Use `OBJECT_STORAGE_PROVIDER=cloudflare-r2` with `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_REGION=auto`. R2 is not required for this project.

## Deployment order

This phase contains a Prisma migration (`expense_documents`). Follow the existing Phase 6 runbook.

1. Push the reviewed code to `staging` first.
2. Configure the **staging Render** B2 variables and staging bucket key.
3. Let staging Render apply the migration with its direct Neon URL.
4. Upload a disposable sample bill using the staging PI demo account.
5. Verify the attached-bill indicator and authenticated download work for PI and Finance.
6. Verify a different PI cannot download the document.
7. Create a fresh production Neon snapshot.
8. Merge the same reviewed migration to `main`.
9. Configure the **production Render** B2 variables and production bucket key before/with the deployment.
10. Let production Render run the migration preflight/deploy wrapper, then verify `/api/ready` and one authorized upload/download.

The migration does not copy existing legacy `billUrl` values into R2. Existing public URLs are intentionally not treated as trusted private bill records.

## Failure behavior

- If private object storage is not configured, normal expense creation still works; attempting an attachment returns a clear storage-unavailable message.
- If an object upload fails, no document database record is created.
- If PostgreSQL metadata creation fails after the object upload, ShodhFund attempts to delete the new R2 object.
- The app never silently claims a document was retained when storage failed.

## Current limitations

- There is no user-facing document deletion/retention-management screen yet.
- Earlier replacement object bytes are retained privately for audit history; lifecycle/retention controls are a later operational phase.
- OCR extraction remains an input aid. A stored document does not certify the extracted fields, tax data, accounting treatment, GFR compliance, or approval decision.
