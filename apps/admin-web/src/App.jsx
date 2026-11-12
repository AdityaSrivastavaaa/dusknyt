import { Routes, Route, Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Megaphone, Ticket, Inbox, Users, BarChart3, Wallet, Settings as Cog, ShieldCheck, ScrollText, LifeBuoy, Bell, LogOut } from 'lucide-react';
import { RequireAuth, Logo, ThemeToggle, useAuth, cx } from '@dusknyt/ui';
import { Login } from './pages/Login';
import { Dashboard, Analytics } from './pages/Dashboard';
import { Clubs, ClubDetails, ClubForm } from './pages/Clubs';
import { Promoters, PromoterDetails, PromoterForm } from './pages/Promoters';
import { Offers, OfferDetails, OfferForm } from './pages/Offers';
import { Requests, RequestDetails } from './pages/Requests';
import { UsersList, Payouts, Settings, Roles, ActivityLogs, Support, Notifications } from './pages/Misc';

const NAV = [
  ['/', 'Dashboard', LayoutDashboard], ['/clubs', 'Clubs', Building2], ['/promoters', 'Promoters', Megaphone], ['/offers', 'Offers', Ticket],
  ['/requests', 'Guestlist Requests', Inbox], ['/users', 'Users', Users], ['/analytics', 'Reports & Analytics', BarChart3], ['/payouts', 'Payouts', Wallet],
  ['/notifications', 'Notifications', Bell], ['/support', 'Support', LifeBuoy], ['/roles', 'Roles & Permissions', ShieldCheck], ['/logs', 'Activity Logs', ScrollText], ['/settings', 'Settings', Cog],
];

function Layout() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-card md:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <Logo className="text-lg" /><p className="mb-6 text-[10px] tracking-[0.3em] text-brand">ADMIN PANEL</p>
          <nav className="flex-1 space-y-1 overflow-y-auto">{NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', isActive ? 'bg-brand text-white' : 'text-muted hover:bg-line')}><Icon size={16} />{label}</NavLink>))}</nav>
          <div className="mt-3 flex items-center justify-between text-xs text-muted"><span className="truncate">{user.email}</span><ThemeToggle /></div>
          <button onClick={() => { logout(); nav('/login'); }} className="mt-2 flex items-center gap-2 text-sm text-bad"><LogOut size={14} />Logout</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-scrollbar sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-line bg-bg/95 px-3 py-2 backdrop-blur md:hidden">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('shrink-0 rounded-lg px-3 py-1.5 text-xs', isActive ? 'bg-brand text-white' : 'bg-card text-muted')}>{label}</NavLink>)}
          <button onClick={() => { logout(); nav('/login'); }} className="shrink-0 px-2 text-xs text-bad">Logout</button>
        </div>
        <main className="mx-auto max-w-5xl p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth roles={['ADMIN', 'SUPER_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clubs" element={<Clubs />} /><Route path="clubs/new" element={<ClubForm />} /><Route path="clubs/:id" element={<ClubDetails />} /><Route path="clubs/:id/edit" element={<ClubForm />} />
          <Route path="promoters" element={<Promoters />} /><Route path="promoters/new" element={<PromoterForm />} /><Route path="promoters/:id" element={<PromoterDetails />} />
          <Route path="offers" element={<Offers />} /><Route path="offers/new" element={<OfferForm />} /><Route path="offers/:id" element={<OfferDetails />} /><Route path="offers/:id/edit" element={<OfferForm />} />
          <Route path="requests" element={<Requests />} /><Route path="requests/:id" element={<RequestDetails />} />
          <Route path="users" element={<UsersList />} /><Route path="analytics" element={<Analytics />} /><Route path="payouts" element={<Payouts />} />
          <Route path="notifications" element={<Notifications />} /><Route path="support" element={<Support />} />
          <Route path="roles" element={<Roles />} /><Route path="logs" element={<ActivityLogs />} /><Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
