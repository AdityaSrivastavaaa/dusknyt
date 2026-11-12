import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Chip, Async, Input, Logo } from '@dusknyt/ui';
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
  const nav = useNavigate(); const setCity = useStore((s) => s.setCity);
  const [sel, setSel] = useState(useStore.getState().city); const [q, setQ] = useState('');
  const cities = useQuery({ queryKey: ['cities'], queryFn: () => http.get('/cities') });
  return (
    <div className="flex min-h-screen flex-col p-5">
      <h1 className="mt-6 text-2xl font-black leading-tight">WHERE ARE<br />WE TONIGHT?</h1>
      <div className="mt-5"><Input placeholder="Search your city" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="mb-2 mt-5 text-xs text-muted">Popular cities</p>
      <Async q={cities}>{(list) => (
        <div className="flex flex-wrap gap-2">
          {list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).map((c) => <Chip key={c.id} active={sel === c.name} className="px-5 py-2.5 text-sm" onClick={() => setSel(c.name)}>{c.name}</Chip>)}
        </div>
      )}</Async>
      <div className="mt-auto pt-8"><Button disabled={!sel} onClick={() => { setCity(sel); nav('/', { replace: true }); }}>Continue</Button></div>
    </div>
  );
}
