/* ---------------------------------------------------------------------------
   A small SVG chart set, hand-rolled so the site ships with zero dependencies.

   Conventions that hold across every chart here:
     - colours are applied as `style="fill: var(--series-1)"` rather than as
       attributes, so a theme switch repaints without a redraw;
     - marks are thin, gridlines are solid hairlines one step off the surface;
     - touching marks are separated by a 2px gap in the surface colour, never
       by a stroke;
     - every chart has a crosshair or per-mark tooltip, and every chart on the
       page is mirrored by a table view.
   --------------------------------------------------------------------------- */

const NS = "http://www.w3.org/2000/svg";
const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The categorical slots, in fixed order. Never cycled; a 7th series folds into "Other". */
export const SERIES_VARS = [
  "--series-1", "--series-2", "--series-3",
  "--series-4", "--series-5", "--series-6"
];

export function seriesColor(index) {
  return `var(${SERIES_VARS[index % SERIES_VARS.length]})`;
}

const measurer = document.createElement("canvas").getContext("2d");

function textWidth(text, font = FONT) {
  measurer.font = font;
  return measurer.measureText(String(text)).width;
}

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, value);
  }
  if (parent) parent.appendChild(node);
  return node;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** Rounded rectangle with per-corner control - used for the 4px data-end. */
function roundedRect(x, y, w, h, r, [tl, tr, br, bl]) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  const a = tl ? radius : 0;
  const b = tr ? radius : 0;
  const c = br ? radius : 0;
  const d = bl ? radius : 0;
  return [
    `M${x + a},${y}`,
    `H${x + w - b}`, b ? `A${b},${b} 0 0 1 ${x + w},${y + b}` : "",
    `V${y + h - c}`, c ? `A${c},${c} 0 0 1 ${x + w - c},${y + h}` : "",
    `H${x + d}`, d ? `A${d},${d} 0 0 1 ${x},${y + h - d}` : "",
    `V${y + a}`, a ? `A${a},${a} 0 0 1 ${x + a},${y}` : "",
    "Z"
  ].join(" ");
}

/** Ticks on clean 1 / 2 / 5 x 10^n boundaries. */
function niceScale(min, max, target = 4) {
  if (!isFinite(min) || !isFinite(max) || max === min) max = min + 1;
  const raw = (max - min) / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalised = raw / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, ticks };
}

/**
 * Mounts a chart that redraws itself when its container is resized, and tears
 * down the previous one if the container is being reused.
 */
function createChart(container, height, draw, ariaLabel) {
  if (container.__chartCleanup) container.__chartCleanup();
  container.classList.add("chart");
  container.replaceChildren();

  const svg = el("svg", { role: "img", "aria-label": ariaLabel || "" });
  const tip = document.createElement("div");
  tip.className = "tooltip";
  container.append(svg, tip);

  let lastWidth = -1;
  const render = () => {
    const width = Math.max(260, Math.round(container.clientWidth));
    if (width === lastWidth) return;
    lastWidth = width;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();
    hideTip(tip);
    draw({ svg, width, height, tip, container });
  };

  const observer = new ResizeObserver(() => requestAnimationFrame(render));
  observer.observe(container);
  render();

  container.__chartCleanup = () => {
    observer.disconnect();
    delete container.__chartCleanup;
  };
}

function showTip(tip, container, x, y, title, rows) {
  tip.innerHTML =
    `<div class="tooltip__title">${escapeHtml(title)}</div>` +
    rows.map((row) => (
      `<div class="tooltip__row"><span class="tooltip__key">` +
      (row.color ? `<span class="legend__swatch" style="background:${row.color}"></span>` : "") +
      `${escapeHtml(row.label)}</span>` +
      `<span class="tooltip__value">${escapeHtml(row.value)}</span></div>`
    )).join("");

  tip.dataset.open = "true";
  const width = tip.offsetWidth;
  const bounds = container.clientWidth;
  let left = x + 16;
  if (left + width > bounds) left = x - width - 16;
  tip.style.left = `${Math.max(0, Math.min(left, bounds - width))}px`;
  tip.style.top = `${Math.max(0, y)}px`;
}

function hideTip(tip) {
  tip.dataset.open = "false";
}

