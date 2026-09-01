const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact money for axes and tiles: $1.2M, $48.5K, $920. */
export function money(value) {
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n >= 1_000_000) return `${sign}$${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `${sign}$${trim(n / 1_000)}K`;
  return `${sign}$${Math.round(n).toLocaleString("en-US")}`;
}

/** Exact money for tables and tooltips: $1,234.56. */
export function moneyExact(value) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Exact money, no cents - the grain most report tables actually want. */
export function moneyWhole(value) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

export function count(value) {
  return Math.round(value).toLocaleString("en-US");
}

export function percent(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

/** "2026-03-05" -> "Mar 5" */
export function dateShort(iso) {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** "2026-03-05" -> "Mar 5, 2026" */
export function dateLong(iso) {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const ms = new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function trim(value) {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
}
