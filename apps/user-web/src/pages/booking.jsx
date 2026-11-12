import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Minus, Plus, Clock, Circle } from 'lucide-react';
import { Async, Header, Button, Input, Textarea, Card, Badge, cx, useAuth } from '@dusknyt/ui';
import { formatINR, fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { useStore } from '../store';

const Row = ({ k, v }) => <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>;

export function GuestDetails() {
  const nav = useNavigate(); const { user } = useAuth(); const { draft, setDraft } = useStore();
  const o = draft.offer;
  const [count, setCount] = useState(Math.max(1, draft.guests.length || (o?.entryType === 'Couple' ? 2 : 1)));
  const [names, setNames] = useState(() => Array.from({ length: 10 }, (_, i) => draft.guests[i + 1]?.name || ''));
  if (!o) return <Navigate to="/" replace />;
  const guests = [{ name: user.name, gender: '' }, ...names.slice(0, count - 1).map((name) => ({ name, gender: '' }))];
  const valid = guests.every((g) => g.name.trim());
  return (
    <div className="pb-24">
      <Header back title="Guest Details" sub={`${o.promoter?.brand} · ${o.club?.name} · ${fmtDate(o.date)}`} />
      <div className="space-y-4 p-4">
        <Input label="Your name" value={user.name} readOnly />
        <Input label="Phone number" value={user.phone || ''} readOnly />
        <Input label="Entry type" value={`${o.entryType} Entry`} readOnly />
        <div><p className="mb-1 text-xs text-muted">Number of guests</p>
          <div className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2">
            <button onClick={() => setCount(Math.max(1, count - 1))}><Minus size={18} /></button><span className="font-semibold">{count}</span><button onClick={() => setCount(Math.min(10, count + 1))}><Plus size={18} /></button></div></div>
        {Array.from({ length: count - 1 }, (_, i) => <Input key={i} label={`Guest ${i + 2} name`} value={names[i]} onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))} />)}
        <Textarea label="Special note (optional)" value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} />
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-bg p-4"><Button disabled={!valid} onClick={() => { setDraft({ guests }); nav('/book/review'); }}>Continue</Button></div>
    </div>
  );
}

export function Review() {
  const nav = useNavigate(); const qc = useQueryClient(); const { draft, clearDraft } = useStore(); const [ok, setOk] = useState(false); const [err, setErr] = useState('');
  const o = draft.offer;
  const send = useMutation({
    mutationFn: () => http.post('/guestlist', { offerId: o.id, guests: draft.guests, note: draft.note || undefined }),
    onSuccess: (r) => { clearDraft(); qc.invalidateQueries({ queryKey: ['guestlists'] }); nav(`/book/submitted/${r.id}`, { replace: true }); },
    onError: (e) => setErr(errMsg(e)),
  });
  if (!o || !draft.guests.length) return <Navigate to="/" replace />;
  return (
    <div className="pb-28">
      <Header back title="Review & Confirm" sub="Please review your details" />
      <div className="space-y-3 p-4">
        <Card><p className="text-xs text-muted">{o.promoter?.brand}</p><p className="text-sm text-muted">{o.club?.name} · {fmtDate(o.date)}</p><p className="text-3xl font-black">{o.price ? formatINR(o.price) : '₹0'}</p><p className="text-sm text-brand">{o.offerType}</p></Card>
        <Card className="divide-y divide-line py-2"><Row k="Guests" v={draft.guests.length} /><Row k="Entry type" v={`${o.entryType} Entry`} /><Row k="Arrive before" v={o.entryBefore} /></Card>
        <Card><p className="mb-1 text-xs text-muted">Guest list</p>{draft.guests.map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}</p>)}</Card>
        <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-brand" />I agree to the terms and conditions</label>
        {err && <p className="text-sm text-bad">{err}</p>}
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-bg p-4"><Button loading={send.isPending} disabled={!ok} onClick={() => { setErr(''); send.mutate(); }}>Confirm & Send Request</Button></div>
    </div>
  );
}

export function Submitted() {
  const { id } = useParams(); const q = useQuery({ queryKey: ['gl', id], queryFn: () => http.get(`/guestlist/${id}`) });
  return (
    <div className="p-6 text-center">
      <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full border-2 border-brand text-brand"><Check size={36} /></div>
      <h1 className="mt-4 text-2xl font-bold">Request Sent!</h1><p className="mb-6 text-sm text-muted">Your guestlist request has been sent to the promoter.</p>
      <Async q={q}>{(r) => (<Card className="divide-y divide-line py-2 text-left"><Row k="Request ID" v={r.code} /><Row k="Status" v={<Badge s={r.status} />} /><Row k="Promoter" v={r.offer.promoter.brand} /><Row k="Club" v={r.offer.club.name} /><Row k="Date" v={fmtDate(r.offer.date)} /></Card>)}</Async>
      <div className="mt-6"><Link to={`/requests/${id}`}><Button>Track Request</Button></Link></div>
    </div>
  );
}

export function RequestStatus() {
  const { id } = useParams(); const nav = useNavigate();
  const q = useQuery({ queryKey: ['gl', id], queryFn: () => http.get(`/guestlist/${id}`), refetchInterval: (c) => (c.state.data?.status === 'PENDING' ? 15000 : false) });
  return (
    <div>
      <Header back title="Request Status" sub={q.data?.code} />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        {r.status === 'PENDING' && <Card><ol className="space-y-5 text-sm">
          <Step done title="Request Submitted" sub={new Date(r.createdAt).toLocaleString('en-IN')} />
          <Step active title="Under Review" sub="Promoter will confirm soon" /><Step title="Confirmation" sub="Awaiting" /></ol></Card>}
        {r.status === 'CONFIRMED' && (<div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-ok text-ok"><Check size={28} /></div>
          <h2 className="mt-2 text-xl font-bold">You're Confirmed!</h2><p className="text-xs text-muted">Enjoy your night</p>
          {r.qrCode && <img src={r.qrCode} alt="Entry pass QR" className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white p-2" />}<p className="mt-1 text-xs text-muted">{r.code}</p></div>)}
        {(r.status === 'REJECTED' || r.status === 'EXPIRED') && (<div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-bad text-bad"><X size={28} /></div>
          <h2 className="mt-2 text-xl font-bold">{r.status === 'EXPIRED' ? 'Request Expired' : 'Request Not Accepted'}</h2>
          {r.rejectReason && <Card className="mt-4 text-left"><p className="text-xs text-muted">Reason</p><p className="text-sm">{r.rejectReason}</p></Card>}
          <div className="mt-4"><Button onClick={() => nav(`/clubs/${r.offer.club.id}/offers`)}>View Other Offers</Button></div></div>)}
        <Card className="divide-y divide-line py-2"><Row k="Promoter" v={r.offer.promoter.brand} /><Row k="Club" v={r.offer.club.name} /><Row k="Date" v={fmtDate(r.offer.date)} /><Row k="Entry" v={`${r.offer.entryType} · ${r.guestCount} guest(s)`} /><Row k="Arrive before" v={r.offer.entryBefore} /></Card>
      </div>)}</Async>
    </div>
  );
}
const Step = ({ done, active, title, sub }) => (
  <li className="flex gap-3"><span className={cx('mt-0.5', done ? 'text-brand' : active ? 'text-warn' : 'text-muted')}>{done ? <Check size={16} /> : active ? <Clock size={16} /> : <Circle size={16} />}</span>
    <div><p className="font-medium">{title}</p><p className="text-xs text-muted">{sub}</p></div></li>
);
