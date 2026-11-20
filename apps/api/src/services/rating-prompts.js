import { prisma } from '../lib/prisma.js';

// In-app prompts are recorded once per confirmed booking. The conditional claim
// inside the transaction keeps multiple API instances from sending duplicates.
export async function sendDueRatingPrompts() {
  const now = new Date();
  const due = await prisma.guestRequest.findMany({
    where: { status: 'CONFIRMED', ratingPromptAt: { lte: now }, ratingPromptSentAt: null },
    include: { offer: { select: { club: { select: { name: true } }, promoter: { select: { brand: true } } } } },
    orderBy: { ratingPromptAt: 'asc' }, take: 250,
  });
  for (const request of due) {
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.guestRequest.updateMany({ where: { id: request.id, status: 'CONFIRMED', ratingPromptSentAt: null }, data: { ratingPromptSentAt: now } });
        if (!claimed.count) return;
        await tx.notification.create({
          data: {
            userId: request.userId,
            requestId: request.id,
            title: 'How was your guestlist?',
            body: `Rate ${request.offer.promoter.brand} after your ${request.offer.club.name} guestlist. Your feedback helps guests choose promoters.`,
          },
        });
      });
    } catch (error) {
      console.error(`Rating prompt failed for request ${request.id}:`, error.message);
    }
  }
  return due.length;
}
