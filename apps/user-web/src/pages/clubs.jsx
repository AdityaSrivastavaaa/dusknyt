import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, MapPin, Share2, Star, Check } from 'lucide-react';
import { Async, Header, Button, Img, Chip, Card, EmptyState, Select, useAuth } from '@dusknyt/ui';
import { formatINR, fmtDate } from '@dusknyt/shared';
import { http } from '../lib/api';
import { useStore } from '../store';
import { SaveButton } from '../components';

export function ClubDetails() {
  const { id } = useParams(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['club', id], queryFn: () => http.get(`/clubs/${id}`) });
  return (
    <div className="pb-24">
      <Async q={q}>{(c) => (<>
        <div className="relative"><Img src={c.images[0]} name={c.name} className="h-56 w-full" />
          <button onClick={() => nav(-1)} className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-white">‹</button></div>
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between"><div><h1 className="text-xl font-bold">{c.name}</h1><p className="text-xs text-muted">{c.address}</p></div>
            <span className="flex items-center gap-1 text-sm text-warn"><Star size={14} className="fill-warn" />{c.rating}</span></div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <a href={`tel:${c.phone}`} className="rounded-xl border border-line py-2"><Phone className="mx-auto mb-1" size={16} />Call</a>
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${c.lat && c.lng ? c.lat + ',' + c.lng : encodeURIComponent(c.name + ' ' + c.address)}`} className="rounded-xl border border-line py-2"><MapPin className="mx-auto mb-1" size={16} />Map</a>
            <button onClick={() => (navigator.share ? navigator.share({ title: c.name, url: location.href }) : navigator.clipboard?.writeText(location.href))} className="rounded-xl border border-line py-2"><Share2 className="mx-auto mb-1" size={16} />Share</button>
            <div className="rounded-xl border border-line py-0.5"><SaveButton clubId={c.id} className="mx-auto" /><span>Save</span></div>
          </div>
          {c.about && <div><h3 className="mb-1 text-sm font-semibold">About</h3><p className="text-sm text-muted">{c.about}</p></div>}
          <div className="flex justify-between text-sm"><span className="text-muted">Music</span><span>{c.music.join(' · ') || '—'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Dress code</span><span>{c.dressCode || '—'}</span></div>
          {c.events.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Upcoming events</h3><div className="space-y-2">{c.events.slice(0, 3).map((e) => (
            <Card key={e.id} className="flex justify-between p-3 text-sm"><div><p className="font-medium">{e.title}</p><p className="text-xs text-muted">{e.djName}</p></div><p className="text-xs text-muted">{fmtDate(e.date)}<br />{e.startTime}</p></Card>))}</div></div>}
        </div>
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-bg p-4"><Button onClick={() => nav(`/clubs/${c.id}/events`)}>View Offers</Button></div>
      </>)}</Async>
    </div>
  );
}

export function EventSelect() {
  const { id } = useParams(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['events', id], queryFn: () => http.get(`/clubs/${id}/events`) });
  const [sel, setSel] = useState(null);
  return (
    <div>
      <Header back title="Select Event" />
      <Async q={q} empty={<EmptyState title="No upcoming events" action={<Button onClick={() => nav(`/clubs/${id}/offers`)}>See all offers</Button>} />}>{(list) => {
        const days = [...new Set(list.map((e) => e.date.slice(0, 10)))];
        const day = sel || days[0];
        return (<div className="p-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">{days.map((d) => <Chip key={d} active={d === day} onClick={() => setSel(d)}>{fmtDate(d)}</Chip>)}</div>
          <p className="mb-2 mt-5 text-xs text-muted">Events on {fmtDate(day)}</p>
          <div className="space-y-3">{(() => { const events = list.filter((e) => e.date.slice(0, 10) === day); return <button onClick={() => nav(`/clubs/${id}/offers?date=${day}`)} className="w-full rounded-2xl border border-line bg-card p-4 text-left">
            <p className="font-semibold">{events.length === 1 ? events[0].title : `${events.length} events`}</p><p className="text-xs text-muted">{events.map((e) => [e.title, e.djName].filter(Boolean).join(' · ')).join(' / ')}</p><p className="text-xs text-muted">{events.map((e) => e.startTime).filter((x, i, a) => a.indexOf(x) === i).join(' · ')} Onwards</p></button>; })()}</div>
        </div>);
      }}</Async>
    </div>
  );
}

export function ClubOffers() {
  const { id } = useParams(); const [sp] = useSearchParams(); const [sort, setSort] = useState('recommended'); const [expanded, setExpanded] = useState([]);
  const { token, user } = useAuth(); const setDraft = useStore((s) => s.setDraft); const nav = useNavigate();
  const q = useQuery({ queryKey: ['club-offers', id, sp.get('eventId'), sp.get('date'), sort], queryFn: () => http.get(`/clubs/${id}/offers`, { eventId: sp.get('eventId') || undefined, date: sp.get('date') || undefined, sort }) });
  const book = (offer) => {
    setDraft({ offer, guests: [], note: '' });
    if (!token) return nav('/login', { state: { from: '/book/guests' } });
    nav(user?.name ? '/book/guests' : '/setup', { state: { from: '/book/guests' } });
  };
  return (
    <div>
      <Header back title="Offers at this club" sub={sp.get('date') ? `${fmtDate(sp.get('date'))} · Expand offers to compare` : 'Expand offers to compare'} />
      <div className="p-4"><Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: 'recommended', label: 'Recommended' }, { value: 'price', label: 'Price: low to high' }]} /></div>
      <Async q={q} empty={<EmptyState title="No offers available" text="Promoters haven't listed offers for this event yet." />}>{(list) => <div className="space-y-3 px-4 pb-6">{list.map((o) => {
        const open = expanded.includes(o.id);
        return <Card key={o.id} className="overflow-hidden p-0"><button type="button" aria-expanded={open} onClick={() => setExpanded((old) => open ? old.filter((x) => x !== o.id) : [...old, o.id])} className="flex w-full items-center gap-3 p-4 text-left">
          <Img src={o.club.images?.[0]} name={o.club.name} className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1"><p className="text-xs text-muted">{o.promoter.brand}</p><p className="font-semibold">{o.offerType} · {o.entryTypes?.length ? o.entryTypes.join(' & ') : o.entryType}</p>{o.event?.title && <p className="truncate text-xs text-muted">{o.event.title}{o.event.startTime ? ` · ${o.event.startTime}` : ''}</p>}<p className="text-xs text-muted">{o.entryFrom || '9:00 PM'}–{o.entryBefore}{o.limitedSlots ? ' · Limited slots' : ''}</p></div>
          <div className="text-right"><p className="font-bold">{formatINR(o.price)}</p><p className="text-xs text-brand">{open ? 'Hide' : 'Details'}</p></div>
        </button>{open && <div className="space-y-3 border-t border-line p-4">
          {o.inclusions?.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Included perks</p><ul className="space-y-1 text-sm">{o.inclusions.map((perk) => <li key={perk} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-ok" />{perk}</li>)}</ul></div>}
          {o.terms && <div><p className="mb-1 text-xs font-semibold text-muted">Terms</p><p className="text-sm text-muted">{o.terms}</p></div>}
          <Button onClick={() => book(o)}>Get Guestlist Entry</Button>
        </div>}</Card>;
      })}</div>}</Async>
    </div>
  );
}

export function AllOffers() {
  const city = useStore((s) => s.city); const [sort, setSort] = useState('date');
  const q = useQuery({ queryKey: ['all-offers', city, sort], queryFn: () => http.get('/offers', { city, sort }) });
  return (
    <div>
      <Header title="Offers" sub="Best guestlist deals tonight" />
      <div className="flex gap-2 p-4"><Chip active={sort === 'date'} onClick={() => setSort('date')}>Soonest</Chip><Chip active={sort === 'price'} onClick={() => setSort('price')}>Lowest price</Chip></div>
      <Async q={q} empty={<EmptyState title="No active offers" />}>{(list) => {
        const groups = [...list.reduce((m, o) => {
          const date = o.date.slice(0, 10), key = `${o.club.id}:${date}`;
          const g = m.get(key) || { club: o.club, date, offers: [] }; g.offers.push(o); m.set(key, g); return m;
        }, new Map()).values()];
        return <div className="space-y-3 px-4">{groups.map((g) => <Link key={`${g.club.id}:${g.date}`} to={`/clubs/${g.club.id}/offers?date=${g.date}`}><Card className="flex items-center gap-3 p-3"><Img src={g.club.images?.[0]} name={g.club.name} className="h-16 w-16 rounded-xl" /><div className="min-w-0 flex-1"><p className="font-semibold">{g.club.name}</p><p className="text-xs text-muted">{fmtDate(g.date)} · {g.offers.length} promoter offer{g.offers.length === 1 ? '' : 's'}</p><p className="truncate text-xs text-muted">{[...new Set(g.offers.map((o) => o.promoter.brand))].join(' · ')}</p></div><span className="text-xs font-semibold text-brand">{formatINR(Math.min(...g.offers.map((o) => o.price)))}</span></Card></Link>)}</div>;
      }}</Async>
    </div>
  );
}

export function OfferDetails() {
  const { id } = useParams(); const nav = useNavigate(); const { token, user } = useAuth(); const setDraft = useStore((s) => s.setDraft);
  const q = useQuery({ queryKey: ['offer', id], queryFn: () => http.get(`/offers/${id}`) });
  const go = (o) => {
    setDraft({ offer: o, guests: [], note: '' });
    if (!token) return nav('/login', { state: { from: '/book/guests' } });
    nav(user?.name ? '/book/guests' : '/setup', { state: { from: '/book/guests' } });
  };
  return (
    <div className="pb-24">
      <Header back title="Offer Details" />
      <Async q={q}>{(o) => (<div className="space-y-5 p-4">
        <Card><p className="text-xs text-muted">{o.promoter.brand} · {o.club.name}</p>
          <p className="mt-1 text-4xl font-black">{o.price ? formatINR(o.price) : '₹0'}</p>
          <p className="font-semibold text-brand">{o.offerType} · {o.entryTypes?.length ? o.entryTypes.join(' & ') : o.entryType}</p><p className="mt-1 text-xs text-muted">{fmtDate(o.date)} · Entry {o.entryFrom || '9:00 PM'}–{o.entryBefore}{o.limitedSlots ? ' · Limited slots' : ''}</p></Card>
        {o.inclusions.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">What's Included</h3><ul className="space-y-1.5 text-sm text-muted">{o.inclusions.map((x) => <li key={x} className="flex gap-2"><Check size={14} className="mt-0.5 text-ok" />{x}</li>)}</ul></div>}
        {o.terms && <div><h3 className="mb-2 text-sm font-semibold">Terms & Conditions</h3><p className="text-xs text-muted">{o.terms}</p></div>}
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-bg p-4"><Button onClick={() => go(o)}>Get Guestlist Entry</Button></div>
      </div>)}</Async>
    </div>
  );
}
