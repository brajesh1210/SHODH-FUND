"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import styles from "../login/login.module.css";

type Role = "PI" | "FINANCE" | "ADMIN" | "AUDITOR";

const roles: { value: Role; label: string; desc: string }[] = [
  { value: "PI", label: "Principal Investigator", desc: "Manage grants and expenses" },
  { value: "FINANCE", label: "Finance Officer", desc: "Review and approve spending" },
  { value: "ADMIN", label: "Research Admin", desc: "Oversee institution records" },
  { value: "AUDITOR", label: "Auditor", desc: "Inspect compliance and audit trail" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<Role>("PI");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState<"details" | "otp" | "password">("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function sendOtp() {
    setError("");
    setInfo("");
    if (!email.trim() || !name.trim()) {
      setError("Name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message: string; expiresAt: string; devOtp?: string; devMode?: boolean }>(
        "/api/auth/send-otp",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), purpose: "REGISTRATION" }),
        }
      );
      setInfo(res.message || "OTP sent. Check your email.");
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setInfo("");
    if (!otp.trim()) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), purpose: "REGISTRATION", code: otp.trim() }),
      });
      setInfo("Email verified. Set your password to complete registration.");
      setStep("password");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    setError("");
    setInfo("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ token: string; user: { id: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          department: department.trim(),
        }),
      });
      if (!res?.token) throw new Error("Registration succeeded but no session was returned.");
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.formPanel}>
        <div className={styles.formInner}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" /> Back to home
          </Link>

          <div className={styles.heading}>
            <span>
              <LockKeyhole aria-hidden="true" /> Create your workspace
            </span>
            <h1>Join ShodhFund.</h1>
            <p>Register with email verification. Choose your role and start managing research funding.</p>
          </div>

          <div className={styles.form} style={{ marginTop: 24 }}>
            {step === "details" && (
              <>
                <div className={styles.field}>
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Arjun Sharma"
                    required
                    disabled={loading}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="email">Work email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@institution.edu"
                    required
                    disabled={loading}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="dept">Department (optional)</label>
                  <input
                    id="dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Biotechnology"
                    disabled={loading}
                  />
                </div>
                <div className={styles.field}>
                  <label>Role</label>
                  <div style={{ display: "grid", gap: 8 }}>
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        disabled={loading}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: role === r.value ? "1px solid #0D1220" : "1px solid #D2D4CC",
                          background: role === r.value ? "#F0F1EB" : "white",
                          fontSize: 12,
                        }}
                      >
                        <strong style={{ display: "block", fontSize: 12 }}>{r.label}</strong>
                        <small style={{ color: "#6B7280" }}>{r.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <button className={styles.submitButton} type="button" onClick={sendOtp} disabled={loading || !email.trim() || !name.trim()}>
                  <span>{loading ? "Sending OTP..." : "Send verification OTP"}</span>
                  <Mail aria-hidden="true" />
                </button>
              </>
            )}

            {step === "otp" && (
              <>
                <div className={styles.field}>
                  <label htmlFor="otp">Enter OTP sent to {email}</label>
                  <input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={loading}
                  />
                </div>
                {devOtp && (
                  <div style={{ padding: "8px 10px", background: "#FEF9C3", borderRadius: 8, fontSize: 11 }}>
                    Dev OTP: <strong>{devOtp}</strong> (shown because email not configured in dev)
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={styles.submitButton} type="button" onClick={verifyOtp} disabled={loading || otp.length !== 6} style={{ flex: 1 }}>
                    <span>{loading ? "Verifying..." : "Verify email"}</span>
                    <CheckCircle2 aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={loading}
                    style={{ padding: "0 14px", borderRadius: 10, border: "1px solid #D2D4CC", background: "white", fontSize: 11 }}
                  >
                    Resend
                  </button>
                </div>
                <button type="button" onClick={() => setStep("details")} style={{ fontSize: 11, color: "#6B7280", textDecoration: "underline" }}>
                  Change email/role
                </button>
              </>
            )}

            {step === "password" && (
              <>
                <div className={styles.field}>
                  <label htmlFor="password">Create password</label>
                  <div className={styles.passwordField}>
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password">
                      {showPass ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="confirm">Confirm password</label>
                  <input
                    id="confirm"
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    required
                    disabled={loading}
                  />
                </div>
                <button className={styles.submitButton} type="button" onClick={register} disabled={loading || !password || !confirm}>
                  <span>{loading ? "Creating account..." : "Create account"}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </>
            )}

            {error && (
              <div className={styles.error} role="alert">
                <span aria-hidden="true">!</span> {error}
              </div>
            )}
            {info && (
              <div style={{ padding: "10px 12px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, fontSize: 11, color: "#065F46" }}>
                {info}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, textAlign: "center", color: "#6B7280" }}>
              Already have an account? <Link href="/login" style={{ textDecoration: "underline", fontWeight: 600 }}>Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.brandPanel} aria-label="About">
        <div className={styles.brandTop}>
          <Link href="/" aria-label="Home"><Logo light size={38} priority /></Link>
          <span>Research funding, simplified.</span>
        </div>
        <div className={styles.brandContent}>
          <span className={styles.brandEyebrow}><Sparkles aria-hidden="true" /> Secure onboarding</span>
          <h2>
            Email verified.
            <br />
            <em>Role-aware access.</em>
          </h2>
          <p>Registration requires a 6-digit OTP, hashed storage, expiry, attempt limits, and audit logging. No plaintext OTPs are stored.</p>
          <div className={styles.proofCard}>
            <div className={styles.proofHead}>
              <span>Onboarding checks</span>
              <strong><i /> Verified</strong>
            </div>
            <div className={styles.proofRows}>
              <div><span><ShieldCheck /> OTP hashing</span><b>bcrypt</b></div>
              <div><span><Mail /> Email ownership</span><b>Verified</b></div>
              <div><span><User /> Role binding</span><b>From account</b></div>
            </div>
          </div>
        </div>
        <div className={styles.brandFooter}>
          <span><i /> No demo seed in production</span>
          <span>© 2026 ShodhFund</span>
        </div>
      </aside>
    </main>
  );
}
