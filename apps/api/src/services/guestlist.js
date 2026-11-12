import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/http.js';
import { notify, logActivity } from './notify.js';

const nextCode = () => 'DN' + Math.floor(10000000 + Math.random() * 90000000);
// Single source of truth for the request lifecycle.
const TRANSITIONS = { PENDING: ['CONFIRMED', 'REJECTED', 'EXPIRED'], CONFIRMED: [], REJECTED: [], EXPIRED: [] };

export async function createRequest(user, { offerId, guests, note }) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { club: true, promoter: true } });
  if (!offer || offer.status !== 'ACTIVE') throw new ApiError(400, 'This offer is not available');
  const dup = await prisma.guestRequest.findFirst({ where: { userId: user.id, offerId, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (dup) throw new ApiError(409, 'You already have a request for this offer');
  const r = await prisma.guestRequest.create({
    data: { code: nextCode(), userId: user.id, offerId, guestCount: guests.length, guests, note },
  });
  await notify(offer.promoter.userId, 'New guestlist request', `${user.name} · ${offer.club.name} · ${r.guestCount} guest(s)`, r.id);
  return r;
}

/** action: 'ACCEPT' | 'REJECT'. promoterId scopes a promoter to their own offers; admins omit it. */
export async function decide(id, action, { reason, note, actor, promoterId }) {
  const r = await prisma.guestRequest.findUnique({ where: { id }, include: { offer: { include: { club: true } } } });
  if (!r || (promoterId && r.offer.promoterId !== promoterId)) throw new ApiError(404, 'Request not found');
  const to = action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED';
  if (!TRANSITIONS[r.status].includes(to)) throw new ApiError(400, `Cannot change a ${r.status.toLowerCase()} request`);
  const data = { status: to, promoterNote: note || null, reviewedById: actor.id };
  if (to === 'CONFIRMED') data.qrCode = await QRCode.toDataURL(JSON.stringify({ code: r.code, id: r.id }), { margin: 1, width: 280 });
  else data.rejectReason = reason || 'Capacity Full';
  const updated = await prisma.guestRequest.update({ where: { id }, data });
  await notify(
    r.userId,
    to === 'CONFIRMED' ? "You're confirmed!" : 'Request not accepted',
    to === 'CONFIRMED' ? `Your request for ${r.offer.club.name} is confirmed. Show your entry pass at the door.` : `Your request for ${r.offer.club.name} was not accepted: ${data.rejectReason}`,
    r.id,
  );
  await logActivity(actor, `Request ${r.code} ${to.toLowerCase()}`, 'request', r.id);
  return updated;
}

export const expireStale = () =>
  prisma.guestRequest.updateMany({
    where: { status: 'PENDING', offer: { date: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } },
    data: { status: 'EXPIRED' },
  }).catch((e) => console.error('expireStale', e.message));

/** Counts & earnings shared by promoter and admin analytics. */
export async function analytics(where, days) {
  const now = new Date(), from = new Date(now.getTime() - days * 86400000), prevFrom = new Date(from.getTime() - days * 86400000);
  const rows = await prisma.guestRequest.findMany({ where: { ...where, createdAt: { gte: prevFrom } }, include: { offer: { select: { price: true } } } });
  const cur = rows.filter((r) => r.createdAt >= from), prev = rows.filter((r) => r.createdAt < from);
  const earn = (a) => a.filter((r) => r.status === 'CONFIRMED').reduce((s, r) => s + r.offer.price * r.guestCount, 0);
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);
  const confirmed = cur.filter((r) => r.status === 'CONFIRMED').length;
  const buckets = days <= 7 ? 7 : 10;
  const size = (days * 86400000) / buckets;
  const series = Array.from({ length: buckets }, (_, i) => {
    const s = from.getTime() + i * size;
    const label = days <= 7 ? new Date(s).toLocaleDateString('en-IN', { weekday: 'short' }) : new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { label, value: cur.filter((r) => r.createdAt.getTime() >= s && r.createdAt.getTime() < s + size).length };
  });
  return {
    total: cur.length, totalChange: pct(cur.length, prev.length),
    confirmed, confirmedChange: pct(confirmed, prev.filter((r) => r.status === 'CONFIRMED').length),
    conversion: cur.length ? Math.round((confirmed / cur.length) * 1000) / 10 : 0,
    earnings: earn(cur), earningsChange: pct(earn(cur), earn(prev)), series,
  };
}
