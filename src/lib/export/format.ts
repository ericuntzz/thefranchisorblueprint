/**
 * Formatting helpers for export builders.
 *
 * Builders pull raw values out of `customer_memory.fields` (numbers,
 * strings, booleans, arrays) and need to turn them into customer-
 * facing display text. These helpers centralize the formatting so
 * every deliverable shows currency / percent / dates the same way.
 *
 * Empty / missing values are intentionally rendered as "—" rather
 * than blank. An attorney reading the FDD draft can scan for "—"
 * to find every spot the customer hasn't filled in yet, and the
 * pre-export confidence review surfaces these as gaps.
 */

const EM_DASH = "—";

export function fmtText(v: unknown): string {
  if (v == null) return EM_DASH;
  if (typeof v === "string") return v.trim() || EM_DASH;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : EM_DASH;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    const items = v.filter((x) => typeof x === "string" && x.trim());
    return items.length > 0 ? items.join(", ") : EM_DASH;
  }
  return EM_DASH;
}

/** US dollars — `$45,000` or `—` when missing. */
export function fmtCurrency(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return EM_DASH;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** Currency range — "$275,000 – $425,000" or "$275,000+" if only low set. */
export function fmtCurrencyRange(low: unknown, high: unknown): string {
  const lo = toNumber(low);
  const hi = toNumber(high);
  if (lo == null && hi == null) return EM_DASH;
  if (lo != null && hi != null) return `${fmtCurrency(lo)} – ${fmtCurrency(hi)}`;
  if (lo != null) return `${fmtCurrency(lo)}+`;
  return `Up to ${fmtCurrency(hi!)}`;
}

/** Percentage — `5.5%` or `—` when missing. */
export function fmtPct(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return EM_DASH;
  const formatted = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1);
  return `${formatted}%`;
}

/** Whole integer with thousands separators — `1,250` or `—`. */
export function fmtInt(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return EM_DASH;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Decimal number — `12.5` or `—`. */
export function fmtNumber(v: unknown, decimals = 1): string {
  const n = toNumber(v);
  if (n == null) return EM_DASH;
  return n.toFixed(decimals);
}

/** ISO date → "September 1, 2018" or `—`. */
export function fmtDate(v: unknown): string {
  if (typeof v !== "string" || !v) return EM_DASH;
  const d = new Date(v);
  if (isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "Yes" / "No" / "—". */
export function fmtBool(v: unknown): string {
  if (v == null) return EM_DASH;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return EM_DASH;
}

/** Resolve a `select` field's stored value to its label, falling back
 *  to a humanized version of the value if no options array supplied. */
export function fmtSelect(
  v: unknown,
  options?: Array<{ value: string; label: string }>,
): string {
  if (typeof v !== "string" || !v) return EM_DASH;
  if (options) {
    const match = options.find((o) => o.value === v);
    if (match) return match.label;
  }
  // Humanize snake_case → Title Case as a fallback.
  return v
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Returns the items as a list (no joining), filtering out empties.
 *  Use for `bullets` / `numbered` blocks where the renderer handles
 *  per-item layout. */
export function fmtList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((s) => s.trim());
}

/** True if the value would render as a real value (not the em-dash). */
export function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.some((x) => typeof x === "string" && !!x.trim());
  return false;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
