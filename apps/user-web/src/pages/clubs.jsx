import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, MapPin, Share2, Star, Check } from 'lucide-react';
import { Async, Header, Button, Img, Chip, Card, EmptyState, Select, EventBannerArt, useAuth } from '@dusknyt/ui';
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
        <div className="relative"><Img src={c.images?.[0]} name={c.name} className="h-56 w-full" />
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
          {c.events?.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Upcoming events</h3><div className="space-y-3">{c.events.slice(0, 3).map((e) => (
            <button key={e.id} type="button" onClick={() => nav(`/clubs/${c.id}/offers?date=${e.date.slice(0, 10)}&eventId=${e.id}`)} className="glass-panel w-full overflow-hidden rounded-2xl border border-line text-left">
              <div className="relative grid aspect-[16/8] place-items-end bg-gradient-to-br from-brand-dark to-black">{e.poster ? <img src={e.poster} alt={`${e.title} event banner`} className="absolute inset-0 h-full w-full object-cover" /> : <EventBannerArt className="absolute inset-0 h-full w-full" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" /><div className="relative w-full p-3 text-white"><p className="text-lg font-bold">{e.title}</p><p className="text-xs text-white/80">{c.name} · {fmtDate(e.date)} · {e.startTime}</p></div></div>
              <div className="space-y-1 p-3 text-xs"><p><span className="text-muted">DJ / Performer:</span> {e.djName || 'To be announced'}</p><p><span className="text-muted">Music / Theme:</span> {e.genre || 'To be announced'}</p><p className="text-muted">{c.address}</p><p className="pt-1 font-semibold text-brand">See offers for this event</p></div>
            </button>))}</div></div>}
        </div>
        <div className="glass-bar fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><Button onClick={() => nav(`/clubs/${c.id}/offers`)}>Compare Offers</Button></div>
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
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{days.map((d) => <button key={d} type="button" aria-pressed={d === day} onClick={() => setSel(d)} className={`min-w-0 rounded-xl border px-2 py-2 text-center text-xs ${d === day ? 'border-brand bg-brand text-white' : 'border-line bg-card text-muted'}`}><span className="block truncate font-semibold">{new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span><span className="mt-0.5 block truncate">{fmtDate(d)}</span></button>)}</div>
          <p className="mb-2 mt-5 text-xs text-muted">Events on {fmtDate(day)}</p>
          <div className="space-y-3">{list.filter((e) => e.date.slice(0, 10) === day).map((e) => <button key={e.id} onClick={() => nav(`/clubs/${id}/offers?date=${day}&eventId=${e.id}`)} className="glass-panel w-full overflow-hidden rounded-2xl border border-line text-left">
            <div className="relative grid aspect-[16/8] place-items-end bg-gradient-to-br from-brand-dark to-black">{e.poster ? <img src={e.poster} alt={`${e.title} event banner`} className="absolute inset-0 h-full w-full object-cover" /> : <EventBannerArt className="absolute inset-0 h-full w-full" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" /><div className="relative w-full p-3 text-white"><p className="text-lg font-bold">{e.title}</p><p className="text-xs text-white/80">{e.club?.name} · {fmtDate(e.date)} · {e.startTime}</p></div></div>
            <div className="space-y-1 p-3 text-xs"><p><span className="text-muted">DJ / Performer:</span> {e.djName || 'To be announced'}</p><p><span className="text-muted">Music / Theme:</span> {e.genre || 'To be announced'}</p><p className="text-muted">{e.club?.address || e.club?.area}</p><p className="pt-1 font-semibold text-brand">See offers for this event</p></div></button>)}</div>
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
      <Header back title="Compare Guestlist Offers" sub={`${q.data?.[0]?.club?.name || 'Club'}${sp.get('date') ? ` · ${fmtDate(sp.get('date'))}` : ''}`} />
      <Card className="mx-4 mt-4 space-y-2 !p-3"><p className="text-sm font-semibold">Choose a promoter’s guestlist offer for {q.data?.[0]?.club?.name || 'this club'}</p><p className="text-xs text-muted">The name on each offer is its promoter or guestlist host (a person, team, or brand), not the club. Compare the entry type, arrival time, price, and perks.</p><p className="text-xs text-brand">Tap an offer to see its perks and terms, then select “Request this guestlist”.</p></Card>
      <div className="p-4"><Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: 'recommended', label: 'Recommended' }, { value: 'price', label: 'Price: low to high' }]} /></div>
      <Async q={q} empty={<EmptyState title="No offers available" text="Promoters haven't listed offers for this event yet." />}>{(list) => {
        const groups = [...list.reduce((map, offer) => { const date = offer.date.slice(0, 10); const group = map.get(date) || []; group.push(offer); map.set(date, group); return map; }, new Map()).entries()];
        return <div className="space-y-6 px-4 pb-6">{groups.map(([date, offers]) => <section key={date} className="space-y-3"><h2 className="px-1 text-sm font-semibold text-muted">{fmtDate(date)} <span className="font-normal">· {offers.length} offer{offers.length === 1 ? '' : 's'}</span></h2>{offers.map((o) => {
          const open = expanded.includes(o.id);
          return <Card key={o.id} className="overflow-hidden p-0"><button type="button" aria-expanded={open} onClick={() => setExpanded((old) => open ? old.filter((x) => x !== o.id) : [...old, o.id])} className="flex min-h-[104px] w-full items-stretch text-left">
            <div className="w-1/4 min-w-[76px] shrink-0"><Img src={o.club.images?.[0]} name={o.club.name} className="h-full min-h-[104px] w-full rounded-none object-cover" /></div>
            <div className="flex min-w-0 flex-1 items-center gap-2 p-2.5"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Promoter / guestlist host</p><p className="truncate text-xs text-fg">{o.promoter.brand}</p><p className="font-semibold leading-tight">{o.offerType} · {o.entryTypes?.length ? o.entryTypes.join(' & ') : o.entryType}</p>{o.event?.title && <p className="truncate text-xs text-muted">{o.event.title}{o.event.startTime ? ` · ${o.event.startTime}` : ''}</p>}<p className="text-xs text-muted">Entry {o.entryFrom || '9:00 PM'}–{o.entryBefore}{o.limitedSlots ? ' · Limited slots' : ''}</p></div>
            <div className="shrink-0 text-right"><p className="font-bold">{o.price === 0 ? 'Free Entry' : formatINR(o.price)}</p><p className="text-xs text-brand">{open ? 'Hide details' : 'View details'}</p></div></div>
          </button>{open && <div className="space-y-3 border-t border-line p-4">
            {o.inclusions?.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Included perks</p><ul className="space-y-1 text-sm">{o.inclusions.map((perk) => <li key={perk} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-ok" />{perk}</li>)}</ul></div>}
            {o.terms && <div><p className="mb-1 text-xs font-semibold text-muted">Terms</p><p className="text-sm text-muted">{o.terms}</p></div>}
            <Button onClick={() => book(o)}>Request this guestlist</Button>
          </div>}</Card>;
        })}</section>)}</div>;
      }}</Async>
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
        return <div className="flex flex-col gap-3 px-4">{groups.map((g) => <Link className="block" key={`${g.club.id}:${g.date}`} to={`/clubs/${g.club.id}/offers?date=${g.date}`}><Card className="flex items-center gap-3 p-3"><Img src={g.club.images?.[0]} name={g.club.name} className="h-16 w-16 rounded-xl" /><div className="min-w-0 flex-1"><p className="font-semibold">{g.club.name}</p><p className="text-xs text-muted">{fmtDate(g.date)} · {g.offers.length} promoter offer{g.offers.length === 1 ? '' : 's'}</p><p className="truncate text-xs text-muted">{[...new Set(g.offers.map((o) => o.promoter.brand))].join(' · ')}</p></div><span className="text-xs font-semibold text-brand">{formatINR(Math.min(...g.offers.map((o) => o.price)))}</span></Card></Link>)}</div>;
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
      <div className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-line p-4"><Button onClick={() => go(o)}>Get Guestlist Entry</Button></div>
      </div>)}</Async>
    </div>
  );
}
