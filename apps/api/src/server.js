import app from './app.js';
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { expirePastOffers, expireStale } from './services/guestlist.js';
import { sendDueRatingPrompts } from './services/rating-prompts.js';
import { attachArrivalSockets } from './services/arrival-sockets.js';

const server = createServer(app);
attachArrivalSockets(server);
server.listen(env.port, () => console.log(`DUSKNYT API listening on :${env.port}`));
// Expire unanswered requests for past events. Move to BullMQ if you run multiple instances.
setInterval(expireStale, 10 * 60 * 1000);
// Past offers disappear from active listings without deleting booking history.
expirePastOffers();
setInterval(expirePastOffers, 60 * 60 * 1000);
sendDueRatingPrompts().catch((e) => console.error('sendDueRatingPrompts', e.message));
setInterval(() => sendDueRatingPrompts().catch((e) => console.error('sendDueRatingPrompts', e.message)), 5 * 60 * 1000);
