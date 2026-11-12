import axios from 'axios';

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';

export function createHttp(baseUrl, { loginPath = '/login' } = {}) {
  const raw = axios.create({ baseURL: baseUrl.replace(/\/$/, '') + '/api/v1', timeout: 20000 });
  raw.interceptors.request.use((c) => {
    const t = localStorage.getItem('dn_token');
    if (t) c.headers.Authorization = `Bearer ${t}`;
    return c;
  });
  raw.interceptors.response.use((r) => r, (e) => {
    const url = e.config?.url || '';
    if (e.response?.status === 401 && !url.startsWith('/auth')) {
      localStorage.removeItem('dn_token');
      localStorage.removeItem('dn_user');
      if (location.pathname !== loginPath) location.assign(loginPath);
    }
    return Promise.reject(e);
  });
  return {
    raw,
    get: (u, params) => raw.get(u, { params }).then((r) => r.data),
    post: (u, body) => raw.post(u, body).then((r) => r.data),
    put: (u, body) => raw.put(u, body).then((r) => r.data),
    patch: (u, body) => raw.patch(u, body).then((r) => r.data),
    del: (u) => raw.delete(u).then((r) => r.data),
  };
}
