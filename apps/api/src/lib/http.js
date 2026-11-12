export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
  return r.data;
};
export const paging = (q) => {
  const page = Math.max(1, +q.page || 1), limit = Math.min(100, +q.limit || 20);
  return { skip: (page - 1) * limit, take: limit };
};
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);
export const publicUser = ({ passwordHash, ...u }) => u;
