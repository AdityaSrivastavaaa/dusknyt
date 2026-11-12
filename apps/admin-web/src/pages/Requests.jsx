import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Button, Select, Textarea, Badge, Card, Tabs, Avatar, EmptyState } from '@dusknyt/ui';
import { REJECT_REASONS, fmtDate, timeAgo } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle, KV } from '../components';

export function Requests() {
  const [tab, setTab] = useState('new');
  const q = useQuery({ queryKey: ['a-requests', tab], queryFn: () => http.get('/admin/requests', { tab, limit: 50 }), refetchInterval: 30000 });
  return (<div><PageTitle title="Guestlist Requests" />
    <div className="mb-4 max-w-lg"><Tabs tabs={[{ value: 'new', label: 'New' }, { value: 'PENDING', label: `Pending${q.data ? ` (${q.data.counts.pending})` : ''}` }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'all', label: 'All' }]} value={tab} onChange={setTab} /></div>
    <Async q={q}>{(d) => d.items.length === 0 ? <EmptyState title="No New Requests" text="All caught up! New guestlist requests will appear here." /> : (
      <div className="divide-y divide-line rounded-2xl border border-line bg-card">{d.items.map((r) => (
        <Link key={r.id} to={`/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3"><Avatar src={r.user.avatar} name={r.user.name} />
          <div className="min-w-0 flex-1"><p className="font-medium">{r.user.name}</p><p className="truncate text-xs text-muted">{r.offer.club.name} · {r.offer.promoter.brand} · {r.guestCount} guests</p></div>
          <div className="text-right"><p className="text-[11px] text-muted">{timeAgo(r.createdAt)}</p><Badge s={r.status} /></div></Link>))}</div>)}</Async></div>);
}

export function RequestDetails() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient(); const [reason, setReason] = useState(REJECT_REASONS[0]); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const q = useQuery({ queryKey: ['a-request', id], queryFn: () => http.get(`/admin/requests/${id}`) });
  const m = useMutation({
    mutationFn: (action) => http.post(`/admin/requests/${id}/decision`, { action, reason: action === 'REJECT' ? reason : undefined, note: note || undefined }),
    onSuccess: () => { qc.invalidateQueries(); nav('/requests'); }, onError: (e) => setErr(errMsg(e)),
  });
  return (<div><PageTitle title="Request Details" />
    <Async q={q}>{(r) => (<div className="max-w-xl space-y-4">
      <Card className="flex items-center gap-3"><Avatar name={r.user.name} size={48} /><div className="flex-1"><p className="font-semibold">{r.user.name}</p><p className="text-xs text-muted">{r.user.phone}</p></div><Badge s={r.status} /></Card>
      <Card className="divide-y divide-line"><KV k="Request ID" v={r.code} /><KV k="Club" v={r.offer.club.name} /><KV k="Promoter" v={r.offer.promoter.brand} /><KV k="Offer" v={r.offer.offerType} /><KV k="Date" v={fmtDate(r.offer.date)} /><KV k="Entry type" v={r.offer.entryType} /><KV k="Guests" v={r.guestCount} /><KV k="Entry before" v={r.offer.entryBefore} /><KV k="Notes" v={r.note} /></Card>
      <Card><p className="mb-1 text-xs text-muted">Guests</p>{(r.guests || []).map((g, i) => <p key={i} className="text-sm">{i + 1}. {g.name}</p>)}</Card>
      {r.status === 'PENDING' ? (<Card className="space-y-3"><p className="text-sm font-semibold">Request action</p>
        <Select label="Rejection reason (if rejecting)" value={reason} onChange={(e) => setReason(e.target.value)} options={REJECT_REASONS} /><Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="text-xs text-bad">{err}</p>}
        <div className="flex gap-3"><Button variant="danger" loading={m.isPending} onClick={() => m.mutate('REJECT')}>Reject</Button><Button variant="success" loading={m.isPending} onClick={() => m.mutate('ACCEPT')}>Approve</Button></div></Card>)
        : r.rejectReason && <p className="text-sm text-muted">Reason: {r.rejectReason}</p>}
    </div>)}</Async></div>);
}
