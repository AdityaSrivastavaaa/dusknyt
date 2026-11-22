import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Input, Badge, Card, Toggle, EmptyState, Avatar } from '@dusknyt/ui';
import { fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, AddLink, SearchBox, Table, Td, KV, useDebounced } from '../components';

const loginTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never logged in';

export function Promoters() {
  const [text, setText] = useState(''); const q = useDebounced(text);
  const res = useQuery({ queryKey: ['a-promoters', q], queryFn: () => http.get('/admin/promoters', { q: q || undefined, limit: 50 }) });
  return (<div><PageTitle title="Promoters" action={<AddLink to="/promoters/new" label="Add Promoter" />} /><SearchBox value={text} onChange={setText} placeholder="Search promoters…" />
    <Async q={res} empty={<EmptyState title="No promoters" />}>{(d) => (<Table head={['Promoter', 'Instagram', 'Phone', 'Last login', 'Offers', 'Status']}>{d.items.map((p) => (
      <tr key={p.id}><Td><Link to={`/promoters/${p.id}`} className="flex items-center gap-3 font-medium"><Avatar name={p.user.name || p.brand} size={32} /><span>{p.user.name || p.brand}<small className="block text-xs font-normal text-muted">{p.brand}</small><small className="block max-w-xs truncate text-xs font-normal text-muted">Clubs: {[...new Map(p.offers.map((o) => [o.club.id, o.club.name])).values()].join(', ') || 'None yet'}</small></span></Link></Td><Td>{p.instagram ? `@${p.instagram.replace(/^@/, '')}` : '—'}</Td><Td>{p.user.phone}</Td><Td className="whitespace-nowrap text-xs">{loginTime(p.user.promoterLoginHistory?.[0]?.loggedInAt)}</Td><Td>{p._count.offers}</Td><Td><Badge s={p.status} /></Td></tr>))}
      <tr><Td colSpan={6} className="text-xs text-muted">Showing {d.items.length} of {d.total} promoters</Td></tr></Table>)}</Async></div>);
}

export function PromoterDetails() {
  const { id } = useParams(); const qc = useQueryClient(); const [temporaryPassword, setTemporaryPassword] = useState(''); const [passwordEmailStatus, setPasswordEmailStatus] = useState('');
  const q = useQuery({ queryKey: ['a-promoter', id], queryFn: () => http.get(`/admin/promoters/${id}`) });
  const set = useMutation({ mutationFn: (status) => http.put(`/admin/promoters/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-promoter', id] }) });
  const reset = useMutation({ mutationFn: () => http.post(`/admin/promoters/${id}/reset-password`, {}), onSuccess: (d) => { setTemporaryPassword(d.temporaryPassword); setPasswordEmailStatus(d.emailSent ? 'New temporary credentials emailed to the promoter.' : `Password email not sent: ${d.emailError || 'Email delivery failed.'}`); } });
  return (<div><PageTitle title="Promoter Details" />
    <Async q={q}>{(p) => (<div className="space-y-4">
      <Card className="flex items-center gap-4"><Avatar name={p.brand} size={56} /><div className="flex-1"><p className="text-lg font-bold">{p.brand}</p><p className="text-xs text-muted">{p.user.phone} · {p.user.email}</p></div><Badge s={p.status} /></Card>
      <Card className="divide-y divide-line"><KV k="Joined" v={fmtDate(p.createdAt)} /><KV k="Instagram" v={p.instagram ? <a className="text-brand" href={`https://instagram.com/${p.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{p.instagram.replace(/^@/, '')}</a> : '—'} /><KV k="Total offers" v={p.offers.length} /><KV k="Total requests" v={p.stats.total} /><KV k="Confirmed" v={p.stats.confirmed} /></Card>
      <Card className="space-y-3"><div><p className="text-sm font-semibold">Login history</p><p className="text-xs text-muted">Successful password and OTP sign-ins</p></div>{p.user.promoterLoginHistory?.length ? <div className="space-y-3">{p.user.promoterLoginHistory.map((login) => <div key={login.id} className="flex min-w-0 items-start justify-between gap-3 border-t border-line pt-3"><div className="min-w-0"><p className="text-sm font-medium">{loginTime(login.loggedInAt)}</p><p className="mt-1 text-xs text-muted">IP: {login.ipAddress || 'Unavailable'}</p><p className="max-w-full break-words text-[11px] text-muted">{login.userAgent || 'Device details unavailable'}</p></div></div>)}</div> : <p className="border-t border-line pt-3 text-sm text-muted">No successful logins recorded yet. History starts after this update is deployed.</p>}</Card>
      <Card className="space-y-3"><p className="text-sm font-semibold">Account access</p><Button className="!w-auto" loading={reset.isPending} onClick={() => { setTemporaryPassword(''); setPasswordEmailStatus(''); reset.mutate(); }}>Issue temporary password</Button>{passwordEmailStatus && <p className={`text-xs ${passwordEmailStatus.startsWith('New') ? 'text-ok' : 'text-bad'}`}>{passwordEmailStatus}</p>}{temporaryPassword && <div className="rounded-xl bg-line p-3 text-sm"><p>The password was emailed when delivery succeeded. Keep this one-time fallback private.</p><code className="font-bold">{temporaryPassword}</code></div>}</Card>
      <div className="flex items-center justify-between"><span className="text-sm">Active</span><Toggle on={p.status === 'ACTIVE'} onChange={(v) => set.mutate(v ? 'ACTIVE' : 'INACTIVE')} /></div>
      <p className="text-sm font-semibold">Offers</p><Table head={['Offer', 'Club', 'Date', 'Status']}>{p.offers.map((o) => <tr key={o.id}><Td><Link to={`/offers/${o.id}`}>{o.title}</Link></Td><Td>{o.club.name}</Td><Td>{fmtDate(o.date)}</Td><Td><Badge s={o.status} /></Td></tr>)}</Table>
    </div>)}</Async></div>);
}

