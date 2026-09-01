import { h, card, statTile, table, select } from "../ui.js";
import { barChart, sparklineSvg, seriesColor } from "../charts.js";
import { STANDINGS } from "../data/school.js";
import { count, percent, dateLong } from "../format.js";

const ROW_LIMIT = 50;

/**
 * Report 3 - the student roster, the view an attendance clerk actually works
 * from. It carries its own filter row rather than the global date range:
 * student standing is a whole-year measure, and a date filter here would
 * promise a slice the rolled-up data cannot cut.
 */
export const roster = {
  id: "roster",
  title: "Student roster",
  blurb: "Every enrolled student ranked by attendance, with the chronically absent surfaced first. Figures cover the full school year.",
  usesGlobalFilters: false,

  render({ school, state, setState }) {
    const query = state.rosterQuery.trim().toLowerCase();
    const sort = state.rosterSort;

    const matching = school.students.filter((student) =>
      (state.rosterGrade === "all" || student.grade === state.rosterGrade) &&
      (state.rosterStanding === "all" || student.standing === state.rosterStanding) &&
      (!query ||
        student.name.toLowerCase().includes(query) ||
        String(student.id).includes(query)));

    const sorted = [...matching].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const compare = typeof left === "string" ? left.localeCompare(right) : left - right;
      return sort.dir === "asc" ? compare : -compare;
    });

    const shown = sorted.slice(0, ROW_LIMIT);
    const chronic = matching.filter((s) => s.standing === "Chronically absent");
    const daysMissed = matching.reduce((sum, s) => sum + s.absent, 0);
    const avgRate = matching.length
      ? matching.reduce((sum, s) => sum + s.rate, 0) / matching.length
      : 0;
    const mostMissed = [...matching].sort((a, b) => b.absent - a.absent).slice(0, 10);

    const view = h("div");

    // --- this report's own filter row --------------------------------------
    view.append(h("div.filters", {},
      h("span.filters__label", { text: "Grade" }),
      select({
        label: "Grade level",
        value: state.rosterGrade,
        onChange: (value) => setState({ rosterGrade: value }),
        options: [
          { value: "all", label: "All grades" },
          ...school.meta.grades.map((grade) => ({ value: grade, label: grade }))
        ]
      }),
      h("span.filters__label", { text: "Standing" }),
      select({
        label: "Attendance standing",
        value: state.rosterStanding,
        onChange: (value) => setState({ rosterStanding: value }),
        options: [
          { value: "all", label: "All standings" },
          ...STANDINGS.map((standing) => ({ value: standing, label: standing }))
        ]
      }),
      h("input", {
        type: "search",
        placeholder: "Search name or student ID",
        "aria-label": "Search the roster",
        value: state.rosterQuery,
        onInput: (event) => setState({ rosterQuery: event.target.value })
      }),
      h("span.chip.filters__spacer", { text: `${count(matching.length)} students` })));

    view.append(h("div.grid.grid--tiles", {},
      statTile({ label: "Students matching", value: count(matching.length) }),
      statTile({
        label: "Chronically absent",
        value: count(chronic.length),
        note: `${percent(matching.length ? (chronic.length / matching.length) * 100 : 0, 1)} of the filtered roster`,
        goodWhenUp: false
      }),
      statTile({ label: "Average attendance", value: percent(avgRate, 1) }),
      statTile({
        label: "Days missed",
        value: count(daysMissed),
        note: "Total absent student-days across the year",
        goodWhenUp: false
      })));

    const topCard = card({
      title: "Ten students with the most days missed",
      sub: "The intervention list. A short tail of students accounts for a large share of all absences."
    });
    const topPlot = h("div");
    topCard.body.append(topPlot);

    const tableCard = card({
      title: "Roster detail",
      sub: shown.length < sorted.length
        ? `Showing the first ${shown.length} of ${count(sorted.length)} matching students. Sort or filter to narrow the list.`
        : `${count(sorted.length)} matching students.`
    });

    tableCard.body.append(table({
      caption: "Student attendance roster for the full school year",
      columns: columns(),
      rows: shown,
      sort,
      onSort: (key) => setState({
        rosterSort: { key, dir: sort.key === key && sort.dir === "desc" ? "asc" : "desc" }
      })
    }));

    if (!shown.length) {
      tableCard.body.append(h("p.loading", { text: "No students match these filters." }));
    }

    view.append(h("div.grid", { style: "margin-top: 16px" }, topCard.root, tableCard.root));

    view.__mount = () => {
      if (!mostMissed.length) return;
      barChart(topPlot, {
        labels: mostMissed.map((s) => `${s.name} · ${s.id}`),
        values: mostMissed.map((s) => s.absent),
        color: seriesColor(0),
        formatValue: (v) => `${count(v)} days`,
        ariaLabel: "The ten students with the most absent days. The roster table below carries the same values."
      });
    };

    return view;
  }
};

function columns() {
  return [
    { key: "name", label: "Student", strong: true },
    { key: "id", label: "ID", num: true, format: (v) => String(v) },
    { key: "grade", label: "Grade" },
    {
      key: "standing", label: "Standing",
      render: (row) => h("span.pill", { text: row.standing })
    },
    { key: "days", label: "Enrolled", num: true, format: count },
    { key: "absent", label: "Absent", num: true, format: count },
    { key: "unexcused", label: "Unexcused", num: true, format: count },
    { key: "tardy", label: "Tardy", num: true, format: count },
    {
      key: "rate", label: "Attendance", num: true,
      render: (row) => h("span", {
        class: row.rate < 90 ? "neg" : null,
        text: percent(row.rate, 1)
      })
    },
    {
      key: "spark", label: "Trend", sortable: false,
      render: (row) => h("span", {
        html: sparklineSvg(row.spark.filter((v) => v !== null)),
        title: "Attendance rate per reporting period across the year"
      })
    },
    { key: "topReason", label: "Top reason" },
    { key: "lastAbsence", label: "Last absence", format: (v) => (v ? dateLong(v) : "-") }
  ];
}
