import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, UserCog, KeyRound, Bell, HelpCircle, Info, LogOut, BarChart3 } from 'lucide-react';
import { Async, Header, Button, Input, Avatar, ThemeToggle, Toggle, EmptyState, useAuth } from '@dusknyt/ui';
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
  return (
    <div>
      <Header title="Profile" right={<ThemeToggle />} />
      <div className="flex items-center gap-3 p-4"><Avatar src={user.avatar} name={user.name} size={56} /><div><p className="font-semibold">{q.data?.promoter?.brand || user.name}</p><p className="text-xs text-muted">{user.phone}</p><p className="text-xs text-muted">{user.email}</p></div></div>
      <Item to="/analytics" icon={BarChart3} label="Analytics" /><Item to="/profile/edit" icon={UserCog} label="Edit Profile" /><Item to="/password" icon={KeyRound} label="Change Password" />
      <Item to="/notifications" icon={Bell} label="Notification Settings" /><Item to="/help" icon={HelpCircle} label="Help & Support" /><Item to="/about" icon={Info} label="About DUSKNYT" />
      <Item icon={LogOut} danger label="Logout" onClick={() => { logout(); nav('/login'); }} />
    </div>
  );
}

export function EditProfile() {
  const { user, update } = useAuth(); const nav = useNavigate(); const qc = useQueryClient();
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', brand: '' }); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => http.put('/promoter/profile', { name: f.name, ...(f.email && { email: f.email }), ...(f.brand && { brand: f.brand }) }),
    onSuccess: (u) => { update({ ...user, ...u }); qc.invalidateQueries({ queryKey: ['p-profile'] }); nav(-1); }, onError: (e) => setErr(errMsg(e)),
  });
  return (<div><Header back title="Edit Profile" /><div className="space-y-4 p-4">
    <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
    <Input label="Brand / company (optional)" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />{err && <p className="text-xs text-bad">{err}</p>}
    <Button loading={save.isPending} onClick={() => save.mutate()}>Save Changes</Button></div></div>);
}

export function ChangePassword() {
  const nav = useNavigate(); const [f, setF] = useState({ current: '', next: '' }); const [err, setErr] = useState('');
  const save = useMutation({ mutationFn: () => http.post('/promoter/change-password', f), onSuccess: () => nav(-1), onError: (e) => setErr(errMsg(e)) });
  return (<div><Header back title="Change Password" /><div className="space-y-4 p-4">
    <Input label="Current password" type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /><Input label="New password (min 8)" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
    {err && <p className="text-xs text-bad">{err}</p>}<Button loading={save.isPending} disabled={f.next.length < 8} onClick={() => save.mutate()}>Update Password</Button></div></div>);
}

export function Notifications() {
  const [on, setOn] = useState(() => localStorage.getItem('dn_p_push') !== '0');
  return (<div><Header back title="Notification Settings" />
    <div className="flex items-center justify-between px-4 py-4 text-sm"><span>New request alerts</span><Toggle on={on} onChange={(v) => { setOn(v); localStorage.setItem('dn_p_push', v ? '1' : '0'); }} /></div>
    <p className="px-4 text-xs text-muted">New requests also show as a badge on the Requests tab.</p></div>);
}
export const Help = () => (<div><Header back title="Help & Support" /><div className="space-y-3 p-4 text-sm text-muted"><p>Need help with an offer or request?</p><a className="block text-brand" href="mailto:support@dusknyt.com">support@dusknyt.com</a></div></div>);
export const About = () => (<div><Header back title="About DUSKNYT" /><div className="space-y-3 p-4 text-sm text-muted"><p>DUSKNYT connects guests with the best nightlife and promoters. Manage your offers and guestlist requests from one simple app.</p></div></div>);
