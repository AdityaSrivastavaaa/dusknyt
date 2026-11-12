export const ROLES = { USER: 'USER', PROMOTER: 'PROMOTER', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN' };
export const REQUEST_STATUS = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'];
export const OFFER_STATUS = ['ACTIVE', 'UPCOMING', 'EXPIRED', 'DRAFT', 'INACTIVE'];
export const ENTRY_TYPES = ['Couple', 'Stag', 'Ladies', 'Group'];
export const OFFER_TYPES = ['Free Entry', 'Cover Charge', 'Stag Entry', 'Ladies Night'];
export const MUSIC = ['EDM', 'Bollywood', 'Hip Hop', 'Commercial'];
export const REJECT_REASONS = ['Capacity Full', 'Guest criteria not met', 'Offer unavailable', 'Other'];
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
