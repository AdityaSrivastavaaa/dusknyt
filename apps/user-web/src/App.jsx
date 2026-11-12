import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Home as HomeIcon, Search, Ticket, Bookmark, User } from 'lucide-react';
import { Page, BottomNav, RequireAuth } from '@dusknyt/ui';
import { Splash, CitySelect } from './pages/onboarding';
import { Home, Explore, SearchResults, Filters } from './pages/discovery';
import { ClubDetails, EventSelect, ClubOffers, OfferDetails, AllOffers } from './pages/clubs';
import { Login, Verify, ProfileSetup } from './pages/auth';
import { GuestDetails, Review, Submitted, RequestStatus } from './pages/booking';
import { Saved, MyGuestlists, Notifications, Profile, EditProfile, Settings, Help } from './pages/account';

const nav = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true }, { to: '/explore', label: 'Explore', icon: Search },
  { to: '/offers', label: 'Offers', icon: Ticket }, { to: '/saved', label: 'Saved', icon: Bookmark }, { to: '/profile', label: 'Profile', icon: User },
];
const Main = () => <Page nav><Outlet /><BottomNav items={nav} /></Page>;
const Plain = () => <Page><Outlet /></Page>;

export default function App() {
  return (
    <Routes>
      <Route element={<Main />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="offers" element={<AllOffers />} />
        <Route element={<RequireAuth />}>
          <Route path="saved" element={<Saved />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
      <Route element={<Plain />}>
        <Route path="splash" element={<Splash />} />
        <Route path="city" element={<CitySelect />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="filters" element={<Filters />} />
        <Route path="clubs/:id" element={<ClubDetails />} />
        <Route path="clubs/:id/events" element={<EventSelect />} />
        <Route path="clubs/:id/offers" element={<ClubOffers />} />
        <Route path="offers/:id" element={<OfferDetails />} />
        <Route path="login" element={<Login />} />
        <Route path="verify" element={<Verify />} />
        <Route path="setup" element={<RequireAuth><ProfileSetup /></RequireAuth>} />
        <Route path="help" element={<Help />} />
        <Route element={<RequireAuth />}>
          <Route path="book/guests" element={<GuestDetails />} />
          <Route path="book/review" element={<Review />} />
          <Route path="book/submitted/:id" element={<Submitted />} />
          <Route path="requests/:id" element={<RequestStatus />} />
          <Route path="guestlists" element={<MyGuestlists />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
