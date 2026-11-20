import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Header, Button, Tabs, Badge, Avatar, Card, Select, Textarea, EmptyState, cx } from '@dusknyt/ui';
import { REJECT_REASONS, formatINR, fmtDate, timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

const Row = ({ k, v }) => <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>;

export function Requests() {
  const [tab, setTab] = useState('new');
  const q = useQuery({ queryKey: ['requests', tab], queryFn: () => http.get('/promoter/requests', { tab }), refetchInterval: 30000 });
  return (
    <div>
      <Header title="Incoming Requests" />
      <div className="p-4"><Tabs tabs={[{ value: 'new', label: `New${q.data?.newCount ? ` (${q.data.newCount})` : ''}` }, { value: 'pending', label: 'Pending' }, { value: 'all', label: 'All' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No new requests" text="You're all caught up! New requests will appear here." />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No new requests" text="You're all caught up! New requests will appear here." /> : (
          <div className="divide-y divide-line">{d.items.map((r) => (
            <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3"><Avatar src={r.user.avatar} name={r.user.name} />
              <div className="min-w-0 flex-1"><p className="font-medium">{r.user.name}</p><p className="text-xs text-muted">{r.guestCount} Guests · {r.offer.entryType} Entry</p></div>
              <div className="text-right"><p className="text-[11px] text-muted">{timeAgo(r.createdAt)}</p>{r.status !== 'PENDING' && <Badge s={r.status} />}</div></Link>))}</div>)}
      </Async>
    </div>
  );
}

export function RequestDetails() {
  const { id } = useParams(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => http.get(`/promoter/requests/${id}`) });
  const checkIn = useMutation({ mutationFn: () => http.post(`/promoter/guestlist/${id}/check-in`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['guestlist'] }); }, onError: (e) => setCheckInError(errMsg(e)) });
  const [checkInError, setCheckInError] = useState('');
  useEffect(() => { if (q.data) qc.invalidateQueries({ queryKey: ['requests'] }); }, [q.data?.id]); // opening marks it as seen
  return (
    <div>
      <Header back title="Request Details" />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        <div className="flex items-center gap-3"><Avatar src={r.user.avatar} name={r.user.name} size={48} /><div><p className="font-semibold">{r.user.name}</p><p className="text-xs text-muted">{r.user.phone}</p></div><div className="ml-auto"><Badge s={r.status} /></div></div>
        <Card className="divide-y divide-line py-2"><Row k="Request ID" v={r.code} /><Row k="Club" v={r.offer.club.name} /><Row k="Entry type" v={`${r.offer.entryType} Entry`} /><Row k="Number of guests" v={r.guestCount} /><Row k="Arrive before" v={r.offer.entryBefore} />{r.checkedInAt && <Row k="Entry marked" v={new Date(r.checkedInAt).toLocaleString('en-IN')} />}{r.note && <Row k="Note" v={r.note} />}</Card>
        <Card><p className="mb-1 text-xs text-muted">Guests</p>{(r.guests || []).map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}{g.gender ? ` (${g.gender})` : ''}</p>)}</Card>
        {r.status === 'CONFIRMED' && (r.checkedInAt ? <Card className="border-ok/40 text-sm text-ok">This guest group was checked in at {new Date(r.checkedInAt).toLocaleString('en-IN')}.</Card> : <Card className="space-y-3"><p className="text-sm text-muted">Mark the confirmed guest group as entered at the venue.</p>{checkInError && <p className="text-xs text-bad">{checkInError}</p>}<Button loading={checkIn.isPending} onClick={() => { setCheckInError(''); checkIn.mutate(); }}>Mark Group Entered</Button></Card>)}
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
  const qc = useQueryClient(); const [error, setError] = useState('');
  const scope = { ...(eventId && { eventId }), ...(!eventId && clubId && { clubId }), ...(!eventId && date && { date }) };
  const q = useQuery({ queryKey: ['guestlist-event-details', eventId, clubId, date], queryFn: () => http.get('/promoter/guestlist/event-details', scope), enabled: Boolean(eventId || (clubId && date)) });
  const checkIn = useMutation({ mutationFn: (id) => http.post(`/promoter/guestlist/${id}/check-in`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['guestlist-events'] }); qc.invalidateQueries({ queryKey: ['guestlist-event-details'] }); qc.invalidateQueries({ queryKey: ['guestlist'] }); }, onError: (e) => setError(errMsg(e)) });
  const exportCsv = async () => {
    const res = await http.raw.get('/promoter/guestlist/export', { params: { ...scope }, responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(res.data); a.download = `guestlist-event-${date || eventId}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <Header back title={q.data?.event?.title || 'Event Guestlist'} sub={q.data ? `${q.data.club.name} · ${fmtDate(q.data.event?.date || q.data.offers[0]?.date)}` : 'Event details and bookings'} right={q.data && <button onClick={exportCsv} className="whitespace-nowrap text-xs font-semibold text-brand">Export CSV</button>} />
      <Async q={q} empty={<EmptyState title="Event unavailable" text="This event has no offers assigned to your account." />}>
        {(data) => {
          const banner = data.event?.poster || data.club.images?.[0];
          const confirmed = data.requests.filter((request) => request.status === 'CONFIRMED');
          const pending = data.requests.filter((request) => request.status === 'PENDING');
          const confirmedGuests = confirmed.reduce((sum, request) => sum + request.guestCount, 0);
          return <div className="space-y-5 px-4 pb-6 pt-4">
            {error && <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-xs text-bad">{error}</p>}
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-dark to-black">{banner && <img src={banner} alt={`${data.event?.title || data.club.name} event banner`} className="absolute inset-0 h-full w-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-white"><p className="text-2xl font-black">{data.event?.title || 'Guestlist'}</p><p className="mt-1 text-sm text-white/85">{data.club.name}</p></div></div>
            <Card className="space-y-2"><h2 className="font-semibold">Event details</h2><Row k="Date" v={fmtDate(data.event?.date || data.offers[0]?.date)} /><Row k="Start time" v={data.event?.startTime || data.offers[0]?.entryFrom || '—'} /><Row k="DJ / performer" v={data.event?.djName || 'To be announced'} /><Row k="Music / theme" v={data.event?.genre || 'To be announced'} /><Row k="Venue" v={data.club.name} /><Row k="Address" v={data.club.address} /></Card>
            <section className="space-y-3"><h2 className="text-base font-bold">Offers for this event</h2>{data.offers.map((offer) => <Card key={offer.id} className="space-y-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{offer.offerType} · {offer.entryTypes?.length ? offer.entryTypes.join(' & ') : offer.entryType}</p><p className="text-xs text-muted">Entry {offer.entryFrom}–{offer.entryBefore}{offer.limitedSlots ? ' · Limited slots' : ''}</p></div><p className="shrink-0 font-bold">{formatINR(offer.price)}</p></div>{offer.inclusions?.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Perks</p><ul className="space-y-1 text-sm">{offer.inclusions.map((perk) => <li key={perk}>• {perk}</li>)}</ul></div>}{offer.terms && <p className="border-t border-line pt-2 text-xs text-muted">{offer.terms}</p>}</Card>)}</section>
            <section className="space-y-3"><div><h2 className="text-base font-bold">Confirmed guestlist</h2><p className="text-xs text-muted">{confirmed.length} bookings · {confirmedGuests} guests</p></div>{confirmed.length ? confirmed.map((request) => <GuestRequestCard key={request.id} request={request} checkIn={checkIn} />) : <Card className="text-sm text-muted">No confirmed guests for this event yet.</Card>}</section>
            {pending.length > 0 && <section className="space-y-3"><div><h2 className="text-base font-bold">Pending requests</h2><p className="text-xs text-muted">{pending.length} bookings · {pending.reduce((sum, request) => sum + request.guestCount, 0)} guests</p></div>{pending.map((request) => <GuestRequestCard key={request.id} request={request} />)}</section>}
          </div>;
        }}
      </Async>
    </div>
  );
}

function GuestRequestCard({ request, checkIn }) {
  return <Card className="space-y-3 p-3"><div className="flex min-w-0 items-start gap-3"><Avatar src={request.user.avatar} name={request.user.name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{request.user.name}</p><p className="text-xs text-muted">{request.guestCount} guest{request.guestCount === 1 ? '' : 's'} · {request.offer.entryType} · arrive by {request.offer.entryBefore}</p><p className="mt-1 break-words text-xs">{(request.guests || []).map((guest) => guest.name).filter(Boolean).join(', ')}</p></div><Badge s={request.status} /></div>
    <div className="flex flex-wrap gap-2"><Link to={`/requests/${request.id}`} className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-xs font-semibold text-fg">View Request Details</Link>{request.status === 'CONFIRMED' && (request.checkedInAt ? <span className="flex items-center rounded-lg bg-ok/10 px-3 py-2 text-xs text-ok">Entered · {new Date(request.checkedInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span> : <Button className="!w-auto !py-2 text-xs" loading={checkIn?.isPending && checkIn.variables === request.id} disabled={checkIn?.isPending} onClick={() => checkIn.mutate(request.id)}>Mark Group Entered</Button>)}{request.status === 'PENDING' && <Link to={`/requests/${request.id}/review`} className="inline-flex items-center rounded-xl bg-ok px-3 py-2 text-xs font-semibold text-white">Review Request</Link>}</div>
  </Card>;
}
