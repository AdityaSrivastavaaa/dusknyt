import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Async, Header, Button, Input, Select, Textarea, Chip, Tabs, Badge, Img, Card, EmptyState, ErrorState } from '@dusknyt/ui';
import { ENTRY_TYPES, OFFER_TYPES, OFFER_PERK_GROUPS, formatINR, fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

export function MyOffers() {
  const [tab, setTab] = useState('active');
  const q = useQuery({ queryKey: ['offers', tab], queryFn: () => http.get('/promoter/offers', { tab }) });
  return (
    <div>
      <Header title="My Offers" />
      <div className="p-4"><Tabs tabs={[{ value: 'active', label: 'Active' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'drafts', label: 'Drafts' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No active offers" text="Create your first offer and start getting guests." action={<Link to="/offers/new"><Button>Create Offer</Button></Link>} />}>{(list) => (
        <div className="space-y-3 px-4">{list.map((o) => (<Link key={o.id} to={`/offers/${o.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <Img src={o.club.images[0]} name={o.club.name} className="h-14 w-14 rounded-xl" />
          <div className="min-w-0 flex-1"><p className="font-semibold">{o.club.name}</p><p className="truncate text-xs text-muted">{fmtDate(o.date)} · {o.offerType} · {o.entryTypes?.length ? o.entryTypes.join(' & ') : o.entryType}</p><p className="text-xs text-muted">{o.entryFrom || '9:00 PM'}–{o.entryBefore} · {o._count.requests} requests</p></div><Badge s={o.status} /></Link>))}</div>)}</Async>
      <Link to="/offers/new" className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg" aria-label="Create offer"><Plus /></Link>
    </div>
  );
}

export function CreateOffer() {
  const nav = useNavigate(); const qc = useQueryClient(); const [step, setStep] = useState(1); const [err, setErr] = useState('');
  const [customPerk, setCustomPerk] = useState('');
  const clubs = useQuery({ queryKey: ['p-clubs'], queryFn: () => http.get('/promoter/clubs') });
  const [f, setF] = useState({ clubId: '', eventId: '', eventTitle: '', djName: '', startTime: '9:00 PM', genre: '', eventBanner: '', entryTypes: ['Couple'], offerType: 'Free Entry', price: 0, entryFrom: '9:00 PM', entryBefore: '11:00 PM', limitedSlots: false, date: '', inclusions: [], terms: '' });
  const club = clubs.data?.find((c) => c.id === f.clubId);
  const existingEvent = club?.events.find((event) => event.date.slice(0, 10) === f.date.slice(0, 10));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: async (status) => {
      const event = await http.post('/promoter/events', { clubId: f.clubId, title: f.eventTitle, djName: f.djName || undefined, date: f.date, startTime: f.startTime, genre: f.genre || undefined, poster: f.eventBanner || undefined });
      return http.post('/promoter/offers', {
        ...f, entryType: f.entryTypes.join(', '), status, eventId: event.id, date: event.date, price: f.offerType === 'Free Entry' || f.offerType === 'Ladies Night' ? 0 : +f.price,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); nav('/offers', { replace: true }); },
    onError: (e) => setErr(errMsg(e)),
  });
  const onClub = (e) => { setF((old) => ({ ...old, clubId: e.target.value, eventId: '', eventTitle: '', djName: '', genre: '', eventBanner: '', date: '' })); };
  const onDate = (e) => {
    const date = e.target.value; const ev = club?.events.find((event) => event.date.slice(0, 10) === date);
    setF((old) => ({ ...old, date, eventId: ev?.id || '', eventTitle: ev?.title || '', djName: ev?.djName || '', startTime: ev?.startTime || '9:00 PM', genre: ev?.genre || '', eventBanner: ev?.pendingPoster || ev?.poster || '' }));
  };
  const toggleInclusion = (value) => setF((old) => ({ ...old, inclusions: old.inclusions.includes(value) ? old.inclusions.filter((x) => x !== value) : [...old.inclusions, value] }));
  const toggleEntryType = (value) => setF((old) => ({ ...old, entryTypes: old.entryTypes.includes(value) ? old.entryTypes.filter((x) => x !== value) : [...old.entryTypes, value] }));
  const addCustomPerk = () => {
    const perk = customPerk.trim();
    if (!perk || f.inclusions.some((x) => x.toLowerCase() === perk.toLowerCase())) return;
    setF((old) => ({ ...old, inclusions: [...old.inclusions, perk] })); setCustomPerk('');
  };
  const uploadEventBanner = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Choose an image file for the event banner.'); return; }
    try {
      const image = new Image(); const source = URL.createObjectURL(file);
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
      const scale = Math.min(1, 1400 / image.width, 1800 / image.height);
      const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(source);
      setErr(''); setF((old) => ({ ...old, eventBanner: canvas.toDataURL('image/jpeg', 0.8) }));
    } catch { setErr('Could not read this image. Try another file.'); }
  };
  return (
    <div className="pb-8">
      <Header back title="Create New Offer" sub={`Step ${step} of 2`} />
      <Async q={clubs}>{() => (<div className="space-y-4 p-4">
        {step === 1 ? (<>
          <Select label="Club" value={f.clubId} onChange={onClub} options={[{ value: '', label: 'Select club first' }, ...clubs.data.map((c) => ({ value: c.id, label: c.name }))]} />
          <Input label="Event date" type="date" min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())} value={f.date.slice(0, 10)} disabled={!f.clubId} onChange={onDate} />
          {existingEvent ? <Card className="space-y-1 border-brand/40"><p className="font-semibold">Using this club’s existing event</p><p className="text-sm">{f.eventTitle}</p><p className="text-xs text-muted">{f.djName || 'Performer TBA'} · {f.genre || 'Music theme TBA'} · Starts {f.startTime}</p><p className="text-xs text-muted">{existingEvent.status === 'PENDING' ? 'Awaiting admin approval. Your offer will appear to users after approval.' : 'Approved and shared by this club’s promoters.'}</p></Card> : <>
            <Input label="Event name" value={f.eventTitle} onChange={set('eventTitle')} placeholder="e.g. Bollywood Night" disabled={!f.date} />
            <Input label="DJ / performer (optional)" value={f.djName} onChange={set('djName')} disabled={!f.date} />
            <Input label="Event start time" value={f.startTime} onChange={set('startTime')} disabled={!f.date} />
            <Input label="Music / theme (optional)" value={f.genre} onChange={set('genre')} placeholder="e.g. Bollywood" disabled={!f.date} />
            <div className="space-y-2"><label className="block text-xs text-muted">Event banner (optional; admin approval required before users see it)<input type="file" accept="image/*" onChange={(e) => uploadEventBanner(e.target.files?.[0])} disabled={!f.date} className="mt-1 block w-full text-sm" /></label>{f.eventBanner && <><img src={f.eventBanner} alt="Event banner preview" className="h-40 w-full rounded-xl object-cover" /><button type="button" onClick={() => setF((old) => ({ ...old, eventBanner: '' }))} className="text-xs text-bad">Remove banner</button></>}</div>
          </>}
          <fieldset><legend className="mb-2 text-xs text-muted">Who is this offer for? Select all that apply</legend><div className="flex flex-wrap gap-2">{ENTRY_TYPES.map((t) => <label key={t} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs"><input type="checkbox" checked={f.entryTypes.includes(t)} onChange={() => toggleEntryType(t)} className="accent-brand" />{t}</label>)}</div></fieldset>
          <Select label="Offer type" value={f.offerType} onChange={set('offerType')} options={OFFER_TYPES} />
          {['Cover Charge', 'Stag Entry'].includes(f.offerType) && <Input label="Price (₹)" type="number" min="0" value={f.price} onChange={set('price')} />}
          <div className="grid grid-cols-2 gap-3"><Input label="Guestlist entry starts" value={f.entryFrom} onChange={set('entryFrom')} placeholder="10:00 PM" /><Input label="Guestlist entry ends" value={f.entryBefore} onChange={set('entryBefore')} placeholder="11:45 PM" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.limitedSlots} onChange={(e) => setF({ ...f, limitedSlots: e.target.checked })} className="accent-brand" />Limited slots</label>
          <Button disabled={!f.clubId || !f.date || !f.entryTypes.length || f.eventTitle.trim().length < 2} onClick={() => setStep(2)}>Next</Button>
        </>) : (<>
          <div className="space-y-4"><div><h2 className="font-semibold">Offer perks</h2><p className="text-xs text-muted">Select every perk this offer includes. Add a custom perk if needed.</p></div>
            {OFFER_PERK_GROUPS.map((group) => <fieldset key={group.label}><legend className="mb-2 text-xs font-semibold text-muted">{group.label}</legend><div className="grid grid-cols-2 gap-2">{group.options.map((item) => <label key={item} className="flex items-center gap-2 rounded-xl border border-line bg-card p-2 text-xs"><input type="checkbox" checked={f.inclusions.includes(item)} onChange={() => toggleInclusion(item)} className="accent-brand" />{item}</label>)}</div></fieldset>)}
            <div><label className="block text-xs text-muted">Add another perk<input maxLength={60} value={customPerk} onChange={(e) => setCustomPerk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPerk(); } }} placeholder="e.g. Free entry to after-party" className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none focus:border-brand" /></label><Button type="button" variant="outline" className="mt-2" disabled={!customPerk.trim()} onClick={addCustomPerk}>Add perk</Button></div>
            {f.inclusions.length > 0 && <div className="rounded-xl border border-line p-3"><p className="mb-2 text-xs font-semibold text-muted">Selected perks</p><div className="flex flex-wrap gap-2">{f.inclusions.map((perk) => <button type="button" key={perk} onClick={() => toggleInclusion(perk)} className="rounded-full bg-brand/15 px-3 py-1 text-xs text-brand">{perk} ×</button>)}</div></div>}
          </div>
          <Textarea label="Terms & conditions" rows={4} value={f.terms} onChange={set('terms')} />
          <Card className="text-sm"><p className="font-semibold">{club?.name} · {f.eventTitle} · {f.offerType}</p><p className="text-xs text-muted">{f.entryTypes.join(' & ')} · {fmtDate(f.date)} · {f.entryFrom}–{f.entryBefore}{f.limitedSlots ? ' · Limited slots' : ''}</p></Card>
          {err && <p className="text-xs text-bad">{err}</p>}
          <Button loading={create.isPending} onClick={() => create.mutate('ACTIVE')}>Publish Offer</Button>
          <Button variant="outline" onClick={() => create.mutate('DRAFT')}>Save as Draft</Button><Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
        </>)}</div>)}</Async>
    </div>
  );
}

export function OfferDetail() {
  const { id } = useParams(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['offer', id], queryFn: () => http.get(`/promoter/offers/${id}`) });
  const set = useMutation({ mutationFn: (status) => http.patch(`/promoter/offers/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offer', id] }); qc.invalidateQueries({ queryKey: ['offers'] }); } });
  return (
    <div>
      <Header back title="Offer Details" />
      <Async q={q}>{(o) => (<div className="space-y-4 p-4">
        {o.date.slice(0, 10) < new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()) && <p className="rounded-xl border border-line bg-card p-3 text-xs text-muted">This is a past offer. Its details are read-only.</p>}
        <Card><div className="flex justify-between"><p className="text-lg font-bold">{o.club.name}</p><Badge s={o.status} /></div><p className="text-sm text-muted">{fmtDate(o.date)} · {o.offerType} · {o.entryTypes?.length ? o.entryTypes.join(' & ') : o.entryType}</p><p className="mt-2 text-3xl font-black">{formatINR(o.price)}</p><p className="text-xs text-muted">Entry {o.entryFrom}–{o.entryBefore} · {o._count.requests} requests {o.limitedSlots ? '· Limited slots' : ''}</p></Card>
        {o.inclusions.length > 0 && <Card><p className="mb-1 text-xs text-muted">Included</p>{o.inclusions.map((x) => <p key={x} className="text-sm">• {x}</p>)}</Card>}
        {o.date.slice(0, 10) >= new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()) && <Card className="space-y-2"><p className="font-semibold">Guest arrival coordination</p><p className="text-xs text-muted">Guests can use private DUSKNYT chat and an internet call during the hour before the event starts. Your phone number is not shown.</p></Card>}
        {o.status === 'INACTIVE' && <p className="text-center text-sm text-muted">Offer expired or inactive.</p>}
        {o.date.slice(0, 10) >= new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()) && (['INACTIVE', 'DRAFT'].includes(o.status) ? <Button loading={set.isPending} onClick={() => set.mutate('ACTIVE')}>Activate Offer</Button> : <Button variant="danger" loading={set.isPending} onClick={() => set.mutate('INACTIVE')}>Deactivate Offer</Button>)}
      </div>)}</Async>
    </div>
  );
}
