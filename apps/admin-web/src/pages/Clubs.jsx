import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Input, Select, Textarea, Chip, Badge, Card, Img, Tabs, EmptyState } from '@dusknyt/ui';
import { MUSIC, formatINR, fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, AddLink, SearchBox, Table, Td, KV, useDebounced } from '../components';

export function Clubs() {
  const [text, setText] = useState(''); const q = useDebounced(text);
  const res = useQuery({ queryKey: ['a-clubs', q], queryFn: () => http.get('/admin/clubs', { q: q || undefined, limit: 50 }) });
  return (<div><PageTitle title="Clubs" action={<AddLink to="/clubs/new" label="Add Club" />} /><SearchBox value={text} onChange={setText} placeholder="Search clubs…" />
    <Async q={res} empty={<EmptyState title="No clubs" />}>{(d) => (<Table head={['Club', 'Area', 'Rating', 'Status']}>{d.items.map((c) => (
      <tr key={c.id}><Td><Link to={`/clubs/${c.id}`} className="flex items-center gap-3 font-medium"><Img src={c.images[0]} name={c.name} className="h-10 w-10 rounded-lg" />{c.name}</Link></Td><Td>{c.area || c.city.name}</Td><Td>{c.rating}</Td><Td><Badge s={c.status} /></Td></tr>))}
      <tr><Td colSpan={4} className="text-xs text-muted">Showing {d.items.length} of {d.total} clubs</Td></tr></Table>)}</Async></div>);
}

export function ClubDetails() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [tab, setTab] = useState('overview');
  const [ev, setEv] = useState({ title: '', djName: '', date: '', startTime: '9:00 PM' });
  const q = useQuery({ queryKey: ['a-club', id], queryFn: () => http.get(`/admin/clubs/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['a-club', id] });
  const addEv = useMutation({ mutationFn: () => http.post(`/admin/clubs/${id}/events`, ev), onSuccess: () => { setEv({ title: '', djName: '', date: '', startTime: '9:00 PM' }); refresh(); } });
  const delEv = useMutation({ mutationFn: (eid) => http.del(`/admin/events/${eid}`), onSuccess: refresh });
  const toggle = useMutation({ mutationFn: (status) => http.put(`/admin/clubs/${id}`, { status }), onSuccess: refresh });
  return (<div><PageTitle title="Club Details" />
    <Async q={q}>{(c) => (<div className="space-y-4">
      <Card className="flex items-center gap-4"><Img src={c.images[0]} name={c.name} className="h-16 w-16 rounded-xl" /><div className="flex-1"><p className="text-lg font-bold">{c.name}</p><p className="text-xs text-muted">{c.address}</p></div><Badge s={c.status} /></Card>
      <Tabs tabs={[{ value: 'overview', label: 'Overview' }, { value: 'events', label: 'Events' }, { value: 'offers', label: 'Offers' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && <Card className="divide-y divide-line"><KV k="Address" v={c.address} /><KV k="Contact" v={c.phone} /><KV k="Email" v={c.email} /><KV k="Dress code" v={c.dressCode} /><KV k="Music" v={c.music.join(', ')} /><KV k="City" v={c.city.name} /></Card>}
      {tab === 'events' && (<><Card className="space-y-3"><p className="text-sm font-semibold">Add event</p><div className="grid gap-3 md:grid-cols-4"><Input label="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} /><Input label="DJ" value={ev.djName} onChange={(e) => setEv({ ...ev, djName: e.target.value })} /><Input label="Date" type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} /><Input label="Start" value={ev.startTime} onChange={(e) => setEv({ ...ev, startTime: e.target.value })} /></div>
        <Button className="!w-auto" disabled={!ev.title || !ev.date} loading={addEv.isPending} onClick={() => addEv.mutate()}>Add Event</Button></Card>
        <Table head={['Event', 'DJ', 'Date', '']}>{c.events.map((e) => <tr key={e.id}><Td>{e.title}</Td><Td>{e.djName}</Td><Td>{fmtDate(e.date)} · {e.startTime}</Td><Td><button className="text-xs text-bad" onClick={() => delEv.mutate(e.id)}>Delete</button></Td></tr>)}</Table></>)}
      {tab === 'offers' && <Table head={['Offer', 'Date', 'Price', 'Status']}>{c.offers.map((o) => <tr key={o.id}><Td><Link to={`/offers/${o.id}`}>{o.title}</Link></Td><Td>{fmtDate(o.date)}</Td><Td>{formatINR(o.price)}</Td><Td><Badge s={o.status} /></Td></tr>)}</Table>}
      <div className="flex gap-3"><Button className="!w-auto" onClick={() => nav(`/clubs/${id}/edit`)}>Edit Club</Button>
        <Button variant={c.status === 'ACTIVE' ? 'danger' : 'success'} className="!w-auto" loading={toggle.isPending} onClick={() => toggle.mutate(c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</Button></div>
    </div>)}</Async></div>);
}

export function ClubForm() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState('');
  const cities = useQuery({ queryKey: ['a-cities'], queryFn: () => http.get('/admin/cities') });
  const existing = useQuery({ queryKey: ['a-club', id], queryFn: () => http.get(`/admin/clubs/${id}`), enabled: !!id });
  const [f, setF] = useState(null);
  const form = f || (id ? existing.data && { ...existing.data, image: existing.data.images[0] || '', music: existing.data.music } : { cityId: '', name: '', address: '', area: '', phone: '', email: '', dressCode: '', about: '', image: '', music: [] });
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = { cityId: form.cityId || cities.data[0].id, name: form.name, address: form.address, area: form.area || undefined, phone: form.phone || undefined, email: form.email || '', dressCode: form.dressCode || undefined, about: form.about || undefined, music: form.music, images: form.image ? [form.image] : [] };
      return id ? http.put(`/admin/clubs/${id}`, body) : http.post('/admin/clubs', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['a-clubs'] }); nav('/clubs'); }, onError: (e) => setErr(errMsg(e)),
  });
  if (!form || !cities.data) return <div className="p-6 text-sm text-muted">Loading…</div>;
  return (<div><PageTitle title={id ? 'Edit Club' : 'Add New Club'} />
    <Card className="max-w-xl space-y-4">
      <Input label="Club image URL" value={form.image} onChange={set('image')} placeholder="https://…" /><Input label="Club name" value={form.name} onChange={set('name')} />
      <Input label="Full address" value={form.address} onChange={set('address')} /><Input label="Area" value={form.area || ''} onChange={set('area')} />
      <Select label="City" value={form.cityId || cities.data[0].id} onChange={set('cityId')} options={cities.data.map((c) => ({ value: c.id, label: c.name }))} />
      <Input label="Contact number" value={form.phone || ''} onChange={set('phone')} /><Input label="Email" value={form.email || ''} onChange={set('email')} /><Input label="Dress code" value={form.dressCode || ''} onChange={set('dressCode')} />
      <div><p className="mb-1 text-xs text-muted">Music</p><div className="flex flex-wrap gap-2">{MUSIC.map((m) => <Chip key={m} active={form.music.includes(m)} onClick={() => setF({ ...form, music: form.music.includes(m) ? form.music.filter((x) => x !== m) : [...form.music, m] })}>{m}</Chip>)}</div></div>
      <Textarea label="About" value={form.about || ''} onChange={set('about')} />
      {err && <p className="text-xs text-bad">{err}</p>}
      <div className="flex gap-3"><Button variant="outline" onClick={() => nav(-1)}>Cancel</Button><Button loading={save.isPending} disabled={!form.name || !form.address} onClick={() => save.mutate()}>Save Club</Button></div>
    </Card></div>);
}
