import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Inbox, Users, MoreHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Page, BottomNav, RequireAuth } from '@dusknyt/ui';
import { http } from './lib/api';
import { Splash, Login } from './pages/auth';
import { Dashboard, Analytics } from './pages/dashboard';
import { MyOffers, CreateOffer, OfferDetail } from './pages/offers';
import { Requests, RequestDetails, ReviewRequest, Guestlist } from './pages/requests';
import { More, EditProfile, ChangePassword, Notifications, Help, About } from './pages/profile';

function Main() {
  const q = useQuery({ queryKey: ['requests', 'new'], queryFn: () => http.get('/promoter/requests', { tab: 'new', limit: 1 }), refetchInterval: 30000 });
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/offers', label: 'Offers', icon: Ticket },
    { to: '/requests', label: 'Requests', icon: Inbox, badge: q.data?.newCount }, { to: '/guestlist', label: 'Guestlist', icon: Users }, { to: '/more', label: 'More', icon: MoreHorizontal },
  ];
  return <Page nav><Outlet /><BottomNav items={items} /></Page>;
}

export default function App() {
  const guard = <RequireAuth roles={['PROMOTER']} />;
  return (
    <Routes>
      <Route path="splash" element={<Splash />} />
      <Route path="login" element={<Login />} />
      <Route element={guard}>
        <Route element={<Main />}>
          <Route index element={<Dashboard />} />
          <Route path="offers" element={<MyOffers />} />
          <Route path="requests" element={<Requests />} />
          <Route path="guestlist" element={<Guestlist />} />
          <Route path="more" element={<More />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route element={<Page><Outlet /></Page>}>
          <Route path="offers/new" element={<CreateOffer />} />
          <Route path="offers/:id" element={<OfferDetail />} />
          <Route path="requests/:id" element={<RequestDetails />} />
          <Route path="requests/:id/review" element={<ReviewRequest />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="password" element={<ChangePassword />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="help" element={<Help />} />
          <Route path="about" element={<About />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
