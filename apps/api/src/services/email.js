import { env } from '../config/env.js';
import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!env.smtpUser || !env.smtpPass) throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS in the API environment.');
  if (!transporter) transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transporter;
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function brandedEmail({ eyebrow, title, body, buttonLabel, buttonUrl, footer }) {
  return `<!doctype html><html><body style="margin:0;background:#111116;color:#f5f5f0;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111116;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #33313c;border-radius:20px;background:#191820;overflow:hidden"><tr><td style="padding:28px 28px 8px"><div style="font-size:25px;font-weight:800;letter-spacing:5px;color:#f5f5f0">DUSK<span style="color:#b79cff">N</span>YT</div><div style="margin-top:20px;color:#b79cff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${escapeHtml(eyebrow)}</div><h1 style="margin:10px 0 12px;font-size:26px;line-height:1.25;color:#f5f5f0">${escapeHtml(title)}</h1><div style="font-size:15px;line-height:1.7;color:#c9c5d3">${body}</div>${buttonLabel ? `<p style="margin:24px 0 20px"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;border-radius:12px;background:#b79cff;color:#17131f;padding:13px 20px;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(buttonLabel)}</a></p>` : ''}<div style="border-top:1px solid #33313c;margin-top:24px;padding:16px 0 6px;color:#928e9c;font-size:12px;line-height:1.6">${footer}</div></td></tr></table><div style="padding:16px;color:#77727f;font-size:11px">Nightlife access · Guestlists · Experiences</div></td></tr></table></body></html>`;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!env.emailFrom) throw new Error('Set EMAIL_FROM to your authenticated SMTP sender address.');
  return getTransporter().sendMail({ from: env.emailFrom, to, subject, html, text });
}

export async function sendPromoterWelcome({ name, brand, phone, email, temporaryPassword }) {
  const loginUrl = `${env.promoterAppUrl.replace(/\/$/, '')}/login`;
  const safeName = escapeHtml(name || brand);
  const html = brandedEmail({
    eyebrow: 'Promoter partner welcome',
    title: `Welcome to DUSKNYT, ${safeName}`,
    body: `<p>Your promoter account for <strong style="color:#f5f5f0">${escapeHtml(brand)}</strong> is ready. Manage your offers and guestlists from one place.</p><div style="border:1px solid #393544;border-radius:12px;background:#121117;padding:16px;margin-top:16px"><div style="font-size:12px;color:#a7a2af;margin-bottom:8px">YOUR LOGIN DETAILS</div><div style="margin:5px 0"><strong>Phone:</strong> ${escapeHtml(phone)}</div><div style="margin:5px 0"><strong>Email:</strong> ${escapeHtml(email)}</div><div style="margin:5px 0"><strong>Temporary password:</strong> <code style="color:#d6c5ff;font-size:15px">${escapeHtml(temporaryPassword)}</code></div></div><p style="font-size:13px">For your security, you’ll be asked to set a new password the first time you sign in. Keep this temporary password private.</p>`,
    buttonLabel: 'Open Promoter App', buttonUrl: loginUrl,
    footer: 'If you were not expecting this account, contact the DUSKNYT team and do not share these credentials.',
  });
  const text = `Welcome to DUSKNYT, ${name || brand}!\n\nYour promoter account for ${brand} is ready.\nPhone: ${phone}\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in: ${loginUrl}\nYou will be asked to change this password after your first login. Keep it private.`;
  return sendEmail({ to: email, subject: 'Your DUSKNYT promoter account is ready', html, text });
}

export async function sendUserWelcome({ name, email }) {
  const appUrl = env.userAppUrl.replace(/\/$/, '');
  const html = brandedEmail({
    eyebrow: 'Welcome to your next night out',
    title: `Welcome to DUSKNYT${name ? `, ${escapeHtml(name)}` : ''}`,
    body: '<p>Discover nightlife, compare guestlist offers from promoters, and keep your bookings together in one place.</p><p>Browse clubs and events, check each offer’s entry details and perks, then request the guestlist that suits you.</p>',
    buttonLabel: 'Explore DUSKNYT', buttonUrl: appUrl,
    footer: 'You received this message because a DUSKNYT account was created with this email address.',
  });
  const text = `Welcome to DUSKNYT${name ? `, ${name}` : ''}!\n\nDiscover nightlife, compare promoter guestlist offers, and keep your bookings together.\n\nExplore the app: ${appUrl}`;
  return sendEmail({ to: email, subject: 'Welcome to DUSKNYT', html, text });
}
