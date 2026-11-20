import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Heart, Bookmark, Bell, UserCog, Settings as Cog, HelpCircle, LogOut, ChevronDown } from 'lucide-react';
import { Async, Header, Button, Input, Textarea, Tabs, Card, Badge, Avatar, EmptyState, ThemeToggle, Toggle, useAuth, cx } from '@dusknyt/ui';
import { fmtDate, timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { ClubCard, OfferCard } from '../components';

async function profilePhotoDataUrl(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Choose an image file.');
  const source = URL.createObjectURL(file); const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
    const scale = Math.min(1, 512 / image.width, 512 / image.height);
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally { URL.revokeObjectURL(source); }
}

export function Saved() {
  const { token } = useAuth(); const nav = useNavigate();
  const [tab, setTab] = useState('clubs');
  const q = useQuery({ queryKey: ['saved', tab], queryFn: () => http.get('/saved', { type: tab }), enabled: !!token });
  if (!token) return <><Header title="Saved" sub="Your saved clubs & offers" /><LoginPrompt onLogin={() => nav('/login', { state: { from: '/saved' } })} /></>;
  return (
    <div>
      <Header title="Saved" sub="Your saved clubs & offers" />
      <div className="p-4"><Tabs tabs={[{ value: 'clubs', label: 'Clubs' }, { value: 'offers', label: 'Offers' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No Saved Items" text="You haven't saved anything yet." action={<Link to="/explore"><Button>Explore Clubs</Button></Link>} />}>{(list) => (
        <div className="space-y-3 px-4">{list.map((x) => (tab === 'clubs' ? <ClubCard key={x.id} club={x} /> : <OfferCard key={x.id} offer={x} />))}</div>)}</Async>
    </div>
  );
}

export function MyGuestlists() {
  const { token } = useAuth(); const nav = useNavigate(); const [tab, setTab] = useState('upcoming');
  const q = useQuery({ queryKey: ['guestlists', tab], queryFn: () => http.get('/guestlist', { status: tab }), enabled: !!token });
  if (!token) return <><Header title="My Bookings" /><LoginPrompt message="Log in to see your current guestlist requests and entry passes." onLogin={() => nav('/login', { state: { from: '/guestlists' } })} /></>;
  return (
    <div>
      <Header title="My Bookings" sub="Requests, confirmations and entry passes" />
      <div className="p-4"><Tabs tabs={[{ value: 'upcoming', label: 'Current' }, { value: 'pending', label: 'Pending' }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="Nothing here" text="Your guestlist requests will show up here." />}>{(list) => (
        <div className="space-y-3 px-4">{list.map((r) => (
          <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-card p-4">
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.offer.event?.title || r.offer.club.name}</p><p className="text-xs text-muted">{r.offer.club.name} · {fmtDate(r.offer.date)}</p><p className="text-xs text-muted">{r.guestCount} guests · {r.offer.entryFrom || '9:00 PM'}–{r.offer.entryBefore}</p><p className="text-xs text-muted">{r.offer.promoter.brand}</p><p className="mt-1 text-xs text-fg">Guest names: {(r.guests || []).map((guest) => guest.name).filter(Boolean).join(', ') || 'No guest names provided'}</p></div><Badge s={r.status} /></Link>))}</div>)}</Async>
    </div>
  );
}

export function Notifications() {
  const qc = useQueryClient(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => http.get('/notifications') });
  const readAll = useMutation({ mutationFn: () => http.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <div>
      <Header back title="Notifications" />
      <Async q={q} empty={<EmptyState title="No notifications" />}>{(list) => (<>
        <div className="divide-y divide-line">{list.map((n) => (
          <button key={n.id} onClick={() => n.requestId && nav(`/requests/${n.requestId}`)} className="flex w-full gap-3 px-4 py-3 text-left">
            <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-line' : 'bg-brand')} />
            <div><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-muted">{n.body}</p><p className="mt-0.5 text-[11px] text-muted">{timeAgo(n.createdAt)}</p></div></button>))}</div>
        <button className="mx-auto mt-4 block text-sm text-brand" onClick={() => readAll.mutate()}>Mark all as read</button></>)}</Async>
    </div>
  );
}

const MenuItem = ({ to, icon: Icon, label, onClick }) => {
  const C = to ? Link : 'button';
  return <C to={to} onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-sm"><Icon size={18} className="text-muted" /><span className="flex-1 text-left">{label}</span><ChevronRight size={16} className="text-muted" /></C>;
};

function LoginPrompt({ onLogin, message = 'Log in to view your account and saved items.' }) {
  return <div className="p-5"><Card className="text-center"><h2 className="font-semibold">Please log in</h2><p className="mt-2 text-sm text-muted">{message}</p><Button className="mt-4" onClick={onLogin}>Log in</Button></Card></div>;
}

export function Profile() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  if (!user) return <><Header title="Profile" /><LoginPrompt onLogin={() => nav('/login', { state: { from: '/profile' } })} /></>;
  return (
    <div>
      <Header title="Profile" sub="Your DUSKNYT account" />
      <div className="space-y-5 p-4">
        <Card className="flex min-w-0 items-center gap-3 p-4">
          <Avatar src={user.avatar} name={user.name} size={60} />
          <div className="min-w-0 flex-1"><p className="truncate text-base font-semibold">{user.name || 'DUSKNYT Guest'}</p><p className="truncate text-xs text-muted">{user.phone || user.email || 'Guest account'}</p>{user.email && user.phone && <p className="truncate text-xs text-muted">{user.email}</p>}</div>
          <Link to="/profile/edit" className="shrink-0 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-brand">Edit</Link>
        </Card>
        <section><h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Your activity</h2><Card className="overflow-hidden p-0"><MenuItem to="/guestlists" icon={Heart} label="My Bookings" /><MenuItem to="/saved" icon={Bookmark} label="Saved Clubs & Offers" /><MenuItem to="/notifications" icon={Bell} label="Notifications" /></Card></section>
        <section><h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Account & support</h2><Card className="overflow-hidden p-0"><MenuItem to="/settings" icon={Cog} label="Settings" /><MenuItem to="/help" icon={HelpCircle} label="Help & Support" /></Card></section>
        <Card className="overflow-hidden p-0"><MenuItem icon={LogOut} label="Log out" onClick={() => { logout(); nav('/login'); }} /></Card>
      </div>
    </div>
  );
}

export function EditProfile() {
  const { user, update } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', dob: user.dob?.slice(0, 10) || '', avatar: user.avatar || '' }); const [err, setErr] = useState('');
  const save = useMutation({ mutationFn: () => http.put('/me', f), onSuccess: (u) => { update(u); nav(-1); }, onError: (e) => setErr(errMsg(e)) });
  return (
    <div>
      <Header back title="Edit Profile" />
      <div className="space-y-4 p-4"><div className="flex flex-col items-center gap-3"><Avatar src={f.avatar} name={f.name} size={88} /><label className="w-full rounded-xl border border-line bg-card p-3 text-xs text-muted">Upload profile photo from your phone<input type="file" accept="image/*" onChange={async (e) => { try { setErr(''); const avatar = await profilePhotoDataUrl(e.target.files?.[0]); setF((old) => ({ ...old, avatar })); } catch (error) { setErr(error.message || 'Could not read this image.'); } }} className="mt-2 block w-full text-sm text-fg" /></label>{f.avatar && <button type="button" onClick={() => setF((old) => ({ ...old, avatar: '' }))} className="text-xs text-bad">Remove photo</button>}</div>
        <Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Date of birth" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        {err && <p className="text-xs text-bad">{err}</p>}<Button loading={save.isPending} onClick={() => save.mutate()}>Save Changes</Button></div>
    </div>
  );
}

export function Settings() {
  const nav = useNavigate(); const { logout } = useAuth();
  const [push, setPush] = useState(() => localStorage.getItem('dn_push') !== '0');
  return (
    <div>
      <Header back title="Settings" />
      <div className="divide-y divide-line">
        <div className="flex items-center justify-between px-4 py-4 text-sm"><span>Push notifications</span><Toggle on={push} onChange={(v) => { setPush(v); localStorage.setItem('dn_push', v ? '1' : '0'); }} /></div>
        <div className="flex items-center justify-between px-4 py-4 text-sm"><span>Theme</span><ThemeToggle /></div>
        <a className="block px-4 py-4 text-sm" href="https://dusknyt.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
        <a className="block px-4 py-4 text-sm" href="https://dusknyt.com/terms" target="_blank" rel="noreferrer">Terms & Conditions</a>
        <button className="block w-full px-4 py-4 text-left text-sm text-bad" onClick={() => { logout(); nav('/login'); }}>Logout</button>
      </div>
    </div>
  );
}

const FAQ = [
  ['How does the guestlist work?', 'Pick a club and offer, send a request, and the promoter reviews it. Once confirmed you get a QR entry pass to show at the door.'],
  ['How long does confirmation take?', 'Most requests are answered within a few hours. Requests for past events expire automatically.'],
  ['Booking & cancellation', 'Requests can be tracked under My Guestlists. If your plans change, simply do not use the pass and send a new request later.'],
];
export function Help() {
  const { token } = useAuth(); const [open, setOpen] = useState(null); const [f, setF] = useState({ subject: '', message: '' }); const [msg, setMsg] = useState('');
  const send = useMutation({ mutationFn: () => http.post('/support', f), onSuccess: () => { setMsg('Thanks! Our team will get back to you.'); setF({ subject: '', message: '' }); }, onError: (e) => setMsg(errMsg(e)) });
  return (
    <div>
      <Header back title="Help & Support" />
      <div className="divide-y divide-line">{FAQ.map(([q, a], i) => (
        <div key={q}><button className="flex w-full items-center justify-between px-4 py-4 text-sm" onClick={() => setOpen(open === i ? null : i)}>{q}<ChevronDown size={16} className={cx(open === i && 'rotate-180')} /></button>
          {open === i && <p className="px-4 pb-4 text-xs text-muted">{a}</p>}</div>))}</div>
      <div className="space-y-3 p-4"><h3 className="text-sm font-semibold">Report an issue</h3>
        {token ? (<><Input label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /><Textarea label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          {msg && <p className="text-xs text-muted">{msg}</p>}<Button loading={send.isPending} disabled={f.subject.length < 3 || f.message.length < 5} onClick={() => send.mutate()}>Submit</Button></>) : <p className="text-xs text-muted">Log in to contact support.</p>}
        <a href="mailto:support@dusknyt.com" className="block text-center text-xs text-brand">Contact Support</a></div>
      <p className="pb-6 text-center text-xs text-muted">We're here to help!</p>
    </div>
  );
}
