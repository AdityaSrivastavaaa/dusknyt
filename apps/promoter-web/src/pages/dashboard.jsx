import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Async, Header, Stat, Card, Select, LineChart, EmptyState, Button, useAuth } from '@dusknyt/ui';
import { fmtDate } from '@dusknyt/shared';
import { http } from '../lib/api';
import { CallNotificationButton } from '../components/ArrivalCallListener';

export function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => http.get('/promoter/dashboard') });
  return (
    <div>
      <div className="glass-bar sticky top-0 z-20 box-border flex w-full min-w-0 max-w-full items-center gap-3 border-b border-line px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]"><div className="min-w-0 flex-1"><h1 className="truncate text-xl font-bold">Hey {user.name?.split(' ')[0]} 👋</h1><p className="truncate text-xs text-muted">Here's what's happening</p></div><CallNotificationButton /></div>
      <Async q={q}>{(d) => (<div className="space-y-5 px-4">
        <div><p className="mb-2 text-xs text-muted">Your Overview</p><div className="grid grid-cols-3 gap-2"><Stat label="New Requests" value={d.newRequests} /><Stat label="Confirmed" value={d.confirmed} /><Stat label="Active Offers" value={d.activeOffers} /></div></div>
        <div><div className="mb-2 flex justify-between"><h2 className="text-sm font-semibold">Upcoming Events</h2><Link to="/offers" className="text-xs text-brand">View all</Link></div>
          {d.upcoming.length === 0 ? <EmptyState title="No active offers" text="Create your first offer and start getting guests." action={<Link to="/offers/new"><Button>Create Offer</Button></Link>} />
            : <div className="flex flex-col gap-3">{d.upcoming.map((e) => { const to = e.eventId ? `/guestlist/event?eventId=${encodeURIComponent(e.eventId)}` : `/guestlist/event?clubId=${encodeURIComponent(e.clubId)}&date=${e.date}`; return <Link key={e.id} to={to} className="block"><Card className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate font-medium">{e.event}</p><p className="truncate text-xs text-muted">{e.club} · {fmtDate(e.date)}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-brand">{e.requests} Requests<ChevronRight size={14} /></span></Card></Link>; })}</div>}</div>
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
          <Stat label="Conversion Rate" value={`${a.conversion}%`} /><Stat label="Confirmation Rate" value={`${a.total ? Math.round((a.confirmed / a.total) * 100) : 0}%`} /></div>
        <Card><p className="mb-2 text-xs text-muted">Requests Over Time</p><LineChart data={a.series} /></Card>
      </div>)}</Async>
    </div>
  );
}
