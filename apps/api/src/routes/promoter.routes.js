import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, paging, startOfDay, addDays, publicUser } from '../lib/http.js';
import { decide, analytics } from '../services/guestlist.js';

// Mounted behind authenticate + authorize('PROMOTER') + loadPromoter.
// EVERY query below is scoped to req.promoter.id — never trust ids from the client alone.
const r = Router();
const reqInclude = { user: { select: { id: true, name: true, phone: true, avatar: true } }, offer: { include: { club: { select: { id: true, name: true, area: true, address: true, images: true } }, event: { select: { id: true, title: true, date: true, startTime: true, djName: true, genre: true, poster: true } } } } };
const mine = (req) => ({ offer: { promoterId: req.promoter.id } });

r.get('/dashboard', wrap(async (req, res) => {
  const where = mine(req);
  const [fresh, confirmed, upcomingOffers, activeOffers] = await Promise.all([
    prisma.guestRequest.count({ where: { ...where, status: 'PENDING', seenAt: null } }),
    prisma.guestRequest.count({ where: { ...where, status: 'CONFIRMED' } }),
    prisma.offer.findMany({
      where: { promoterId: req.promoter.id, status: 'ACTIVE', date: { gte: startOfDay() } },
      include: { club: { select: { id: true, name: true, images: true } }, event: { select: { id: true, title: true } }, _count: { select: { requests: true } } }, orderBy: { date: 'asc' },
    }),
    prisma.offer.count({ where: { promoterId: req.promoter.id, status: 'ACTIVE', date: { gte: startOfDay() } } }),
  ]);
  const upcomingByEvent = new Map();
  for (const offer of upcomingOffers) {
    const date = offer.date.toISOString().slice(0, 10);
    const key = offer.eventId || `${offer.clubId}:${date}`;
    const group = upcomingByEvent.get(key) || { id: key, eventId: offer.eventId, clubId: offer.club.id, club: offer.club.name, event: offer.event?.title || 'Guestlist', date, requests: 0 };
    group.requests += offer._count.requests;
    upcomingByEvent.set(key, group);
  }
  res.json({
    name: req.user.name || req.promoter.brand, newRequests: fresh, confirmed,
    activeOffers,
    upcoming: [...upcomingByEvent.values()],
  });
}));

