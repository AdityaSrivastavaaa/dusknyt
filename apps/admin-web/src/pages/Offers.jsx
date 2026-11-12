import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Input, Select, Textarea, Chip, Badge, Card, Tabs, EmptyState } from '@dusknyt/ui';
import { ENTRY_TYPES, OFFER_TYPES, formatINR, fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, AddLink, SearchBox, Table, Td, KV, useDebounced } from '../components';

export function Offers() {
  const [status, setStatus] = useState('ALL'); const [text, setText] = useState(''); const q = useDebounced(text);
  const res = useQuery({ queryKey: ['a-offers', status, q], queryFn: () => http.get('/admin/offers', { status, q: q || undefined, limit: 50 }) });
  return (<div><PageTitle title="Offers" action={<AddLink to="/offers/new" label="Add Offer" />} /><SearchBox value={text} onChange={setText} placeholder="Search offers…" />
    <div className="mb-4 max-w-md"><Tabs tabs={[{ value: 'ALL', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'UPCOMING', label: 'Upcoming' }, { value: 'EXPIRED', label: 'Expired' }]} value={status} onChange={setStatus} /></div>
    <Async q={res} empty={<EmptyState title="No active offers" text="You haven't created any offers yet." />}>{(d) => (<Table head={['Offer', 'Promoter', 'Date', 'Price', 'Status']}>{d.items.map((o) => (
      <tr key={o.id}><Td><Link to={`/offers/${o.id}`} className="font-medium">{o.title}</Link></Td><Td>{o.promoter.brand}</Td><Td>{fmtDate(o.date)}</Td><Td>{formatINR(o.price)}</Td><Td><Badge s={o.status} /></Td></tr>))}
      <tr><Td colSpan={5} className="text-xs text-muted">Showing {d.items.length} of {d.total} offers</Td></tr></Table>)}</Async></div>);
}

export function OfferDetails() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['a-offer', id], queryFn: () => http.get(`/admin/offers/${id}`) });
  const set = useMutation({ mutationFn: (status) => http.patch(`/admin/offers/${id}/status`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-offer', id] }) });
  return (<div><PageTitle title="Offer Details" />
    <Async q={q}>{(o) => (<div className="max-w-xl space-y-4">
      <Card className="flex items-center justify-between"><div><p className="text-lg font-bold">{o.club.name}</p><p className="text-xs text-muted">{o.offerType} · {o.entryType}</p></div><Badge s={o.status} /></Card>
      <Card className="divide-y divide-line"><KV k="Promoter" v={o.promoter.brand} /><KV k="Date" v={fmtDate(o.date)} /><KV k="Price" v={formatINR(o.price)} /><KV k="Entry before" v={o.entryBefore} /><KV k="Total requests" v={o._count.requests} /><KV k="Confirmed" v={o.confirmed} /></Card>
      <div className="flex gap-3"><Button className="!w-auto" onClick={() => nav(`/offers/${id}/edit`)}>Edit Offer</Button>
        <Button className="!w-auto" variant={o.status === 'ACTIVE' ? 'danger' : 'success'} loading={set.isPending} onClick={() => set.mutate(o.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{o.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</Button></div>
    </div>)}</Async></div>);
}

export function OfferForm() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState('');
  const clubs = useQuery({ queryKey: ['a-clubs-all'], queryFn: () => http.get('/admin/clubs', { limit: 100 }) });
  const promoters = useQuery({ queryKey: ['a-promoters-all'], queryFn: () => http.get('/admin/promoters', { limit: 100 }) });
  const ex = useQuery({ queryKey: ['a-offer', id], queryFn: () => http.get(`/admin/offers/${id}`), enabled: !!id });
  const [f, setF] = useState(null);
  const form = f || (id ? ex.data && { ...ex.data, date: ex.data.date.slice(0, 10), inclusions: ex.data.inclusions.join('\n') } : { clubId: '', promoterId: '', date: '', entryType: 'Couple', offerType: 'Free Entry', price: 0, entryBefore: '9:00 PM', inclusions: '', terms: '', status: 'ACTIVE' });
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = { clubId: form.clubId || clubs.data.items[0].id, promoterId: form.promoterId || promoters.data.items[0].id, date: form.date, entryType: form.entryType, offerType: form.offerType, price: +form.price, entryBefore: form.entryBefore, terms: form.terms || undefined, status: form.status, inclusions: String(form.inclusions).split('\n').map((s) => s.trim()).filter(Boolean) };
      return id ? http.put(`/admin/offers/${id}`, body) : http.post('/admin/offers', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['a-offers'] }); nav('/offers'); }, onError: (e) => setErr(errMsg(e)),
  });
  if (!form || !clubs.data || !promoters.data) return <div className="p-6 text-sm text-muted">Loading…</div>;
  return (<div><PageTitle title={id ? 'Edit Offer' : 'Create New Offer'} /><Card className="max-w-xl space-y-4">
    <Select label="Club" value={form.clubId || clubs.data.items[0].id} onChange={set('clubId')} options={clubs.data.items.map((c) => ({ value: c.id, label: c.name }))} />
    <Select label="Promoter" value={form.promoterId || promoters.data.items[0].id} onChange={set('promoterId')} options={promoters.data.items.map((p) => ({ value: p.id, label: p.brand }))} />
    <Input label="Event date" type="date" value={form.date} onChange={set('date')} />
    <div><p className="mb-1 text-xs text-muted">Entry type</p><div className="flex flex-wrap gap-2">{ENTRY_TYPES.map((t) => <Chip key={t} active={form.entryType === t} onClick={() => setF({ ...form, entryType: t })}>{t}</Chip>)}</div></div>
    <Select label="Offer type" value={form.offerType} onChange={set('offerType')} options={OFFER_TYPES} /><Input label="Price (₹)" type="number" min="0" value={form.price} onChange={set('price')} /><Input label="Entry before" value={form.entryBefore} onChange={set('entryBefore')} />
    <Select label="Status" value={form.status} onChange={set('status')} options={['ACTIVE', 'UPCOMING', 'DRAFT', 'INACTIVE', 'EXPIRED']} />
    <Textarea label="Inclusions (one per line)" value={form.inclusions} onChange={set('inclusions')} /><Textarea label="Terms" value={form.terms || ''} onChange={set('terms')} />
    {err && <p className="text-xs text-bad">{err}</p>}<div className="flex gap-3"><Button variant="outline" onClick={() => nav(-1)}>Cancel</Button><Button loading={save.isPending} disabled={!form.date} onClick={() => save.mutate()}>Save Offer</Button></div></Card></div>);
}
