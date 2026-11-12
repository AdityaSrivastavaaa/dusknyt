import app from './app.js';
import { env } from './config/env.js';
import { expireStale } from './services/guestlist.js';

app.listen(env.port, () => console.log(`DUSKNYT API listening on :${env.port}`));
// Expire unanswered requests for past events. Move to BullMQ if you run multiple instances.
setInterval(expireStale, 10 * 60 * 1000);
