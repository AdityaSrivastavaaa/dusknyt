import { createContext, useContext, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const Ctx = createContext(null);
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => read('dn_user'));
  const [token, setToken] = useState(() => localStorage.getItem('dn_token'));
  const login = (t, u) => {
    localStorage.setItem('dn_token', t); localStorage.setItem('dn_user', JSON.stringify(u));
    setToken(t); setUser(u);
  };
  const update = (u) => { localStorage.setItem('dn_user', JSON.stringify(u)); setUser(u); };
  const logout = () => {
    localStorage.removeItem('dn_token'); localStorage.removeItem('dn_user');
    setToken(null); setUser(null);
  };
  return <Ctx.Provider value={{ user, token, login, update, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);

/** Guards routes. `roles` restricts by role; unauthenticated users are sent to `to`. */
export function RequireAuth({ roles, to = '/login', children }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token || !user) return <Navigate to={to} state={{ from: loc.pathname + loc.search }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={to} replace />;
  return children ?? <Outlet />;
}
