import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Input, Textarea, Badge, Card, Tabs, Toggle, Avatar, EmptyState, Sheet, Select } from '@dusknyt/ui';
import { formatINR, fmtDate, timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, SearchBox, Table, Td, useDebounced } from '../components';

export function UsersList() {
  const [text, setText] = useState(''); const q = useDebounced(text); const qc = useQueryClient();
  const res = useQuery({ queryKey: ['a-users', q], queryFn: () => http.get('/admin/users', { q: q || undefined, limit: 50 }) });
  const set = useMutation({ mutationFn: ({ id, status }) => http.patch(`/admin/users/${id}/status`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-users'] }) });
  return (<div><PageTitle title="Users" /><SearchBox value={text} onChange={setText} placeholder="Search users…" />
    <Async q={res} empty={<EmptyState title="No users" />}>{(d) => (<Table head={['User', 'Phone', 'Joined', 'Status', '']}>{d.items.map((u) => (
      <tr key={u.id}><Td><span className="flex items-center gap-2"><Avatar src={u.avatar} name={u.name} size={28} />{u.name || '—'}</span></Td><Td>{u.phone || u.email}</Td><Td>{fmtDate(u.createdAt)}</Td><Td><Badge s={u.status} /></Td>
        <Td><button className="text-xs text-brand" onClick={() => set.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>{u.status === 'ACTIVE' ? 'Block' : 'Unblock'}</button></Td></tr>))}
      <tr><Td colSpan={5} className="text-xs text-muted">Showing {d.items.length} of {d.total} users</Td></tr></Table>)}</Async></div>);
}

export function Payouts() {
  const [tab, setTab] = useState('ALL'); const qc = useQueryClient(); const [open, setOpen] = useState(false); const [f, setF] = useState({ promoterId: '', amount: '' }); const [err, setErr] = useState('');
  const res = useQuery({ queryKey: ['a-payouts', tab], queryFn: () => http.get('/admin/payouts', { status: tab }) });
  const promoters = useQuery({ queryKey: ['a-promoters-all'], queryFn: () => http.get('/admin/promoters', { limit: 100 }), enabled: open });
  const pay = useMutation({ mutationFn: (id) => http.patch(`/admin/payouts/${id}/pay`), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-payouts'] }) });
  const create = useMutation({ mutationFn: () => http.post('/admin/payouts', { promoterId: f.promoterId || promoters.data.items[0].id, amount: +f.amount }), onSuccess: () => { setOpen(false); setF({ promoterId: '', amount: '' }); qc.invalidateQueries({ queryKey: ['a-payouts'] }); }, onError: (e) => setErr(errMsg(e)) });
  return (<div><PageTitle title="Payouts" action={<Button className="!w-auto" onClick={() => setOpen(true)}>New Payout</Button>} />
    <div className="mb-4 max-w-sm"><Tabs tabs={[{ value: 'ALL', label: 'All' }, { value: 'PAID', label: 'Paid' }, { value: 'PENDING', label: 'Pending' }]} value={tab} onChange={setTab} /></div>
    <Async q={res} empty={<EmptyState title="No payouts" />}>{(list) => (<Table head={['Promoter', 'Amount', 'Status', 'Date', '']}>{list.map((p) => (
      <tr key={p.id}><Td>{p.promoter.brand}</Td><Td className="font-semibold">{formatINR(p.amount)}</Td><Td><Badge s={p.status} /></Td><Td>{fmtDate(p.paidAt || p.createdAt)}</Td><Td>{p.status === 'PENDING' && <button className="text-xs text-brand" onClick={() => pay.mutate(p.id)}>Mark paid</button>}</Td></tr>))}</Table>)}</Async>
    <Sheet open={open} onClose={() => setOpen(false)} title="New payout"><div className="space-y-4">
      {promoters.data && <Select label="Promoter" value={f.promoterId || promoters.data.items[0]?.id} onChange={(e) => setF({ ...f, promoterId: e.target.value })} options={promoters.data.items.map((p) => ({ value: p.id, label: p.brand }))} />}
      <Input label="Amount (₹)" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />{err && <p className="text-xs text-bad">{err}</p>}
      <Button loading={create.isPending} disabled={!f.amount} onClick={() => create.mutate()}>Create</Button></div></Sheet></div>);
}

export function Settings() {
  const qc = useQueryClient(); const q = useQuery({ queryKey: ['a-settings'], queryFn: () => http.get('/admin/settings') });
  const save = useMutation({ mutationFn: ({ key, value }) => http.put(`/admin/settings/${key}`, { value }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-settings'] }) });
  const [pw, setPw] = useState({ current: '', next: '' }); const [msg, setMsg] = useState('');
  const change = useMutation({ mutationFn: () => http.post('/admin/change-password', pw), onSuccess: () => { setMsg('Password updated'); setPw({ current: '', next: '' }); }, onError: (e) => setMsg(errMsg(e)) });
  return (<div><PageTitle title="Settings" />
    <Async q={q}>{(s) => (<div className="max-w-xl space-y-4">
      <Card className="space-y-3"><p className="text-sm font-semibold">General</p>
        <Input label="Support email" defaultValue={s.general?.supportEmail} onBlur={(e) => save.mutate({ key: 'general', value: { ...s.general, supportEmail: e.target.value } })} />
        <Input label="Request expiry (hours)" type="number" defaultValue={s.general?.requestExpiryHours} onBlur={(e) => save.mutate({ key: 'general', value: { ...s.general, requestExpiryHours: +e.target.value } })} /></Card>
      <Card className="space-y-3"><p className="text-sm font-semibold">Notification settings</p>
        {['email', 'push'].map((k) => <div key={k} className="flex items-center justify-between text-sm"><span className="capitalize">{k} notifications</span><Toggle on={!!s.notifications?.[k]} onChange={(v) => save.mutate({ key: 'notifications', value: { ...s.notifications, [k]: v } })} /></div>)}</Card>
      <Card className="space-y-3"><p className="text-sm font-semibold">Change password</p><Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <Input label="New password (min 8)" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />{msg && <p className="text-xs text-muted">{msg}</p>}
        <Button loading={change.isPending} disabled={pw.next.length < 8} onClick={() => change.mutate()}>Update password</Button></Card>
      <div className="flex gap-4 text-sm text-brand"><Link to="/roles">Manage roles</Link><Link to="/logs">Activity logs</Link></div></div>)}</Async></div>);
}

export function Roles() {
  const qc = useQueryClient(); const q = useQuery({ queryKey: ['a-roles'], queryFn: () => http.get('/admin/roles') }); const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', description: '', permissions: '' });
  const add = useMutation({ mutationFn: () => http.post('/admin/roles', { ...f, permissions: f.permissions.split(',').map((s) => s.trim()).filter(Boolean) }), onSuccess: () => { setOpen(false); setF({ name: '', description: '', permissions: '' }); qc.invalidateQueries({ queryKey: ['a-roles'] }); } });
  const del = useMutation({ mutationFn: (id) => http.del(`/admin/roles/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-roles'] }) });
  return (<div><PageTitle title="Roles & Permissions" action={<Button className="!w-auto" onClick={() => setOpen(true)}>Add Role</Button>} />
    <Async q={q}>{(list) => <div className="grid gap-3 md:grid-cols-2">{list.map((r) => (<Card key={r.id} className="flex items-start justify-between"><div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{r.description}</p><p className="mt-1 text-[11px] text-brand">{r.permissions.join(', ')}</p></div>
      {r.name !== 'Super Admin' && <button className="text-xs text-bad" onClick={() => del.mutate(r.id)}>Delete</button>}</Card>))}</div>}</Async>
    <Sheet open={open} onClose={() => setOpen(false)} title="Add role"><div className="space-y-4"><Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <Input label="Permissions (comma separated)" value={f.permissions} onChange={(e) => setF({ ...f, permissions: e.target.value })} /><Button loading={add.isPending} disabled={f.name.length < 2} onClick={() => add.mutate()}>Save</Button></div></Sheet></div>);
}

export function ActivityLogs() {
  const q = useQuery({ queryKey: ['a-logs'], queryFn: () => http.get('/admin/activity-logs') });
  return (<div><PageTitle title="Activity Logs" /><Async q={q} empty={<EmptyState title="No activity yet" />}>{(list) => (<Card className="divide-y divide-line py-0">{list.map((l) => (<div key={l.id} className="flex justify-between gap-3 py-3 text-sm"><div><p>{l.action}</p><p className="text-xs text-muted">{l.actorName}</p></div><span className="shrink-0 text-xs text-muted">{timeAgo(l.createdAt)}</span></div>))}</Card>)}</Async></div>);
}

export function Notifications() {
  const q = useQuery({ queryKey: ['a-notifs'], queryFn: () => http.get('/admin/notifications'), refetchInterval: 30000 });
  return (<div><PageTitle title="Notifications" sub="Latest platform events" /><Async q={q} empty={<EmptyState title="No notifications" />}>{(list) => (<Card className="divide-y divide-line py-0">{list.map((l) => (<div key={l.id} className="flex justify-between gap-3 py-3 text-sm"><p>{l.action}</p><span className="shrink-0 text-xs text-muted">{timeAgo(l.createdAt)}</span></div>))}</Card>)}</Async></div>);
}

export function Support() {
  const [tab, setTab] = useState('OPEN'); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['a-tickets', tab], queryFn: () => http.get('/admin/tickets', { status: tab }) });
  const set = useMutation({ mutationFn: ({ id, status }) => http.patch(`/admin/tickets/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['a-tickets'] }) });
  return (<div><PageTitle title="Support Tickets" />
    <div className="mb-4 max-w-sm"><Tabs tabs={[{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'CLOSED', label: 'Closed' }]} value={tab} onChange={setTab} /></div>
    <Async q={q} empty={<EmptyState title="No tickets" />}>{(list) => <div className="space-y-3">{list.map((t) => (<Card key={t.id}><div className="flex items-start justify-between"><div><p className="font-medium">{t.subject}</p><p className="text-xs text-muted">{t.user.name} · {t.user.phone} · {timeAgo(t.createdAt)}</p></div><Badge s={t.status} /></div>
      <p className="mt-2 text-sm text-muted">{t.message}</p><div className="mt-3 flex gap-3 text-xs text-brand">{t.status !== 'IN_PROGRESS' && <button onClick={() => set.mutate({ id: t.id, status: 'IN_PROGRESS' })}>Mark in progress</button>}{t.status !== 'CLOSED' && <button onClick={() => set.mutate({ id: t.id, status: 'CLOSED' })}>Close</button>}</div></Card>))}</div>}</Async></div>);
}
