'use strict';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readEmailConfig(env = process.env) {
  const provider = text(env.EMAIL_PROVIDER).toLowerCase() || (text(env.RESEND_API_KEY) ? 'resend' : '');
  const from = text(env.EMAIL_FROM) || 'ShodhFund <no-reply@shodhfund.local>';
  const resendKey = text(env.RESEND_API_KEY);
  const smtpHost = text(env.SMTP_HOST);
  const smtpPort = Number(env.SMTP_PORT) || 587;
  const smtpUser = text(env.SMTP_USER);
  const smtpPass = text(env.SMTP_PASS);
  const smtpSecure = String(env.SMTP_SECURE || '').toLowerCase() === 'true';

  const configured =
    (provider === 'resend' && Boolean(resendKey)) ||
    (provider === 'smtp' && Boolean(smtpHost && smtpUser && smtpPass));

  return {
    provider: provider || (resendKey ? 'resend' : smtpHost ? 'smtp' : ''),
    from,
    resendKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    configured
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
    const error = new Error(`Email provider returned HTTP ${response.status}`);
    error.details = body.slice(0, 500);
    throw error;
  }
}

async function sendWithSmtp({ to, subject, html, textBody }, config) {
  // Lazy import to avoid mandatory nodemailer dependency when using Resend
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass }
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

  if (config.provider === 'resend') {
    return sendWithResend(payload, config);
  }
  if (config.provider === 'smtp') {
    return sendWithSmtp(payload, config);
  }

  // Auto-detect fallback
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
    <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:12px 16px;background:#f8fafc;border-radius:12px;text-align:center;border:1px solid #e2e8f0">${code}</div>
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
