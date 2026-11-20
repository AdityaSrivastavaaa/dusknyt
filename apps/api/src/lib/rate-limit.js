import rateLimit from 'express-rate-limit';

export const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait before submitting another support ticket.' },
});
