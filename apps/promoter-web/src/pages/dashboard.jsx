import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Async, Header, Stat, Card, Select, LineChart, EmptyState, Button, Avatar, useAuth } from '@dusknyt/ui';
import { formatINR, fmtDate } from '@dusknyt/shared';
import { http } from '../lib/api';

export function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => http.get('/promoter/dashboard') });
  return (
    <div>
      <div className="flex items-center justify-between p-4"><div><h1 className="text-xl font-bold">Hey {user.name?.split(' ')[0]} 👋</h1><p className="text-xs text-muted">Here's what's happening</p></div><Avatar src={user.avatar} name={user.name} /></div>
      <Async q={q}>{(d) => (<div className="space-y-5 px-4">
        <div><p className="mb-2 text-xs text-muted">Today's Overview</p><div className="grid grid-cols-3 gap-2"><Stat label="New Requests" value={d.newRequests} /><Stat label="Confirmed" value={d.confirmed} /><Stat label="Est. Earnings" value={formatINR(d.earnings) === 'Free Entry' ? '₹0' : formatINR(d.earnings)} /></div></div>
        <div><div className="mb-2 flex justify-between"><h2 className="text-sm font-semibold">Upcoming Events</h2><Link to="/offers" className="text-xs text-brand">View all</Link></div>
          {d.upcoming.length === 0 ? <EmptyState title="No active offers" text="Create your first offer and start getting guests." action={<Link to="/offers/new"><Button>Create Offer</Button></Link>} />
            : <div className="space-y-2">{d.upcoming.map((e) => (<Link key={e.id} to={`/offers/${e.id}`}><Card className="flex items-center justify-between p-3"><div><p className="font-medium">{e.club}</p><p className="text-xs text-muted">{fmtDate(e.date)} · {e.entryBefore}</p></div><span className="flex items-center gap-1 text-xs text-brand">{e.requests} Requests<ChevronRight size={14} /></span></Card></Link>))}</div>}</div>
      </div>)}</Async>
    </div>
  );
}

export function Analytics() {
  const [range, setRange] = useState('week');
  const q = useQuery({ queryKey: ['analytics', range], queryFn: () => http.get('/promoter/analytics', { range }) });
  const ch = (n) => (n ? <span className={n > 0 ? 'text-ok' : 'text-bad'}>{n > 0 ? '+' : ''}{n}% vs last {range}</span> : null);
  return (
    <div>
      <Header back title="Analytics" right={<Select value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }]} className="!mt-0 !py-1" />} />
      <Async q={q}>{(a) => (<div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Requests" value={a.total} hint={ch(a.totalChange)} /><Stat label="Confirmed" value={a.confirmed} hint={ch(a.confirmedChange)} />
          <Stat label="Conversion Rate" value={`${a.conversion}%`} /><Stat label="Est. Earnings" value={'₹' + a.earnings.toLocaleString('en-IN')} hint={ch(a.earningsChange)} /></div>
        <Card><p className="mb-2 text-xs text-muted">Requests Over Time</p><LineChart data={a.series} /></Card>
      </div>)}</Async>
    </div>
  );
}
