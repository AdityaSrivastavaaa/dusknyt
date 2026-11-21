import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, wrap, parse, paging, startOfDay, addDays, publicUser } from '../lib/http.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createRequest } from '../services/guestlist.js';
import { arrivalSessionWindow, indiaStartOfDay } from '../lib/offer-time.js';
import { createSupportTicket, supportTicketInclude, supportTicketDetailInclude } from '../lib/support.js';
import { supportLimiter } from '../lib/rate-limit.js';
import { isAtLeast21 } from '@dusknyt/shared';

const r = Router();
const adultOnly = (req, res, next) => isAtLeast21(req.user.dob) ? next() : next(new ApiError(403, 'DUSKNYT is available only to users aged 21 or older. Add your date of birth to continue.'));
const auth = [authenticate, authorize('USER'), adultOnly];
const offerInclude = { club: { select: { id: true, name: true, area: true, address: true, images: true } }, promoter: { select: { id: true, brand: true, logo: true } }, event: { select: { title: true, date: true, startTime: true, djName: true, genre: true, poster: true, status: true } } };
const withoutPromoterPhone = (offer) => { const { contactPhone: _contactPhone, shareContact: _shareContact, ...publicOffer } = offer; return publicOffer; };
const withPrice = (c) => ({ ...c, startingPrice: c.offers?.length ? Math.min(...c.offers.map((o) => o.price)) : null, offerCount: c.offers?.length || 0, offers: undefined });
const cityWhere = (city) => (city ? { city: { name: { equals: city, mode: 'insensitive' } } } : {});


r.get('/cities/with-clubs', wrap(async (req, res) => {
  const clubs = await prisma.club.findMany({
    where: { status: 'ACTIVE' },
    select: {
      city: {
        select: { id: true, name: true },
      },
    },
    distinct: ['cityId'],
  });

  res.json(
    clubs
      .map((club) => club.city)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}));

/* ---------- public discovery ---------- */
r.get('/cities', wrap(async (req, res) => {
  res.json(await prisma.city.findMany({ orderBy: [{ isPopular: 'desc' }, { name: 'asc' }] }));
}));

r.get('/home', wrap(async (req, res) => {
  const base = { status: 'ACTIVE', ...cityWhere(req.query.city) };
  const inc = { offers: { where: { status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }] }, select: { price: true } } };
  const today = startOfDay();
  const [highlights, trending] = await Promise.all([
    prisma.club.findMany({ where: { ...base, offers: { some: { status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }], date: { gte: today, lt: addDays(today, 1) } } } }, include: inc, take: 8 }),
    prisma.club.findMany({ where: base, include: inc, orderBy: { rating: 'desc' }, take: 8 }),
  ]);
  const fill = highlights.length ? highlights : trending.slice(0, 5);
  res.json({ highlights: fill.map(withPrice), trending: trending.map(withPrice) });
}));

r.get('/clubs', wrap(async (req, res) => {
  const { city, q, music, maxPrice, entryType, date } = req.query;
  const offerFilters = [{ OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }] }];
  const of = { status: 'ACTIVE' };
  if (maxPrice) of.price = { lte: +maxPrice };
  if (entryType) offerFilters.push({ OR: [{ entryTypes: { hasSome: String(entryType).split(',') } }, { entryType: { in: String(entryType).split(',') } }] });
  if (date) { const d = startOfDay(date); of.date = { gte: d, lt: addDays(d, 1) }; }
  if (maxPrice || entryType || date) of.AND = offerFilters;
  const where = {
    status: 'ACTIVE', ...cityWhere(city),
    ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { area: { contains: q, mode: 'insensitive' } }] }),
    ...(music && { music: { hasSome: String(music).split(',') } }),
    ...((maxPrice || entryType || date) && { offers: { some: of } }),
  };
  const clubs = await prisma.club.findMany({ where, ...paging(req.query), orderBy: { rating: 'desc' }, include: { offers: { where: { status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }] }, select: { price: true } } } });
  res.json(clubs.map(withPrice));
}));

