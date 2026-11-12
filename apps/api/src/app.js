import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authenticate, authorize, loadPromoter } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import promoterRoutes from './routes/promoter.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (o, cb) => cb(null, !o || env.corsOrigins.includes(o)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true }), authRoutes);
app.use('/api/v1/promoter', authenticate, authorize('PROMOTER'), loadPromoter, promoterRoutes);
app.use('/api/v1/admin', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), adminRoutes);
app.use('/api/v1', userRoutes);

app.use(notFound);
app.use(errorHandler);
export default app;
