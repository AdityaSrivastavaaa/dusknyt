import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Input, Badge, Card, Toggle, EmptyState, Avatar } from '@dusknyt/ui';
import { fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, AddLink, SearchBox, Table, Td, KV, useDebounced } from '../components';

export function Promoters() {
  const [text, setText] = useState(''); const q = useDebounced(text);
  const res = useQuery({ queryKey: ['a-promoters', q], queryFn: () => http.get('/admin/promoters', { q: q || undefined, limit: 50 }) });
  return (<div><PageTitle title="Promoters" action={<AddLink to="/promoters/new" label="Add Promoter" />} /><SearchBox value={text} onChange={setText} placeholder="Search promoters…" />
    <Async q={res} empty={<EmptyState title="No promoters" />}>{(d) => (<Table head={['Promoter', 'Instagram', 'Phone', 'Offers', 'Status']}>{d.items.map((p) => (
      <tr key={p.id}><Td><Link to={`/promoters/${p.id}`} className="flex items-center gap-3 font-medium"><Avatar name={p.user.name || p.brand} size={32} /><span>{p.user.name || p.brand}<small className="block text-xs font-normal text-muted">{p.brand}</small><small className="block max-w-xs truncate text-xs font-normal text-muted">Clubs: {[...new Map(p.offers.map((o) => [o.club.id, o.club.name])).values()].join(', ') || 'None yet'}</small></span></Link></Td><Td>{p.instagram ? `@${p.instagram.replace(/^@/, '')}` : '—'}</Td><Td>{p.user.phone}</Td><Td>{p._count.offers}</Td><Td><Badge s={p.status} /></Td></tr>))}
      <tr><Td colSpan={5} className="text-xs text-muted">Showing {d.items.length} of {d.total} promoters</Td></tr></Table>)}</Async></div>);
}

export function PromoterDetails() {
  const { id } = useParams(); const qc = useQueryClient(); const [temporaryPassword, setTemporaryPassword] = useState('');
  const q = useQuery({ queryKey: ['a-promoter', id], queryFn: () => http.get(`/admin/promoters/${id}`) });
  const set = useMutation({ mutationFn: (status) => http.put(`/admin/promoters/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-promoter', id] }) });
  const reset = useMutation({ mutationFn: () => http.post(`/admin/promoters/${id}/reset-password`, {}), onSuccess: (d) => setTemporaryPassword(d.temporaryPassword) });
  return (<div><PageTitle title="Promoter Details" />
    <Async q={q}>{(p) => (<div className="space-y-4">
      <Card className="flex items-center gap-4"><Avatar name={p.brand} size={56} /><div className="flex-1"><p className="text-lg font-bold">{p.brand}</p><p className="text-xs text-muted">{p.user.phone} · {p.user.email}</p></div><Badge s={p.status} /></Card>
      <Card className="divide-y divide-line"><KV k="Joined" v={fmtDate(p.createdAt)} /><KV k="Instagram" v={p.instagram ? <a className="text-brand" href={`https://instagram.com/${p.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{p.instagram.replace(/^@/, '')}</a> : '—'} /><KV k="Total offers" v={p.offers.length} /><KV k="Total requests" v={p.stats.total} /><KV k="Confirmed" v={p.stats.confirmed} /></Card>
      <Card className="space-y-3"><p className="text-sm font-semibold">Account access</p><Button className="!w-auto" loading={reset.isPending} onClick={() => { setTemporaryPassword(''); reset.mutate(); }}>Issue temporary password</Button>{temporaryPassword && <div className="rounded-xl bg-line p-3 text-sm"><p>Share this temporary password with the promoter. It is shown only once.</p><code className="font-bold">{temporaryPassword}</code></div>}</Card>
      <div className="flex items-center justify-between"><span className="text-sm">Active</span><Toggle on={p.status === 'ACTIVE'} onChange={(v) => set.mutate(v ? 'ACTIVE' : 'INACTIVE')} /></div>
      <p className="text-sm font-semibold">Offers</p><Table head={['Offer', 'Club', 'Date', 'Status']}>{p.offers.map((o) => <tr key={o.id}><Td><Link to={`/offers/${o.id}`}>{o.title}</Link></Td><Td>{o.club.name}</Td><Td>{fmtDate(o.date)}</Td><Td><Badge s={o.status} /></Td></tr>)}</Table>
    </div>)}</Async></div>);
}

export function PromoterForm() {
  const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState(''); const [created, setCreated] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', email: '', brand: '', instagram: '' }); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({ mutationFn: () => http.post('/admin/promoters', f), onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['a-promoters'] }); setCreated(d); }, onError: (e) => setErr(errMsg(e)) });
  return (<div><PageTitle title="Add New Promoter" /><Card className="max-w-xl space-y-4">
    <Input label="Full name" value={f.name} onChange={set('name')} /><Input label="Phone number" value={f.phone} onChange={set('phone')} placeholder="+91" /><Input label="Email (optional)" type="email" value={f.email} onChange={set('email')} />
    <Input label="Company / brand" value={f.brand} onChange={set('brand')} /><Input label="Instagram ID" value={f.instagram} onChange={set('instagram')} placeholder="@promoter" />
    <p className="text-xs text-muted">A temporary password will be generated. The promoter must change it after their first login.</p>
    {err && <p className="text-xs text-bad">{err}</p>}<div className="flex gap-3"><Button variant="outline" onClick={() => nav(-1)}>Cancel</Button><Button loading={save.isPending} disabled={!!created || !f.name || !f.phone || !f.brand || !f.instagram} onClick={() => save.mutate()}>Add Promoter</Button></div>
    {created && <div className="rounded-xl border border-brand p-4 text-sm"><p className="font-semibold">Promoter created</p><p>Share these credentials securely. The password is shown only once.</p><p className="mt-2">Phone: <b>{created.user.phone}</b></p><p>Temporary password: <code className="font-bold">{created.temporaryPassword}</code></p><Button className="mt-3" onClick={() => nav('/promoters')}>Done</Button></div>}
    </Card></div>);
}
