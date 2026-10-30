const UK_TIME_ZONE = 'Europe/London';

export function getUKDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function getUKDateKey(date = new Date()) {
  const { year, month, day } = getUKDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getUKDayKey(date = new Date()) {
  const weekday = getUKDateParts(date).weekday;
  return ({ Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' })[weekday];
}

export function getUKMondayDate(date = new Date()) {
  const [year, month, day] = getUKDateKey(date).split('-').map(Number);
  const monday = new Date(year, month - 1, day, 12, 0, 0, 0);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return monday;
}

export function isCurrentUKWeek(weekStartDate, date = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate || '')) return false;
  const currentMonday = getUKMondayDate(date);
  const year = currentMonday.getFullYear();
  const month = String(currentMonday.getMonth() + 1).padStart(2, '0');
  const day = String(currentMonday.getDate()).padStart(2, '0');
  return weekStartDate === `${year}-${month}-${day}`;
}
