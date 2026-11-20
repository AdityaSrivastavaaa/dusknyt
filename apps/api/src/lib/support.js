import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';
import { ApiError } from './http.js';

export const supportTicketInclude = {
  guestRequest: { select: { id: true, code: true, offer: { select: { date: true, club: { select: { name: true } }, event: { select: { title: true } } } } } },
};

export async function createSupportTicket(userId, details) {
  if (details.guestRequestId) {
    const request = await prisma.guestRequest.findFirst({ where: { id: details.guestRequestId, userId }, select: { id: true } });
    if (!request) throw new ApiError(400, 'Choose one of your own bookings');
  }
  const ticketCode = `DNH-${randomBytes(4).toString('hex').toUpperCase()}`;
  return prisma.ticket.create({ data: { ...details, userId, ticketCode }, include: supportTicketInclude });
}
