import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrivalRoom, Header, useAuth } from '@dusknyt/ui';

export function ArrivalConversation() {
  const { requestId } = useParams();
  const [search] = useSearchParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  return <div className="min-h-screen"><Header back title="Guest call & chat" sub="Private arrival coordination" /><ArrivalRoom key={requestId} token={token} requestId={requestId} autoAnswer={search.get('answer') === '1'} fullPage onClose={() => navigate('/guestlist', { replace: true })} /></div>;
}
