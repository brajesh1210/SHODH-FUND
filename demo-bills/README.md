# ShodhFund bundled bill samples

These four PDFs are **demonstration fixtures**, not genuine invoices. They are provided so the Add Expense upload flow can be exercised without external documents:

- `travel.pdf`
- `consumable.pdf`
- `duplicate.pdf`
- `equipment.pdf`

## OCR behavior

- When `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is configured on the backend, an uploaded PDF or supported image is sent to the configured Gemini extraction provider. Every extracted field must still be reviewed before submission.
- Without a configured provider, canned demo values are returned **only** when the uploaded bytes exactly match one of these bundled PDFs by SHA-256 digest. Renaming an arbitrary file to a sample filename does not trigger a canned response.
- All canned responses are explicitly returned with `source: "sample-demo"`, `demo: true`, and a note explaining that live OCR was not performed.
- Other files receive an honest service-unavailable response when OCR is not configured.

The current local duplicate and budget checks are review aids only. They do not establish legal, procurement, tax, finance, or audit compliance.
