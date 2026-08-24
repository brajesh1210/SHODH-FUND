import Link from "next/link";

const controls = [
  [
    "Session handling",
    "The web layer stores the session token in an HttpOnly, SameSite cookie. Production cookies are marked Secure, and explicit logout clears the session cookie.",
  ],
  [
    "Authorization",
    "Corrected API routes require authentication, enforce permitted roles for mutations, and scope PI grant, expense, calendar, report, UC, and related records by ownership.",
  ],
  [
    "Credentials",
    "Seeded passwords are stored as bcrypt hashes. Production startup requires a JWT secret of at least 32 characters; an unconfigured development process uses a temporary in-memory secret.",
  ],
  [
    "Uploads and errors",
    "Bill uploads are limited by file size and accepted media type. Corrected routes return bounded client errors and avoid exposing raw database exceptions to the browser.",
  ],
] as const;

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#071C2C] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#C9FF24] hover:underline">
          ← Back to ShodhFund
        </Link>

        <article className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl sm:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/shodhfund-logo-light.png"
            alt="ShodhFund"
            width={178}
            height={50}
            className="h-auto w-40"
          />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-[#A8B7C2]">
            Security implementation overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Controls present in this application</h1>
          <p className="mt-4 text-sm leading-7 text-[#C4D0D7]">
            These are implementation details, not a certification, penetration-test result, uptime promise, or
            guarantee that every deployment is secure. Deployment owners must configure, monitor, update, back
            up, and independently assess their environment.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {controls.map(([title, description]) => (
              <section key={title} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h2 className="font-semibold text-[#C9FF24]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#B8C5CC]">{description}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-200/10 p-5">
            <h2 className="font-semibold text-amber-100">Deployment responsibilities</h2>
            <p className="mt-2 text-sm leading-7 text-[#D7DFE3]">
              Use HTTPS, configure strong secrets, restrict backend network exposure, maintain dependency and
              database updates, configure least-privilege provider credentials, review logs, test backups, set
              retention rules, and complete organization-specific security and compliance reviews before
              production use.
            </p>
          </section>

          <p className="mt-9 border-t border-white/10 pt-5 text-xs leading-6 text-[#93A5B0]">
            To report a suspected vulnerability, contact the operator of your ShodhFund deployment. For this
            project’s public contact, use <a className="text-[#C9FF24] hover:underline" href="mailto:hello@shodhfund.in">hello@shodhfund.in</a> without including sensitive production data.
          </p>
        </article>
      </div>
    </main>
  );
}
