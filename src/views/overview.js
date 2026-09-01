import { h, card, heroTile, statTile, tableView, table } from "../ui.js";
import { lineChart, barChart, seriesColor } from "../charts.js";
import { byDay, byGrade, summarise, filterRows, priorWindow } from "../data/reports.js";
import { money, moneyWhole, count, percent, dateShort, dateLong } from "../format.js";

/**
 * The landing view. One hero figure - the attendance rate the whole year is
 * judged on - then the four numbers an administrator is asked about first.
 */
export const overview = {
  id: "overview",
  title: "Attendance overview",
  blurb: "Where the school stands over the selected stretch of instructional days, and what it is costing in Average Daily Attendance funding.",
  usesGlobalFilters: true,

  render({ rows, school, window: win, state }) {
    const totals = summarise(rows);
    const days = byDay(rows);
    const grades = byGrade(rows, school.meta.grades);

    const prior = priorWindow(school.calendar, win.from, win.to);
    const before = prior
      ? summarise(filterRows(school.attendance, { ...prior, grades: win.grades }))
      : null;

    const chronic = school.students.filter((student) =>
      student.standing === "Chronically absent" &&
      (!win.grades || win.grades.has(student.grade))).length;

    const inScope = school.students.filter((student) => !win.grades || win.grades.has(student.grade));
    const worstDay = days.reduce((a, b) => (b.rate < a.rate ? b : a), days[0]);

    const view = h("div");

    view.append(h("div.grid.grid--tiles", {},
      heroTile({
        label: "Attendance rate",
        value: percent(totals.rate, 1),
        delta: before ? totals.rate - before.rate : null,
        deltaUnit: "pts",
        note: `${count(totals.present)} of ${count(totals.enrolled)} student-days attended across ` +
          `${count(totals.days)} instructional days.`
      })));

    view.append(h("div.grid.grid--tiles", { style: "margin-top: 16px" },
      statTile({
        label: "Students enrolled",
        value: count(inScope.length),
        note: state.grade === "all" ? "All grade levels" : state.grade
      }),
      statTile({
        label: "Chronically absent",
        value: count(chronic),
        note: `${percent(inScope.length ? (chronic / inScope.length) * 100 : 0, 1)} of students · missed 10% or more of enrolled days`,
        // More chronically absent students is bad news, so the delta colour flips.
        goodWhenUp: false
      }),
      statTile({
        label: "Average daily attendance",
        value: count(totals.ada),
        note: "Students present on an average day"
      }),
      statTile({
        label: "ADA funding forfeited",
        value: money(totals.fundingForfeited),
        note: `${count(totals.absent)} absent student-days at ${moneyWhole(school.meta.adaRate)} each`,
        goodWhenUp: false
      })));

    // --- attendance by day --------------------------------------------------
    const dayCard = card({
      title: "Attendance rate by day",
      sub: `Lowest day was ${dateLong(worstDay.date)} at ${percent(worstDay.rate, 1)} - Fridays and the days either side of a break drive the dips.`
    });
    const dayPlot = h("div");
    dayCard.body.append(dayPlot, tableView("View as table", table({
      columns: dayColumns,
      rows: days,
      footer: dayFooter(totals)
    })));

    // --- attendance by grade ------------------------------------------------
    const gradeCard = card({
      title: "Absence rate by grade",
      sub: "Charted as absence rate rather than attendance rate: a bar from zero to 94% looks the same for every grade, while a bar from zero to 8% shows the gap."
    });
    const gradePlot = h("div");
    gradeCard.body.append(gradePlot, tableView("View as table", table({
      columns: gradeColumns,
      rows: grades
    })));

    view.append(h("div.grid.grid--split", { style: "margin-top: 16px" }, dayCard.root, gradeCard.root));

    // Charts mount after the nodes are in the document, so they can measure width.
    view.__mount = () => {
      lineChart(dayPlot, {
        labels: days.map((d) => d.date),
        series: [{ name: "Attendance rate", values: days.map((d) => d.rate) }],
        baseline: "fit",
        height: 240,
        formatTick: (v) => percent(v, 0),
        formatValue: (v) => percent(v, 1),
        formatLabel: (iso, _i, full) => (full ? dateLong(iso) : dateShort(iso)),
        ariaLabel: "Attendance rate by instructional day. The table view below carries the same values."
      });

      barChart(gradePlot, {
        labels: grades.map((g) => g.grade),
        values: grades.map((g) => g.absenceRate),
        color: seriesColor(0),
        formatValue: (v) => percent(v, 1),
        ariaLabel: "Absence rate by grade level."
      });
    };

    return view;
  }
};

const dayColumns = [
  { key: "date", label: "Date", format: dateLong, strong: true },
  { key: "enrolled", label: "Enrolled", num: true, format: count },
  { key: "present", label: "Present", num: true, format: count },
  { key: "absent", label: "Absent", num: true, format: count },
  { key: "tardy", label: "Tardy", num: true, format: count },
  { key: "rate", label: "Rate", num: true, format: (v) => percent(v, 1) }
];

const dayFooter = (totals) => ({
  date: "Total",
  enrolled: count(totals.enrolled),
  present: count(totals.present),
  absent: count(totals.absent),
  tardy: count(totals.tardy),
  rate: percent(totals.rate, 1)
});

const gradeColumns = [
  { key: "grade", label: "Grade", strong: true },
  { key: "enrolled", label: "Enrolled days", num: true, format: count },
  { key: "absent", label: "Absent days", num: true, format: count },
  { key: "absenceRate", label: "Absence rate", num: true, format: (v) => percent(v, 2) },
  { key: "rate", label: "Rate", num: true, format: (v) => percent(v, 1) }
];
