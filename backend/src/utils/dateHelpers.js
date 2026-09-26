/**
 * Shared date/time helpers used across routes.
 */

/** Get Monday date string (YYYY-MM-DD) for the week containing `date` */
function getMondayOfWeek(date = new Date()) {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Parse HH:MM string into a Date on the same calendar day as `baseDate` */
function parseTimeOnDate(timeStr, baseDate = new Date()) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Minutes difference: actual - scheduled (positive = late) */
function punctualityMinutes(actualDate, scheduledTimeStr, baseDate) {
  const scheduled = parseTimeOnDate(scheduledTimeStr, baseDate || actualDate);
  return Math.round((actualDate - scheduled) / 60000);
}

function getPunctualityLabel(diffMinutes) {
  if (diffMinutes === null) return 'unscheduled';
  if (diffMinutes < -5)   return 'early';
  if (diffMinutes <= 5)   return 'on_time';
  if (diffMinutes <= 15)  return 'slightly_late';
  return 'late';
}

/** Day key from a Date: 'mon' | 'tue' | ... */
function dayKey(date = new Date()) {
  return ['sun','mon','tue','wed','thu','fri','sat'][date.getDay()];
}

module.exports = { getMondayOfWeek, parseTimeOnDate, punctualityMinutes, getPunctualityLabel, dayKey };
