/* ---------------------------------------------------------------------------
   Wiring: generate the school once, then route between views and re-render on
   every filter change. The whole app is one synchronous render - there is no
   server to wait on, so there is nothing to reconcile.
   --------------------------------------------------------------------------- */

import "./styles.css";

import { generateSchool } from "./data/school.js";
import { FALL_END, SPRING_START } from "./data/calendar.js";
import { filterRows, filterAbsences } from "./data/reports.js";
import { h, segmented, select } from "./ui.js";
import { count, dateLong } from "./format.js";

import { overview } from "./views/overview.js";
import { dailyAttendance } from "./views/dailyAttendance.js";
import { gradeBreakdown } from "./views/gradeBreakdown.js";
import { roster } from "./views/roster.js";

const VIEWS = [overview, dailyAttendance, gradeBreakdown, roster];

const RANGES = [
  { value: "year", label: "Full year" },
  { value: "fall", label: "Fall" },
  { value: "spring", label: "Spring" },
  { value: "recent", label: "Last 30 days" }
];

const state = {
  view: "overview",
  range: "year",
  grade: "all",
  rosterGrade: "all",
  rosterStanding: "all",
  rosterQuery: "",
  rosterSort: { key: "rate", dir: "asc" }
};

const nodes = {
  nav: document.getElementById("nav"),
  filters: document.getElementById("filters"),
  view: document.getElementById("view"),
  title: document.getElementById("view-title"),
  blurb: document.getElementById("view-blurb"),
  buildNote: document.getElementById("build-note"),
  themeToggle: document.getElementById("theme-toggle")
};

let school = null;

/* ------------------------------------------------------------------- theme -- */

function applyTheme(theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);

  const dark = theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  nodes.themeToggle.textContent = dark ? "Light mode" : "Dark mode";
  nodes.themeToggle.setAttribute("aria-pressed", String(dark));
}

function initTheme() {
  let theme = "system";
  try {
    theme = localStorage.getItem("hp-theme") || "system";
  } catch {
    // Private browsing and locked-down profiles both throw here; the default is fine.
  }

  applyTheme(theme);

  nodes.themeToggle.addEventListener("click", () => {
    const dark = nodes.themeToggle.getAttribute("aria-pressed") === "true";
    const next = dark ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem("hp-theme", next);
    } catch {
      // Not being able to remember the choice is not worth surfacing.
    }
  });
}

/* ------------------------------------------------------------------ window -- */

/** Turns the range preset into a concrete pair of instructional days. */
function resolveWindow() {
  const calendar = school.calendar;
  let from = calendar[0];
  let to = calendar[calendar.length - 1];

  if (state.range === "fall") {
    to = calendar.filter((date) => date <= FALL_END).pop();
  } else if (state.range === "spring") {
    from = calendar.find((date) => date >= SPRING_START);
  } else if (state.range === "recent") {
    from = calendar[Math.max(0, calendar.length - 30)];
  }

  return {
    from,
    to,
    grades: state.grade === "all" ? null : new Set([state.grade])
  };
}

/* ------------------------------------------------------------------ render -- */

function currentView() {
  return VIEWS.find((view) => view.id === state.view) || VIEWS[0];
}

/**
 * Applies a state patch and re-renders. Focus and caret position are carried
 * across the re-render, so typing in the roster search box is uninterrupted.
 */
function setState(patch) {
  const active = document.activeElement;
  const isSearch = active && active.matches && active.matches('input[type="search"]');
  const caret = isSearch ? active.selectionStart : null;

  Object.assign(state, patch);
  render();

  if (isSearch) {
    const next = document.querySelector('input[type="search"]');
    if (next) {
      next.focus();
      next.setSelectionRange(caret, caret);
    }
  }
}

function renderNav() {
  nodes.nav.replaceChildren(...VIEWS.map((view) =>
    h("button.nav-item", {
      type: "button",
      "aria-current": view.id === state.view ? "page" : null,
      onClick: () => {
        location.hash = `#/${view.id}`;
      }
    },
      h("span.nav-item__dot"),
      h("span", { text: view.title }))));
}

function renderFilters(view, win) {
  if (!view.usesGlobalFilters) {
    nodes.filters.replaceChildren();
    return;
  }

  nodes.filters.replaceChildren(h("div.filters", {},
    h("span.filters__label", { text: "Period" }),
    segmented({
      label: "Reporting period",
      options: RANGES,
      value: state.range,
      onChange: (value) => setState({ range: value })
    }),
    h("span.filters__label", { text: "Grade" }),
    select({
      label: "Grade level",
      value: state.grade,
      onChange: (value) => setState({ grade: value }),
      options: [
        { value: "all", label: "All grades" },
        ...school.meta.grades.map((grade) => ({ value: grade, label: grade }))
      ]
    }),
    h("span.chip.filters__spacer", {
      text: `${dateLong(win.from)} – ${dateLong(win.to)}`
    })));
}

function render() {
  const view = currentView();
  const win = resolveWindow();

  nodes.title.textContent = view.title;
  nodes.blurb.textContent = view.blurb;

  renderNav();
  renderFilters(view, win);

  const rows = filterRows(school.attendance, win);
  const absences = filterAbsences(school.absences, win);

  const rendered = view.render({ school, rows, absences, window: win, state, setState });

  nodes.view.replaceChildren(rendered);

  // Charts measure their container, so they mount only once the nodes are live.
  if (rendered.__mount) rendered.__mount();
}

/* -------------------------------------------------------------------- boot -- */

function routeFromHash() {
  const id = location.hash.replace(/^#\/?/, "");
  state.view = VIEWS.some((view) => view.id === id) ? id : "overview";
}

function boot() {
  initTheme();

  // Let the shell paint before the generator runs, so the loading line is seen
  // rather than skipped over.
  requestAnimationFrame(() => {
    school = generateSchool();

    nodes.buildNote.textContent =
      `${count(school.meta.students)} students · ${count(school.meta.instructionalDays)} instructional days · ` +
      `built in ${school.meta.generatedInMs} ms`;

    routeFromHash();
    render();

    window.addEventListener("hashchange", () => {
      routeFromHash();
      render();
      window.scrollTo({ top: 0 });
    });
  });
}

boot();
