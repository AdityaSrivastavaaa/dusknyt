import { prisma } from '../lib/prisma.js';

export const notify = (userId, title, body, requestId) =>
  prisma.notification.create({ data: { userId, title, body, requestId } });

export const logActivity = (actor, action, entity, entityId) =>
  prisma.activityLog.create({ data: { actorId: actor?.id, actorName: actor?.name || actor?.email || actor?.phone, action, entity, entityId } });
