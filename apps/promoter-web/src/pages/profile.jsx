import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, UserCog, KeyRound, Bell, HelpCircle, Info, LogOut, BarChart3, Star } from 'lucide-react';
import { Async, Header, Button, Input, Textarea, Select, Card, Badge, Avatar, ThemeToggle, Toggle, EmptyState, useAuth } from '@dusknyt/ui';
import { timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

const Item = ({ to, icon: Icon, label, danger, onClick }) => {
  const C = to ? Link : 'button';
  return <C to={to} onClick={onClick} className={`flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-sm ${danger ? 'text-bad' : ''}`}><Icon size={18} /><span className="flex-1 text-left">{label}</span><ChevronRight size={16} className="text-muted" /></C>;
};

export function More() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['p-profile'], queryFn: () => http.get('/promoter/profile') });
  const ratings = useQuery({ queryKey: ['p-ratings'], queryFn: () => http.get('/promoter/ratings') });
  return (
    <div>
      <Header title="Profile" right={<ThemeToggle />} />
      <div className="flex items-center gap-3 p-4"><Avatar src={user.avatar} name={user.name} size={56} /><div><p className="font-semibold">{q.data?.promoter?.brand || user.name}</p><p className="text-xs text-muted">{user.name} · {user.phone}</p><p className="text-xs text-muted">{q.data?.promoter?.instagram ? `@${q.data.promoter.instagram.replace(/^@/, '')}` : 'Instagram not set'}</p></div></div>
      {q.data?.clubs?.length > 0 && <div className="px-4 pb-3"><p className="mb-2 text-xs font-semibold text-muted">CLUBS YOU WORK WITH</p><div className="flex flex-wrap gap-2">{q.data.clubs.map((c) => <span key={c.id} className="rounded-lg bg-card px-3 py-1.5 text-xs">{c.name}</span>)}</div></div>}
      <div className="px-4 pb-3"><Card className="space-y-3"><div className="flex items-center justify-between"><div><p className="font-semibold">Guest ratings</p><p className="text-xs text-muted">Feedback from confirmed guestlists</p></div><div className="flex items-center gap-1 text-brand"><Star size={16} className="fill-brand" /><span className="font-bold">{q.data?.rating?.count ? q.data.rating.average.toFixed(1) : '—'}</span><span className="text-xs text-muted">({q.data?.rating?.count || 0})</span></div></div>{ratings.data?.slice(0, 3).map((item) => <div key={item.id} className="border-t border-line pt-2"><p className="flex items-center gap-1 text-xs font-semibold"><Star size={13} className="fill-brand text-brand" />{item.rating}/5 · {item.guestRequest.offer.event?.title || item.guestRequest.offer.club.name}</p>{item.comment && <p className="mt-1 text-xs text-muted">{item.comment}</p>}</div>)}{ratings.data?.length === 0 && <p className="border-t border-line pt-2 text-xs text-muted">Ratings from guests will appear after events.</p>}</Card></div>
      <Item to="/analytics" icon={BarChart3} label="Analytics" /><Item to="/profile/edit" icon={UserCog} label="Edit Profile" /><Item to="/password" icon={KeyRound} label="Change Password" />
      <Item to="/notifications" icon={Bell} label="Notification Settings" /><Item to="/help" icon={HelpCircle} label="Help & Support" /><Item to="/about" icon={Info} label="About DUSKNYT" />
      <Item icon={LogOut} danger label="Logout" onClick={() => { logout(); nav('/login'); }} />
    </div>
  );
}

export function EditProfile() {
  const { user, update } = useAuth(); const nav = useNavigate(); const qc = useQueryClient();
  const profile = useQuery({ queryKey: ['p-profile'], queryFn: () => http.get('/promoter/profile') });
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', brand: '', instagram: '' }); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => http.put('/promoter/profile', { name: f.name, ...(f.email && { email: f.email }), brand: f.brand || profile.data?.promoter?.brand, instagram: f.instagram || profile.data?.promoter?.instagram || '' }),
    onSuccess: (u) => { update({ ...user, ...u }); qc.invalidateQueries({ queryKey: ['p-profile'] }); nav(-1); }, onError: (e) => setErr(errMsg(e)),
  });
  return (<div><Header back title="Edit Profile" /><div className="space-y-4 p-4">
    <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
    <Input label="Brand / company" value={f.brand || profile.data?.promoter?.brand || ''} onChange={(e) => setF({ ...f, brand: e.target.value })} /><Input label="Instagram ID" value={f.instagram || profile.data?.promoter?.instagram || ''} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="@yourhandle" />{err && <p className="text-xs text-bad">{err}</p>}
    <Button loading={save.isPending} onClick={() => save.mutate()}>Save Changes</Button></div></div>);
}

