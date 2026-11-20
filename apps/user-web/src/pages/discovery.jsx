import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Async, Header, Button, Chip, EmptyState, Logo, useAuth } from '@dusknyt/ui';
import { MUSIC, ENTRY_TYPES, formatINR } from '@dusknyt/shared';
import { http } from '../lib/api';
import { useStore } from '../store';
import { ClubCard } from '../components';

const Section = ({ title, children }) => <section className="mt-5"><h2 className="mb-2 px-4 text-sm font-semibold uppercase tracking-wide">{title}</h2>{children}</section>;

function HighlightCarousel({ clubs = [] }) {
  const track = useRef(null); const scrollTimer = useRef(null);
  const looped = clubs.length > 1 ? [clubs[clubs.length - 1], ...clubs, clubs[0]] : clubs;
  const centerAt = (index, behavior = 'auto') => {
    const el = track.current; const card = el?.children[index];
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior });
  };
  useEffect(() => {
    if (clubs.length > 1) centerAt(1);
    return () => clearTimeout(scrollTimer.current);
  }, [clubs]);
  const onScroll = () => {
    clearTimeout(scrollTimer.current);
    if (clubs.length < 2) return;
    scrollTimer.current = setTimeout(() => {
      const el = track.current;
      if (!el) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0, distance = Infinity;
      [...el.children].forEach((card, index) => {
        const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - center);
        if (d < distance) { nearest = index; distance = d; }
      });
      if (nearest === 0) centerAt(clubs.length);
      else if (nearest === clubs.length + 1) centerAt(1);
    }, 180);
  };
  if (!clubs.length) return null;
  return <div ref={track} onScroll={onScroll} className="no-scrollbar relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[9%] pb-2">
    {looped.map((club, index) => <ClubCard key={`${index}-${club.id}`} club={club} featured />)}
  </div>;
}

export function Home() {
  const city = useStore((s) => s.city); const nav = useNavigate();
  const q = useQuery({ queryKey: ['home', city], queryFn: () => http.get('/home', { city }), enabled: !!city });
  if (!city) return <Navigate to="/city" replace />;
  return (
    <div>
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1"><Logo className="!w-32 max-w-full sm:!w-36 block" /><button onClick={() => nav('/city')} className="flex max-w-full min-w-0 items-center gap-1 text-xs text-muted"><span className="truncate">{city}</span><ChevronDown size={12} className="shrink-0" /></button></div>
        <Link to="/notifications" aria-label="Notifications" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-card text-fg"><Bell size={19} /></Link>
      </div>
      <button onClick={() => nav('/search')} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-muted"><Search size={16} />Search clubs, events, experiences…</button>
      <Async q={q} empty={<EmptyState title="No clubs yet" text="We're adding venues in your city soon." />}>{(d) => (<>
        <Section title="Today's Highlights"><HighlightCarousel clubs={d.highlights} /></Section>
        <Section title="Trending Tonight"><div className="space-y-3 px-4">{d.trending.map((club) => <ClubCard key={club.id} club={club} list />)}</div></Section>
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
  const [f, setF] = useState(() => ({ date: filters.date || '', entryType: filters.entryType?.split(',') || [], music: filters.music?.split(',') || [], maxPrice: filters.maxPrice || 5000 }));
  const toggle = (k, v) => setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
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
        <div><p className="mb-2 text-xs text-muted">Date</p><div className="grid grid-cols-2 gap-2">
          {[['Today', day(0)], ['Tomorrow', day(1)]].map(([label, value]) => <button key={label} type="button" aria-pressed={f.date === value} onClick={() => setF({ ...f, date: f.date === value ? '' : value })} className={`min-w-0 rounded-xl border px-3 py-3 text-sm font-medium ${f.date === value ? 'border-brand bg-brand text-white' : 'border-line bg-card text-muted'}`}>{label}</button>)}
          <label className="col-span-2 block min-w-0 text-xs text-muted">Or choose a date<input type="date" value={f.date} min={day(0)} onChange={(e) => setF({ ...f, date: e.target.value })} className="mt-1 block h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border border-line bg-card px-3 text-sm text-fg" /></label></div></div>
        <div><p className="mb-2 text-xs text-muted">Entry Type</p><div className="flex flex-wrap gap-2">{ENTRY_TYPES.map((e) => <Chip key={e} active={f.entryType.includes(e)} onClick={() => toggle('entryType', e)}>{e}</Chip>)}</div></div>
        <div><p className="mb-2 flex justify-between text-xs text-muted"><span>Price Range</span><span>Up to {+f.maxPrice >= 5000 ? '₹5000+' : formatINR(f.maxPrice)}</span></p>
          <input type="range" min="0" max="5000" step="500" value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: e.target.value })} className="w-full accent-brand" /></div>
        <div><p className="mb-2 text-xs text-muted">Music</p><div className="flex flex-wrap gap-2">{MUSIC.map((m) => <Chip key={m} active={f.music.includes(m)} onClick={() => toggle('music', m)}>{m}</Chip>)}</div></div>
        <Button onClick={apply}>Apply Filters</Button>
      </div>
    </div>
  );
}
