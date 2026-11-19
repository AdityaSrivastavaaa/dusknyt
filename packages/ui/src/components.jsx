import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronLeft, Loader2, WifiOff, Inbox, X } from 'lucide-react';
import brandWordmark from './assets/dusknyt-wordmark.png';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ---------- theme ---------- */
export function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem('dn_theme', t);
}
export const initTheme = () => applyTheme(localStorage.getItem('dn_theme') || 'dark');
export function ThemeToggle({ className }) {
  const [t, setT] = useState(() => localStorage.getItem('dn_theme') || 'dark');
  const flip = () => { const n = t === 'dark' ? 'light' : 'dark'; applyTheme(n); setT(n); };
  return (
    <button onClick={flip} aria-label="Toggle theme" className={cx('rounded-full border border-line p-2', className)}>
      {t === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* ---------- layout ---------- */
export const Page = ({ children, className, wide, nav }) => (
  <div className={cx('app-shell mx-auto min-h-screen w-full', wide ? 'max-w-6xl' : 'max-w-md', nav && 'page-with-nav', className)}>{children}</div>
);
export function Header({ title, sub, back, right }) {
  const nav = useNavigate();
  return (
    <div className="glass-bar sticky top-0 z-20 box-border flex w-full min-w-0 max-w-full items-center gap-2 border-b border-line px-3 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] sm:gap-3 sm:px-4">
      {back && <button onClick={() => nav(-1)} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full"><ChevronLeft size={22} /></button>}
      <div className="min-w-0 flex-1 overflow-hidden">
        <h1 className="max-w-full truncate text-lg font-semibold">{title}</h1>
        {sub && <p className="max-w-full truncate text-xs text-muted">{sub}</p>}
      </div>
      {right && <div className="ml-auto flex shrink-0 items-center">{right}</div>}
    </div>
  );
}
export function BottomNav({ items }) {
  return (
    <nav className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md justify-around border-t border-line px-1 pt-2">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-[10px] leading-tight sm:text-[11px]', isActive ? 'text-brand' : 'text-muted')}>
          <Icon size={19} strokeWidth={2} />{label}
          {badge > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-bad px-1 text-[9px] text-white">{badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
export function Logo({ className }) {
  const width = className?.includes('text-4xl') ? 'w-56' : className?.includes('text-3xl') ? 'w-48' : className?.includes('text-2xl') ? 'w-40' : 'w-36';
  return <img src={brandWordmark} alt="DUSKNYT" className={cx('inline-block h-auto max-w-full object-contain', width, className)} />;
}

/* ---------- form controls ---------- */
const field = 'mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none focus:border-brand';
export const Input = ({ label, error, className, ...p }) => (
  <label className="block text-xs text-muted">{label}<input {...p} className={cx(field, className)} />{error && <span className="text-bad">{error}</span>}</label>
);
export const Textarea = ({ label, className, ...p }) => (
  <label className="block text-xs text-muted">{label}<textarea rows={3} {...p} className={cx(field, className)} /></label>
);
export const Select = ({ label, options = [], className, ...p }) => (
  <label className="block text-xs text-muted">{label}
    <select {...p} className={cx(field, className)}>
      {options.map((o) => { const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o; return <option key={v} value={v}>{l}</option>; })}
    </select>
  </label>
);
export function Button({ variant = 'primary', loading, className, children, ...p }) {
  const v = { primary: 'bg-brand text-white hover:bg-brand-dark', outline: 'border border-line', danger: 'bg-bad text-white', success: 'bg-ok text-white', ghost: 'text-brand' }[variant];
  return (
    <button {...p} disabled={p.disabled || loading} className={cx('flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50', v, className)}>
      {loading && <Loader2 className="animate-spin" size={16} />}{children}
    </button>
  );
}
export const Chip = ({ active, className, ...p }) => (
  <button type="button" {...p} className={cx('shrink-0 rounded-lg border px-3 py-1.5 text-xs', active ? 'border-brand bg-brand text-white' : 'border-line bg-card text-muted', className)} />
);
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-card p-1">
      {tabs.map((t) => {
        const v = typeof t === 'object' ? t.value : t; const l = typeof t === 'object' ? t.label : t;
        return <button key={v} onClick={() => onChange(v)} className={cx('flex-1 rounded-lg py-1.5 text-xs font-medium', value === v ? 'bg-brand text-white' : 'text-muted')}>{l}</button>;
      })}
    </div>
  );
}
export const Toggle = ({ on, onChange }) => (
  <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx('h-6 w-11 rounded-full p-0.5 transition', on ? 'bg-brand' : 'bg-line')}>
    <span className={cx('block h-5 w-5 rounded-full bg-white transition', on && 'translate-x-5')} />
  </button>
);

/* ---------- display ---------- */
export const Card = ({ className, ...p }) => <div {...p} className={cx('glass-panel rounded-2xl border border-line bg-card p-4', className)} />;
const tone = {
  CONFIRMED: 'bg-ok/15 text-ok', ACTIVE: 'bg-ok/15 text-ok', PAID: 'bg-ok/15 text-ok',
  PENDING: 'bg-warn/15 text-warn', OPEN: 'bg-warn/15 text-warn', IN_PROGRESS: 'bg-brand/15 text-brand', UPCOMING: 'bg-brand/15 text-brand',
  REJECTED: 'bg-bad/15 text-bad', INACTIVE: 'bg-bad/15 text-bad',
};
export const Badge = ({ s }) => <span className={cx('whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold uppercase', tone[s] || 'bg-line text-muted')}>{String(s || '').replace('_', ' ')}</span>;
export const Stat = ({ label, value, hint, className }) => (
  <Card className={cx('p-3', className)}><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{hint && <p className="text-[11px] text-ok">{hint}</p>}</Card>
);
export const Avatar = ({ src, name, size = 40 }) => src
  ? <img src={src} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
  : <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-bold text-brand">{(name || '?')[0]}</div>;
export function Img({ src, name, className }) {
  return src
    ? <img src={src} alt={name} loading="lazy" className={cx('object-cover', className)} />
    : <div className={cx('grid place-items-center bg-gradient-to-br from-brand-dark to-fuchsia-900 text-2xl font-black text-white/80', className)}>{(name || '?')[0]}</div>;
}
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

/* ---------- states ---------- */
export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-xl bg-line', className)} />;
export const ListSkeleton = ({ n = 3 }) => <div className="space-y-3 p-4">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>;
export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
      <Inbox className="text-muted" size={40} /><h3 className="font-semibold">{title}</h3>
      {text && <p className="text-sm text-muted">{text}</p>}{action && <div className="mt-3 w-full max-w-xs">{action}</div>}
    </div>
  );
}
export function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
      <WifiOff className="text-bad" size={40} /><h3 className="font-semibold text-bad">Something went wrong</h3>
      <p className="text-sm text-muted">Unable to fetch data. Please check your connection and try again.</p>
      <div className="mt-3 w-full max-w-xs"><Button onClick={onRetry}>Try Again</Button></div>
    </div>
  );
}
/** Renders loading / error / empty states for a react-query result, else children(data). */
export function Async({ q, empty, skeleton = 3, children }) {
  if (q.isLoading) return <ListSkeleton n={skeleton} />;
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const d = q.data;
  if (empty && (Array.isArray(d) ? d.length === 0 : !d)) return empty;
  return children(d);
}

/** Tiny dependency-free line chart. data: [{label, value}] */
export function LineChart({ data = [], height = 120 }) {
  const w = 300, pad = 8, max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1), height - 18 - (d.value / max) * (height - 30)]);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" points={pts.map((p) => p.join(',')).join(' ')} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#8b5cf6" />)}
      {data.map((d, i) => <text key={i} x={pts[i][0]} y={height - 3} textAnchor="middle" fontSize="8" fill="currentColor" opacity=".5">{d.label}</text>)}
    </svg>
  );
}
