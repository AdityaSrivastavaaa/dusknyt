import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Chip, Input, Logo } from '@dusknyt/ui';
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
    <div className="flex min-h-screen flex-col p-5">
      <h1 className="mt-6 text-2xl font-black leading-tight">
        WHERE ARE<br />WE TONIGHT?
      </h1>
      <p className="mt-2 text-sm text-muted">Choose a city where DUSKNYT has clubs.</p>

      <div className="mt-5">
        <Input
          placeholder="Search your city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {cities.isLoading && <p className="mt-5 text-sm text-muted">Loading available cities…</p>}
      {cities.isError && <div className="mt-5"><p className="text-sm text-bad">Could not load cities.</p><button onClick={() => cities.refetch()} className="mt-2 text-sm text-brand">Try again</button></div>}
      {cities.isSuccess && cities.data.length === 0 && <p className="mt-5 text-sm text-muted">No cities with active clubs are available yet.</p>}
      {cities.isSuccess && cities.data.length > 0 && <div className="mt-5"><p className="mb-2 text-xs text-muted">Available cities</p><div className="flex flex-wrap gap-2">{matches.map((city) => <Chip key={city.id} active={sel === city.name} className="px-5 py-2.5 text-sm" onClick={() => setSel(city.name)}>{city.name}</Chip>)}</div>{matches.length === 0 && <p className="mt-3 text-sm text-muted">No available city matches “{q}”.</p>}</div>}

      <div className="mt-auto pt-8">
        <Button
          disabled={!sel || !cities.data?.some((city) => city.name === sel)}
          onClick={() => {
            setCity(sel);
            nav('/', { replace: true });
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

