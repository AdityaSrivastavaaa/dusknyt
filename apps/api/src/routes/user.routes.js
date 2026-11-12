import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, paging, startOfDay, addDays, publicUser } from '../lib/http.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createRequest } from '../services/guestlist.js';

const r = Router();
const auth = [authenticate, authorize('USER')];
const offerInclude = { club: { select: { id: true, name: true, area: true, images: true } }, promoter: { select: { brand: true, logo: true } } };
const withPrice = (c) => ({ ...c, startingPrice: c.offers?.length ? Math.min(...c.offers.map((o) => o.price)) : null, offerCount: c.offers?.length || 0, offers: undefined });
const cityWhere = (city) => (city ? { city: { name: { equals: city, mode: 'insensitive' } } } : {});

/* ---------- public discovery ---------- */
r.get('/cities', wrap(async (req, res) => {
  res.json(await prisma.city.findMany({ orderBy: [{ isPopular: 'desc' }, { name: 'asc' }] }));
}));

r.get('/home', wrap(async (req, res) => {
  const base = { status: 'ACTIVE', ...cityWhere(req.query.city) };
  const inc = { offers: { where: { status: 'ACTIVE' }, select: { price: true } } };
  const today = startOfDay();
  const [highlights, trending] = await Promise.all([
    prisma.club.findMany({ where: { ...base, offers: { some: { status: 'ACTIVE', date: { gte: today, lt: addDays(today, 1) } } } }, include: inc, take: 8 }),
    prisma.club.findMany({ where: base, include: inc, orderBy: { rating: 'desc' }, take: 8 }),
  ]);
  const fill = highlights.length ? highlights : trending.slice(0, 5);
  res.json({ highlights: fill.map(withPrice), trending: trending.map(withPrice) });
}));

r.get('/clubs', wrap(async (req, res) => {
  const { city, q, music, maxPrice, entryType, date } = req.query;
  const of = { status: 'ACTIVE' };
  if (maxPrice) of.price = { lte: +maxPrice };
  if (entryType) of.entryType = { in: String(entryType).split(',') };
  if (date) { const d = startOfDay(date); of.date = { gte: d, lt: addDays(d, 1) }; }
  const where = {
    status: 'ACTIVE', ...cityWhere(city),
    ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { area: { contains: q, mode: 'insensitive' } }] }),
    ...(music && { music: { hasSome: String(music).split(',') } }),
    ...((maxPrice || entryType || date) && { offers: { some: of } }),
  };
  const clubs = await prisma.club.findMany({ where, ...paging(req.query), orderBy: { rating: 'desc' }, include: { offers: { where: { status: 'ACTIVE' }, select: { price: true } } } });
  res.json(clubs.map(withPrice));
}));

r.get('/clubs/:id', wrap(async (req, res) => {
  const club = await prisma.club.findFirst({
    where: { id: req.params.id, status: 'ACTIVE' },
    include: { city: true, events: { where: { date: { gte: startOfDay() } }, orderBy: { date: 'asc' }, take: 20 } },
  });
  if (!club) throw new ApiError(404, 'Club not found');
  res.json(club);
}));
r.get('/clubs/:id/events', wrap(async (req, res) => {
  res.json(await prisma.event.findMany({ where: { clubId: req.params.id, date: { gte: startOfDay() } }, orderBy: { date: 'asc' } }));
}));
r.get('/clubs/:id/offers', wrap(async (req, res) => {
  const { eventId, sort } = req.query;
  res.json(await prisma.offer.findMany({
    where: { clubId: req.params.id, status: 'ACTIVE', ...(eventId && { eventId }) },
    include: offerInclude, orderBy: sort === 'price' ? { price: 'asc' } : { createdAt: 'desc' },
  }));
}));
r.get('/offers', wrap(async (req, res) => {
  res.json(await prisma.offer.findMany({
    where: { status: 'ACTIVE', club: { status: 'ACTIVE', ...cityWhere(req.query.city) } },
    include: offerInclude, orderBy: req.query.sort === 'price' ? { price: 'asc' } : { date: 'asc' }, ...paging(req.query),
  }));
}));
r.get('/offers/:id', wrap(async (req, res) => {
  const o = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { ...offerInclude, event: true } });
  if (!o) throw new ApiError(404, 'Offer not found');
  res.json(o);
}));

