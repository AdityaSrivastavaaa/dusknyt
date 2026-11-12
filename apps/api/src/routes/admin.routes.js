import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, paging, startOfDay, publicUser } from '../lib/http.js';
import { decide, analytics } from '../services/guestlist.js';
import { logActivity } from '../services/notify.js';

// Mounted behind authenticate + authorize('ADMIN','SUPER_ADMIN').
const r = Router();
const phoneS = z.string().regex(/^\+?\d{10,13}$/).transform((p) => (p.startsWith('+') ? p : '+91' + p.slice(-10)));
const like = (q, fields) => (q ? { OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } })) } : {});

/* ----- dashboard ----- */
r.get('/dashboard', wrap(async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000), day = startOfDay();
  const [clubs, clubsNew, promoters, promotersNew, offers, offersToday, users, byStatus, activity] = await Promise.all([
    prisma.club.count(), prisma.club.count({ where: { createdAt: { gte: since } } }),
    prisma.promoter.count(), prisma.promoter.count({ where: { createdAt: { gte: since } } }),
    prisma.offer.count({ where: { status: 'ACTIVE' } }), prisma.offer.count({ where: { createdAt: { gte: day } } }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.guestRequest.groupBy({ by: ['status'], _count: true }),
    prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  const c = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  res.json({ clubs, clubsNew, promoters, promotersNew, offers, offersToday, users, requests: { new: c.PENDING || 0, pending: c.PENDING || 0, confirmed: c.CONFIRMED || 0, rejected: c.REJECTED || 0 }, activity });
}));

/* ----- clubs & events ----- */
const clubBody = z.object({
  cityId: z.string(), name: z.string().min(2), address: z.string().min(2), area: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  about: z.string().optional(), dressCode: z.string().optional(), music: z.array(z.string()).default([]), images: z.array(z.string().url()).default([]),
  lat: z.coerce.number().optional(), lng: z.coerce.number().optional(), status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
r.get('/cities', wrap(async (req, res) => res.json(await prisma.city.findMany({ orderBy: { name: 'asc' } }))));
r.post('/cities', wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(2), isPopular: z.boolean().default(false) }), req.body);
  res.status(201).json(await prisma.city.create({ data: d }));
}));
r.get('/clubs', wrap(async (req, res) => {
  const where = { ...like(req.query.q, ['name', 'area']), ...(req.query.status && { status: req.query.status }) };
  const [items, total] = await Promise.all([
    prisma.club.findMany({ where, include: { city: true }, orderBy: { createdAt: 'desc' }, ...paging(req.query) }), prisma.club.count({ where }),
  ]);
  res.json({ items, total });
}));
r.post('/clubs', wrap(async (req, res) => {
  const c = await prisma.club.create({ data: parse(clubBody, req.body) });
  await logActivity(req.user, `Admin added new club '${c.name}'`, 'club', c.id);
  res.status(201).json(c);
}));
r.get('/clubs/:id', wrap(async (req, res) => {
  const c = await prisma.club.findUnique({ where: { id: req.params.id }, include: { city: true, events: { orderBy: { date: 'desc' }, take: 20 }, offers: { orderBy: { date: 'desc' }, take: 20 } } });
  if (!c) throw new ApiError(404, 'Club not found');
  res.json(c);
}));
r.put('/clubs/:id', wrap(async (req, res) => {
  const c = await prisma.club.update({ where: { id: req.params.id }, data: parse(clubBody.partial(), req.body) });
  await logActivity(req.user, `Club '${c.name}' updated`, 'club', c.id);
  res.json(c);
}));
r.delete('/clubs/:id', wrap(async (req, res) => { // soft delete keeps history intact
  await prisma.club.update({ where: { id: req.params.id }, data: { status: 'INACTIVE' } });
  res.json({ ok: true });
}));
r.post('/clubs/:id/events', wrap(async (req, res) => {
  const d = parse(z.object({ title: z.string().min(2), djName: z.string().optional(), date: z.string(), startTime: z.string().default('9:00 PM'), genre: z.string().optional(), poster: z.string().url().optional().or(z.literal('')) }), req.body);
  res.status(201).json(await prisma.event.create({ data: { ...d, date: new Date(d.date), clubId: req.params.id } }));
}));
r.delete('/events/:id', wrap(async (req, res) => { await prisma.event.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }));