r.get('/clubs/:id', wrap(async (req, res) => {
  const club = await prisma.club.findFirst({
    where: { id: req.params.id, status: 'ACTIVE' },
    include: { city: true, events: { where: { status: 'ACTIVE', date: { gte: startOfDay() }, offers: { some: { status: 'ACTIVE' } } }, orderBy: { date: 'asc' }, take: 20 } },
  });
  if (!club) throw new ApiError(404, 'Club not found');
  res.json(club);
}));
r.get('/clubs/:id/events', wrap(async (req, res) => {
  res.json(await prisma.event.findMany({ where: { clubId: req.params.id, status: 'ACTIVE', date: { gte: startOfDay() }, offers: { some: { status: 'ACTIVE' } } }, include: { club: { select: { name: true, address: true, area: true } } }, orderBy: { date: 'asc' } }));
}));
r.get('/clubs/:id/offers', wrap(async (req, res) => {
  const { eventId, date, entryType, maxPrice, music, sort } = req.query;
  const eventDate = date ? startOfDay(date) : null;
  const entryTypes = entryType ? String(entryType).split(',').filter(Boolean) : [];
  const musicTypes = music ? String(music).split(',').filter(Boolean) : [];
  const matchingFilters = [];
  if (entryTypes.length) matchingFilters.push({ OR: [{ entryTypes: { hasSome: entryTypes } }, { entryType: { in: entryTypes } }] });
  if (musicTypes.length) {
    const genreFilters = musicTypes.map((genre) => ({ event: { is: { genre: { contains: genre, mode: 'insensitive' } } } }));
    matchingFilters.push({ OR: [...genreFilters, { eventId: null }] });
  }
  const where = {
    clubId: req.params.id,
    status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }],
    ...(eventId && { eventId }),
    ...(eventDate && { date: { gte: eventDate, lt: addDays(eventDate, 1) } }),
    ...(matchingFilters.length && { AND: matchingFilters }),
    ...(maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice)) && { price: { lte: Number(maxPrice) } }),
  };
  res.json((await prisma.offer.findMany({
    where,
    include: offerInclude, orderBy: sort === 'price' ? { price: 'asc' } : { createdAt: 'desc' },
  })).map(withoutPromoterPhone));
}));
r.get('/offers', wrap(async (req, res) => {
  res.json((await prisma.offer.findMany({
    where: { status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }], club: { status: 'ACTIVE', ...cityWhere(req.query.city) } },
    include: offerInclude, orderBy: req.query.sort === 'price' ? { price: 'asc' } : { date: 'asc' }, ...paging(req.query),
  })).map(withoutPromoterPhone));
}));
r.get('/offers/:id', wrap(async (req, res) => {
  const o = await prisma.offer.findFirst({ where: { id: req.params.id, status: 'ACTIVE', OR: [{ eventId: null }, { event: { is: { status: 'ACTIVE' } } }] }, include: { ...offerInclude, event: true } });
  if (!o) throw new ApiError(404, 'Offer not found');
  res.json(withoutPromoterPhone(o));
}));

/* ---------- profile ---------- */
r.get('/me', authenticate, authorize('USER'), (req, res) => res.json(publicUser(req.user)));
r.put('/me', authenticate, authorize('USER'), wrap(async (req, res) => {
  const d = parse(z.object({
    name: z.string().min(2).optional(), email: z.string().email().optional().or(z.literal('')),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isAtLeast21, 'DUSKNYT is available only to users aged 21 or older.'), avatar: z.string().url().optional().or(z.literal('')),
  }), req.body);
  const u = await prisma.user.update({
    where: { id: req.user.id },
    data: { ...(d.name && { name: d.name }), ...(d.email !== undefined && { email: d.email || null }), ...(d.dob && { dob: new Date(d.dob) }), ...(d.avatar !== undefined && { avatar: d.avatar || null }) },
  });
  res.json(publicUser(u));
}));

