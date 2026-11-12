import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Star, MapPin } from 'lucide-react';
import { Img, useAuth, cx } from '@dusknyt/ui';
import { formatINR, fmtDate } from '@dusknyt/shared';
import { http } from './lib/api';

export function SaveButton({ clubId, offerId, className }) {
  const { token } = useAuth(); const nav = useNavigate(); const qc = useQueryClient();
  const ids = useQuery({ queryKey: ['savedIds'], queryFn: () => http.get('/saved/ids'), enabled: !!token });
  const on = clubId ? ids.data?.clubs.includes(clubId) : ids.data?.offers.includes(offerId);
  const m = useMutation({ mutationFn: () => http.post('/saved/toggle', { clubId, offerId }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['savedIds'] }); qc.invalidateQueries({ queryKey: ['saved'] }); } });
  return (
    <button aria-label="Save" className={cx('rounded-full p-2', className)} onClick={(e) => { e.preventDefault(); token ? m.mutate() : nav('/login', { state: { from: location.pathname } }); }}>
      <Bookmark size={18} className={on ? 'fill-brand text-brand' : 'text-muted'} />
    </button>
  );
}

export function ClubCard({ club, compact }) {
  return (
    <Link to={`/clubs/${club.id}`} className={cx('block overflow-hidden rounded-2xl border border-line bg-card', compact && 'w-40 shrink-0')}>
      <Img src={club.images?.[0]} name={club.name} className={compact ? 'h-24 w-full' : 'h-36 w-full'} />
      <div className="p-3">
        <div className="flex items-center justify-between"><h3 className="truncate font-semibold">{club.name}</h3>
          <span className="flex items-center gap-0.5 text-xs text-warn"><Star size={12} className="fill-warn" />{club.rating}</span></div>
        <p className="flex items-center gap-1 truncate text-xs text-muted"><MapPin size={11} />{club.area || club.address}</p>
        {club.startingPrice !== undefined && <p className="mt-1 text-xs text-brand">{club.offerCount ? `Starting ${formatINR(club.startingPrice)}` : 'No active offers'}</p>}
      </div>
    </Link>
  );
}

export function OfferCard({ offer }) {
  return (
    <Link to={`/offers/${offer.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
      <Img src={offer.club?.images?.[0]} name={offer.club?.name} className="h-14 w-14 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{offer.promoter?.brand} · {offer.club?.name}</p>
        <p className="font-semibold">{offer.offerType} <span className="text-xs font-normal text-muted">· {offer.entryType}</span></p>
        <p className="text-[11px] text-muted">{fmtDate(offer.date)} · Before {offer.entryBefore}</p>
      </div>
      <div className="text-right"><p className="text-lg font-bold">{formatINR(offer.price)}</p><SaveButton offerId={offer.id} className="!p-1" /></div>
    </Link>
  );
}