/* ---------- profile ---------- */
r.get('/me', ...auth, (req, res) => res.json(publicUser(req.user)));
r.put('/me', ...auth, wrap(async (req, res) => {
  const d = parse(z.object({
    name: z.string().min(2).optional(), email: z.string().email().optional().or(z.literal('')),
    dob: z.string().optional().or(z.literal('')), avatar: z.string().url().optional().or(z.literal('')),
  }), req.body);
  const u = await prisma.user.update({
    where: { id: req.user.id },
    data: { ...(d.name && { name: d.name }), ...(d.email !== undefined && { email: d.email || null }), ...(d.dob && { dob: new Date(d.dob) }), ...(d.avatar !== undefined && { avatar: d.avatar || null }) },
  });
  res.json(publicUser(u));
}));

/* ---------- guestlist requests ---------- */
const reqInclude = { offer: { include: { club: { select: { id: true, name: true, area: true, images: true } }, promoter: { select: { brand: true } } } } };
r.post('/guestlist', ...auth, wrap(async (req, res) => {
  if (!req.user.name) throw new ApiError(400, 'Complete your profile first');
  const d = parse(z.object({
    offerId: z.string(), note: z.string().max(300).optional(),
    guests: z.array(z.object({ name: z.string().min(1), gender: z.string().optional() })).min(1).max(10),
  }), req.body);
  res.status(201).json(await createRequest(req.user, d));
}));
r.get('/guestlist', ...auth, wrap(async (req, res) => {
  const today = startOfDay();
  const tab = req.query.status;
  const where = { userId: req.user.id };
  if (tab === 'upcoming') Object.assign(where, { status: 'CONFIRMED', offer: { date: { gte: today } } });
  else if (tab === 'pending') where.status = 'PENDING';
  else if (tab === 'past') where.OR = [{ status: { in: ['REJECTED', 'EXPIRED'] } }, { status: 'CONFIRMED', offer: { date: { lt: today } } }];
  res.json(await prisma.guestRequest.findMany({ where, include: reqInclude, orderBy: { createdAt: 'desc' }, ...paging(req.query) }));
}));
r.get('/guestlist/:id', ...auth, wrap(async (req, res) => {
  const g = await prisma.guestRequest.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: reqInclude });
  if (!g) throw new ApiError(404, 'Request not found');
  res.json(g);
}));

/* ---------- saved ---------- */
r.get('/saved/ids', ...auth, wrap(async (req, res) => {
  const rows = await prisma.saved.findMany({ where: { userId: req.user.id } });
  res.json({ clubs: rows.filter((s) => s.clubId).map((s) => s.clubId), offers: rows.filter((s) => s.offerId).map((s) => s.offerId) });
}));
r.get('/saved', ...auth, wrap(async (req, res) => {
  const type = req.query.type === 'offers' ? 'offers' : 'clubs';
  if (type === 'clubs') {
    const rows = await prisma.saved.findMany({ where: { userId: req.user.id, clubId: { not: null } }, include: { club: { include: { offers: { where: { status: 'ACTIVE' }, select: { price: true } } } } } });
    return res.json(rows.map((s) => withPrice(s.club)));
  }
  const rows = await prisma.saved.findMany({ where: { userId: req.user.id, offerId: { not: null } }, include: { offer: { include: offerInclude } } });
  res.json(rows.map((s) => s.offer));
}));
r.post('/saved/toggle', ...auth, wrap(async (req, res) => {
  const { clubId, offerId } = parse(z.object({ clubId: z.string().optional(), offerId: z.string().optional() }), req.body);
  if (!clubId && !offerId) throw new ApiError(400, 'clubId or offerId required');
  const where = { userId: req.user.id, ...(clubId ? { clubId } : { offerId }) };
  const ex = await prisma.saved.findFirst({ where });
  if (ex) { await prisma.saved.delete({ where: { id: ex.id } }); return res.json({ saved: false }); }
  await prisma.saved.create({ data: where });
  res.json({ saved: true });
}));

/* ---------- notifications & support ---------- */
r.get('/notifications', ...auth, wrap(async (req, res) => {
  res.json(await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }));
}));
r.post('/notifications/read-all', ...auth, wrap(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ ok: true });
}));
r.post('/support', ...auth, wrap(async (req, res) => {
  const d = parse(z.object({ subject: z.string().min(3), message: z.string().min(5) }), req.body);
  res.status(201).json(await prisma.ticket.create({ data: { ...d, userId: req.user.id } }));
}));

export default r;
