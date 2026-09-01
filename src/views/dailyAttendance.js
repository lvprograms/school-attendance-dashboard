import { h, card, statTile, tableView, table } from "../ui.js";
import { lineChart, seriesColor } from "../charts.js";
import { byDay, summarise } from "../data/reports.js";
import { money, count, percent, dateShort, dateLong } from "../format.js";

/**
 * Report 1 - the daily attendance register.
 *
 * Rate and absence count are two different measures on two different scales,
 * so they get two charts rather than one chart with two y-axes.
 */
export const dailyAttendance = {
  id: "daily",
  title: "Daily attendance register",
  blurb: "Day-by-day attendance across the selected instructional days: who was scheduled, who showed up, and what the gap costs.",
  usesGlobalFilters: true,

  render({ rows, school }) {
    const days = byDay(rows);
    const totals = summarise(rows);

    const best = days.reduce((a, b) => (b.rate > a.rate ? b : a), days[0]);
    const worst = days.reduce((a, b) => (b.rate < a.rate ? b : a), days[0]);
    const belowTarget = days.filter((day) => day.rate < 95).length;

    const view = h("div");

    view.append(h("div.grid.grid--tiles", {},
      statTile({
        label: "Instructional days",
        value: count(totals.days),
        note: `${dateLong(days[0].date)} - ${dateLong(days[days.length - 1].date)}`
      }),
      statTile({ label: "Attendance rate", value: percent(totals.rate, 2) }),
      statTile({
        label: "Absent student-days",
        value: count(totals.absent),
        note: `${money(totals.fundingForfeited)} in forfeited ADA funding`,
        goodWhenUp: false
      }),
      statTile({
        label: "Days below 95% target",
        value: `${belowTarget} of ${totals.days}`,
        note: "The 95% line is the district's own reporting threshold",
        goodWhenUp: false
      })));

    // --- rate by day --------------------------------------------------------
    const rateCard = card({
      title: "Attendance rate by day",
      sub: `Best day ${dateLong(best.date)} at ${percent(best.rate, 1)}; worst ${dateLong(worst.date)} at ${percent(worst.rate, 1)}.`
    });
    const ratePlot = h("div");
    rateCard.body.append(ratePlot, tableView("View as table", table({
      caption: "Daily attendance register",
      columns,
      rows: days,
      footer: {
        date: "Total",
        enrolled: count(totals.enrolled),
        present: count(totals.present),
        absent: count(totals.absent),
        tardy: count(totals.tardy),
        rate: percent(totals.rate, 2),
        fundingForfeited: money(totals.fundingForfeited)
      }
    })));

    // --- absences by day ----------------------------------------------------
    const absenceCard = card({
      title: "Absent student-days by day",
      sub: "The same register counted as headcount rather than a rate - this is the number that drives the funding line."
    });
    const absencePlot = h("div");
    absenceCard.body.append(absencePlot, h("p.card__sub", { style: "margin-top: 10px" },
      `Every absent student-day costs ${money(school.meta.adaRate)} in Average Daily Attendance funding. ` +
      `Over this window that comes to ${money(totals.fundingForfeited)}.`));

    view.append(h("div.grid", { style: "margin-top: 16px" }, rateCard.root, absenceCard.root));

    view.__mount = () => {
      lineChart(ratePlot, {
        labels: days.map((d) => d.date),
        series: [{ name: "Attendance rate", values: days.map((d) => d.rate) }],
        baseline: "fit",
        height: 260,
        formatTick: (v) => percent(v, 0),
        formatValue: (v) => percent(v, 2),
        formatLabel: (iso, _i, full) => (full ? dateLong(iso) : dateShort(iso)),
        ariaLabel: "Attendance rate by instructional day. The table view below carries the same values."
      });

      lineChart(absencePlot, {
        labels: days.map((d) => d.date),
        series: [{ name: "Absent", values: days.map((d) => d.absent), color: seriesColor(1) }],
        height: 220,
        formatTick: count,
        formatValue: (v) => `${count(v)} students`,
        formatLabel: (iso, _i, full) => (full ? dateLong(iso) : dateShort(iso)),
        ariaLabel: "Absent student-days by instructional day. The table view in the card above carries the same values."
      });
    };

    return view;
  }
};

const columns = [
  { key: "date", label: "Date", format: dateLong, strong: true },
  { key: "enrolled", label: "Enrolled", num: true, format: count },
  { key: "present", label: "Present", num: true, format: count },
  { key: "absent", label: "Absent", num: true, format: count },
  { key: "tardy", label: "Tardy", num: true, format: count },
  {
    key: "rate", label: "Rate", num: true,
    render: (row) => h("span", {
      class: row.rate < 95 ? "neg" : null,
      text: percent(row.rate, 2)
    })
  },
  { key: "fundingForfeited", label: "Funding forfeited", num: true, format: money }
];
