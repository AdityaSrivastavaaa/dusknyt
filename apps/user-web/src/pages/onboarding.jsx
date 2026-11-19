import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, MapPin } from 'lucide-react';
import { Button, Input, Logo } from '@dusknyt/ui';
import { http } from '../lib/api';
import { useStore } from '../store';

export function Splash() {
  const nav = useNavigate(); const city = useStore((s) => s.city);
  useEffect(() => { const t = setTimeout(() => nav(city ? '/' : '/city', { replace: true }), 1400); return () => clearTimeout(t); }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-bg to-brand-dark/30 text-center">
      <div><Logo className="text-4xl" /><p className="mt-3 text-[10px] tracking-widest text-muted">NIGHTLIFE ACCESS · GUESTLISTS · EXPERIENCES</p></div>
    </div>
  );
}


export function CitySelect() {
  const nav = useNavigate();
  const setCity = useStore((s) => s.setCity);
  const [sel, setSel] = useState(useStore.getState().city);
  const [q, setQ] = useState('');
  const cities = useQuery({ queryKey: ['supported-cities'], queryFn: () => http.get('/cities/with-clubs') });
  const matches = (cities.data || []).filter((city) => city.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col overflow-x-clip px-5 pb-28 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="mb-8"><Logo className="block w-36" /></div>
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"><MapPin size={21} /></span>
        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">Your night starts here</p><h1 className="mt-1 text-2xl font-black leading-tight">Choose your city</h1><p className="mt-1 text-sm text-muted">Find guestlists and events near you.</p></div>
      </div>

      <div className="mt-6 min-w-0"><Input label="Search available cities" placeholder="Type a city name" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 min-w-0" /></div>

      {cities.isLoading && <p className="mt-5 text-sm text-muted">Loading available cities…</p>}
      {cities.isError && <div className="mt-5 rounded-2xl border border-line bg-card p-4"><p className="text-sm text-bad">Could not load cities.</p><button onClick={() => cities.refetch()} className="mt-2 text-sm font-semibold text-brand">Try again</button></div>}
      {cities.isSuccess && cities.data.length === 0 && <p className="mt-5 rounded-2xl border border-line bg-card p-4 text-sm text-muted">No cities with active clubs are available yet.</p>}
      {cities.isSuccess && cities.data.length > 0 && <div className="mt-6 min-w-0"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Available cities</p><span className="text-xs text-muted">{matches.length} found</span></div>
        {matches.length > 0 ? <div className="grid min-w-0 grid-cols-2 gap-2.5">{matches.map((city) => <button key={city.id} type="button" aria-pressed={sel === city.name} onClick={() => setSel(city.name)} className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium ${sel === city.name ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-card text-fg'}`}><span className="truncate">{city.name}</span>{sel === city.name && <Check size={16} className="shrink-0" />}</button>)}</div> : <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">No available city matches “{q}”.</p>}
      </div>}

      <div className="glass-bar fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-line p-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button disabled={!sel || !cities.data?.some((city) => city.name === sel)} onClick={() => { setCity(sel); nav('/', { replace: true }); }}>Continue</Button>
      </div>
    </div>
  );
}

