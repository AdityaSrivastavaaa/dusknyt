import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrivalRoom, useAuth } from '@dusknyt/ui';
import { http } from '../lib/api';

export function ArrivalConversation() {
  const { requestId } = useParams();
  const [search] = useSearchParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const request = useQuery({ queryKey: ['promoter-arrival-booking', requestId], queryFn: () => http.get(`/promoter/requests/${requestId}`), enabled: Boolean(requestId) }).data;
  const booking = request ? {
    bookingCode: request.code,
    guestName: request.user?.name || 'Guest',
    guestCount: request.guestCount,
    clubName: request.offer?.club?.name,
    eventTitle: request.offer?.event?.title,
    date: request.offer?.date,
    startTime: request.offer?.event?.startTime,
    entryType: request.offer?.entryType,
    entryBefore: request.offer?.entryBefore,
  } : null;
  return <ArrivalRoom key={requestId} token={token} requestId={requestId} booking={booking} autoAnswer={search.get('answer') === '1'} fullPage onClose={() => navigate('/guestlist', { replace: true })} />;
}
