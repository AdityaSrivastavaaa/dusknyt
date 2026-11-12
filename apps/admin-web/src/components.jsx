import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { cx } from '@dusknyt/ui';

export const PageTitle = ({ title, sub, action }) => (
  <div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="text-xl font-bold">{title}</h1>{sub && <p className="text-xs text-muted">{sub}</p>}</div>{action}</div>
);
export const AddLink = ({ to, label }) => <Link to={to} className="flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"><Plus size={14} />{label}</Link>;
export const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-card px-3"><Search size={16} className="text-muted" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2.5 text-sm outline-none" /></div>
);
export const Table = ({ head, children }) => (
  <div className="overflow-x-auto rounded-2xl border border-line bg-card"><table className="w-full text-left text-sm">
    <thead className="border-b border-line text-xs text-muted"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></div>
);
export const Td = ({ className, ...p }) => <td {...p} className={cx('px-4 py-3', className)} />;
export const KV = ({ k, v }) => <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium">{v ?? '—'}</span></div>;
export const useDebounced = (v, ms = 300) => { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v]); return d; };
