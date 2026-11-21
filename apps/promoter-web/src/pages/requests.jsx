import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrivalRoom, Async, Header, Button, Tabs, Badge, Avatar, Card, Select, Textarea, EmptyState, EventBannerArt, cx, useAuth } from '@dusknyt/ui';
import { QrCode, X } from 'lucide-react';
import { REJECT_REASONS, formatINR, fmtDate, timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

const Row = ({ k, v }) => <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>;

async function imageFileToDataUrl(file, maxWidth = 1400, maxHeight = 1800) {
  if (!file?.type.startsWith('image/')) throw new Error('Choose an image file.');
  const source = URL.createObjectURL(file); const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(source); }
}

export function Requests() {
  const [tab, setTab] = useState('all');
  const q = useQuery({ queryKey: ['requests', tab], queryFn: () => http.get('/promoter/requests', { tab }), refetchInterval: 30000 });
  return (
    <div>
      <Header title="Incoming Requests" />
      <div className="p-4"><Tabs tabs={[{ value: 'all', label: 'Show All' }, { value: 'new', label: `New${q.data?.newCount ? ` (${q.data.newCount})` : ''}` }, { value: 'pending', label: 'Pending' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No new requests" text="You're all caught up! New requests will appear here." />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No new requests" text="You're all caught up! New requests will appear here." /> : (
          <div className="divide-y divide-line">{d.items.map((r) => (
            <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3"><Avatar name={r.user.name} />
              <div className="min-w-0 flex-1"><p className="font-medium">{r.user.name}</p><p className="text-xs text-muted">{r.guestCount} Guests · {r.offer.entryType} Entry</p></div>
              <div className="text-right"><p className="text-[11px] text-muted">{timeAgo(r.createdAt)}</p>{r.status !== 'PENDING' && <Badge s={r.status} />}</div></Link>))}</div>)}
      </Async>
    </div>
  );
}

export function RequestDetails() {
  const { id } = useParams(); const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const q = useQuery({ queryKey: ['request', id], queryFn: () => http.get(`/promoter/requests/${id}`) });
  const checkIn = useMutation({ mutationFn: () => http.post(`/promoter/guestlist/${id}/check-in`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['guestlist'] }); }, onError: (e) => setCheckInError(errMsg(e)) });
  const [checkInError, setCheckInError] = useState('');
  useEffect(() => { if (q.data) qc.invalidateQueries({ queryKey: ['requests'] }); }, [q.data?.id]); // opening marks it as seen
  return (
    <div>
      <Header back title="Request Details" />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        <div className="flex items-center gap-3"><Avatar name={r.user.name} size={48} /><div><p className="font-semibold">{r.user.name}</p><p className="text-xs text-muted">{r.user.phone}</p></div><div className="ml-auto"><Badge s={r.status} /></div></div>
        <Card className="divide-y divide-line py-2"><Row k="Request ID" v={r.code} /><Row k="Club" v={r.offer.club.name} /><Row k="Entry type" v={`${r.offer.entryType} Entry`} /><Row k="Number of guests" v={r.guestCount} /><Row k="Arrive before" v={r.offer.entryBefore} />{r.checkedInAt && <Row k="Entry marked" v={new Date(r.checkedInAt).toLocaleString('en-IN')} />}{r.note && <Row k="Note" v={r.note} />}</Card>
        <Card><p className="mb-1 text-xs text-muted">Guests</p>{(r.guests || []).map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}{g.gender ? ` (${g.gender})` : ''}</p>)}</Card>
        {r.status === 'CONFIRMED' && (r.checkedInAt ? <Card className="border-ok/40 text-sm text-ok">You marked this guest group as arrived at {new Date(r.checkedInAt).toLocaleString('en-IN')}. This does not confirm club admission.</Card> : <Card className="space-y-3"><p className="text-sm text-muted">Mark when this confirmed guest group has met your team. This records promoter arrival only, not club admission.</p>{checkInError && <p className="text-xs text-bad">{checkInError}</p>}{(() => { const opensAt = r.checkInOpensAt ? new Date(r.checkInOpensAt) : null; const canCheckIn = !opensAt || now >= opensAt.getTime(); const opensLabel = opensAt?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); return <Button loading={checkIn.isPending} disabled={!canCheckIn} onClick={() => { setCheckInError(''); checkIn.mutate(); }}>{canCheckIn ? 'Mark Guestlist Arrival' : `Opens at ${opensLabel}`}</Button>; })()}</Card>)}
        {r.status === 'PENDING' ? <Link to={`/requests/${r.id}/review`}><Button>Review Request</Button></Link>
          : r.rejectReason && <p className="text-xs text-muted">Reason: {r.rejectReason}</p>}
      </div>)}</Async>
    </div>
  );
}