/* ----- offers ----- */
r.get('/clubs', wrap(async (req, res) => {
  res.json(await prisma.club.findMany({
    where: { status: 'ACTIVE' }, orderBy: { name: 'asc' },
    select: { id: true, name: true, area: true, events: { where: { date: { gte: startOfDay() } }, orderBy: { date: 'asc' }, select: { id: true, title: true, djName: true, date: true, startTime: true, genre: true, poster: true } } },
  }));
}));
// Matching event title and club/date reuse one shared event across promoters.
r.post('/events', wrap(async (req, res) => {
  const d = parse(z.object({ clubId: z.string(), title: z.string().min(2), djName: z.string().optional(), date: z.string(), startTime: z.string().default('9:00 PM'), genre: z.string().optional(), poster: z.string().url().optional().or(z.literal('')) }), req.body);
  const club = await prisma.club.findFirst({ where: { id: d.clubId, status: 'ACTIVE' } });
  if (!club) throw new ApiError(400, 'Select an active club');
  const date = new Date(d.date), from = startOfDay(date), to = addDays(from, 1);
  const existing = await prisma.event.findFirst({ where: { clubId: club.id, title: { equals: d.title, mode: 'insensitive' }, date: { gte: from, lt: to } } });
  if (existing) {
    if (d.poster && !existing.poster) return res.json(await prisma.event.update({ where: { id: existing.id }, data: { poster: d.poster } }));
    return res.json(existing);
  }
  res.status(201).json(await prisma.event.create({ data: { ...d, date, clubId: club.id } }));
}));
const offerBody = z.object({
  clubId: z.string(), eventId: z.string().nullable().optional(), date: z.string(), entryType: z.string(), offerType: z.string(),
  entryTypes: z.array(z.string()).min(1).default([]),
  price: z.coerce.number().int().min(0).default(0), entryFrom: z.string().default('9:00 PM'), entryBefore: z.string().default('11:00 PM'), limitedSlots: z.boolean().default(false),
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
  if (d.eventId && !await prisma.event.findFirst({ where: { id: d.eventId, clubId: club.id } })) throw new ApiError(400, 'Event does not belong to the selected club');
  const entryTypes = d.entryTypes.length ? d.entryTypes : [d.entryType];
  res.status(201).json(await prisma.offer.create({ data: { ...d, entryTypes, entryType: entryTypes.join(', '), date: new Date(d.date), title: titleOf(d, club.name), promoterId: req.promoter.id } }));
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
  res.json(await prisma.offer.update({ where: { id: own.id }, data: { ...rest, ...(d.entryTypes?.length && { entryType: d.entryTypes.join(', ') }), ...(d.date && { date: new Date(d.date) }) } }));
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
  const date = req.query.eventId || (req.query.clubId && req.query.date) ? undefined : t === 'tonight' ? { gte: today, lt: addDays(today, 1) } : t === 'upcoming' ? { gte: addDays(today, 1) } : { lt: today };
  return { offer: { promoterId: req.promoter.id, ...(date && { date }), ...(req.query.eventId && { eventId: String(req.query.eventId) }), ...(req.query.clubId && { clubId: String(req.query.clubId) }), ...(req.query.date && !req.query.eventId && { date: { gte: startOfDay(String(req.query.date)), lt: addDays(startOfDay(String(req.query.date)), 1) } }) }, status: { in: ['CONFIRMED', 'PENDING'] } };
};
r.get('/guestlist/events', wrap(async (req, res) => {
  const today = startOfDay(), tab = req.query.tab || 'tonight';
  const date = tab === 'tonight' ? { gte: today, lt: addDays(today, 1) } : tab === 'upcoming' ? { gte: addDays(today, 1) } : { lt: today };
  const offers = await prisma.offer.findMany({
    where: { promoterId: req.promoter.id, date, status: { not: 'DRAFT' } },
    include: {
      club: { select: { id: true, name: true, area: true, address: true, images: true } },
      event: { select: { id: true, title: true, date: true, startTime: true, djName: true, genre: true, poster: true } },
      requests: { where: { status: { in: ['CONFIRMED', 'PENDING'] } }, select: { guestCount: true, status: true } },
    },
    orderBy: { date: 'asc' },
  });
  const groups = new Map();
  for (const offer of offers) {
    const dateKey = offer.date.toISOString().slice(0, 10);
    const key = offer.eventId || `${offer.clubId}:${dateKey}`;
    const group = groups.get(key) || {
      key, eventId: offer.eventId, clubId: offer.clubId, club: offer.club,
      event: offer.event || { id: null, title: 'Guestlist', date: offer.date, startTime: offer.entryFrom, djName: null, genre: null, poster: null },
      banner: offer.event?.poster || offer.club.images?.[0] || null,
      offers: [], bookings: 0, confirmedBookings: 0, confirmedGuests: 0, pendingBookings: 0, pendingGuests: 0,
    };
    group.offers.push({ id: offer.id, offerType: offer.offerType, entryType: offer.entryType, entryTypes: offer.entryTypes, price: offer.price, entryFrom: offer.entryFrom, entryBefore: offer.entryBefore, inclusions: offer.inclusions, terms: offer.terms });
    for (const request of offer.requests) {
      group.bookings++;
      if (request.status === 'CONFIRMED') { group.confirmedBookings++; group.confirmedGuests += request.guestCount; }
      else { group.pendingBookings++; group.pendingGuests += request.guestCount; }
    }
    groups.set(key, group);
  }
  res.json([...groups.values()]);
}));
r.get('/guestlist/event-details', wrap(async (req, res) => {
  const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
  const clubId = req.query.clubId ? String(req.query.clubId) : undefined;
  const from = req.query.date ? startOfDay(String(req.query.date)) : undefined;
  if (!eventId && !(clubId && from)) throw new ApiError(400, 'Select an event or club date');
  const offers = await prisma.offer.findMany({
    where: { promoterId: req.promoter.id, status: { not: 'DRAFT' }, ...(eventId && { eventId }), ...(clubId && { clubId }), ...(from && { date: { gte: from, lt: addDays(from, 1) } }) },
    include: { club: true, event: true }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  if (!offers.length) throw new ApiError(404, 'Event guestlist not found');
  const requestRows = await prisma.guestRequest.findMany({ where: { offerId: { in: offers.map((offer) => offer.id) }, status: { in: ['CONFIRMED', 'PENDING'] } }, include: reqInclude, orderBy: { createdAt: 'asc' } });
  res.json({ event: offers[0].event, club: offers[0].club, offers: offers.map(({ club, event, ...offer }) => offer), requests: requestRows });
}));
r.get('/guestlist', wrap(async (req, res) => {
  res.json(await prisma.guestRequest.findMany({ where: guestlistWhere(req), include: reqInclude, orderBy: { createdAt: 'asc' } }));
}));
r.post('/guestlist/:id/check-in', wrap(async (req, res) => {
  const request = await prisma.guestRequest.findFirst({ where: { id: req.params.id, ...mine(req) }, include: reqInclude });
  if (!request) throw new ApiError(404, 'Guestlist request not found');
  if (request.status !== 'CONFIRMED') throw new ApiError(400, 'Only confirmed guests can be checked in');
  if (request.checkedInAt) return res.json(request);
  res.json(await prisma.guestRequest.update({ where: { id: request.id }, data: { checkedInAt: new Date() }, include: reqInclude }));
}));
r.get('/guestlist/export', wrap(async (req, res) => {
  const where = guestlistWhere(req);
  where.offer = {
    ...where.offer,
    ...(req.query.eventId && { eventId: String(req.query.eventId) }),
    ...(req.query.clubId && { clubId: String(req.query.clubId) }),
    ...(req.query.date && (() => { const from = startOfDay(String(req.query.date)); return { date: { gte: from, lt: addDays(from, 1) } }; })()),
  };
  const rows = await prisma.guestRequest.findMany({ where, include: reqInclude, orderBy: { createdAt: 'asc' } });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Code,Name,Phone,Club,Event,Date,Guests,Entry,Arrive Before,Status,Checked In At', ...rows.map((g) => [g.code, g.user.name, g.user.phone, g.offer.club.name, g.offer.event?.title || '', g.offer.date.toISOString().slice(0, 10), g.guestCount, g.offer.entryType, g.offer.entryBefore, g.status, g.checkedInAt?.toISOString() || ''].map(esc).join(','))].join('\n');
  res.type('text/csv').attachment('guestlist.csv').send(csv);
}));

/* ----- analytics & profile ----- */
r.get('/analytics', wrap(async (req, res) => {
  res.json(await analytics(mine(req), req.query.range === 'month' ? 30 : 7));
}));
r.get('/profile', wrap(async (req, res) => {
  const rows = await prisma.offer.findMany({ where: { promoterId: req.promoter.id }, select: { clubId: true, club: { select: { id: true, name: true } } }, distinct: ['clubId'] });
  res.json({ ...publicUser(req.user), promoter: req.promoter, clubs: rows.map((x) => x.club) });
}));
r.put('/profile', wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(2).optional(), email: z.string().email().optional(), avatar: z.string().url().optional().or(z.literal('')), brand: z.string().min(2).optional(), instagram: z.string().max(100).optional() }), req.body);
  const { brand, instagram, ...u } = d;
  if (brand || instagram !== undefined) await prisma.promoter.update({ where: { id: req.promoter.id }, data: { ...(brand && { brand }), ...(instagram !== undefined && { instagram }) } });
  res.json(publicUser(await prisma.user.update({ where: { id: req.user.id }, data: u })));
}));
r.post('/change-password', wrap(async (req, res) => {
  const d = parse(z.object({ current: z.string().optional(), next: z.string().min(8) }), req.body);
  if (!req.user.mustChangePassword && (!d.current || !req.user.passwordHash || !(await bcrypt.compare(d.current, req.user.passwordHash)))) throw new ApiError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(d.next, 10), mustChangePassword: false } });
  res.json({ ok: true });
}));

export default r;
