import { h, card, statTile, legend, tableView, table } from "../ui.js";
import { barChart, stackedColumnChart, seriesColor } from "../charts.js";
import { byGrade, byReason, gradeByReason, summarise, withShare } from "../data/reports.js";
import { count, percent, money } from "../format.js";

/**
 * Report 2 - where the absences actually sit.
 *
 * The unexcused share is the number that matters here: excused and medical
 * absences are a health story, unexcused absences are an intervention story,
 * and only one of the two is something the school can act on directly.
 */
export const gradeBreakdown = {
  id: "grades",
  title: "Grade level & absence reasons",
  blurb: "Which grade levels carry the absences, and what those absences are recorded as once the office codes them.",
  usesGlobalFilters: true,

  render({ rows, absences, school }) {
    const totals = summarise(rows);
    const grades = withShare(byGrade(rows, school.meta.grades), "absent");
    const reasons = byReason(absences, school.meta.reasons);
    const matrix = gradeByReason(absences, school.meta.grades, school.meta.reasons);

    const lowest = [...grades].sort((a, b) => a.rate - b.rate)[0];
    const topReason = reasons[0];
    const unexcused = reasons.find((r) => r.reason === "Unexcused");

    const view = h("div");

    view.append(h("div.grid.grid--tiles", {},
      statTile({ label: "Grade levels in scope", value: String(grades.length) }),
      statTile({
        label: "Lowest attendance",
        value: lowest ? lowest.grade : "-",
        note: lowest ? percent(lowest.rate, 1) + " attendance rate" : null
      }),
      statTile({
        label: "Most common reason",
        value: topReason ? topReason.reason : "-",
        note: topReason ? `${percent(topReason.share, 1)} of all absences` : null
      }),
      statTile({
        label: "Unexcused share",
        value: unexcused ? percent(unexcused.share, 1) : "-",
        note: `${count(unexcused ? unexcused.absent : 0)} student-days needing follow-up`,
        goodWhenUp: false
      })));

    // --- absences by grade --------------------------------------------------
    const gradeCard = card({
      title: "Absent student-days by grade",
      sub: "Raw headcount, not a rate - larger grades carry more absences even at the same attendance rate."
    });
    const gradePlot = h("div");
    gradeCard.body.append(gradePlot, tableView("View as table", table({
      caption: "Attendance by grade level",
      columns: gradeColumns,
      rows: grades,
      footer: {
        grade: "Total",
        enrolled: count(totals.enrolled),
        present: count(totals.present),
        absent: count(totals.absent),
        share: percent(100, 1),
        tardy: count(totals.tardy),
        rate: percent(totals.rate, 2),
        fundingForfeited: money(totals.fundingForfeited)
      }
    })));

    // --- reasons by grade ---------------------------------------------------
    const reasonCard = card({
      title: "Absences by grade, split by recorded reason",
      sub: "Colour always means the same reason, whichever grades the filter leaves standing."
    });
    const reasonPlot = h("div");
    const swatches = matrix.series.map((series, index) => ({ name: series.name, color: seriesColor(index) }));
    reasonCard.body.append(legend(swatches), reasonPlot, tableView("View as table", table({
      caption: "Absences by recorded reason",
      columns: reasonColumns,
      rows: reasons,
      footer: {
        reason: "Total",
        absent: count(reasons.reduce((sum, r) => sum + r.absent, 0)),
        share: percent(100, 1)
      }
    })));

    view.append(h("div.grid", { style: "margin-top: 16px" }, gradeCard.root, reasonCard.root));

    view.__mount = () => {
      barChart(gradePlot, {
        labels: grades.map((g) => g.grade),
        values: grades.map((g) => g.absent),
        color: seriesColor(0),
        formatValue: count,
        ariaLabel: "Absent student-days by grade level."
      });

      stackedColumnChart(reasonPlot, {
        labels: matrix.grades,
        series: matrix.series.map((series, index) => ({ ...series, color: seriesColor(index) })),
        height: 300,
        formatTick: count,
        formatValue: count,
        formatLabel: (label) => label.replace("Grade ", "Gr "),
        ariaLabel: "Absences by grade level, stacked by recorded reason. The table view below carries the same values."
      });
    };

    return view;
  }
};

const gradeColumns = [
  { key: "grade", label: "Grade", strong: true },
  { key: "enrolled", label: "Enrolled days", num: true, format: count },
  { key: "present", label: "Present", num: true, format: count },
  { key: "absent", label: "Absent", num: true, format: count },
  { key: "share", label: "% of absences", num: true, format: (v) => percent(v, 1) },
  { key: "tardy", label: "Tardy", num: true, format: count },
  { key: "rate", label: "Rate", num: true, format: (v) => percent(v, 2) },
  { key: "fundingForfeited", label: "Funding forfeited", num: true, format: money }
];

const reasonColumns = [
  { key: "reason", label: "Recorded reason", strong: true },
  { key: "absent", label: "Student-days", num: true, format: count },
  { key: "share", label: "% of absences", num: true, format: (v) => percent(v, 1) }
];
