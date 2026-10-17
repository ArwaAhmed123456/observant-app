/**
 * Shared date/time helpers used across routes.
 * Standardised on UK Timezone (Europe/London - GMT/BST) for UK security operations.
 */

const UK_TIMEZONE = 'Europe/London';

/** Get year, month, day, hours, minutes in UK timezone */
function getUKDateParts(date = new Date()) {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const part of formatter.formatToParts(d)) {
    parts[part.type] = part.value;
  }
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`
  };
}

/** Get Monday date string (YYYY-MM-DD) for the week containing `date` in UK timezone */
function getMondayOfWeek(date = new Date()) {
  const parts = getUKDateParts(date);
  const ukNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  const day = ukNoon.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(ukNoon.getTime() + diff * 86400000);
  const monParts = getUKDateParts(monday);
  return monParts.dateStr;
}

/** Day key from a Date in UK timezone: 'mon' | 'tue' | ... */
function dayKey(date = new Date()) {
  const parts = getUKDateParts(date);
  const ukNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  return ['sun','mon','tue','wed','thu','fri','sat'][ukNoon.getUTCDay()];
}

/** Parse HH:MM string into a Date on the same calendar day as `baseDate` in UK timezone */
function parseTimeOnDate(timeStr, baseDate = new Date()) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return new Date(baseDate);
  const [h, m] = timeStr.split(':').map(Number);
  const parts = getUKDateParts(baseDate);
  const targetUtcApprox = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, h, m, 0));
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const ukCheck = {};
  for (const p of formatter.formatToParts(targetUtcApprox)) {
    ukCheck[p.type] = p.value;
  }
  const diffHours = parseInt(ukCheck.hour, 10) - h;
  return new Date(targetUtcApprox.getTime() - diffHours * 3600000);
}

/**
 * Calculate scheduled shift end Date (UTC Date object).
 * Handles overnight shifts where end time <= start time by adding one day in UK calendar.
 */
function calculateShiftEndDateTime(scheduledStartTimeStr, scheduledEndTimeStr, shiftDate = new Date()) {
  if (!scheduledEndTimeStr || !/^\d{2}:\d{2}$/.test(scheduledEndTimeStr)) return null;
  const parts = getUKDateParts(shiftDate);
  const [endH, endM] = scheduledEndTimeStr.split(':').map(Number);
  const [startH, startM] = (scheduledStartTimeStr && /^\d{2}:\d{2}$/.test(scheduledStartTimeStr))
    ? scheduledStartTimeStr.split(':').map(Number)
    : [endH, endM];

  let y = parts.year;
  let m = parts.month;
  let d = parts.day;

  // If overnight shift (end time <= start time), end is on next calendar day
  if (endH < startH || (endH === startH && endM <= startM)) {
    d += 1;
  }

  const targetUtcApprox = new Date(Date.UTC(y, m - 1, d, endH, endM, 0));
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const ukCheck = {};
  for (const p of formatter.formatToParts(targetUtcApprox)) {
    ukCheck[p.type] = p.value;
  }
  const diffHours = parseInt(ukCheck.hour, 10) - endH;
  return new Date(targetUtcApprox.getTime() - diffHours * 3600000);
}

/** Minutes difference: actual - scheduled (positive = late) */
function punctualityMinutes(actualDate, scheduledTimeStr, baseDate) {
  const scheduled = parseTimeOnDate(scheduledTimeStr, baseDate || actualDate);
  return Math.round((new Date(actualDate) - scheduled) / 60000);
}

function getPunctualityLabel(diffMinutes) {
  if (diffMinutes === null) return 'unscheduled';
  if (diffMinutes < -5)   return 'early';
  if (diffMinutes <= 5)   return 'on_time';
  if (diffMinutes <= 15)  return 'slightly_late';
  return 'late';
}

module.exports = {
  UK_TIMEZONE,
  getUKDateParts,
  getMondayOfWeek,
  dayKey,
  parseTimeOnDate,
  calculateShiftEndDateTime,
  punctualityMinutes,
  getPunctualityLabel,
};