/** Gridlines, y-axis labels and the baseline. Returns the plot rectangle. */
function drawFrame(svg, width, height, { lo, hi, ticks }, formatTick, padLeft, padBottom, padTop = 12, padRight = 18) {
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const yFor = (value) => padTop + plotHeight - ((value - lo) / (hi - lo)) * plotHeight;

  for (const tick of ticks) {
    const y = yFor(tick);
    el("line", {
      x1: padLeft, x2: padLeft + plotWidth, y1: y, y2: y,
      style: `stroke: var(${tick === lo ? "--axis" : "--grid"}); stroke-width: 1`,
      "shape-rendering": "crispEdges"
    }, svg);

    const label = el("text", {
      x: padLeft - 8, y: y + 4, "text-anchor": "end",
      style: "fill: var(--text-3); font-size: 11px; font-variant-numeric: tabular-nums"
    }, svg);
    label.textContent = formatTick(tick);
  }

  return { padLeft, padTop, plotWidth, plotHeight, yFor };
}

function drawXLabels(svg, labels, xFor, y, formatLabel, maxLabels = 7) {
  const stride = Math.max(1, Math.ceil(labels.length / maxLabels));
  labels.forEach((label, i) => {
    if (i % stride !== 0 && i !== labels.length - 1) return;
    if (i !== labels.length - 1 && labels.length - 1 - i < stride * 0.6) return;
    const node = el("text", {
      x: xFor(i), y, "text-anchor": "middle",
      style: "fill: var(--text-3); font-size: 11px"
    }, svg);
    node.textContent = formatLabel(label, i);
  });
}

/* ------------------------------------------------------------------ line ---- */

/**
 * `baseline: "zero"` (the default) anchors the y-axis at zero, which is correct
 * for anything whose magnitude is the point - counts, totals, money.
 *
 * `baseline: "fit"` scales to the data instead. Rates that live in a narrow
 * band near the top - an attendance rate between 86% and 96% - are a flat line
 * against a 0-100 axis, and the whole story is in the wiggle. Fitted scales are
 * only ever used on lines here; a bar chart always keeps its zero baseline,
 * because a bar encodes value as length and a cropped bar lies about it.
 */
export function lineChart(container, options) {
  const {
    labels, series, height = 250, area = false, baseline = "zero",
    formatTick = String, formatValue = String, formatLabel = String,
    ariaLabel = "Line chart"
  } = options;

  createChart(container, height, ({ svg, width, tip }) => {
    const all = series.flatMap((s) => s.values);
    const floor = baseline === "fit" ? Math.min(...all) : Math.min(0, ...all);
    const scale = niceScale(floor, Math.max(...all));
    const padLeft = Math.ceil(Math.max(...scale.ticks.map((t) => textWidth(formatTick(t), "11px " + FONT.slice(5)))) + 18);
    const frame = drawFrame(svg, width, height, scale, formatTick, padLeft, 28);

    const xFor = (i) => labels.length === 1
      ? frame.padLeft + frame.plotWidth / 2
      : frame.padLeft + (i / (labels.length - 1)) * frame.plotWidth;

    drawXLabels(svg, labels, xFor, height - 8, formatLabel);

    for (const [index, s] of series.entries()) {
      const color = s.color || seriesColor(index);
      const points = s.values.map((v, i) => `${xFor(i)},${frame.yFor(v)}`);

      if (area) {
        el("path", {
          d: `M${frame.padLeft},${frame.yFor(scale.lo)} L${points.join(" L")} L${xFor(labels.length - 1)},${frame.yFor(scale.lo)} Z`,
          style: `fill: ${color}; opacity: 0.10`
        }, svg);
      }

      el("polyline", {
        points: points.join(" "),
        style: `fill: none; stroke: ${color}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round`
      }, svg);
    }

    // Crosshair layer: one hit rect over the whole plot, snapping to the nearest index.
    const crosshair = el("line", {
      style: "stroke: var(--axis); stroke-width: 1; opacity: 0", y1: frame.padTop, y2: frame.padTop + frame.plotHeight
    }, svg);
    const markers = series.map((s, index) => el("circle", {
      r: 4.5,
      style: `fill: ${s.color || seriesColor(index)}; stroke: var(--surface); stroke-width: 2; opacity: 0`
    }, svg));

    const hit = el("rect", {
      x: frame.padLeft, y: frame.padTop, width: frame.plotWidth, height: frame.plotHeight,
      style: "fill: transparent"
    }, svg);

    const move = (event) => {
      const box = svg.getBoundingClientRect();
      const x = event.clientX - box.left;
      const ratio = (x - frame.padLeft) / (frame.plotWidth || 1);
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(ratio * (labels.length - 1))));

      crosshair.setAttribute("x1", xFor(i));
      crosshair.setAttribute("x2", xFor(i));
      crosshair.style.opacity = "1";

      markers.forEach((marker, index) => {
        marker.setAttribute("cx", xFor(i));
        marker.setAttribute("cy", frame.yFor(series[index].values[i]));
        marker.style.opacity = "1";
      });

      showTip(tip, container, xFor(i), frame.padTop + 4, formatLabel(labels[i], i, true),
        series.map((s, index) => ({
          label: s.name,
          value: formatValue(s.values[i], s),
          color: series.length > 1 ? (s.color || seriesColor(index)) : null
        })));
    };

    const leave = () => {
      crosshair.style.opacity = "0";
      markers.forEach((m) => { m.style.opacity = "0"; });
      hideTip(tip);
    };

    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", leave);
  }, ariaLabel);
}

