import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { arrivalSessionWindow } from '../lib/offer-time.js';

const roomFor = (requestId) => `arrival:${requestId}`;
const sessionFor = (request) => arrivalSessionWindow(request.offer);

export function attachArrivalSockets(server) {
  const io = new Server(server, { cors: { origin: env.corsOrigins, credentials: true }, maxHttpBufferSize: 64 * 1024 });
  const arrival = io.of('/arrival');
  arrival.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Sign in to use arrival chat.');
      const claims = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({ where: { id: claims.sub }, include: { promoter: { select: { id: true, brand: true, status: true } } } });
      if (!user || user.status !== 'ACTIVE') throw new Error('Account unavailable.');
      socket.data.user = { id: user.id, role: user.role, name: user.name, promoterId: user.promoter?.id, promoterBrand: user.promoter?.brand, promoterStatus: user.promoter?.status };
      next();
    } catch (error) { next(new Error(error.message || 'Not authorized.')); }
  });

  arrival.on('connection', (socket) => {
    socket.on('arrival:join', async ({ requestId } = {}, ack = () => {}) => {
      try {
        if (typeof requestId !== 'string') return ack({ ok: false, error: 'Booking is required.' });
        const request = await prisma.guestRequest.findUnique({ where: { id: requestId }, include: { offer: { include: { event: true, promoter: { select: { id: true, userId: true, brand: true, status: true } } } } } });
        if (!request || request.status !== 'CONFIRMED') return ack({ ok: false, error: 'Only confirmed bookings can use arrival chat.' });
        const identity = socket.data.user;
        const isGuest = identity.role === 'USER' && request.userId === identity.id;
        const isPromoter = identity.role === 'PROMOTER' && request.offer.promoter.userId === identity.id && identity.promoterStatus === 'ACTIVE';
        if (!isGuest && !isPromoter) return ack({ ok: false, error: 'You are not a member of this booking.' });
        const { opensAt, closesAt } = sessionFor(request);
        const now = Date.now();
        if (!opensAt || !closesAt || now < opensAt.getTime() || now >= closesAt.getTime()) return ack({ ok: false, error: 'Arrival chat and calls are available for one hour before the event starts.' });
        socket.data.requestId = request.id;
        socket.join(roomFor(request.id));
        const messages = await prisma.arrivalMessage.findMany({ where: { guestRequestId: request.id, createdAt: { gte: opensAt } }, orderBy: { createdAt: 'asc' }, take: 100, include: { sender: { select: { name: true, promoter: { select: { brand: true } } } } } });
        ack({ ok: true, userId: identity.id, opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(), role: isGuest ? 'USER' : 'PROMOTER', messages: messages.map((message) => ({ id: message.id, senderId: message.senderId, senderRole: message.senderRole, senderName: message.sender.promoter?.brand || message.sender.name || (message.senderRole === 'USER' ? 'Guest' : 'Promoter'), body: message.body, createdAt: message.createdAt })) });
        socket.to(roomFor(request.id)).emit('arrival:peer', { role: isGuest ? 'USER' : 'PROMOTER' });
      } catch { ack({ ok: false, error: 'Could not open this arrival session.' }); }
    });

    socket.on('arrival:message', async ({ body } = {}, ack = () => {}) => {
      const requestId = socket.data.requestId;
      if (!requestId || typeof body !== 'string') return ack({ ok: false, error: 'Open the booking arrival session first.' });
      const text = body.trim();
      if (!text || text.length > 1000) return ack({ ok: false, error: 'Messages must be 1–1000 characters.' });
      const request = await prisma.guestRequest.findUnique({ where: { id: requestId }, include: { offer: { include: { event: true } } } });
      const { opensAt, closesAt } = request ? sessionFor(request) : {};
      if (!request || request.status !== 'CONFIRMED' || !opensAt || Date.now() < opensAt.getTime() || Date.now() >= closesAt.getTime()) return ack({ ok: false, error: 'This arrival session has closed.' });
      const message = await prisma.arrivalMessage.create({ data: { guestRequestId: requestId, senderId: socket.data.user.id, senderRole: socket.data.user.role, body: text } });
      const payload = { id: message.id, senderId: message.senderId, senderRole: message.senderRole, senderName: socket.data.user.promoterBrand || socket.data.user.name || 'Guest', body: message.body, createdAt: message.createdAt };
      arrival.to(roomFor(requestId)).emit('arrival:message', payload);
      ack({ ok: true, message: payload });
    });

    socket.on('arrival:session-closed', () => {
      if (socket.data.requestId) socket.leave(roomFor(socket.data.requestId));
      socket.data.requestId = null;
    });

    for (const event of ['call:offer', 'call:answer', 'call:ice', 'call:hangup']) {
      socket.on(event, async (payload) => {
        const requestId = socket.data.requestId;
        if (!requestId) return;
        const request = await prisma.guestRequest.findUnique({ where: { id: requestId }, include: { offer: { include: { event: true } } } });
        const { closesAt, opensAt } = request ? sessionFor(request) : {};
        if (!request || request.status !== 'CONFIRMED' || !opensAt || !closesAt || Date.now() < opensAt.getTime() || Date.now() >= closesAt.getTime()) {
          socket.emit('arrival:session-closed');
          return;
        }
        socket.to(roomFor(requestId)).emit(event, payload);
      });
    }
    socket.on('disconnect', () => {
      if (socket.data.requestId) socket.to(roomFor(socket.data.requestId)).emit('arrival:peer-left');
    });
  });
  return io;
}
