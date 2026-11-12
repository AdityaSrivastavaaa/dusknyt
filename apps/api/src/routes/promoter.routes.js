import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, paging, startOfDay, addDays, publicUser } from '../lib/http.js';
import { decide, analytics } from '../services/guestlist.js';

// Mounted behind authenticate + authorize('PROMOTER') + loadPromoter.
// EVERY query below is scoped to req.promoter.id — never trust ids from the client alone.
const r = Router();
const reqInclude = { user: { select: { id: true, name: true, phone: true, avatar: true } }, offer: { include: { club: { select: { name: true, area: true } } } } };
const mine = (req) => ({ offer: { promoterId: req.promoter.id } });

r.get('/dashboard', wrap(async (req, res) => {
  const where = mine(req);
  const [fresh, confirmed, confirmedRows, events] = await Promise.all([
    prisma.guestRequest.count({ where: { ...where, status: 'PENDING', seenAt: null } }),
    prisma.guestRequest.count({ where: { ...where, status: 'CONFIRMED' } }),
    prisma.guestRequest.findMany({ where: { ...where, status: 'CONFIRMED' }, include: { offer: { select: { price: true } } } }),
    prisma.offer.findMany({
      where: { promoterId: req.promoter.id, status: 'ACTIVE', date: { gte: startOfDay() } },
      include: { club: { select: { name: true, images: true } }, _count: { select: { requests: true } } }, orderBy: { date: 'asc' }, take: 6,
    }),
  ]);
  res.json({
    name: req.user.name || req.promoter.brand, newRequests: fresh, confirmed,
    earnings: confirmedRows.reduce((s, x) => s + x.offer.price * x.guestCount, 0),
    upcoming: events.map((o) => ({ id: o.id, club: o.club.name, image: o.club.images[0], date: o.date, entryBefore: o.entryBefore, requests: o._count.requests })),
  });
}));

/* ----- offers ----- */
r.get('/clubs', wrap(async (req, res) => {
  res.json(await prisma.club.findMany({
    where: { status: 'ACTIVE' }, orderBy: { name: 'asc' },
    select: { id: true, name: true, area: true, events: { where: { date: { gte: startOfDay() } }, orderBy: { date: 'asc' }, select: { id: true, title: true, date: true, startTime: true } } },
  }));
}));
const offerBody = z.object({
  clubId: z.string(), eventId: z.string().nullable().optional(), date: z.string(), entryType: z.string(), offerType: z.string(),
  price: z.coerce.number().int().min(0).default(0), entryBefore: z.string().default('9:00 PM'),
  inclusions: z.array(z.string()).default([]), terms: z.string().optional(), description: z.string().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'UPCOMING']).default('ACTIVE'),
});
const titleOf = (d, clubName) => `${d.offerType} · ${d.entryType}${clubName ? ' @ ' + clubName : ''}`;

r.get('/offers', wrap(async (req, res) => {
  const t = req.query.tab, today = startOfDay();
  const where = { promoterId: req.promoter.id };
  if (t === 'active') where.status = 'ACTIVE';
  else if (t === 'upcoming') where.status = 'UPCOMING';
  else if (t === 'drafts') where.status = 'DRAFT';
  else if (t === 'past') where.OR = [{ status: { in: ['EXPIRED', 'INACTIVE'] } }, { date: { lt: today } }];
  res.json(await prisma.offer.findMany({ where, include: { club: { select: { name: true, images: true } }, _count: { select: { requests: true } } }, orderBy: { date: 'desc' } }));
}));
r.post('/offers', wrap(async (req, res) => {
  const d = parse(offerBody, req.body);
  const club = await prisma.club.findFirst({ where: { id: d.clubId, status: 'ACTIVE' } });
  if (!club) throw new ApiError(400, 'Invalid club');
  res.status(201).json(await prisma.offer.create({ data: { ...d, date: new Date(d.date), title: titleOf(d, club.name), promoterId: req.promoter.id } }));
}));
r.get('/offers/:id', wrap(async (req, res) => {
  const o = await prisma.offer.findFirst({ where: { id: req.params.id, promoterId: req.promoter.id }, include: { club: true, event: true, _count: { select: { requests: true } } } });
  if (!o) throw new ApiError(404, 'Offer not found');
  res.json(o);
}));
r.put('/offers/:id', wrap(async (req, res) => {
  const d = parse(offerBody.partial(), req.body);
  const own = await prisma.offer.findFirst({ where: { id: req.params.id, promoterId: req.promoter.id } });
  if (!own) throw new ApiError(404, 'Offer not found');
  const { clubId, ...rest } = d; // club cannot be changed after creation
  res.json(await prisma.offer.update({ where: { id: own.id }, data: { ...rest, ...(d.date && { date: new Date(d.date) }) } }));
}));
r.patch('/offers/:id/status', wrap(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']) }), req.body);
  const own = await prisma.offer.findFirst({ where: { id: req.params.id, promoterId: req.promoter.id } });
  if (!own) throw new ApiError(404, 'Offer not found');
  res.json(await prisma.offer.update({ where: { id: own.id }, data: { status } }));
}));

