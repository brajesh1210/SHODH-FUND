"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState<"email" | "reset">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function sendOtp() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message: string; devOtp?: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      setInfo(res.message || "If an account exists, an OTP has been sent.");
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep("reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError("");
    setInfo("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: otp.trim(), newPassword, newPasswordConfirm: confirm }),
      });
      setInfo(res.message || "Password reset successful. You can now sign in.");
      setOtp("");
      setNewPassword("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.formPanel}>
        <div className={styles.formInner}>
          <Link href="/login" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" /> Back to sign in
          </Link>

          <div className={styles.heading}>
            <span><LockKeyhole aria-hidden="true" /> Password recovery</span>
            <h1>Reset password.</h1>
            <p>Enter your work email. We will send a 6-digit OTP that expires in 10 minutes.</p>
          </div>

          <div className={styles.form} style={{ marginTop: 24 }}>
            {step === "email" && (
              <>
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
                <button className={styles.submitButton} type="button" onClick={sendOtp} disabled={loading || !email.trim()}>
                  <span>{loading ? "Sending OTP..." : "Send reset OTP"}</span>
                  <Mail aria-hidden="true" />
                </button>
              </>
            )}

            {step === "reset" && (
              <>
                <div className={styles.field}>
                  <label htmlFor="otp">OTP for {email}</label>
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
                    Dev OTP: <strong>{devOtp}</strong>
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="newPass">New password</label>
                  <div className={styles.passwordField}>
                    <input
                      id="newPass"
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)}>
                      {showPass ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="confirm">Confirm new password</label>
                  <input
                    id="confirm"
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    disabled={loading}
                  />
                </div>
                <button className={styles.submitButton} type="button" onClick={resetPassword} disabled={loading || !otp || !newPassword || !confirm}>
                  <span>{loading ? "Resetting..." : "Reset password"}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setStep("email")} style={{ fontSize: 11, color: "#6B7280", textDecoration: "underline" }}>
                  Change email
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
              Remembered? <Link href="/login" style={{ textDecoration: "underline", fontWeight: 600 }}>Sign in</Link> ·{" "}
              <Link href="/register" style={{ textDecoration: "underline", fontWeight: 600 }}>Create account</Link>
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <Link href="/" aria-label="Home"><Logo light size={38} priority /></Link>
          <span>Secure recovery</span>
        </div>
        <div className={styles.brandContent}>
          <span className={styles.brandEyebrow}><Sparkles aria-hidden="true" /> Account safety</span>
          <h2>
            OTP secured.
            <br />
            <em>Password reset.</em>
          </h2>
          <p>Reset uses hashed OTPs, expiry, attempt limits, and audit logging. No password or OTP is logged.</p>
          <div className={styles.proofCard}>
            <div className={styles.proofHead}>
              <span>Recovery checks</span>
              <strong><i /> Protected</strong>
            </div>
            <div className={styles.proofRows}>
              <div><span><ShieldCheck /> OTP attempts</span><b>Limited</b></div>
              <div><span><Mail /> Anti-enumeration</span><b>Generic response</b></div>
              <div><span><LockKeyhole /> Audit trail</span><b>Logged</b></div>
            </div>
          </div>
        </div>
        <div className={styles.brandFooter}>
          <span><i /> 10-minute expiry</span>
          <span>© 2026 ShodhFund</span>
        </div>
      </aside>
    </main>
  );
}
