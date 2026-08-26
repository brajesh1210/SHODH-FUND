# ShodhFund Production Checklist — Phase 9 Final

## Current Live Topology (Free Tier)
```
Vercel Production: https://shodh-fund-sigma.vercel.app
  -> NEXT_PUBLIC_API_URL=https://shodhfund-backend.onrender.com
Render Production: https://shodhfund-backend.onrender.com
  -> DATABASE_URL=Neon pooled shodhfund_prod
  -> DIRECT_DATABASE_URL=Neon direct shodhfund_prod
  -> Gemini: gemini-3.1-flash-lite live-ai
  -> Storage: Backblaze B2 private (prod bucket)
  -> Email: Brevo HTTPS API (any recipient)

Vercel Staging Preview: staging branch preview
Render Staging: https://shodhfund-staging-backend.onrender.com
Neon Staging: shodhfund_staging (seeded demo data)
```

## Security Hardening (Phase 9)
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS in prod, Cache-Control private no-store for /api
- Rate limiting (in-memory, free tier):
  - login: 10 / 15min
  - otp (send, verify, register, forgot, reset): 20 / hour + per-email 5/hour + 60s cooldown + 5 attempts
  - chat: 15 / min
  - ask: 20 / min
  - export: 10 / min
  - upload/ocr: 20 / min
- OTP: bcrypt hash, 10min expiry, 30min verified window, anti-enumeration for password reset
- Passwords: bcrypt 12
- JWT: HttpOnly cookie sf_session via frontend proxy, 8h expiry, production requires 32+ char secret
- CORS: exact Vercel origin only
- No secrets in frontend bundle, logs, or Git

## Free Tier Sleep Handling
Render Free sleeps after 15 min inactivity. First request after sleep takes 30-60s.
We intentionally allow sleep to stay within 750 free hours/month.
- 1 always-awake service = ~720h (within limit)
- 2 always-awake = ~1440h (exceeds, will be paused)
Recommendation: Let production sleep, accept cold start. For demo day, use external ping every 10 min temporarily.

Vercel Hobby is always awake, no sleep.

## Email OTP — Any User
- Resend onboarding@resend.dev only sends to owner email (free limitation)
- For any recipient, use Brevo HTTPS API:
  EMAIL_PROVIDER=brevo
  EMAIL_FROM=ShodhFund <verified-email>
  BREVO_API_KEY=xkeysib-...
- Verify sender in Brevo dashboard. Gmail freemail senders work but have deliverability warnings. Custom domain recommended for production.
- SMTP (Gmail App Password) also works but may timeout on Render Free (port 587). Port 465 with SMTP_SECURE=true is more reliable.

## Bill Storage — Private
- Backblaze B2 private bucket, no public URL, no browser key
- Magic-byte validation, 8MB max
- Object key never exposed, download via authenticated backend route
- PI ownership enforced, Finance/Admin/Auditor via expense-read policy

## Final Smoke Test (Run on Production URLs)
1. Landing loads, logos correct, orbit, marquee
2. /register -> any real email -> OTP inbox -> verify -> password -> create -> login
3. Login with new account -> dashboard (empty, correct for fresh prod)
4. /forgot-password -> OTP -> reset -> login with new password
5. Existing production Admin login still works
6. Ask AI -> Live AI badge, not built-in-guidance
7. Ask Records (PI) -> deterministic links
8. Add Expense (PI) -> bill upload to B2 private -> download works, other PI gets 403
9. Finance verify, UC generate/review/PDF, reports, exports
10. Logout -> landing
11. Mobile 390px no offscreen actions

## Rollback
- Code: redeploy previous Vercel/Render deployment
- DB: Neon snapshot restore (free tier 1 snapshot) + forward-fix migration preferred over destructive reset
- Secrets: rotate via Render dashboard, redeploy

## Remaining Optional Future Work
- Custom domain + HTTPS
- Distributed rate limiting via Redis
- Private document retention UI + lifecycle
- Admin user provisioning UI
- Monitoring/alerting (UptimeRobot, Logtail)
- Paid plans for guaranteed uptime

