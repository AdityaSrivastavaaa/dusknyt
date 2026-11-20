import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';
import { ApiError } from './http.js';

export const supportTicketInclude = {
  guestRequest: { select: { id: true, code: true, offer: { select: { date: true, club: { select: { name: true } }, event: { select: { title: true } } } } } },
};
export const supportTicketDetailInclude = {
  ...supportTicketInclude,
  messages: { orderBy: { createdAt: 'asc' } },
};

export async function createSupportTicket(userId, details, senderRole = 'USER', senderName = 'Guest', promoterId) {
  if (details.guestRequestId) {
    const request = await prisma.guestRequest.findFirst({ where: { id: details.guestRequestId, ...(senderRole === 'PROMOTER' ? { offer: { promoterId } } : { userId }) }, select: { id: true } });
    if (!request) throw new ApiError(400, 'Choose one of your own bookings');
  }
  const ticketCode = `DNH-${randomBytes(4).toString('hex').toUpperCase()}`;
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({ data: { ...details, userId, ticketCode } });
    await tx.ticketMessage.create({ data: { ticketId: ticket.id, senderRole, senderName, body: details.message } });
    return tx.ticket.findUnique({ where: { id: ticket.id }, include: supportTicketDetailInclude });
  });
}
