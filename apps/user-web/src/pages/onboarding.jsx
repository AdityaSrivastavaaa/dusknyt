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
  const nav = useNavigate();
  const setCity = useStore((s) => s.setCity);

  const [sel, setSel] = useState(useStore.getState().city);
  const [q, setQ] = useState('');
  const [detectedCity, setDetectedCity] = useState('');
  const [locationStatus, setLocationStatus] = useState('Detecting your location...');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Detect user's current city
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = new URL('https://nominatim.openstreetmap.org/reverse');
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('lat', coords.latitude);
          url.searchParams.set('lon', coords.longitude);
          url.searchParams.set('zoom', '10');

          const response = await fetch(url);
          if (!response.ok) throw new Error('Location lookup failed');

          const data = await response.json();
          const address = data.address || {};
          const city =
            address.city ||
            address.town ||
            address.city_district ||
            address.municipality ||
            address.village ||
            '';

          if (!city) throw new Error('City not found');

          setDetectedCity(city);
          setSel((current) => current || city);
          setLocationStatus('Your detected location');
        } catch {
          setLocationStatus('Could not identify your city. Search below.');
        }
      },
      () => setLocationStatus('Location permission denied. Search your city below.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Search cities independently of the database
  useEffect(() => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);

        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('city', q.trim());
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', '8');

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();

        const results = data.map((item) => {
          const address = item.address || {};
          return (
            address.city ||
            address.town ||
            address.municipality ||
            address.village ||
            item.name
          );
        }).filter(Boolean);

        setSearchResults([...new Set(results)]);
      } catch (error) {
        if (error.name !== 'AbortError') setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const selectCity = (name) => {
    setSel(name);
    setQ('');
    setSearchResults([]);
  };

  return (
    <div className="flex min-h-screen flex-col p-5">
      <h1 className="mt-6 text-2xl font-black leading-tight">
        WHERE ARE<br />WE TONIGHT?
      </h1>

      <div className="mt-5">
        <Input
          placeholder="Search your city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {detectedCity && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted">{locationStatus}</p>
          <Chip
            active={sel === detectedCity}
            className="px-5 py-2.5 text-sm"
            onClick={() => selectCity(detectedCity)}
          >
            📍 {detectedCity}
          </Chip>
        </div>
      )}

      {!detectedCity && (
        <p className="mt-5 text-xs text-muted">{locationStatus}</p>
      )}

      {q.trim().length >= 2 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted">
            {searching ? 'Searching cities...' : 'Search results'}
          </p>

          <div className="flex flex-wrap gap-2">
            {searchResults.map((name) => (
              <Chip
                key={name}
                active={sel === name}
                className="px-5 py-2.5 text-sm"
                onClick={() => selectCity(name)}
              >
                {name}
              </Chip>
            ))}
          </div>

          {!searching && searchResults.length === 0 && (
            <p className="text-sm text-muted">No cities found.</p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-xs text-muted">
          Search for any city to get started.
        </p>
      )}

      <div className="mt-auto pt-8">
        <Button
          disabled={!sel}
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

