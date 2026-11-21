import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Minus, Plus, Clock, Circle, MessageCircle, Star } from 'lucide-react';
import { ArrivalRoom, Async, Header, Button, Input, Textarea, Card, Badge, cx, useAuth } from '@dusknyt/ui';
import { formatINR, fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { useStore } from '../store';

const Row = ({ k, v }) => <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>;

export function GuestDetails() {
  const nav = useNavigate(); const { user } = useAuth(); const { draft, setDraft } = useStore();
  const o = draft.offer;
  const entryTypes = o?.entryTypes?.length ? o.entryTypes : [o?.entryType].filter(Boolean);
  const [count, setCount] = useState(Math.max(1, draft.guests.length || (entryTypes.includes('Couple') ? 2 : 1)));
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
        <Input label="Eligible for" value={(o.entryTypes?.length ? o.entryTypes : [o.entryType]).join(' & ')} readOnly />
        <div><p className="mb-1 text-xs text-muted">Number of guests</p>
          <div className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2">
            <button onClick={() => setCount(Math.max(1, count - 1))}><Minus size={18} /></button><span className="font-semibold">{count}</span><button onClick={() => setCount(Math.min(10, count + 1))}><Plus size={18} /></button></div></div>
        {Array.from({ length: count - 1 }, (_, i) => <Input key={i} label={`Guest ${i + 2} name`} value={names[i]} onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))} />)}
        <Textarea label="Special note (optional)" value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} />
      </div>
      <div className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-line p-4"><Button disabled={!valid} onClick={() => { setDraft({ guests }); nav('/book/review'); }}>Continue</Button></div>
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
        <Card className="divide-y divide-line py-2"><Row k="Guests" v={draft.guests.length} /><Row k="Eligible for" v={(o.entryTypes?.length ? o.entryTypes : [o.entryType]).join(' & ')} /><Row k="Guestlist entry" v={`${o.entryFrom || '9:00 PM'}–${o.entryBefore}`} /></Card>
        <Card><p className="mb-1 text-xs text-muted">Guest list</p>{draft.guests.map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}</p>)}</Card>
        <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-brand" />I agree to the terms and conditions</label>
        {err && <p className="text-sm text-bad">{err}</p>}
      </div>
      <div className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-line p-4"><Button loading={send.isPending} disabled={!ok} onClick={() => { setErr(''); send.mutate(); }}>Confirm & Send Request</Button></div>
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
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const { token } = useAuth(); const [ratingValue, setRatingValue] = useState(0); const [ratingComment, setRatingComment] = useState(''); const [ratingError, setRatingError] = useState(''); const [arrivalOpen, setArrivalOpen] = useState(false); const [now, setNow] = useState(Date.now());
  const q = useQuery({ queryKey: ['gl', id], queryFn: () => http.get(`/guestlist/${id}`), refetchOnWindowFocus: true, refetchInterval: (c) => (c.state.data?.status === 'PENDING' ? 15000 : false) });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(timer); }, []);
  const rate = useMutation({ mutationFn: () => http.post(`/guestlist/${id}/rating`, { rating: ratingValue, ...(ratingComment.trim() && { comment: ratingComment.trim() }) }), onSuccess: () => { setRatingError(''); qc.invalidateQueries({ queryKey: ['gl', id] }); }, onError: (e) => setRatingError(errMsg(e)) });
  return (
    <div>
      <Header back title="Request Status" sub={q.data?.code} />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        {r.status === 'PENDING' && <Card><ol className="space-y-5 text-sm">
          <Step done title="Request Submitted" sub={new Date(r.createdAt).toLocaleString('en-IN')} />
          <Step active title="Under Review" sub="Promoter will confirm soon" /><Step title="Confirmation" sub="Awaiting" /></ol></Card>}
        {r.status === 'CONFIRMED' && (<div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-ok text-ok"><Check size={28} /></div>
          <h2 className="mt-2 text-xl font-bold">You're Confirmed!</h2><p className="text-xs text-muted">Enjoy your night</p>
          {r.qrCode && <img src={r.qrCode} alt="DUSKNYT booking reference QR" className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white p-2" />}<p className="mt-1 text-xs text-muted">Booking reference · {r.code}</p></div>)}
        {(r.status === 'REJECTED' || r.status === 'EXPIRED') && (<div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-bad text-bad"><X size={28} /></div>
          <h2 className="mt-2 text-xl font-bold">{r.status === 'EXPIRED' ? 'Request Expired' : 'Request Not Accepted'}</h2>
          {r.rejectReason && <Card className="mt-4 text-left"><p className="text-xs text-muted">Reason</p><p className="text-sm">{r.rejectReason}</p></Card>}
          <div className="mt-4"><Button onClick={() => nav(`/clubs/${r.offer.club.id}/offers`)}>View Other Offers</Button></div></div>)}
        <Card className="divide-y divide-line py-2"><Row k="Promoter" v={r.offer.promoter.brand} /><Row k="Club" v={r.offer.club.name} /><Row k="Date" v={fmtDate(r.offer.date)} /><Row k="Entry" v={`${r.offer.entryType} · ${r.guestCount} guest(s)`} /><Row k="Guestlist entry" v={`${r.offer.entryFrom || '9:00 PM'}–${r.offer.entryBefore}`} /></Card>
        {r.status === 'CONFIRMED' && <Card className="space-y-3"><div><h2 className="font-semibold">Meet your promoter</h2><p className="mt-1 text-xs text-muted">Your phone number stays private. Use DUSKNYT chat or an in-app internet call to agree on the guestlist meeting point. These open one hour before the event.</p></div>{(() => { const opensAt = r.arrivalSession?.opensAt ? new Date(r.arrivalSession.opensAt).getTime() : null; const closesAt = r.arrivalSession?.closesAt ? new Date(r.arrivalSession.closesAt).getTime() : null; const available = Boolean(opensAt && closesAt && now >= opensAt && now < closesAt); return available ? <Button className="gap-2" onClick={() => setArrivalOpen(true)}><MessageCircle size={16} />Chat or call promoter</Button> : opensAt && now < opensAt ? <p className="rounded-xl bg-brand/10 p-3 text-sm text-muted">Chat and internet calls open at {new Date(opensAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} India time.</p> : <p className="rounded-xl bg-card p-3 text-sm text-muted">The arrival contact window is closed. Check your booking details for the event.</p>; })()}</Card>}
        {arrivalOpen && <ArrivalRoom token={token} requestId={r.id} title={`${r.offer.promoter.brand} · ${r.offer.club.name}`} onClose={() => setArrivalOpen(false)} />}
        {r.status === 'CONFIRMED' && r.ratingPromptSentAt && <Card className="space-y-3"><div><h2 className="font-semibold">Rate your promoter</h2><p className="text-xs text-muted">How was {r.offer.promoter.brand} and the guestlist coordination for {r.offer.club.name}?</p></div>{r.rating ? <><div className="flex items-center gap-1 text-brand">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={18} className={i < r.rating.rating ? 'fill-brand' : ''} />)}<span className="ml-2 text-xs text-muted">Your rating</span></div>{r.rating.comment && <p className="text-sm text-muted">{r.rating.comment}</p>}<p className="text-xs text-ok">Thanks for sharing your feedback.</p></> : <><div className="flex gap-2" role="radiogroup" aria-label="Rate this promoter">{Array.from({ length: 5 }, (_, i) => <button key={i} type="button" role="radio" aria-checked={ratingValue === i + 1} aria-label={`${i + 1} star${i ? 's' : ''}`} onClick={() => setRatingValue(i + 1)} className={i < ratingValue ? 'text-brand' : 'text-muted'}><Star size={28} className={i < ratingValue ? 'fill-brand' : ''} /></button>)}</div><Textarea label="Comment (optional)" rows={3} maxLength={500} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} />{ratingError && <p className="text-xs text-bad">{ratingError}</p>}<Button disabled={!ratingValue} loading={rate.isPending} onClick={() => { setRatingError(''); rate.mutate(); }}>Submit rating</Button></>}</Card>}
      </div>)}</Async>
    </div>
  );
}
const Step = ({ done, active, title, sub }) => (
  <li className="flex gap-3"><span className={cx('mt-0.5', done ? 'text-brand' : active ? 'text-warn' : 'text-muted')}>{done ? <Check size={16} /> : active ? <Clock size={16} /> : <Circle size={16} />}</span>
    <div><p className="font-medium">{title}</p><p className="text-xs text-muted">{sub}</p></div></li>
);
