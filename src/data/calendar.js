/* ---------------------------------------------------------------------------
   The school calendar. Attendance reporting only makes sense against real
   instructional days, so the whole app runs off this list rather than off
   calendar dates - weekends and breaks simply do not exist in the data.
   --------------------------------------------------------------------------- */

export const TERM_START = "2025-08-18";
export const TERM_END = "2026-06-05";

/** The Fall/Spring split. Everything on or before this date is Fall semester. */
export const FALL_END = "2025-12-19";
export const SPRING_START = "2026-01-05";

/** Closures beyond weekends: [from, to] inclusive, plus single-day holidays. */
const CLOSURES = [
  ["2025-09-01", "2025-09-01"], // Labor Day
  ["2025-10-13", "2025-10-13"], // Staff development day
  ["2025-11-24", "2025-11-28"], // Thanksgiving break
  ["2025-12-22", "2026-01-02"], // Winter break
  ["2026-01-19", "2026-01-19"], // MLK Day
  ["2026-02-16", "2026-02-20"], // Presidents week
  ["2026-03-30", "2026-04-03"], // Spring break
  ["2026-05-25", "2026-05-25"]  // Memorial Day
];

function isClosed(date) {
  return CLOSURES.some(([from, to]) => date >= from && date <= to);
}

/** Every instructional day of the year, ascending. */
export function buildCalendar() {
  const days = [];
  const cursor = new Date(`${TERM_START}T00:00:00Z`);
  const end = new Date(`${TERM_END}T00:00:00Z`);

  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    const date = cursor.toISOString().slice(0, 10);
    if (weekday !== 0 && weekday !== 6 && !isClosed(date)) days.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

/**
 * Attendance sags in predictable places: Mondays and Fridays, the days either
 * side of a break, and the winter illness stretch. This multiplies each
 * student's baseline absence rate for the day.
 */
export function dayPressure(date, index, calendar) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const month = Number(date.slice(5, 7));

  let pressure = 1;
  if (weekday === 1) pressure *= 1.14;        // Monday
  if (weekday === 5) pressure *= 1.26;        // Friday
  if (month === 1 || month === 2) pressure *= 1.32; // flu season
  if (month === 12) pressure *= 1.18;         // run-up to winter break
  if (month === 5 || month === 6) pressure *= 1.30; // end-of-year drift

  // A gap on either side means this day brackets a break - the classic dip.
  const gapBefore = index > 0 && gapDays(calendar[index - 1], date) > 1;
  const gapAfter = index < calendar.length - 1 && gapDays(date, calendar[index + 1]) > 1;
  if (gapBefore || gapAfter) pressure *= 1.55;

  return pressure;
}

function gapDays(fromIso, toIso) {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function semesterOf(date) {
  return date <= FALL_END ? "Fall" : "Spring";
}