/* ----- promoters ----- */
r.get('/promoters', wrap(async (req, res) => {
  const where = req.query.q ? { OR: [{ brand: { contains: req.query.q, mode: 'insensitive' } }, { user: { phone: { contains: req.query.q } } }] } : {};
  const [items, total] = await Promise.all([
    prisma.promoter.findMany({ where, include: { user: { select: { name: true, phone: true, email: true } }, _count: { select: { offers: true } } }, orderBy: { createdAt: 'desc' }, ...paging(req.query) }), prisma.promoter.count({ where }),
  ]);
  res.json({ items, total });
}));
r.post('/promoters', wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(2), phone: phoneS, email: z.string().email().optional().or(z.literal('')), brand: z.string().min(2), password: z.string().min(8) }), req.body);
  const user = await prisma.user.create({
    data: { role: 'PROMOTER', name: d.name, phone: d.phone, email: d.email || null, passwordHash: await bcrypt.hash(d.password, 10), promoter: { create: { brand: d.brand, company: d.brand } } },
    include: { promoter: true },
  });
  await logActivity(req.user, `Promoter '${d.brand}' registered`, 'promoter', user.promoter.id);
  res.status(201).json(publicUser(user));
}));
r.get('/promoters/:id', wrap(async (req, res) => {
  const p = await prisma.promoter.findUnique({ where: { id: req.params.id }, include: { user: true, offers: { orderBy: { date: 'desc' }, take: 20, include: { club: { select: { name: true } } } }, payouts: { orderBy: { createdAt: 'desc' }, take: 10 } } });
  if (!p) throw new ApiError(404, 'Promoter not found');
  const reqs = await prisma.guestRequest.groupBy({ by: ['status'], where: { offer: { promoterId: p.id } }, _count: true });
  const stats = Object.fromEntries(reqs.map((s) => [s.status, s._count]));
  res.json({ ...p, user: publicUser(p.user), stats: { total: reqs.reduce((s, x) => s + x._count, 0), confirmed: stats.CONFIRMED || 0 } });
}));
r.put('/promoters/:id', wrap(async (req, res) => {
  const d = parse(z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(), brand: z.string().optional(), password: z.string().min(8).optional() }), req.body);
  const p = await prisma.promoter.update({ where: { id: req.params.id }, data: { ...(d.status && { status: d.status }), ...(d.brand && { brand: d.brand }) } });
  if (d.password) await prisma.user.update({ where: { id: p.userId }, data: { passwordHash: await bcrypt.hash(d.password, 10) } });
  if (d.status) await logActivity(req.user, `Promoter '${p.brand}' set ${d.status.toLowerCase()}`, 'promoter', p.id);
  res.json(p);
}));

/* ----- offers ----- */
const offerInc = { club: { select: { name: true } }, promoter: { select: { brand: true } }, _count: { select: { requests: true } } };
r.get('/offers', wrap(async (req, res) => {
  const { status, q } = req.query;
  const where = { ...(status && status !== 'ALL' && { status }), ...(q && { OR: [{ title: { contains: q, mode: 'insensitive' } }, { club: { name: { contains: q, mode: 'insensitive' } } }] }) };
  const [items, total] = await Promise.all([prisma.offer.findMany({ where, include: offerInc, orderBy: { date: 'desc' }, ...paging(req.query) }), prisma.offer.count({ where })]);
  res.json({ items, total });
}));
r.get('/offers/:id', wrap(async (req, res) => {
  const o = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { ...offerInc, event: true, club: true } });
  if (!o) throw new ApiError(404, 'Offer not found');
  const confirmed = await prisma.guestRequest.count({ where: { offerId: o.id, status: 'CONFIRMED' } });
  res.json({ ...o, confirmed });
}));
const offerBody = z.object({
  clubId: z.string(), promoterId: z.string(), eventId: z.string().nullable().optional(), date: z.string(), entryType: z.string(), offerType: z.string(),
  price: z.coerce.number().int().min(0).default(0), entryBefore: z.string().default('9:00 PM'), inclusions: z.array(z.string()).default([]),
  terms: z.string().optional(), description: z.string().optional(), status: z.enum(['ACTIVE', 'UPCOMING', 'EXPIRED', 'DRAFT', 'INACTIVE']).default('ACTIVE'),
});
r.post('/offers', wrap(async (req, res) => {
  const d = parse(offerBody, req.body);
  const club = await prisma.club.findUnique({ where: { id: d.clubId } });
  if (!club) throw new ApiError(400, 'Invalid club');
  const o = await prisma.offer.create({ data: { ...d, date: new Date(d.date), title: `${d.offerType} · ${d.entryType} @ ${club.name}` } });
  await logActivity(req.user, `Offer '${o.title}' created`, 'offer', o.id);
  res.status(201).json(o);
}));
r.put('/offers/:id', wrap(async (req, res) => {
  const d = parse(offerBody.partial(), req.body);
  res.json(await prisma.offer.update({ where: { id: req.params.id }, data: { ...d, ...(d.date && { date: new Date(d.date) }) } }));
}));
r.patch('/offers/:id/status', wrap(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'DRAFT', 'UPCOMING']) }), req.body);
  const o = await prisma.offer.update({ where: { id: req.params.id }, data: { status } });
  await logActivity(req.user, `Offer '${o.title}' ${status.toLowerCase()}`, 'offer', o.id);
  res.json(o);
}));

