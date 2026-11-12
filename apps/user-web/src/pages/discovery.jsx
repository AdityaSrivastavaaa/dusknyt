import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Async, Header, Button, Chip, EmptyState, Logo, useAuth } from '@dusknyt/ui';
import { MUSIC, ENTRY_TYPES, formatINR } from '@dusknyt/shared';
import { http } from '../lib/api';
import { useStore } from '../store';
import { ClubCard } from '../components';

const Section = ({ title, children }) => <section className="mt-5"><h2 className="mb-2 px-4 text-sm font-semibold uppercase tracking-wide">{title}</h2>{children}</section>;
const Row = ({ clubs }) => <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">{clubs.map((c) => <ClubCard key={c.id} club={c} compact />)}</div>;

export function Home() {
  const city = useStore((s) => s.city); const nav = useNavigate();
  const q = useQuery({ queryKey: ['home', city], queryFn: () => http.get('/home', { city }), enabled: !!city });
  if (!city) return <Navigate to="/city" replace />;
  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4">
        <div><Logo className="text-lg" /><button onClick={() => nav('/city')} className="flex items-center gap-1 text-xs text-muted">{city}<ChevronDown size={12} /></button></div>
        <Link to="/notifications" aria-label="Notifications"><Bell size={20} /></Link>
      </div>
      <button onClick={() => nav('/search')} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-muted"><Search size={16} />Search clubs, events, experiences…</button>
      <Async q={q} empty={<EmptyState title="No clubs yet" text="We're adding venues in your city soon." />}>{(d) => (<>
        <Section title="Tonight's Highlights"><Row clubs={d.highlights} /></Section>
        <Section title="Trending Tonight"><Row clubs={d.trending} /></Section>
      </>)}</Async>
    </div>
  );
}

export function Explore() {
  const city = useStore((s) => s.city); const filters = useStore((s) => s.filters); const nav = useNavigate();
  const q = useQuery({ queryKey: ['clubs', city, filters], queryFn: () => http.get('/clubs', { city, ...filters }), enabled: !!city });
  const active = Object.keys(filters).length;
  return (
    <div>
      <Header title="Explore" sub="Find the perfect night" right={<button onClick={() => nav('/filters')} className="relative" aria-label="Filters"><SlidersHorizontal size={20} />{active > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand" />}</button>} />
      <button onClick={() => nav('/search')} className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-muted"><Search size={16} />Search clubs, events</button>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">{MUSIC.map((m) => <Chip key={m} onClick={() => nav('/search?music=' + m)}>{m}</Chip>)}</div>
      <Async q={q} empty={<EmptyState title="No clubs found" text="Try changing your filters." action={<Button onClick={() => useStore.getState().setFilters({})}>Clear filters</Button>} />}>{(list) => (
        <div className="grid grid-cols-2 gap-3 p-4">{list.map((c) => <ClubCard key={c.id} club={c} />)}</div>
      )}</Async>
    </div>
  );
}

export function SearchResults() {
  const city = useStore((s) => s.city); const [sp] = useSearchParams();
  const [text, setText] = useState(''); const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const music = sp.get('music');
  const q = useQuery({ queryKey: ['search', city, term, music], queryFn: () => http.get('/clubs', { city, q: term || undefined, music: music || undefined }) });
  return (
    <div>
      <Header back title="Search" />
      <div className="p-4"><div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3"><Search size={16} className="text-muted" /><input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search clubs, areas…" className="w-full bg-transparent py-2.5 text-sm outline-none" /></div></div>
      <Async q={q} empty={<EmptyState title="No results" text="Try a different club name or area." />}>{(list) => (
        <div className="space-y-3 px-4">{list.map((c) => <ClubCard key={c.id} club={c} />)}</div>
      )}</Async>
    </div>
  );
}

export function Filters() {
  const nav = useNavigate(); const { filters, setFilters } = useStore();
  const [f, setF] = useState({ date: '', entryType: [], music: [], maxPrice: 5000, ...filters, entryType: filters.entryType?.split(',') || [], music: filters.music?.split(',') || [] });
  const toggle = (k, v) => setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const apply = () => {
    const out = {};
    if (f.date) out.date = f.date;
    if (f.entryType.length) out.entryType = f.entryType.join(',');
    if (f.music.length) out.music = f.music.join(',');
    if (+f.maxPrice < 5000) out.maxPrice = f.maxPrice;
    setFilters(out); nav('/explore');
  };
  return (
    <div>
      <Header back title="Filters" right={<button className="text-xs text-brand" onClick={() => { setFilters({}); nav('/explore'); }}>Clear All</button>} />
      <div className="space-y-6 p-4">
        <div><p className="mb-2 text-xs text-muted">Date</p><div className="flex flex-wrap gap-2">
          <Chip active={f.date === day(0)} onClick={() => setF({ ...f, date: f.date === day(0) ? '' : day(0) })}>Today</Chip>
          <Chip active={f.date === day(1)} onClick={() => setF({ ...f, date: f.date === day(1) ? '' : day(1) })}>Tomorrow</Chip>
          <input type="date" value={f.date} min={day(0)} onChange={(e) => setF({ ...f, date: e.target.value })} className="rounded-lg border border-line bg-card px-2 text-xs" /></div></div>
        <div><p className="mb-2 text-xs text-muted">Entry Type</p><div className="flex flex-wrap gap-2">{ENTRY_TYPES.map((e) => <Chip key={e} active={f.entryType.includes(e)} onClick={() => toggle('entryType', e)}>{e}</Chip>)}</div></div>
        <div><p className="mb-2 flex justify-between text-xs text-muted"><span>Price Range</span><span>Up to {+f.maxPrice >= 5000 ? '₹5000+' : formatINR(f.maxPrice)}</span></p>
          <input type="range" min="0" max="5000" step="500" value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: e.target.value })} className="w-full accent-brand" /></div>
        <div><p className="mb-2 text-xs text-muted">Music</p><div className="flex flex-wrap gap-2">{MUSIC.map((m) => <Chip key={m} active={f.music.includes(m)} onClick={() => toggle('music', m)}>{m}</Chip>)}</div></div>
        <Button onClick={apply}>Apply Filters</Button>
      </div>
    </div>
  );
}
