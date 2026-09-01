/* ---------------------------------------------------------------------------
   The handful of DOM pieces every view is assembled from. Deliberately plain:
   no framework, no virtual DOM, just functions that return elements.
   --------------------------------------------------------------------------- */

/** Tiny hyperscript. `h("div.card", { id: "x" }, child, "text")` */
export function h(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = `${node.className} ${value}`.trim();
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else if (key === "value") node.value = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** A titled panel. Returns the root plus its body, so callers can fill it in. */
export function card({ title, sub }) {
  const body = h("div");
  const root = h("section.card", {},
    title
      ? h("header.card__head", {},
        h("h2.card__title", { text: title }),
        sub ? h("p.card__sub", { text: sub }) : null)
      : null,
    body);
  return { root, body };
}

/**
 * The signed change against the previous period. `goodWhenUp` flips the colour
 * for measures where a rise is the bad outcome (absences, chronic counts).
 */
function deltaNode(delta, { unit = "%", label = "vs previous period", goodWhenUp = true }) {
  if (delta === null || delta === undefined || !isFinite(delta)) return null;

  const up = delta >= 0;
  const positive = up === goodWhenUp;
  return h("div.delta", { class: positive ? "delta--up" : "delta--down" },
    h("span.delta__value", { text: `${up ? "+" : ""}${delta.toFixed(1)}${unit === "pts" ? "" : unit}` }),
    h("span", { text: unit === "pts" ? `pts ${label}` : label }));
}

export function statTile({ label, value, delta = null, deltaUnit = "%", deltaLabel = "vs previous period", note = null, goodWhenUp = true }) {
  return h("div.card.tile", {},
    h("div.tile__label", { text: label }),
    h("div.tile__value", { text: value }),
    deltaNode(delta, { unit: deltaUnit, label: deltaLabel, goodWhenUp }),
    note ? h("p.tile__note", { text: note }) : null);
}

/** The hero figure - the one number a view leads with. Never more than one. */
export function heroTile({ label, value, delta = null, deltaUnit = "%", note = null, goodWhenUp = true }) {
  return h("section.card.hero", {},
    h("div.tile__label", { text: label }),
    h("div.hero__value", { text: value }),
    deltaNode(delta, { unit: deltaUnit, goodWhenUp }),
    note ? h("p.card__sub", { text: note }) : null);
}

/** Identity never rests on colour alone - every multi-series chart gets one of these. */
export function legend(items) {
  return h("ul.legend", {}, items.map((item) =>
    h("li", {},
      h("span.legend__swatch", { style: `background: ${item.color}` }),
      h("span", { text: item.name }))));
}

/**
 * A data table. Columns are `{ key, label, num, strong, format, render, sortable }`.
 * When `sort` and `onSort` are supplied the headers become sort controls.
 */
export function table({ columns, rows, footer = null, sort = null, onSort = null, caption = null }) {
  const head = h("tr", {}, columns.map((column) => {
    const active = sort && sort.key === column.key;
    const sortable = onSort && column.sortable !== false;

    const cell = h("th", {
      class: column.num ? "num" : null,
      scope: "col",
      "data-sortable": sortable ? "" : null,
      "aria-sort": active ? (sort.dir === "asc" ? "ascending" : "descending") : null,
      text: active ? `${column.label} ${sort.dir === "asc" ? "▲" : "▼"}` : column.label
    });

    if (sortable) {
      cell.tabIndex = 0;
      cell.addEventListener("click", () => onSort(column.key));
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSort(column.key);
        }
      });
    }

    return cell;
  }));

  const body = h("tbody", {}, rows.map((row) =>
    h("tr", {}, columns.map((column) => {
      const classes = [column.num ? "num" : "", column.strong ? "strong" : ""].join(" ").trim();
      const cell = h("td", { class: classes || null });

      const content = column.render ? column.render(row)
        : column.format ? column.format(row[column.key])
          : row[column.key];

      if (content instanceof Node) cell.append(content);
      else cell.textContent = content ?? "";

      return cell;
    }))));

  const parts = [caption ? h("caption.sr-only", { text: caption }) : null, h("thead", {}, head), body];

  if (footer) {
    parts.push(h("tfoot", {}, h("tr", {}, columns.map((column) =>
      h("td", {
        class: column.num ? "num" : null,
        text: footer[column.key] === undefined ? "" : footer[column.key]
      })))));
  }

  return h("div.table-wrap", {}, h("table", {}, parts));
}

/** Collapsed table view beneath a chart - the WCAG-clean twin of every figure. */
export function tableView(label, node) {
  return h("details.details", {}, h("summary", { text: label }), h("div", {}, node));
}

export function segmented({ options, value, onChange, label }) {
  return h("div.seg", { role: "group", "aria-label": label },
    options.map((option) => h("button", {
      type: "button",
      "aria-pressed": String(option.value === value),
      text: option.label,
      onClick: () => onChange(option.value)
    })));
}

export function select({ options, value, onChange, label }) {
  const node = h("select", { "aria-label": label, onChange: (event) => onChange(event.target.value) },
    options.map((option) => h("option", { value: option.value }, option.label)));
  node.value = value;
  return node;
}
