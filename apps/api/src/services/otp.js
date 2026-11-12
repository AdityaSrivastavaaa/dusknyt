import { isProd } from '../config/env.js';

// In-memory store: fine for one instance. Use Redis (Upstash) when you scale to several.
const store = new Map();

export function issueOtp(phone) {
  const otp = isProd ? String(Math.floor(100000 + Math.random() * 900000)) : '123456';
  store.set(phone, { otp, exp: Date.now() + 5 * 60 * 1000, tries: 0 });
  // TODO(prod): send via MSG91 / Twilio here. Never log OTPs in production.
  if (!isProd) console.log(`[OTP] ${phone}: ${otp}`);
  return isProd ? undefined : otp;
}
export function checkOtp(phone, otp) {
  const r = store.get(phone);
  if (!r || r.exp < Date.now()) return false;
  if (++r.tries > 5) { store.delete(phone); return false; }
  if (r.otp !== String(otp)) return false;
  store.delete(phone);
  return true;
}
