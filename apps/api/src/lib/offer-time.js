const INDIA_TIME_ZONE = 'Asia/Kolkata';
const INDIA_OFFSET_MINUTES = 330;

export function indiaStartOfDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) - INDIA_OFFSET_MINUTES * 60_000);
}

export function ratingPromptDueAt(offer) {
  // The review prompt goes out at 10 AM India time on the calendar morning after the event.
  return new Date(indiaStartOfDay(offer.date).getTime() + 34 * 60 * 60_000);
}

export function offerEntryStartsAt(offer) {
  const match = String(offer.entryFrom || offer.event?.startTime || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem) { hour %= 12; if (meridiem === 'PM') hour += 12; }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(offer.date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), hour, minute) - INDIA_OFFSET_MINUTES * 60_000);
}

export function promoterContactAvailableAt(offer) {
  const startsAt = offerEntryStartsAt(offer);
  return startsAt ? new Date(startsAt.getTime() - 60 * 60_000) : null;
}