/* ----- guestlist requests (admin can act on any request) ----- */
const reqInc = { user: { select: { name: true, phone: true, avatar: true } }, offer: { include: { club: { select: { name: true } }, promoter: { select: { brand: true } } } } };
r.get('/requests', wrap(async (req, res) => {
  const tab = req.query.tab, where = {};
  if (tab === 'new') Object.assign(where, { status: 'PENDING', createdAt: { gte: new Date(Date.now() - 86400000) } });
  else if (['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'].includes(tab)) where.status = tab;
  const [items, counts] = await Promise.all([
    prisma.guestRequest.findMany({ where, include: reqInc, orderBy: { createdAt: 'desc' }, ...paging(req.query) }),
    prisma.guestRequest.groupBy({ by: ['status'], _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  res.json({ items, counts: { pending: c.PENDING || 0, all: counts.reduce((s, x) => s + x._count, 0) } });
}));
r.get('/requests/:id', wrap(async (req, res) => {
  const g = await prisma.guestRequest.findUnique({ where: { id: req.params.id }, include: reqInc });
  if (!g) throw new ApiError(404, 'Request not found');
  res.json(g);
}));
r.post('/requests/:id/decision', wrap(async (req, res) => {
  const d = parse(z.object({ action: z.enum(['ACCEPT', 'REJECT']), reason: z.string().optional(), note: z.string().max(300).optional() }), req.body);
  res.json(await decide(req.params.id, d.action, { ...d, actor: req.user }));
}));

/* ----- users ----- */
r.get('/users', wrap(async (req, res) => {
  const where = { role: 'USER', ...like(req.query.q, ['name', 'phone', 'email']) };
  const [items, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...paging(req.query) }), prisma.user.count({ where })]);
  res.json({ items: items.map(publicUser), total });
}));
r.patch('/users/:id/status', wrap(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }), req.body);
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  await logActivity(req.user, `User ${u.phone || u.email} set ${status.toLowerCase()}`, 'user', u.id);
  res.json(publicUser(u));
}));

/* ----- analytics ----- */
r.get('/analytics', wrap(async (req, res) => res.json(await analytics({}, req.query.range === 'month' ? 30 : 7))));

/* ----- payouts ----- */
r.get('/payouts', wrap(async (req, res) => {
  const where = req.query.status && req.query.status !== 'ALL' ? { status: req.query.status } : {};
  res.json(await prisma.payout.findMany({ where, include: { promoter: { select: { brand: true, logo: true } } }, orderBy: { createdAt: 'desc' }, ...paging(req.query) }));
}));
r.post('/payouts', wrap(async (req, res) => {
  const d = parse(z.object({ promoterId: z.string(), amount: z.coerce.number().int().positive() }), req.body);
  res.status(201).json(await prisma.payout.create({ data: d }));
}));
r.patch('/payouts/:id/pay', wrap(async (req, res) => {
  const p = await prisma.payout.update({ where: { id: req.params.id }, data: { status: 'PAID', paidAt: new Date() } });
  await logActivity(req.user, `Payout of ₹${p.amount} marked paid`, 'payout', p.id);
  res.json(p);
}));

/* ----- settings, roles, logs, support, notifications ----- */
r.get('/settings', wrap(async (req, res) => {
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((s) => [s.key, s.value])));
}));
r.put('/settings/:key', wrap(async (req, res) => {
  const row = await prisma.setting.upsert({ where: { key: req.params.key }, create: { key: req.params.key, value: req.body.value }, update: { value: req.body.value } });
  await logActivity(req.user, `Setting '${row.key}' updated`, 'setting', row.key);
  res.json(row);
}));
r.post('/change-password', wrap(async (req, res) => {
  const d = parse(z.object({ current: z.string(), next: z.string().min(8) }), req.body);
  if (!req.user.passwordHash || !(await bcrypt.compare(d.current, req.user.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(d.next, 10) } });
  res.json({ ok: true });
}));
const roleBody = z.object({ name: z.string().min(2), description: z.string().optional(), permissions: z.array(z.string()).default([]) });
r.get('/roles', wrap(async (req, res) => res.json(await prisma.roleDef.findMany({ orderBy: { name: 'asc' } }))));
r.post('/roles', wrap(async (req, res) => res.status(201).json(await prisma.roleDef.create({ data: parse(roleBody, req.body) }))));
r.put('/roles/:id', wrap(async (req, res) => res.json(await prisma.roleDef.update({ where: { id: req.params.id }, data: parse(roleBody.partial(), req.body) }))));
r.delete('/roles/:id', wrap(async (req, res) => { await prisma.roleDef.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }));
r.get('/activity-logs', wrap(async (req, res) => {
  res.json(await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, ...paging({ limit: 50, ...req.query }) }));
}));
r.get('/notifications', wrap(async (req, res) => {
  res.json(await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }));
}));
r.get('/tickets', wrap(async (req, res) => {
  const where = req.query.status && req.query.status !== 'ALL' ? { status: req.query.status } : {};
  res.json(await prisma.ticket.findMany({ where, include: { user: { select: { name: true, phone: true } } }, orderBy: { createdAt: 'desc' }, ...paging(req.query) }));
}));
r.patch('/tickets/:id', wrap(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']) }), req.body);
  res.json(await prisma.ticket.update({ where: { id: req.params.id }, data: { status } }));
}));

export default r;
