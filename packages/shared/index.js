export const ROLES = { USER: 'USER', PROMOTER: 'PROMOTER', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN' };
export const REQUEST_STATUS = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'];
export const OFFER_STATUS = ['ACTIVE', 'UPCOMING', 'EXPIRED', 'DRAFT', 'INACTIVE'];
export const ENTRY_TYPES = ['Couple', 'Girls', 'Ladies', 'Stag', 'Group'];
export const OFFER_TYPES = ['Free Entry', 'Cover Charge', 'Stag Entry', 'Ladies Night'];
export const MUSIC = ['EDM', 'Bollywood', 'Hip Hop', 'Commercial'];
export const REJECT_REASONS = ['Capacity Full', 'Guest criteria not met', 'Offer unavailable', 'Other'];
export const OFFER_PERK_GROUPS = [
  { label: 'Entry & access', options: ['Complimentary Entry', 'Guestlist Entry', 'No Cover Charge', 'Skip the Line', 'Priority Entry', 'Dedicated Guestlist Counter', 'VIP Entry'] },
  { label: 'Drinks', options: ['Unlimited Drinks', 'Unlimited Beer', 'Unlimited Cocktails', 'Unlimited Soft Drinks', 'Welcome Drink', 'One Complimentary Drink', 'Complimentary Shots', 'Bottle on the Table', 'Discounted Drinks'] },
  { label: 'Food', options: ['Complimentary Snacks', 'Complimentary Starters', 'Complimentary Meal', 'Buffet Access', 'Food Discount', 'Dessert Included'] },
  { label: 'Seating & venue access', options: ['Reserved Table', 'VIP Table Access', 'Lounge Access', 'Dance Floor Access', 'Poolside Access', 'Private Area Access'] },
  { label: 'Extras', options: ['Birthday Celebration', 'Birthday Decor', 'Celebration Cake', 'Free Coat Check', 'Valet Parking', 'Photo Booth Access', 'After-Party Access'] },
];
export const OFFER_INCLUSIONS = OFFER_PERK_GROUPS.flatMap((group) => group.options);
export const formatINR = (n) => (n ? '₹' + Number(n).toLocaleString('en-IN') : 'Free Entry');
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' mins ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
  return Math.floor(s / 86400) + ' days ago';
};
