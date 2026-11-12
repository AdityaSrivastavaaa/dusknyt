import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap } from '../lib/http.js';

export const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, env.jwtSecret, { expiresIn: '7d' });

export const authenticate = wrap(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new ApiError(401, 'Not authenticated');
  let p;
  try { p = jwt.verify(h.slice(7), env.jwtSecret); } catch { throw new ApiError(401, 'Invalid or expired token'); }
  const user = await prisma.user.findUnique({ where: { id: p.sub } });
  if (!user || user.status === 'INACTIVE') throw new ApiError(401, 'Account unavailable');
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, 'Forbidden'));

/** Resolves the Promoter profile; every promoter query MUST be scoped by req.promoter.id. */
export const loadPromoter = wrap(async (req, res, next) => {
  const p = await prisma.promoter.findUnique({ where: { userId: req.user.id } });
  if (!p || p.status !== 'ACTIVE') throw new ApiError(403, 'Promoter account is not active');
  req.promoter = p;
  next();
});
