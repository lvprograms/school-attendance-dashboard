# Harbor Point HS — Attendance Dashboard

A reporting dashboard for a school that does not exist, built with no framework and no
dependencies at runtime. It covers the thing a school office actually reports on daily:
who was scheduled, who showed up, and what the gap costs in Average Daily Attendance
funding.

**Everything on screen is synthetic.** ~155,000 student-days are simulated in the
browser from a fixed seed the moment the page loads. There is no backend, no database,
and no API — which is also why it runs on StackBlitz and GitHub Pages unchanged.

> ⚠️ Harbor Point High School, Westbrook Unified School District, every student, and
> every number are invented. No real student data is used, stored, or transmitted.

---

## Try it

| | |
|---|---|
| **Live demo** | https://lvprograms.github.io/school-attendance-dashboard/ |
| **Edit in the browser** | https://stackblitz.com/github/lvprograms/school-attendance-dashboard |

Locally:

```bash
npm install
npm run dev
```

## The reports

**Attendance overview** — the landing view. One hero figure (the attendance rate the
year is judged on), then enrolment, chronic absenteeism, Average Daily Attendance, and
the funding forfeited to absences. Attendance by day and absence rate by grade.

**Daily attendance register** — the day-by-day register. Attendance rate and absent
student-days get separate charts rather than one chart with two y-axes, and every day
below the district's 95% threshold is flagged in the table.

**Grade level & absence reasons** — where the absences sit and what the office coded
them as. The unexcused share is the number that matters: excused and medical absences
are a health story, unexcused absences are an intervention story, and only one of the
two is directly actionable.

**Student roster** — the list an attendance clerk works from, sortable on every column,
with standing bands (Good standing / Watch / At risk / Chronically absent) drawn on the
federal definition of chronic absenteeism: missing 10% or more of enrolled days.

The first three share a period + grade filter. The roster carries its own filters,
because student standing is a whole-year measure and a date filter there would promise
a slice the rolled-up data cannot cut.

## How it is put together

```
src/
  data/
    random.js     seeded PRNG (mulberry32) — Math.random cannot be seeded, and the
                  numbers in a screenshot have to match the numbers on the site
    calendar.js   the school calendar: 181 instructional days, weekends and breaks
                  removed, plus the day-level pressure that drives the dips
    school.js     the simulation — one student-day at a time, folded into three
                  rollup tables as it goes so no per-day rows are ever kept
    reports.js    pure functions from those tables to the shape each view renders
  views/          one file per report; each returns a DOM node and a mount hook
  charts.js       the SVG chart set — line, column, stacked column, bar, sparkline
  ui.js           card / stat tile / table / legend / filter primitives
  main.js         routing, filter state, render
```

The layering is the point: `data/` knows nothing about the DOM, `views/` knows nothing
about how the data was generated, and every figure on screen is a real aggregation over
real rows. The data is fake; the reporting is not.

### Notes on the charts

They are hand-rolled SVG — about 400 lines, no charting library. A few rules held
throughout:

- **No dual-axis charts.** Two measures on different scales get two charts.
- **Bars keep a zero baseline; lines may fit the data.** A bar encodes value as length,
  so cropping it lies. That is also why absence rate, not attendance rate, is the bar
  chart on the overview — every grade's attendance bar would look identical at 91–95%,
  while the absence bars run 5.1% to 8.8%.
- **Every chart has a table view**, so no value is reachable only by hovering.
- **Colour never carries meaning alone.** The categorical palette is validated for
  colour-vision deficiency (worst adjacent pair ΔE 9.1 light / 8.4 dark, OKLab ×100),
  and multi-series charts always ship a legend.
- **Colours are CSS custom properties applied via `style`**, so switching theme
  repaints without redrawing.

Light and dark are both first-class: the dark palette is its own set of steps chosen
against the dark surface, not an inverted light one. The toggle wins over the OS
setting in both directions.

## Deploying

`npm run build` emits a static `dist/`. Asset paths are relative, so it works from a
project sub-path without configuration.

A GitHub Actions workflow at `.github/workflows/deploy.yml` publishes it to GitHub Pages
on every push to `main`. Enable it once under **Settings → Pages → Source → GitHub
Actions**.

## Licence

MIT — see [LICENSE](LICENSE).