export function ReviewRequest() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient();
  const [reason, setReason] = useState(REJECT_REASONS[0]); const [note, setNote] = useState(''); const [rejecting, setRejecting] = useState(false); const [err, setErr] = useState('');
  const q = useQuery({ queryKey: ['request', id], queryFn: () => http.get(`/promoter/requests/${id}`) });
  const m = useMutation({
    mutationFn: (action) => http.post(`/promoter/requests/${id}/decision`, { action, reason: action === 'REJECT' ? reason : undefined, note: note || undefined }),
    onSuccess: () => { qc.invalidateQueries(); nav('/requests', { replace: true }); }, onError: (e) => setErr(errMsg(e)),
  });
  return (
    <div>
      <Header back title="Review Request" />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        <div className="flex items-center gap-3"><Avatar name={r.user.name} size={48} /><div><p className="font-semibold">{r.user.name}</p><p className="text-xs text-muted">{r.user.phone}</p></div></div>
        <Card className="divide-y divide-line py-2"><Row k="Entry type" v={`${r.offer.entryType} Entry`} /><Row k="Guests" v={r.guestCount} /><Row k="Arrive before" v={r.offer.entryBefore} /></Card>
        <p className="text-xs text-muted">Please review guest details carefully before confirming.</p>
        <Textarea label="Note for guest (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {rejecting && <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={REJECT_REASONS} />}
        {err && <p className="text-xs text-bad">{err}</p>}
        {!rejecting ? (<><Button variant="success" loading={m.isPending} onClick={() => m.mutate('ACCEPT')}>Accept Request</Button><Button variant="danger" onClick={() => setRejecting(true)}>Reject Request</Button></>)
          : (<><Button variant="danger" loading={m.isPending} onClick={() => m.mutate('REJECT')}>Confirm Rejection</Button><Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button></>)}
      </div>)}</Async>
    </div>
  );
}

