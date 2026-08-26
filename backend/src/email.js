'use strict';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readEmailConfig(env = process.env) {
  const providerRaw = text(env.EMAIL_PROVIDER).toLowerCase();
  const from = text(env.EMAIL_FROM) || 'ShodhFund <no-reply@shodhfund.local>';
  const resendKey = text(env.RESEND_API_KEY);
  const brevoKey = text(env.BREVO_API_KEY);
  const smtpHost = text(env.SMTP_HOST);
  const smtpPort = Number(env.SMTP_PORT) || 587;
  const smtpUser = text(env.SMTP_USER);
  const smtpPass = text(env.SMTP_PASS);
  const smtpSecure = String(env.SMTP_SECURE || '').toLowerCase() === 'true';

  let provider = providerRaw;
  if (!provider) {
    if (resendKey) provider = 'resend';
    else if (brevoKey) provider = 'brevo';
    else if (smtpHost) provider = 'smtp';
  }

  const configured =
    (provider === 'resend' && Boolean(resendKey)) ||
    (provider === 'brevo' && Boolean(brevoKey)) ||
    (provider === 'smtp' && Boolean(smtpHost && smtpUser && smtpPass));

  return {
    provider,
    from,
    resendKey,
    brevoKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    configured,
    // For diagnostics without leaking secrets
    hasResendKey: Boolean(resendKey),
    hasBrevoKey: Boolean(brevoKey),
    hasSmtp: Boolean(smtpHost)
  };
}

async function sendWithResend({ to, subject, html, textBody }, config) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      html,
      text: textBody
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Resend returned HTTP ${response.status}: ${body.slice(0, 300)}`);
    error.code = 'RESEND_FAILED';
    throw error;
  }
}

async function sendWithBrevo({ to, subject, html, textBody }, config) {
  // Brevo API uses HTTPS, works on Render Free without SMTP ports
  // Free tier: 300 emails/day, no card required, any recipient allowed if sender verified
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: parseFrom(config.from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: textBody
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Brevo returned HTTP ${response.status}: ${body.slice(0, 500)}`);
    error.code = 'BREVO_FAILED';
    throw error;
  }
}

function parseFrom(from) {
  // "Name <email@domain>" -> { name, email }
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: from.trim() };
}

async function sendWithSmtp({ to, subject, html, textBody }, config) {
  const nodemailer = require('nodemailer');
  // Try secure true for 465, false for 587 with STARTTLS
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure || config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text: textBody,
    html
  });
}

async function sendEmail(payload, env = process.env) {
  const config = readEmailConfig(env);
  if (!config.configured) {
    const error = new Error('Email is not configured for this environment.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  if (config.provider === 'resend') return sendWithResend(payload, config);
  if (config.provider === 'brevo') return sendWithBrevo(payload, config);
  if (config.provider === 'smtp') return sendWithSmtp(payload, config);

  // Auto-detect fallback order: Brevo (HTTPS) -> Resend (HTTPS) -> SMTP
  if (config.brevoKey) return sendWithBrevo(payload, config);
  if (config.resendKey) return sendWithResend(payload, config);
  if (config.smtpHost) return sendWithSmtp(payload, config);

  const error = new Error('No supported email provider is configured.');
  error.code = 'EMAIL_NOT_CONFIGURED';
  throw error;
}

function otpEmail({ purpose, code }) {
  const isReset = purpose === 'PASSWORD_RESET';
  const subject = isReset ? 'Reset your ShodhFund password' : 'Verify your ShodhFund email';
  const title = isReset ? 'Password reset code' : 'Email verification code';
  const intro = isReset
    ? 'Use this code to reset your ShodhFund password. It expires in 10 minutes.'
    : 'Use this code to verify your email for ShodhFund registration. It expires in 10 minutes.';

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px">
    <h2 style="margin:0 0 8px;font-size:18px">${title}</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6">${intro}</p>
    <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:12px 16px;background:#f8fafc;border-radius:12px;text-align:center;border:1px solid #e2e0e0">${code}</div>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">If you did not request this, you can ignore this email.</p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px">ShodhFund — Research funding, simplified.</p>
  </div>`.trim();

  const textBody = `${title}\n\n${intro}\n\nCode: ${code}\n\nExpires in 10 minutes. If you did not request this, ignore this email.`;

  return { subject, html, textBody };
}

module.exports = {
  readEmailConfig,
  sendEmail,
  otpEmail
};
