import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Async, Header, Button, Input, Select, Textarea, Chip, Tabs, Badge, Img, Card, EmptyState, ErrorState } from '@dusknyt/ui';
import { ENTRY_TYPES, OFFER_TYPES, OFFER_INCLUSIONS, formatINR, fmtDate } from '@dusknyt/shared';
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
          <div className="min-w-0 flex-1"><p className="font-semibold">{o.club.name}</p><p className="truncate text-xs text-muted">{fmtDate(o.date)} · {o.offerType} · {o.entryType}</p><p className="text-xs text-muted">{o._count.requests} requests</p></div><Badge s={o.status} /></Link>))}</div>)}</Async>
      <Link to="/offers/new" className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg" aria-label="Create offer"><Plus /></Link>
    </div>
  );
}

export function CreateOffer() {
  const nav = useNavigate(); const qc = useQueryClient(); const [step, setStep] = useState(1); const [err, setErr] = useState('');
  const clubs = useQuery({ queryKey: ['p-clubs'], queryFn: () => http.get('/promoter/clubs') });
  const [f, setF] = useState({ clubId: '', eventId: '', eventTitle: '', djName: '', startTime: '9:00 PM', genre: '', entryType: 'Couple', offerType: 'Free Entry', price: 0, entryBefore: '9:00 PM', date: '', inclusions: [], terms: '' });
  const club = clubs.data?.find((c) => c.id === f.clubId);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: async (status) => {
      const event = await http.post('/promoter/events', { clubId: f.clubId, title: f.eventTitle, djName: f.djName || undefined, date: f.date, startTime: f.startTime, genre: f.genre || undefined });
      return http.post('/promoter/offers', {
        ...f, status, eventId: event.id, date: event.date, price: f.offerType === 'Free Entry' || f.offerType === 'Ladies Night' ? 0 : +f.price,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); nav('/offers', { replace: true }); },
    onError: (e) => setErr(errMsg(e)),
  });
  const onClub = (e) => { setF({ ...f, clubId: e.target.value, eventId: '', eventTitle: '', djName: '', date: '' }); };
  const onEvent = (e) => { const ev = club?.events.find((x) => x.id === e.target.value); setF({ ...f, eventId: e.target.value, eventTitle: ev?.title || '', djName: ev?.djName || '', startTime: ev?.startTime || '9:00 PM', date: ev?.date?.slice(0, 10) || f.date }); };
  const toggleInclusion = (value) => setF((old) => ({ ...old, inclusions: old.inclusions.includes(value) ? old.inclusions.filter((x) => x !== value) : [...old.inclusions, value] }));
  return (
    <div className="pb-8">
      <Header back title="Create New Offer" sub={`Step ${step} of 2`} />
      <Async q={clubs}>{() => (<div className="space-y-4 p-4">
        {step === 1 ? (<>
          <Select label="Club" value={f.clubId} onChange={onClub} options={[{ value: '', label: 'Select club' }, ...clubs.data.map((c) => ({ value: c.id, label: c.name }))]} />
          <Select label="Use an existing event (optional)" value={f.eventId} onChange={onEvent} options={[{ value: '', label: 'Create event details below' }, ...(club?.events || []).map((e) => ({ value: e.id, label: `${e.title} · ${fmtDate(e.date)}` }))]} />
          <Input label="Event name" value={f.eventTitle} onChange={set('eventTitle')} placeholder="e.g. Bollywood Night" />
          <Input label="DJ / performer (optional)" value={f.djName} onChange={set('djName')} />
          <Input label="Event date" type="date" value={f.date.slice(0, 10)} onChange={set('date')} />
          <Input label="Event start time" value={f.startTime} onChange={set('startTime')} />
          <Input label="Music / theme (optional)" value={f.genre} onChange={set('genre')} placeholder="e.g. Bollywood" />
          <div><p className="mb-1 text-xs text-muted">Entry type</p><div className="flex flex-wrap gap-2">{ENTRY_TYPES.map((t) => <Chip key={t} active={f.entryType === t} onClick={() => setF({ ...f, entryType: t })}>{t}</Chip>)}</div></div>
          <Select label="Offer type" value={f.offerType} onChange={set('offerType')} options={OFFER_TYPES} />
          {['Cover Charge', 'Stag Entry'].includes(f.offerType) && <Input label="Price (₹)" type="number" min="0" value={f.price} onChange={set('price')} />}
          <Input label="Entry before" value={f.entryBefore} onChange={set('entryBefore')} placeholder="9:30 PM" />
          <Button disabled={!f.clubId || !f.date || f.eventTitle.trim().length < 2} onClick={() => setStep(2)}>Next</Button>
        </>) : (<>
          <fieldset><legend className="mb-2 text-xs text-muted">Select everything included</legend><div className="grid grid-cols-2 gap-2">{OFFER_INCLUSIONS.map((item) => <label key={item} className="flex items-center gap-2 rounded-xl border border-line bg-card p-2 text-xs"><input type="checkbox" checked={f.inclusions.includes(item)} onChange={() => toggleInclusion(item)} className="accent-brand" />{item}</label>)}</div></fieldset>
          <Textarea label="Terms & conditions" rows={4} value={f.terms} onChange={set('terms')} />
          <Card className="text-sm"><p className="font-semibold">{club?.name} · {f.offerType}</p><p className="text-xs text-muted">{f.entryType} · {fmtDate(f.date)} · before {f.entryBefore}</p></Card>
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
        <Card><div className="flex justify-between"><p className="text-lg font-bold">{o.club.name}</p><Badge s={o.status} /></div><p className="text-sm text-muted">{fmtDate(o.date)} · {o.offerType} · {o.entryType}</p><p className="mt-2 text-3xl font-black">{formatINR(o.price)}</p><p className="text-xs text-muted">Entry before {o.entryBefore} · {o._count.requests} requests</p></Card>
        {o.inclusions.length > 0 && <Card><p className="mb-1 text-xs text-muted">Included</p>{o.inclusions.map((x) => <p key={x} className="text-sm">• {x}</p>)}</Card>}
        {o.status === 'INACTIVE' && <p className="text-center text-sm text-muted">Offer expired or inactive.</p>}
        {['INACTIVE', 'DRAFT'].includes(o.status) ? <Button loading={set.isPending} onClick={() => set.mutate('ACTIVE')}>Activate Offer</Button> : <Button variant="danger" loading={set.isPending} onClick={() => set.mutate('INACTIVE')}>Deactivate Offer</Button>}
      </div>)}</Async>
    </div>
  );
}
