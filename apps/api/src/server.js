import app from './app.js';
import { env } from './config/env.js';
import { expireStale } from './services/guestlist.js';
import { sendDueRatingPrompts } from './services/rating-prompts.js';

app.listen(env.port, () => console.log(`DUSKNYT API listening on :${env.port}`));
// Expire unanswered requests for past events. Move to BullMQ if you run multiple instances.
setInterval(expireStale, 10 * 60 * 1000);
sendDueRatingPrompts().catch((e) => console.error('sendDueRatingPrompts', e.message));
setInterval(() => sendDueRatingPrompts().catch((e) => console.error('sendDueRatingPrompts', e.message)), 5 * 60 * 1000);
