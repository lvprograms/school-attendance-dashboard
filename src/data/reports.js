/* ---------------------------------------------------------------------------
   The report layer: pure functions from the fact tables to the shapes each view
   renders. Nothing here touches the DOM, and nothing here invents a number -
   every figure on screen is an aggregation of rows produced by school.js.

   Vocabulary, so the columns mean one thing everywhere:
     enrolled   student-days scheduled (a student enrolled for 170 days
                contributes 170, not 1)
     present    student-days attended
     absent     student-days missed
     rate       present / enrolled, the attendance rate
     ada        Average Daily Attendance - present student-days per day
   --------------------------------------------------------------------------- */

import { ADA_RATE } from "./school.js";

/** Rows inside [from, to] whose grade is in `grades` (a Set, or null for all). */
export function filterRows(rows, { from, to, grades = null }) {
  return rows.filter((row) =>
    row.d >= from && row.d <= to && (!grades || grades.has(row.g)));
}

function blank() {
  return { enrolled: 0, present: 0, absent: 0, tardy: 0, dates: new Set() };
}

function accumulate(target, row) {
  target.enrolled += row.en;
  target.present += row.pr;
  target.absent += row.ab;
  target.tardy += row.td;
  target.dates.add(row.d);
  return target;
}

/** Adds the derived measures every view wants. */
function derive(totals, extra = {}) {
  const days = totals.dates.size;
  const rate = totals.enrolled ? (totals.present / totals.enrolled) * 100 : 0;

  return {
    enrolled: totals.enrolled,
    present: totals.present,
    absent: totals.absent,
    tardy: totals.tardy,
    days,
    rate,
    absenceRate: 100 - rate,
    tardyRate: totals.present ? (totals.tardy / totals.present) * 100 : 0,
    // ADA is the per-day average headcount - the number funding is paid on.
    ada: days ? totals.present / days : 0,
    fundingEarned: totals.present * ADA_RATE,
    fundingForfeited: totals.absent * ADA_RATE,
    ...extra
  };
}

export function summarise(rows) {
  return derive(rows.reduce(accumulate, blank()));
}

function groupBy(rows, keyOf, keyName, sort) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!map.has(key)) map.set(key, blank());
    accumulate(map.get(key), row);
  }
  const grouped = [...map.entries()].map(([key, totals]) => derive(totals, { [keyName]: key }));
  return sort ? grouped.sort(sort) : grouped;
}

/** One row per instructional day, ascending. No gap filling - closed days do not exist. */
export function byDay(rows) {
  return groupBy(rows, (r) => r.d, "date", (a, b) => a.date.localeCompare(b.date));
}

/** One row per grade, in school order rather than sorted by a measure. */
export function byGrade(rows, grades) {
  const order = new Map(grades.map((grade, index) => [grade, index]));
  return groupBy(rows, (r) => r.g, "grade", (a, b) => order.get(a.grade) - order.get(b.grade));
}

/* ------------------------------------------------------- absence reasons ---- */

export function filterAbsences(rows, { from, to, grades = null }) {
  return rows.filter((row) =>
    row.d >= from && row.d <= to && (!grades || grades.has(row.g)));
}

export function byReason(absences, reasons) {
  const counts = new Map(reasons.map((reason) => [reason, 0]));
  for (const row of absences) counts.set(row.r, (counts.get(row.r) || 0) + row.n);

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .map(([reason, absent]) => ({ reason, absent, share: total ? (absent / total) * 100 : 0 }))
    .sort((a, b) => b.absent - a.absent);
}

/**
 * Absences per grade split by reason - the stacked-column shape. Series come
 * back in the fixed REASONS order so a colour always means the same reason,
 * no matter which grades the filter leaves standing.
 */
export function gradeByReason(absences, grades, reasons) {
  const present = grades.filter((grade) => absences.some((row) => row.g === grade));
  const lookup = new Map();

  for (const row of absences) {
    const key = `${row.g}|${row.r}`;
    lookup.set(key, (lookup.get(key) || 0) + row.n);
  }

  return {
    grades: present,
    series: reasons.map((reason) => ({
      name: reason,
      values: present.map((grade) => lookup.get(`${grade}|${reason}`) || 0)
    }))
  };
}

/* ---------------------------------------------------------------- windows ---- */

/**
 * The equivalent stretch of instructional days immediately before the selected
 * one, used for the period-over-period deltas. Returns null when the window
 * already starts at the beginning of the year.
 */
export function priorWindow(calendar, from, to) {
  const start = calendar.indexOf(from);
  const end = calendar.indexOf(to);
  if (start <= 0) return null;

  const span = end - start + 1;
  const priorStart = Math.max(0, start - span);
  return { from: calendar[priorStart], to: calendar[start - 1] };
}

/** Share of total, for the "% of absences" column. */
export function withShare(rows, key) {
  const total = rows.reduce((sum, row) => sum + row[key], 0);
  return rows.map((row) => ({ ...row, share: total ? (row[key] / total) * 100 : 0 }));
}
