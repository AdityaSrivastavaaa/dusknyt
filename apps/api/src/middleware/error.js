import { isProd } from '../config/env.js';

export const notFound = (req, res) => res.status(404).json({ message: 'Route not found' });
export const errorHandler = (err, req, res, next) => {
  if (err.code === 'P2002') return res.status(409).json({ message: 'Already exists' });
  if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && isProd ? 'Internal server error' : err.message });
};
