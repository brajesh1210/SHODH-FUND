import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F4F7FB] px-5 py-10 text-[#102A43] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#2454D6] hover:underline">
          ← Back to ShodhFund
        </Link>

        <article className="mt-6 rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/shodhfund-logo-dark.png"
            alt="ShodhFund"
            width={178}
            height={50}
            className="h-auto w-40"
          />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-[#718096]">
            Product privacy information
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">How ShodhFund handles application data</h1>
          <p className="mt-4 text-sm leading-7 text-[#526477]">
            This page describes the data paths implemented in this application. The institution operating a
            deployment remains responsible for publishing its own legally reviewed privacy notice, retention
            schedule, contact details, and any consent or statutory basis required for its users.
          </p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-[#40566D]">
            <section>
              <h2 className="text-lg font-semibold text-[#102A43]">Data recorded in a workspace</h2>
              <p className="mt-2">
                Depending on use, ShodhFund can record account and role details, grants, budget heads, expenses,
                invoice identifiers, vendor and GST fields, milestones, utilization-certificate drafts,
                approvals, objections, anomalies, notifications, and audit-log entries. Users may also upload
                supported bill files for extraction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#102A43]">Authentication and browser storage</h2>
              <p className="mt-2">
                The web application keeps the authenticated session token in an HttpOnly, SameSite cookie rather
                than browser-readable local storage. A limited display-user object may be cached in the browser
                for interface labels; server authorization remains authoritative.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#102A43]">Optional external processing</h2>
              <p className="mt-2">
                If a deployment configures Gemini, supported bill content may be sent to that provider for field
                extraction. Assistant questions may also be sent to the configured provider together with a
                bounded conversation and a summary of records accessible to the signed-in user. Extracted values
                and assistant answers require human verification. If no provider is configured or available, the
                application uses limited built-in guidance and does not claim that AI processing succeeded.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#102A43]">Access, retention, and deletion</h2>
              <p className="mt-2">
                API access is restricted by authenticated role and, for PI accounts, grant ownership. Retention,
                correction, export, and deletion procedures depend on the institution operating the deployment
                and its legal, finance, research, and audit obligations. Contact that institution’s administrator
                for requests concerning a deployed workspace.
              </p>
            </section>
          </div>

          <p className="mt-9 border-t border-[#E8EDF2] pt-5 text-xs text-[#718096]">
            Last product-text update: 23 August 2026. This is implementation information, not legal advice.
          </p>
        </article>
      </div>
    </main>
  );
}