export function PromoterForm() {
  const nav = useNavigate(); const qc = useQueryClient(); const [err, setErr] = useState(''); const [created, setCreated] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', email: '', brand: '', instagram: '' }); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({ mutationFn: () => http.post('/admin/promoters', f), onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['a-promoters'] }); setCreated(d); }, onError: (e) => setErr(errMsg(e)) });
  return (<div><PageTitle title="Add New Promoter" /><Card className="max-w-xl space-y-4">
    <Input label="Full name" value={f.name} onChange={set('name')} /><Input label="Phone number" value={f.phone} onChange={set('phone')} placeholder="+91" /><Input label="Email address" type="email" required value={f.email} onChange={set('email')} />
    <Input label="Company / brand" value={f.brand} onChange={set('brand')} /><Input label="Instagram ID" value={f.instagram} onChange={set('instagram')} placeholder="@promoter" />
    <p className="text-xs text-muted">A branded welcome email will contain the promoter app link and temporary login credentials. The promoter must change the password after first login.</p>
    {err && <p className="text-xs text-bad">{err}</p>}<div className="flex gap-3"><Button variant="outline" onClick={() => nav(-1)}>Cancel</Button><Button loading={save.isPending} disabled={!!created || !f.name || !f.phone || !f.email || !f.brand || !f.instagram} onClick={() => save.mutate()}>Add Promoter</Button></div>
    {created && <div className="rounded-xl border border-brand p-4 text-sm"><p className="font-semibold">Promoter created</p><p className={created.emailSent ? 'text-ok' : 'text-bad'}>{created.emailSent ? `Welcome email sent to ${created.user.email}.` : `Welcome email was not sent: ${created.emailError || 'delivery failed'}. Configure the email service, then issue a new temporary password from promoter details.`}</p><p className="mt-2">Phone: <b>{created.user.phone}</b></p><p>Temporary password: <code className="font-bold">{created.temporaryPassword}</code></p><Button className="mt-3" onClick={() => nav('/promoters')}>Done</Button></div>}
    </Card></div>);
}