/* --------------------------------------------------------------- columns ---- */

export function columnChart(container, options) {
  const {
    labels, values, color = seriesColor(0), height = 250,
    formatTick = String, formatValue = String, formatLabel = String,
    ariaLabel = "Column chart"
  } = options;

  createChart(container, height, ({ svg, width, tip }) => {
    const scale = niceScale(Math.min(0, ...values), Math.max(...values));
    const padLeft = Math.ceil(Math.max(...scale.ticks.map((t) => textWidth(formatTick(t)))) + 18);
    const frame = drawFrame(svg, width, height, scale, formatTick, padLeft, 28);

    const band = frame.plotWidth / values.length;
    const barWidth = Math.max(2, Math.min(24, band - 2)); // the 2px surface gap
    const centre = (i) => frame.padLeft + band * (i + 0.5);
    const zeroY = frame.yFor(0);

    drawXLabels(svg, labels, centre, height - 8, formatLabel);

    values.forEach((value, i) => {
      const y = frame.yFor(value);
      const barHeight = Math.abs(zeroY - y);
      if (barHeight < 0.5) return;
      el("path", {
        d: roundedRect(centre(i) - barWidth / 2, Math.min(y, zeroY), barWidth, barHeight, 4,
          value >= 0 ? [true, true, false, false] : [false, false, true, true]),
        style: `fill: ${color}`
      }, svg);
    });

    values.forEach((value, i) => {
      const hit = el("rect", {
        x: frame.padLeft + band * i, y: frame.padTop,
        width: band, height: frame.plotHeight, style: "fill: transparent"
      }, svg);
      hit.addEventListener("pointerenter", () => {
        showTip(tip, container, centre(i), frame.padTop + 4, formatLabel(labels[i], i, true),
          [{ label: "Value", value: formatValue(value), color }]);
      });
      hit.addEventListener("pointerleave", () => hideTip(tip));
    });
  }, ariaLabel);
}

/* -------------------------------------------------------- stacked columns ---- */

export function stackedColumnChart(container, options) {
  const {
    labels, series, height = 280,
    formatTick = String, formatValue = String, formatLabel = String,
    ariaLabel = "Stacked column chart"
  } = options;

  createChart(container, height, ({ svg, width, tip }) => {
    const totals = labels.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
    const scale = niceScale(0, Math.max(...totals));
    const padLeft = Math.ceil(Math.max(...scale.ticks.map((t) => textWidth(formatTick(t)))) + 18);
    const frame = drawFrame(svg, width, height, scale, formatTick, padLeft, 28);

    const band = frame.plotWidth / labels.length;
    const barWidth = Math.max(6, Math.min(38, band - 16));
    const centre = (i) => frame.padLeft + band * (i + 0.5);

    drawXLabels(svg, labels, centre, height - 8, formatLabel, labels.length);

    labels.forEach((_, i) => {
      let cursor = frame.yFor(0);
      series.forEach((s, index) => {
        const value = s.values[i];
        const full = frame.yFor(0) - frame.yFor(value);
        if (full <= 0) return;
        const isTop = series.slice(index + 1).every((rest) => rest.values[i] <= 0);
        const gap = isTop ? 0 : 2; // 2px of surface between touching segments
        const drawn = Math.max(1, full - gap);
        const y = cursor - full;
        el("path", {
          d: roundedRect(centre(i) - barWidth / 2, y, barWidth, drawn, 4,
            isTop ? [true, true, false, false] : [false, false, false, false]),
          style: `fill: ${s.color || seriesColor(index)}`
        }, svg);
        cursor = y;
      });
    });

    labels.forEach((label, i) => {
      const hit = el("rect", {
        x: frame.padLeft + band * i, y: frame.padTop,
        width: band, height: frame.plotHeight, style: "fill: transparent"
      }, svg);
      hit.addEventListener("pointerenter", () => {
        showTip(tip, container, centre(i), frame.padTop + 4, formatLabel(label, i, true), [
          ...series.map((s, index) => ({
            label: s.name,
            value: formatValue(s.values[i]),
            color: s.color || seriesColor(index)
          })),
          { label: "Total", value: formatValue(totals[i]) }
        ]);
      });
      hit.addEventListener("pointerleave", () => hideTip(tip));
    });
  }, ariaLabel);
}