/* ---------- guestlist requests ---------- */
const reqInclude = { offer: { include: { club: { select: { id: true, name: true, area: true, images: true } }, promoter: { select: { brand: true } }, event: { select: { title: true, date: true, startTime: true, djName: true, genre: true, poster: true, status: true } } } } };
const requestDetailInclude = { rating: true, offer: { include: { club: { select: { id: true, name: true, area: true, images: true } }, promoter: { select: { brand: true } }, event: { select: { title: true, date: true, startTime: true, djName: true, genre: true, poster: true, status: true } } } } };
function withArrivalSession(request, now = Date.now()) {
  const { offer, ...rest } = request;
  const { contactPhone: _contactPhone, shareContact: _shareContact, promoter, ...publicOffer } = offer;
  const { opensAt, closesAt } = arrivalSessionWindow(offer);
  const opened = request.status === 'CONFIRMED' && opensAt && now >= opensAt.getTime() && closesAt && now < closesAt.getTime();
  return {
    ...rest,
    offer: { ...publicOffer, promoter },
    arrivalSession: { available: Boolean(opened), opensAt: opensAt?.toISOString() || null, closesAt: closesAt?.toISOString() || null },
  };
}
r.post('/guestlist', ...auth, wrap(async (req, res) => {
  if (!req.user.name) throw new ApiError(400, 'Complete your profile first');
  const d = parse(z.object({
    offerId: z.string(), note: z.string().max(300).optional(),
    guests: z.array(z.object({ name: z.string().min(1), gender: z.string().optional() })).min(1).max(10),
  }), req.body);
  res.status(201).json(await createRequest(req.user, d));
}));
r.get('/guestlist', ...auth, wrap(async (req, res) => {
  // Offers store calendar dates as UTC-midnight timestamps. Compare them against
  // India's calendar day, independent of the API server's timezone.
  const today = indiaStartOfDay();
  const tab = req.query.status;
  const where = { userId: req.user.id };
  if (tab === 'upcoming') Object.assign(where, { status: 'CONFIRMED', offer: { date: { gte: today } } });
  else if (tab === 'pending') where.status = 'PENDING';
  else if (tab === 'past') where.OR = [{ status: { in: ['REJECTED', 'EXPIRED'] } }, { status: 'CONFIRMED', offer: { date: { lt: today } } }];
  res.json((await prisma.guestRequest.findMany({ where, include: reqInclude, orderBy: { createdAt: 'desc' }, ...paging(req.query) })).map(withArrivalSession));
}));
r.get('/guestlist/:id', ...auth, wrap(async (req, res) => {
  const g = await prisma.guestRequest.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: requestDetailInclude });
  if (!g) throw new ApiError(404, 'Request not found');
  res.json(withArrivalSession(g));
}));
r.post('/guestlist/:id/rating', ...auth, wrap(async (req, res) => {
  const d = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }), req.body);
  const request = await prisma.guestRequest.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { offer: { select: { promoterId: true, promoter: { select: { userId: true, brand: true } }, club: { select: { name: true } } } }, rating: true } });
  if (!request) throw new ApiError(404, 'Booking not found');
  if (request.status !== 'CONFIRMED' || !request.ratingPromptSentAt) throw new ApiError(400, 'Rating will be available the morning after your confirmed event');
  if (request.rating) throw new ApiError(409, 'You have already rated this promoter');
  try {
    const rating = await prisma.$transaction(async (tx) => {
      const created = await tx.promoterRating.create({ data: { guestRequestId: request.id, userId: req.user.id, promoterId: request.offer.promoterId, rating: d.rating, comment: d.comment || null } });
      await tx.notification.create({ data: { userId: request.offer.promoter.userId, title: 'New promoter rating', body: `A guest rated your ${request.offer.club.name} guestlist ${d.rating} out of 5.` } });
      return created;
    });
    res.status(201).json(rating);
  } catch (error) {
    if (error.code === 'P2002') throw new ApiError(409, 'You have already rated this promoter');
    throw error;
  }
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
  res.json(rows.filter((s) => s.offer).map((s) => withoutPromoterPhone(s.offer)));
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
r.get('/support', ...auth, wrap(async (req, res) => {
  res.json(await prisma.ticket.findMany({ where: { userId: req.user.id }, include: supportTicketInclude, orderBy: { updatedAt: 'desc' }, take: 50 }));
}));
r.get('/support/:id', ...auth, wrap(async (req, res) => {
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: supportTicketDetailInclude });
  if (!ticket) throw new ApiError(404, 'Support ticket not found');
  res.json(ticket);
}));
r.post('/support', ...auth, supportLimiter, wrap(async (req, res) => {
  const d = parse(z.object({ category: z.enum(['BOOKING', 'GUESTLIST_ENTRY', 'OFFER', 'ACCOUNT', 'OTHER']), guestRequestId: z.string().optional(), subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(3000) }), req.body);
  res.status(201).json(await createSupportTicket(req.user.id, d));
}));
r.post('/support/:id/messages', ...auth, supportLimiter, wrap(async (req, res) => {
  const { message } = parse(z.object({ message: z.string().trim().min(1).max(3000) }), req.body);
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { messages: { select: { id: true } } } });
  if (!ticket) throw new ApiError(404, 'Support ticket not found');
  if (ticket.status === 'CLOSED') throw new ApiError(400, 'This ticket is closed. Submit a new ticket if you still need help.');
  const created = await prisma.$transaction(async (tx) => {
    if (!ticket.messages.length) {
      await tx.ticketMessage.create({ data: { ticketId: ticket.id, senderRole: req.user.role === 'PROMOTER' ? 'PROMOTER' : 'USER', senderName: req.user.name || 'Guest', body: ticket.message, createdAt: ticket.createdAt } });
      if (ticket.adminReply) await tx.ticketMessage.create({ data: { ticketId: ticket.id, senderRole: 'ADMIN', senderName: 'DUSKNYT Support', body: ticket.adminReply, createdAt: ticket.updatedAt } });
    }
    await tx.ticketMessage.create({ data: { ticketId: ticket.id, senderRole: 'USER', senderName: req.user.name || 'Guest', body: message } });
    await tx.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    return tx.ticket.findUnique({ where: { id: ticket.id }, include: supportTicketDetailInclude });
  });
  res.status(201).json(created);
}));
r.patch('/support/:id', ...auth, wrap(async (req, res) => {
  parse(z.object({ status: z.literal('CLOSED') }), req.body);
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!ticket) throw new ApiError(404, 'Support ticket not found');
  res.json(ticket.status === 'CLOSED' ? ticket : await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' }, include: supportTicketInclude }));
}));
r.post('/support/:id/rating', ...auth, wrap(async (req, res) => {
  const d = parse(z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().trim().max(500).optional() }), req.body);
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!ticket) throw new ApiError(404, 'Support ticket not found');
  if (ticket.status !== 'CLOSED') throw new ApiError(400, 'Close this support ticket before rating your experience');
  if (ticket.supportRating) throw new ApiError(409, 'You have already rated this support ticket');
  const updated = await prisma.ticket.updateMany({ where: { id: ticket.id, userId: req.user.id, status: 'CLOSED', supportRating: null }, data: { supportRating: d.rating, supportFeedback: d.feedback || null, supportRatedAt: new Date() } });
  if (!updated.count) throw new ApiError(409, 'You have already rated this support ticket');
  res.json({ rating: d.rating, feedback: d.feedback || null });
}));

export default r;
