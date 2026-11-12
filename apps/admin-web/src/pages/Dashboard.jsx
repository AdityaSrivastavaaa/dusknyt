import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Async, Stat, Card, Select, LineChart } from '@dusknyt/ui';
import { timeAgo } from '@dusknyt/shared';
import { http } from '../lib/api';
import { PageTitle } from '../components';

export function Dashboard() {
  const q = useQuery({ queryKey: ['a-dash'], queryFn: () => http.get('/admin/dashboard') });
  return (<div><PageTitle title="Dashboard" sub="Today's overview" />
    <Async q={q}>{(d) => (<div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Total Clubs" value={d.clubs} hint={`+${d.clubsNew} this month`} /><Stat label="Promoters" value={d.promoters} hint={`+${d.promotersNew} this month`} /><Stat label="Active Offers" value={d.offers} hint={`+${d.offersToday} today`} /><Stat label="Users" value={d.users} /></div>
      <div><p className="mb-2 text-sm font-semibold">Requests Overview</p><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['New', d.requests.new], ['Pending', d.requests.pending], ['Confirmed', d.requests.confirmed], ['Rejected', d.requests.rejected]].map(([k, v]) => <Stat key={k} label={k} value={v} />)}</div></div>
      <Card><p className="mb-2 text-sm font-semibold">Recent Activity</p>{d.activity.length === 0 && <p className="text-xs text-muted">No activity yet.</p>}{d.activity.map((a) => <div key={a.id} className="flex justify-between border-b border-line py-2 text-sm last:border-0"><span>{a.action}</span><span className="text-xs text-muted">{timeAgo(a.createdAt)}</span></div>)}</Card>
    </div>)}</Async></div>);
}

export function Analytics() {
  const [range, setRange] = useState('week');
  const q = useQuery({ queryKey: ['a-analytics', range], queryFn: () => http.get('/admin/analytics', { range }) });
  const ch = (n) => (n ? `${n > 0 ? '+' : ''}${n}% vs last ${range}` : '');
  return (<div><PageTitle title="Analytics" action={<div className="w-36"><Select value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }]} className="!mt-0" /></div>} />
    <Async q={q}>{(a) => (<div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Total Requests" value={a.total} hint={ch(a.totalChange)} /><Stat label="Confirmed" value={a.confirmed} hint={ch(a.confirmedChange)} /><Stat label="Conversion Rate" value={`${a.conversion}%`} /><Stat label="Total Earnings" value={'₹' + a.earnings.toLocaleString('en-IN')} hint={ch(a.earningsChange)} /></div>
      <Card><p className="mb-2 text-xs text-muted">Requests Over Time</p><LineChart data={a.series} height={160} /></Card></div>)}</Async></div>);
}