/* ------------------------------------------------------------ horizontal ---- */

export function barChart(container, options) {
  const {
    labels, values, color = seriesColor(0), rowHeight = 34,
    formatValue = String, ariaLabel = "Bar chart"
  } = options;

  const height = labels.length * rowHeight + 12;

  createChart(container, height, ({ svg, width, tip }) => {
    const max = Math.max(...values, 1);
    const padLeft = Math.ceil(Math.min(190, Math.max(...labels.map((l) => textWidth(l, `13px ${FONT.slice(5)}`))) + 14));
    const padRight = Math.ceil(Math.max(...values.map((v) => textWidth(formatValue(v), `12px ${FONT.slice(5)}`))) + 14);
    const plotWidth = Math.max(40, width - padLeft - padRight);

    labels.forEach((label, i) => {
      const y = 6 + i * rowHeight;
      const barHeight = Math.min(24, rowHeight - 12);
      const barY = y + (rowHeight - barHeight) / 2 - 3;
      const barWidth = Math.max(1, (values[i] / max) * plotWidth);

      const name = el("text", {
        x: padLeft - 10, y: barY + barHeight / 2 + 4, "text-anchor": "end",
        style: "fill: var(--text-2); font-size: 13px"
      }, svg);
      name.textContent = label;

      el("path", {
        d: roundedRect(padLeft, barY, barWidth, barHeight, 4, [false, true, true, false]),
        style: `fill: ${color}`
      }, svg);

      // Direct label at the tip - the bars carry no axis, so this is the value channel.
      const value = el("text", {
        x: padLeft + barWidth + 8, y: barY + barHeight / 2 + 4,
        style: "fill: var(--text-1); font-size: 12px; font-variant-numeric: tabular-nums"
      }, svg);
      value.textContent = formatValue(values[i]);

      const hit = el("rect", {
        x: 0, y, width, height: rowHeight, style: "fill: transparent"
      }, svg);
      hit.addEventListener("pointerenter", () => {
        showTip(tip, container, padLeft + barWidth, y, label,
          [{ label: "Value", value: formatValue(values[i]), color }]);
      });
      hit.addEventListener("pointerleave", () => hideTip(tip));
    });
  }, ariaLabel);
}

/* ------------------------------------------------------------- sparkline ---- */

/** Returns markup, not a mounted chart - these live inside table cells. */
export function sparklineSvg(values, { width = 78, height = 22 } = {}) {
  if (!values.length) return "";
  const min = Math.min(0, ...values);
  const max = Math.max(...values, min + 1);
  const x = (i) => (i / Math.max(1, values.length - 1)) * (width - 2) + 1;
  const y = (v) => height - 3 - ((v - min) / (max - min)) * (height - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zero = y(0).toFixed(1);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">` +
    `<line x1="1" x2="${width - 1}" y1="${zero}" y2="${zero}" style="stroke: var(--grid); stroke-width: 1" />` +
    `<polyline points="${points}" style="fill:none; stroke: var(--series-1); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round" />` +
    `<circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="2.5" ` +
    `style="fill: var(--series-1); stroke: var(--surface); stroke-width: 1.5" /></svg>`;
}