export function Guestlist() {
  const [tab, setTab] = useState('tonight');
  const q = useQuery({ queryKey: ['guestlist-events', tab], queryFn: () => http.get('/promoter/guestlist/events', { tab }) });
  const exportCsv = async () => {
    const res = await http.raw.get('/promoter/guestlist/export', { params: { tab }, responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(res.data); a.download = `guestlist-${tab}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <Header title="Guestlist" sub="Choose an event to manage its guests" />
      <div className="p-4"><Tabs tabs={[{ value: 'tonight', label: 'Tonight' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No events" text="Events you promote will appear here, with their bookings and guest totals." />}>
        {(groups) => <>
          <div className="flex flex-col gap-4 px-4">{groups.map((group) => {
            const to = group.eventId ? `/guestlist/event?eventId=${encodeURIComponent(group.eventId)}` : `/guestlist/event?clubId=${encodeURIComponent(group.clubId)}&date=${group.event.date.slice(0, 10)}`;
            return <Link key={group.key} to={to} className="block">
              <Card className="overflow-hidden p-0 transition hover:border-brand/60">
                <div className="relative aspect-[16/8] bg-gradient-to-br from-brand-dark to-black">{group.banner && <img src={group.banner} alt={`${group.event.title} banner`} className="absolute inset-0 h-full w-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-white"><p className="text-lg font-bold">{group.event.title}</p><p className="truncate text-xs text-white/80">{group.club.name} · {fmtDate(group.event.date)} · {group.event.startTime}</p></div></div>
                <div className="space-y-3 p-4"><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-bg/60 p-2.5"><span className="block text-muted">Confirmed bookings</span><span className="mt-1 block text-base font-bold">{group.confirmedBookings}</span></div><div className="rounded-xl bg-bg/60 p-2.5"><span className="block text-muted">Confirmed guests</span><span className="mt-1 block text-base font-bold">{group.confirmedGuests}</span></div></div>
                  <div className="flex min-w-0 items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-muted">{group.event.djName || 'Performer TBA'} · {group.event.genre || 'Music TBA'} · {group.offers.length} offer{group.offers.length === 1 ? '' : 's'}</span><span className="shrink-0 font-semibold text-brand">View event →</span></div>
                  {group.pendingBookings > 0 && <p className="text-xs text-warn">{group.pendingBookings} pending booking{group.pendingBookings === 1 ? '' : 's'} · {group.pendingGuests} guests</p>}
                </div>
              </Card>
            </Link>;
          })}</div>
          <div className="p-4"><Button variant="outline" onClick={exportCsv}>Export All {tab} Guestlist</Button></div>
        </>}
      </Async>
    </div>
  );
}

export function GuestlistEvent() {
  const [sp] = useSearchParams(); const eventId = sp.get('eventId'); const clubId = sp.get('clubId'); const date = sp.get('date');
  const qc = useQueryClient(); const { token } = useAuth(); const [error, setError] = useState(''); const [scanOpen, setScanOpen] = useState(false); const [scanMessage, setScanMessage] = useState(''); const [arrivalRequestId, setArrivalRequestId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [bannerDraft, setBannerDraft] = useState(''); const [bannerError, setBannerError] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const scope = { ...(eventId && { eventId }), ...(!eventId && clubId && { clubId }), ...(!eventId && date && { date }) };
  const q = useQuery({ queryKey: ['guestlist-event-details', eventId, clubId, date], queryFn: () => http.get('/promoter/guestlist/event-details', scope), enabled: Boolean(eventId || (clubId && date)) });
  const checkIn = useMutation({ mutationFn: (id) => http.post(`/promoter/guestlist/${id}/check-in`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['guestlist-events'] }); qc.invalidateQueries({ queryKey: ['guestlist-event-details'] }); qc.invalidateQueries({ queryKey: ['guestlist'] }); }, onError: (e) => setError(errMsg(e)) });
  useEffect(() => { if (q.data) setBannerDraft(q.data.event?.bannerChangePending ? (q.data.event.pendingPoster || '') : (q.data.event?.poster || '')); }, [q.data?.event?.poster, q.data?.event?.pendingPoster, q.data?.event?.bannerChangePending]);
  const saveBanner = useMutation({ mutationFn: () => http.patch(`/promoter/events/${q.data.event.id}/banner`, { poster: bannerDraft }), onSuccess: (event) => { setBannerDraft(event.pendingPoster || ''); setBannerError('Banner change sent to admin for approval. Guests will keep seeing the current banner until it is approved.'); qc.invalidateQueries({ queryKey: ['guestlist-events'] }); qc.invalidateQueries({ queryKey: ['guestlist-event-details'] }); }, onError: (e) => setBannerError(errMsg(e)) });
  const exportCsv = async () => {
    const res = await http.raw.get('/promoter/guestlist/export', { params: { ...scope }, responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(res.data); a.download = `guestlist-event-${date || eventId}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <Header back title={q.data?.event?.title || 'Event Guestlist'} sub={q.data ? `${q.data.club.name} · ${fmtDate(q.data.event?.date || q.data.offers[0]?.date)}` : 'Event details and bookings'} right={q.data && <button onClick={exportCsv} className="whitespace-nowrap text-xs font-semibold text-brand">Export CSV</button>} />
      <Async q={q} empty={<EmptyState title="Event unavailable" text="This event has no offers assigned to your account." />}>
        {(data) => {
          const banner = bannerDraft;
          const todayIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
          const eventIsPast = (data.event?.date || data.offers[0]?.date).slice(0, 10) < todayIndia;
          const confirmed = data.requests.filter((request) => request.status === 'CONFIRMED');
          const pending = data.requests.filter((request) => request.status === 'PENDING');
          const confirmedGuests = confirmed.reduce((sum, request) => sum + request.guestCount, 0);
          return <div className="space-y-5 px-4 pb-6 pt-4">
            {error && <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-xs text-bad">{error}</p>}
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-dark to-black">{banner ? <img src={banner} alt={`${data.event?.title || data.club.name} event banner`} className="absolute inset-0 h-full w-full object-cover" /> : <EventBannerArt className="absolute inset-0 h-full w-full" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-white"><p className="text-2xl font-black">{data.event?.title || 'Guestlist'}</p><p className="mt-1 text-sm text-white/85">{data.club.name}</p></div></div>
            {data.event?.id && !eventIsPast && <Card className="space-y-3"><div><h2 className="font-semibold">Event banner</h2><p className="text-xs text-muted">Banner uploads and removals need admin approval before guests see the change.</p>{data.event.bannerChangePending && <p className="mt-1 text-xs text-warn">A banner change is waiting for admin approval.</p>}</div><label className="block text-xs text-muted">Choose photo from your phone<input type="file" accept="image/*" onChange={async (e) => { try { setBannerError(''); setBannerDraft(await imageFileToDataUrl(e.target.files?.[0])); } catch (err) { setBannerError(err.message || 'Could not read this image.'); } }} className="mt-1 block w-full text-sm" /></label>{bannerDraft && <button type="button" onClick={() => setBannerDraft('')} className="self-start text-xs text-bad">Request banner removal</button>}{bannerError && <p className={`text-xs ${bannerError.includes('sent to admin') ? 'text-ok' : 'text-bad'}`}>{bannerError}</p>}<Button loading={saveBanner.isPending} disabled={bannerDraft === (data.event?.bannerChangePending ? (data.event.pendingPoster || '') : (data.event?.poster || ''))} onClick={() => { setBannerError(''); saveBanner.mutate(); }}>Submit Banner Change</Button></Card>}
            <Card className="space-y-2"><h2 className="font-semibold">Event details</h2><Row k="Date" v={fmtDate(data.event?.date || data.offers[0]?.date)} /><Row k="Start time" v={data.event?.startTime || data.offers[0]?.entryFrom || '—'} /><Row k="DJ / performer" v={data.event?.djName || 'To be announced'} /><Row k="Music / theme" v={data.event?.genre || 'To be announced'} /><Row k="Venue" v={data.club.name} /><Row k="Address" v={data.club.address} /></Card>
            <section className="space-y-3"><h2 className="text-base font-bold">Offers for this event</h2>{data.offers.map((offer) => <Card key={offer.id} className="space-y-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{offer.offerType} · {offer.entryTypes?.length ? offer.entryTypes.join(' & ') : offer.entryType}</p><p className="text-xs text-muted">Entry {offer.entryFrom}–{offer.entryBefore}{offer.limitedSlots ? ' · Limited slots' : ''}</p></div><p className="shrink-0 font-bold">{formatINR(offer.price)}</p></div>{offer.inclusions?.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Perks</p><ul className="space-y-1 text-sm">{offer.inclusions.map((perk) => <li key={perk}>• {perk}</li>)}</ul></div>}{offer.terms && <p className="border-t border-line pt-2 text-xs text-muted">{offer.terms}</p>}</Card>)}</section>
            <section className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold">Confirmed guestlist</h2><p className="text-xs text-muted">{confirmed.length} bookings · {confirmedGuests} guests</p></div><Button className="!w-auto gap-2 !px-3 !py-2 text-xs" onClick={() => { setScanMessage(''); setScanOpen(true); }}><QrCode size={16} />Scan QR</Button></div>{confirmed.length ? confirmed.map((request) => <GuestRequestCard key={request.id} request={request} checkIn={checkIn} now={now} onOpenArrival={() => setArrivalRequestId(request.id)} />) : <Card className="text-sm text-muted">No confirmed guests for this event yet.</Card>}</section>
            {pending.length > 0 && <section className="space-y-3"><div><h2 className="text-base font-bold">Pending requests</h2><p className="text-xs text-muted">{pending.length} bookings · {pending.reduce((sum, request) => sum + request.guestCount, 0)} guests</p></div>{pending.map((request) => <GuestRequestCard key={request.id} request={request} now={now} />)}</section>}
            {scanOpen && <QRScanOverlay busy={checkIn.isPending} message={scanMessage} onClose={() => setScanOpen(false)} onScan={(rawValue) => {
              let reference = String(rawValue || '').trim();
              try { const parsed = JSON.parse(reference); reference = parsed.id || parsed.code || reference; } catch { try { const url = new URL(reference); reference = url.searchParams.get('id') || url.searchParams.get('code') || reference; } catch {} }
              const request = confirmed.find((item) => item.id === reference || item.code === reference);
              if (!request) { setScanMessage('This QR does not match a confirmed booking for this event.'); return; }
              if (request.checkedInAt) { setScanMessage(`${request.user.name} is already marked as entered.`); return; }
              setScanMessage(`Confirming entry for ${request.user.name}…`);
              checkIn.mutate(request.id, { onSuccess: () => { setScanMessage(`${request.user.name} marked as entered.`); setScanOpen(false); }, onError: (err) => setScanMessage(errMsg(err)) });
            }} />}
            {arrivalRequestId && <ArrivalRoom token={token} requestId={arrivalRequestId} title={`${data.event?.title || data.club.name} · ${data.club.name}`} onClose={() => setArrivalRequestId(null)} />}
          </div>;
        }}
      </Async>
    </div>
  );
}

function QRScanOverlay({ requests, busy, message, onClose, onScan }) {
  const videoRef = useRef(null); const onScanRef = useRef(onScan); onScanRef.current = onScan;
  const [cameraError, setCameraError] = useState(''); const [manualCode, setManualCode] = useState('');
  useEffect(() => {
    let active = true; let stream;
    const scan = async () => {
      if (!('BarcodeDetector' in window)) { setCameraError('QR scanning is not supported by this browser. Enter the booking reference shown below the guest’s QR instead.'); return; }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream; await videoRef.current.play();
        while (active) {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) { onScanRef.current(codes[0].rawValue); return; }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch (error) {
        if (active) setCameraError(error.name === 'NotAllowedError' ? 'Allow camera access to scan a guest QR code.' : 'Could not start the camera. Enter the booking reference manually.');
      }
    };
    scan();
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center"><div className="glass-panel w-full max-w-md space-y-4 rounded-2xl border border-line p-4 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="font-bold">Scan guest QR</h2><p className="text-xs text-muted">Scan a confirmed booking for this event</p></div><button type="button" onClick={onClose} aria-label="Close scanner" className="rounded-full border border-line p-2"><X size={18} /></button></div><video ref={videoRef} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />{cameraError && <p className="rounded-xl bg-warn/10 p-3 text-xs text-warn">{cameraError}</p>}{message && <p className="rounded-xl bg-brand/10 p-3 text-sm">{message}</p>}<form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (manualCode.trim()) onScan(manualCode.trim()); }}><input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Booking reference or QR ID" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" /><Button className="!w-auto !px-4" disabled={!manualCode.trim() || busy}>Check</Button></form><p className="text-[11px] text-muted">Camera access requires HTTPS. Entry is recorded only after the booking is verified.</p></div></div>;
}

function GuestRequestCard({ request, checkIn, now = Date.now(), onOpenArrival }) {
  const opensAt = request.checkInOpensAt ? new Date(request.checkInOpensAt) : null;
  const canCheckIn = !opensAt || now >= opensAt.getTime();
  const opensLabel = opensAt?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const chatOpens = request.arrivalChatOpensAt ? new Date(request.arrivalChatOpensAt) : null; const chatCloses = request.arrivalChatClosesAt ? new Date(request.arrivalChatClosesAt) : null;
  const canChat = Boolean(chatOpens && chatCloses && now >= chatOpens.getTime() && now < chatCloses.getTime());
  return <Card className="space-y-3 p-3"><div className="flex min-w-0 items-start gap-3"><Avatar name={request.user.name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{request.user.name}</p><p className="text-xs text-muted">{request.guestCount} guest{request.guestCount === 1 ? '' : 's'} · {request.offer.entryType} · arrive by {request.offer.entryBefore}</p><p className="mt-1 break-words text-xs">{(request.guests || []).map((guest) => guest.name).filter(Boolean).join(', ')}</p></div><Badge s={request.status} /></div>
    <div className="flex flex-wrap gap-2"><Link to={`/requests/${request.id}`} className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-xs font-semibold text-fg">View Request Details</Link>{request.status === 'CONFIRMED' && canChat && <Button className="!w-auto !py-2 text-xs" onClick={onOpenArrival}>Open guest chat / call</Button>}{request.status === 'CONFIRMED' && (request.checkedInAt ? <span className="flex items-center rounded-lg bg-ok/10 px-3 py-2 text-xs text-ok">Promoter arrival marked · {new Date(request.checkedInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span> : <Button className="!w-auto !py-2 text-xs" loading={checkIn?.isPending && checkIn.variables === request.id} disabled={checkIn?.isPending || !canCheckIn} onClick={() => checkIn.mutate(request.id)}>{canCheckIn ? 'Mark Guestlist Arrival' : `Opens at ${opensLabel}`}</Button>)}{request.status === 'PENDING' && <Link to={`/requests/${request.id}/review`} className="inline-flex items-center rounded-xl bg-ok px-3 py-2 text-xs font-semibold text-white">Review Request</Link>}</div>
  </Card>;
}