export function ChangePassword() {
  const nav = useNavigate(); const { user, update } = useAuth(); const forced = user?.mustChangePassword; const [f, setF] = useState({ current: '', next: '' }); const [err, setErr] = useState('');
  const save = useMutation({ mutationFn: () => http.post('/promoter/change-password', { ...(forced ? {} : { current: f.current }), next: f.next }), onSuccess: () => { if (forced) update({ ...user, mustChangePassword: false }); nav('/', { replace: true }); }, onError: (e) => setErr(errMsg(e)) });
  return (<div><Header back title="Change Password" /><div className="space-y-4 p-4">
    {forced && <p className="text-sm text-muted">Set a new password before continuing to your promoter account.</p>}{!forced && <Input label="Current password" type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />}<Input label="New password (min 8)" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
    {err && <p className="text-xs text-bad">{err}</p>}<Button loading={save.isPending} disabled={f.next.length < 8} onClick={() => save.mutate()}>Update Password</Button></div></div>);
}

export function Notifications() {
  const [on, setOn] = useState(() => localStorage.getItem('dn_p_push') !== '0');
  return (<div><Header back title="Notification Settings" />
    <div className="flex items-center justify-between px-4 py-4 text-sm"><span>New request alerts</span><Toggle on={on} onChange={(v) => { setOn(v); localStorage.setItem('dn_p_push', v ? '1' : '0'); }} /></div>
    <p className="px-4 text-xs text-muted">New requests also show as a badge on the Requests tab.</p></div>);
}
export function Help() {
  const qc = useQueryClient(); const [category, setCategory] = useState('OFFER'); const [guestRequestId, setGuestRequestId] = useState(''); const [form, setForm] = useState({ subject: '', message: '' }); const [message, setMessage] = useState('');
  const tickets = useQuery({ queryKey: ['p-support-tickets'], queryFn: () => http.get('/promoter/support') });
  const requests = useQuery({ queryKey: ['p-support-requests'], queryFn: () => http.get('/promoter/requests', { tab: 'all', limit: 50 }) });
  const submit = useMutation({ mutationFn: () => http.post('/promoter/support', { ...form, category, ...(guestRequestId && { guestRequestId }) }), onSuccess: (ticket) => { setMessage(`Ticket ${ticket.ticketCode || ticket.id} submitted.`); setForm({ subject: '', message: '' }); setGuestRequestId(''); qc.invalidateQueries({ queryKey: ['p-support-tickets'] }); }, onError: (e) => setMessage(errMsg(e)) });
  return <div><Header back title="Help & Support" /><div className="space-y-4 p-4"><Card className="space-y-2"><h2 className="font-semibold">Promoter support</h2><p className="text-xs text-muted">Get help with offers, guest requests, arrival coordination, or your account. Include the related booking or offer details so we can investigate.</p><p className="text-xs text-muted">Never share your password or a guest’s sensitive information in a ticket.</p></Card><Select label="What do you need help with?" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'OFFER', label: 'Offers and events' }, { value: 'GUESTLIST_ENTRY', label: 'Guestlist or arrival' }, { value: 'BOOKING', label: 'Guest booking request' }, { value: 'ACCOUNT', label: 'Account or login' }, { value: 'OTHER', label: 'Something else' }]} /><Select label="Related request (optional)" value={guestRequestId} onChange={(e) => setGuestRequestId(e.target.value)} options={[{ value: '', label: 'No request selected' }, ...((requests.data?.items || []).map((r) => ({ value: r.id, label: `${r.code} · ${r.user.name} · ${r.offer.club.name}` })))]} /><Input label="Subject" maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><Textarea label="How can we help?" rows={5} maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />{message && <p className="text-xs text-muted">{message}</p>}<Button loading={submit.isPending} disabled={form.subject.trim().length < 3 || form.message.trim().length < 10} onClick={() => { setMessage(''); submit.mutate(); }}>Submit support ticket</Button><a className="block text-center text-xs text-brand" href="mailto:support@dusknyt.com">Email support instead</a><section className="space-y-3 pt-2"><div><h2 className="font-semibold">Your support tickets</h2><p className="text-xs text-muted">Track replies and ticket status here.</p></div><Async q={tickets} empty={<EmptyState title="No support tickets" text="Tickets you submit will appear here." />}>{(list) => list.map((ticket) => <Card key={ticket.id} className="space-y-2"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-brand">{ticket.ticketCode || `Legacy ticket ${ticket.id.slice(-6)}`}</p><p className="font-medium">{ticket.subject}</p></div><Badge s={ticket.status} /></div><p className="text-xs text-muted">{ticket.category.replaceAll('_', ' ')} · {timeAgo(ticket.updatedAt)}{ticket.guestRequest ? ` · Request ${ticket.guestRequest.code}` : ''}</p><p className="whitespace-pre-wrap text-sm text-muted">{ticket.message}</p>{ticket.adminReply && <div className="rounded-xl bg-brand/10 p-3"><p className="mb-1 text-xs font-semibold">DUSKNYT support replied</p><p className="whitespace-pre-wrap text-sm">{ticket.adminReply}</p></div>}</Card>)}</Async></section></div></div>;
}
export const About = () => (<div><Header back title="About DUSKNYT" /><div className="space-y-3 p-4 text-sm text-muted"><p>DUSKNYT connects guests with the best nightlife and promoters. Manage your offers and guestlist requests from one simple app.</p></div></div>);