/* ----- requests ----- */
r.get('/requests', wrap(async (req, res) => {
  const tab = req.query.tab, where = mine(req);
  if (tab === 'new') Object.assign(where, { status: 'PENDING', seenAt: null });
  else if (tab === 'pending') Object.assign(where, { status: 'PENDING', seenAt: { not: null } });
  const [items, fresh] = await Promise.all([
    prisma.guestRequest.findMany({ where, include: reqInclude, orderBy: { createdAt: 'desc' }, ...paging(req.query) }),
    prisma.guestRequest.count({ where: { ...mine(req), status: 'PENDING', seenAt: null } }),
  ]);
  res.json({ items, newCount: fresh });
}));
r.get('/requests/:id', wrap(async (req, res) => {
  const g = await prisma.guestRequest.findFirst({ where: { id: req.params.id, ...mine(req) }, include: reqInclude });
  if (!g) throw new ApiError(404, 'Request not found');
  if (!g.seenAt) await prisma.guestRequest.update({ where: { id: g.id }, data: { seenAt: new Date() } });
  res.json(g);
}));
r.post('/requests/:id/decision', wrap(async (req, res) => {
  const d = parse(z.object({ action: z.enum(['ACCEPT', 'REJECT']), reason: z.string().optional(), note: z.string().max(300).optional() }), req.body);
  res.json(await decide(req.params.id, d.action, { ...d, actor: req.user, promoterId: req.promoter.id }));
}));

/* ----- guestlist (confirmed + pending for tonight/upcoming/past) ----- */
const guestlistWhere = (req) => {
  const today = startOfDay(), t = req.query.tab || 'tonight';
  const date = t === 'tonight' ? { gte: today, lt: addDays(today, 1) } : t === 'upcoming' ? { gte: addDays(today, 1) } : { lt: today };
  return { offer: { promoterId: req.promoter.id, date }, status: { in: ['CONFIRMED', 'PENDING'] } };
};
r.get('/guestlist', wrap(async (req, res) => {
  res.json(await prisma.guestRequest.findMany({ where: guestlistWhere(req), include: reqInclude, orderBy: { createdAt: 'asc' } }));
}));
r.get('/guestlist/export', wrap(async (req, res) => {
  const rows = await prisma.guestRequest.findMany({ where: guestlistWhere(req), include: reqInclude, orderBy: { createdAt: 'asc' } });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Code,Name,Phone,Club,Guests,Entry,Arrive Before,Status', ...rows.map((g) => [g.code, g.user.name, g.user.phone, g.offer.club.name, g.guestCount, g.offer.entryType, g.offer.entryBefore, g.status].map(esc).join(','))].join('\n');
  res.type('text/csv').attachment('guestlist.csv').send(csv);
}));

/* ----- analytics & profile ----- */
r.get('/analytics', wrap(async (req, res) => {
  res.json(await analytics(mine(req), req.query.range === 'month' ? 30 : 7));
}));
r.get('/profile', wrap(async (req, res) => res.json({ ...publicUser(req.user), promoter: req.promoter })));
r.put('/profile', wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(2).optional(), email: z.string().email().optional(), avatar: z.string().url().optional().or(z.literal('')), brand: z.string().min(2).optional() }), req.body);
  const { brand, ...u } = d;
  if (brand) await prisma.promoter.update({ where: { id: req.promoter.id }, data: { brand } });
  res.json(publicUser(await prisma.user.update({ where: { id: req.user.id }, data: u })));
}));
r.post('/change-password', wrap(async (req, res) => {
  const d = parse(z.object({ current: z.string(), next: z.string().min(8) }), req.body);
  if (!req.user.passwordHash || !(await bcrypt.compare(d.current, req.user.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(d.next, 10) } });
  res.json({ ok: true });
}));

export default r;
