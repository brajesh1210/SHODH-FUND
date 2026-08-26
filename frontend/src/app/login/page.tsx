"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { logout } from "@/lib/session";
import type { User } from "@/lib/types";
import styles from "./login.module.css";

const demos = [
  { label: "Principal Investigator", short: "PI", email: "arjun.sharma@university.edu", password: "demo1234", icon: Sparkles },
  { label: "Finance Officer", short: "Finance", email: "rohit.mehta@university.edu", password: "demo1234", icon: Landmark },
  { label: "Research Admin", short: "Admin", email: "meera.iyer@university.edu", password: "demo1234", icon: FileCheck2 },
  { label: "Auditor", short: "Auditor", email: "sk.verma@university.edu", password: "demo1234", icon: ShieldCheck },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("arjun.sharma@university.edu");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    api<User>("/api/auth/me")
      .then(() => {
        router.replace("/select-role");
      })
      .catch(() => {
        logout();
        setCheckingSession(false);
      });
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const data = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!data?.user?.id) {
        throw new Error("The server returned an incomplete login response. Please try again.");
      }

      router.replace("/select-role");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  function selectDemo(account: (typeof demos)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  }

  if (checkingSession) {
    return (
      <main className={styles.loadingScreen} aria-label="Checking your session">
        <Logo size={35} priority />
        <p className={styles.loadingText}>Checking session</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.formPanel}>
        <div className={styles.formInner}>
          <header className={styles.mobileHeader}>
            <Link href="/" aria-label="Back to ShodhFund home"><Logo size={31} priority /></Link>
          </header>

          <Link href="/" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" />
            Back to home
          </Link>

          <div className={styles.heading}>
            <span><LockKeyhole aria-hidden="true" /> Protected workspace sign-in</span>
            <h1>Welcome back.</h1>
            <p>Sign in to continue managing research funding, compliance, and outcomes.</p>
          </div>

          <form onSubmit={submit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="email"
                inputMode="email"
                placeholder="name@institution.edu"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <div className={styles.passwordField}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6 }}>
              <span />
              <Link href="/forgot-password" style={{ fontSize: 11, color: '#4C5F13', fontWeight: 600, textDecoration: 'underline' }}>
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className={styles.error} role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </div>
            )}

            <button className={styles.submitButton} type="submit" disabled={loading || !email.trim() || !password}>
              <span>{loading ? "Signing you in…" : "Sign in to workspace"}</span>
              {loading ? <i className={styles.spinner} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </form>

          <div className={styles.demoSection}>
            <div className={styles.divider}><span>Demo access</span></div>
            <p>Choose a role to fill its working demo credentials.</p>
            <div className={styles.demoGrid}>
              {demos.map((account) => {
                const Icon = account.icon;
                const selected = email === account.email && password === account.password;
                return (
                  <button
                    type="button"
                    key={account.email}
                    onClick={() => selectDemo(account)}
                    className={selected ? styles.selectedDemo : ""}
                    aria-label={`Use ${account.label} demo credentials`}
                  >
                    <span><Icon aria-hidden="true" /></span>
                    <div>
                      <strong>{account.short}</strong>
                      <small>{account.email}</small>
                    </div>
                    {selected && <Check className={styles.demoCheck} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          <p style={{ marginTop: 18, fontSize: 11, textAlign: 'center', color: '#6B7280' }}>
            New to ShodhFund? <Link href="/register" style={{ textDecoration: 'underline', fontWeight: 700, color: '#0D1220' }}>Create an account</Link>
          </p>
          <p className={styles.support}>Need access help? <a href="mailto:hello@shodhfund.in">Contact ShodhFund support</a></p>
        </div>
      </section>

      <aside className={styles.brandPanel} aria-label="About ShodhFund">
        <div className={styles.brandTop}>
          <Link href="/" aria-label="ShodhFund home"><Logo light size={38} priority /></Link>
          <span>Research funding, simplified.</span>
        </div>

        <div className={styles.brandContent}>
          <span className={styles.brandEyebrow}><Sparkles aria-hidden="true" /> One connected grant lifecycle</span>
          <h2>Less administration.<br /><em>More research momentum.</em></h2>
          <p>
            Bring grant records, expenditure workflows, review statuses,
            utilization-certificate drafts, and recorded decisions into one workspace.
          </p>

          <div className={styles.proofCard}>
            <div className={styles.proofHead}>
              <span>Connected oversight</span>
              <strong><i /> Role-aware</strong>
            </div>
            <div className={styles.proofMetric}>
              <div><small>Recorded activity</small><strong>Grant workflows</strong></div>
              <div className={styles.ring} aria-hidden="true"><span>✓</span></div>
            </div>
            <div className={styles.proofRows}>
              <div><span><ShieldCheck /> Duplicate / budget checks</span><b>Recorded</b></div>
              <div><span><FileCheck2 /> UC evidence</span><b>Trackable</b></div>
              <div><span><Landmark /> Available funds</span><b>From records</b></div>
            </div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <span><i /> Demonstration accounts available</span>
          <span>© 2026 ShodhFund</span>
        </div>
      </aside>
    </main>
  );
}
