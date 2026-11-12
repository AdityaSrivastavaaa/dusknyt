import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Header, Button, Tabs, Badge, Avatar, Card, Select, Textarea, EmptyState, cx } from '@dusknyt/ui';
import { REJECT_REASONS, fmtDate, timeAgo } from '@dusknyt/shared';
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
  useEffect(() => { if (q.data) qc.invalidateQueries({ queryKey: ['requests'] }); }, [q.data?.id]); // opening marks it as seen
  return (
    <div>
      <Header back title="Request Details" />
      <Async q={q}>{(r) => (<div className="space-y-4 p-4">
        <div className="flex items-center gap-3"><Avatar src={r.user.avatar} name={r.user.name} size={48} /><div><p className="font-semibold">{r.user.name}</p><p className="text-xs text-muted">{r.user.phone}</p></div><div className="ml-auto"><Badge s={r.status} /></div></div>
        <Card className="divide-y divide-line py-2"><Row k="Request ID" v={r.code} /><Row k="Club" v={r.offer.club.name} /><Row k="Entry type" v={`${r.offer.entryType} Entry`} /><Row k="Number of guests" v={r.guestCount} /><Row k="Arrive before" v={r.offer.entryBefore} />{r.note && <Row k="Note" v={r.note} />}</Card>
        <Card><p className="mb-1 text-xs text-muted">Guests</p>{(r.guests || []).map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}{g.gender ? ` (${g.gender})` : ''}</p>)}</Card>
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
  const q = useQuery({ queryKey: ['guestlist', tab], queryFn: () => http.get('/promoter/guestlist', { tab }) });
  const exportCsv = async () => {
    const res = await http.raw.get('/promoter/guestlist/export', { params: { tab }, responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(res.data); a.download = `guestlist-${tab}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <Header title="Guestlist" />
      <div className="p-4"><Tabs tabs={[{ value: 'tonight', label: 'Tonight' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} /></div>
      <Async q={q} empty={<EmptyState title="No guests" text="Confirmed and pending guests for this period appear here." />}>{(list) => (<>
        <div className="divide-y divide-line">{list.map((g) => (<div key={g.id} className="flex items-center gap-3 px-4 py-3"><Avatar src={g.user.avatar} name={g.user.name} />
          <div className="flex-1"><p className="font-medium">{g.user.name}</p><p className="text-xs text-muted">{g.guestCount} Guests · {g.offer.entryType} Entry · by {g.offer.entryBefore}</p></div><Badge s={g.status} /></div>))}</div>
        <div className="p-4"><Button onClick={exportCsv}>Export Guestlist</Button></div></>)}</Async>
    </div>
  );
}
