import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, publicUser } from '../lib/http.js';
import { sign } from '../middleware/auth.js';
import { issueOtp, checkOtp } from '../services/otp.js';
import { env } from '../config/env.js';

const r = Router();
const phoneS = z.string().regex(/^\+?\d{10,13}$/, 'Invalid phone number').transform((p) => (p.startsWith('+') ? p : '+91' + p.slice(-10)));
const session = (user, extra = {}) => ({ token: sign(user), user: publicUser(user), ...extra });

/* ---------- USER: phone OTP + Google ---------- */
r.post('/user/send-otp', wrap(async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneS }), req.body);
  res.json({ sent: true, devOtp: issueOtp(phone) });
}));
r.post('/user/verify-otp', wrap(async (req, res) => {
  const { phone, otp } = parse(z.object({ phone: phoneS, otp: z.string().length(6) }), req.body);
  if (!checkOtp(phone, otp)) throw new ApiError(400, 'Invalid or expired OTP');
  let user = await prisma.user.findUnique({ where: { phone } });
  if (user && user.role !== 'USER') throw new ApiError(403, 'This number belongs to a staff account');
  if (!user) user = await prisma.user.create({ data: { phone, role: 'USER' } });
  res.json(session(user, { isNew: !user.name }));
}));
r.post('/user/google', wrap(async (req, res) => {
  if (!env.googleClientId) throw new ApiError(501, 'Google login is not configured');
  const { idToken } = parse(z.object({ idToken: z.string() }), req.body);
  const ticket = await new OAuth2Client(env.googleClientId).verifyIdToken({ idToken, audience: env.googleClientId });
  const p = ticket.getPayload();
  let user = await prisma.user.findUnique({ where: { email: p.email } });
  if (user && user.role !== 'USER') throw new ApiError(403, 'This email belongs to a staff account');
  if (!user) user = await prisma.user.create({ data: { email: p.email, name: p.name, avatar: p.picture, role: 'USER' } });
  res.json(session(user, { isNew: !user.name }));
}));

/* ---------- PROMOTER: password or OTP (accounts are created by admins only) ---------- */
const findPromoter = async (phone) => {
  const u = await prisma.user.findUnique({ where: { phone }, include: { promoter: true } });
  if (!u || u.role !== 'PROMOTER' || !u.promoter) throw new ApiError(401, 'No promoter account for this number');
  if (u.status === 'INACTIVE' || u.promoter.status !== 'ACTIVE') throw new ApiError(403, 'Account is not active. Contact DUSKNYT support.');
  return u;
};
r.post('/promoter/login', wrap(async (req, res) => {
  const { phone, password } = parse(z.object({ phone: phoneS, password: z.string().min(1) }), req.body);
  const u = await findPromoter(phone);
  if (!u.passwordHash || !(await bcrypt.compare(password, u.passwordHash))) throw new ApiError(401, 'Incorrect phone or password');
  res.json(session(u));
}));
r.post('/promoter/send-otp', wrap(async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneS }), req.body);
  await findPromoter(phone);
  res.json({ sent: true, devOtp: issueOtp(phone) });
}));
r.post('/promoter/verify-otp', wrap(async (req, res) => {
  const { phone, otp } = parse(z.object({ phone: phoneS, otp: z.string().length(6) }), req.body);
  const u = await findPromoter(phone);
  if (!checkOtp(phone, otp)) throw new ApiError(400, 'Invalid or expired OTP');
  res.json(session(u));
}));

/* ---------- ADMIN: email + password (add TOTP 2FA before going live) ---------- */
r.post('/admin/login', wrap(async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  const u = await prisma.user.findUnique({ where: { email } });
  const ok = u && ['ADMIN', 'SUPER_ADMIN'].includes(u.role) && u.status !== 'INACTIVE' && u.passwordHash && (await bcrypt.compare(password, u.passwordHash));
  if (!ok) throw new ApiError(401, 'Incorrect email or password');
  res.json(session(u));
}));

export default r;
