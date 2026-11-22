import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Async, Badge, Button, Card, EmptyState, Img, Input } from '@dusknyt/ui';
import { fmtDate } from '@dusknyt/shared';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';
import { PageTitle } from '../components';

const editable = (event) => ({
  title: event.title || '', djName: event.djName || '', date: event.date?.slice(0, 10) || '',
  startTime: event.startTime || '9:00 PM', genre: event.genre || '', poster: event.pendingPoster || event.poster || '',
});

async function imageData(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 3_000_000) throw new Error('Choose an image smaller than 3 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file);
  });
}

export function EventApprovals() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const q = useQuery({ queryKey: ['admin-event-approvals'], queryFn: () => http.get('/admin/events') });
  const refresh = () => {
    for (const queryKey of [['admin-event-approvals'], ['a-club'], ['p-clubs'], ['offers'], ['home'], ['clubs'], ['club-offers'], ['all-offers']]) qc.invalidateQueries({ queryKey });
  };
  const review = useMutation({ mutationFn: ({ id, action }) => http.post(`/admin/events/${id}/review`, { action }), onSuccess: refresh, onError: (e) => window.alert(errMsg(e)) });
  const save = useMutation({ mutationFn: () => http.put(`/admin/events/${editingId}`, form), onSuccess: () => { setEditingId(null); setForm(null); setError(''); refresh(); }, onError: (e) => setError(errMsg(e)) });
  const remove = useMutation({ mutationFn: (id) => http.del(`/admin/events/${id}`), onSuccess: refresh, onError: (e) => window.alert(errMsg(e)) });
  return <div className="space-y-4"><PageTitle title="Event Approvals" sub="Review and edit promoter events before they appear to guests." />
    <Async q={q} empty={<EmptyState title="Nothing awaiting review" text="New events and banner updates will appear here." />}>{(items) => <div className="space-y-4">{items.map((event) => {
      const editing = editingId === event.id;
      const beginEdit = () => { setEditingId(event.id); setForm(editable(event)); setError(''); };
      return <Card key={event.id} className="space-y-3">
        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-lg font-semibold">{editing ? 'Edit event before approval' : event.title}</p><p className="text-sm text-muted">{event.club.name} · {event.club.city.name}</p><p className="text-xs text-muted">{fmtDate(event.date)} · {event.startTime} · {event._count.offers} offer(s)</p></div><Badge s={event.status} /></div>
        {editing ? <div className="space-y-3 rounded-xl border border-line p-3">
          <Input label="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="DJ / performer" value={form.djName} onChange={(e) => setForm({ ...form, djName: e.target.value })} /><Input label="Event date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /><Input label="Start time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /><Input label="Music / theme" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></div>
          <label className="block text-xs text-muted">Event banner<input type="file" accept="image/*" onChange={async (e) => { try { setError(''); const poster = await imageData(e.target.files?.[0]); setForm((old) => ({ ...old, poster })); } catch (err) { setError(err.message); } }} className="mt-1 block w-full text-sm" /></label>
          {form.poster && <div className="space-y-2"><Img src={form.poster} name={form.title} className="h-40 w-full rounded-xl" /><button type="button" onClick={() => setForm({ ...form, poster: '' })} className="text-xs text-bad">Remove banner</button></div>}
          {error && <p className="text-xs text-bad">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button className="!w-auto" loading={save.isPending} disabled={!form.title.trim() || !form.date || !form.startTime.trim()} onClick={() => save.mutate()}>Save changes</Button><Button variant="outline" className="!w-auto" onClick={() => { setEditingId(null); setForm(null); }}>Cancel</Button></div>
        </div> : <>
          {event.bannerChangePending && <div className="grid gap-3 sm:grid-cols-2">{event.poster && <div><p className="mb-1 text-xs text-muted">Currently visible</p><Img src={event.poster} name={event.title} className="h-40 w-full rounded-xl" /></div>}{event.pendingPoster ? <div><p className="mb-1 text-xs text-muted">Submitted banner</p><Img src={event.pendingPoster} name={event.title} className="h-40 w-full rounded-xl" /></div> : <p className="rounded-xl border border-line p-4 text-sm text-muted">The promoter requested to remove the current banner.</p>}</div>}
          {event.status === 'PENDING' ? <p className="text-sm text-muted">The event and linked offers stay hidden from guests until you approve this event.</p> : event.bannerChangePending && <p className="text-sm text-muted">Guests keep seeing the current banner until this update is approved.</p>}
          <p className="text-xs text-muted">Promoters: {event.offers.map((offer) => offer.promoter.brand).filter((name, index, all) => all.indexOf(name) === index).join(', ') || 'No promoter offers yet'}</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" className="!w-auto" onClick={beginEdit}>Edit details & banner</Button>{event.status === 'PENDING' && <><Button className="!w-auto" loading={review.isPending} onClick={() => review.mutate({ id: event.id, action: 'APPROVE_EVENT' })}>Approve event</Button><Button className="!w-auto" variant="danger" disabled={review.isPending} onClick={() => review.mutate({ id: event.id, action: 'REJECT_EVENT' })}>Reject event</Button></>}{event.bannerChangePending && event.status !== 'PENDING' && <><Button className="!w-auto" loading={review.isPending} onClick={() => review.mutate({ id: event.id, action: 'APPROVE_BANNER' })}>Approve banner</Button><Button className="!w-auto" variant="danger" disabled={review.isPending} onClick={() => review.mutate({ id: event.id, action: 'REJECT_BANNER' })}>Reject banner</Button></>}{event.status !== 'PENDING' && <Button variant="danger" className="!w-auto" disabled={remove.isPending} onClick={() => { if (window.confirm('Remove this event and deactivate all offers linked to it? Affected promoters will be notified.')) remove.mutate(event.id); }}>Remove event</Button>}</div>
        </>}
      </Card>;
    })}</div>}</Async>
  </div>;
}
