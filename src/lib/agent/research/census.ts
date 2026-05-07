/**
 * US Census Bureau API wrapper — trade-area demographics.
 *
 * Public data, free key. Used to answer "what's the median household
 * income / population / age distribution within ZIP X?" for the
 * territory_real_estate + market_strategy chapters.
 *
 * We hit the ACS 5-Year Detailed Tables (ACSDT5Y) at the ZIP Code
 * Tabulation Area (ZCTA) level. The customer provides a ZIP, we
 * return a small bundle of the metrics that matter for site
 * selection: population, median household income, median age.
 *
 * Env-gated on `CENSUS_API_KEY`. Without it, returns
 * { ok: false, reason: "no_api_key" }.
 */

import "server-only";

const CENSUS_BASE = "https://api.census.gov/data";
// ACS 5-year — the most reliable + comprehensive product. We use the
// most recent year that has stable data; Census releases new years
// in the fall.
const ACS_YEAR = 2022;

export type DemographicsResult =
  | {
      ok: true;
      zip: string;
      population: number | null;
      medianHouseholdIncome: number | null;
      medianAge: number | null;
      year: number;
    }
  | {
      ok: false;
      reason: "no_api_key" | "no_results" | "api_error" | "request_error";
      message?: string;
    };

export async function zipDemographics(zip: string): Promise<DemographicsResult> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  // ACS variables:
  //   B01003_001E — total population
  //   B19013_001E — median household income (dollars)
  //   B01002_001E — median age (years)
  const variables = ["B01003_001E", "B19013_001E", "B01002_001E"];
  const url =
    `${CENSUS_BASE}/${ACS_YEAR}/acs/acs5` +
    `?get=${variables.join(",")}` +
    `&for=zip%20code%20tabulation%20area:${encodeURIComponent(zip)}` +
    `&key=${apiKey}`;
  let res: Response;
  try {
    // `redirect: "manual"` so Census's 302-to-invalid-key HTML page
    // doesn't follow into nonsense — we want to fail clean here.
    res = await fetch(url, { redirect: "manual" });
  } catch (err) {
    return {
      ok: false,
      reason: "request_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  // Census redirects to invalid_key.html (302) when the key is bad —
  // detect the dedicated header it sends rather than the generic
  // status code.
  if (res.headers.get("x-datawebapi-keyerror") === "1") {
    return {
      ok: false,
      reason: "api_error",
      message:
        "Census key invalid. Activate via the email Census sent on signup, or re-request a key.",
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "api_error", message: `HTTP ${res.status}` };
  }
  // Defensive: if Census returns HTML for any other reason, surface
  // a typed error rather than crashing on JSON.parse.
  const text = await res.text();
  if (!text.trim().startsWith("[")) {
    return {
      ok: false,
      reason: "api_error",
      message: `Unexpected response (not JSON): ${text.slice(0, 120)}`,
    };
  }
  const json = JSON.parse(text) as Array<Array<string>>;
  if (!Array.isArray(json) || json.length < 2) {
    return { ok: false, reason: "no_results" };
  }
  const headers = json[0];
  const values = json[1];
  const get = (name: string): number | null => {
    const idx = headers.indexOf(name);
    if (idx < 0) return null;
    const raw = values[idx];
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // Census uses negative sentinel values for "no data" (-666666666 etc).
    if (n < 0) return null;
    return n;
  };

  return {
    ok: true,
    zip,
    population: get("B01003_001E"),
    medianHouseholdIncome: get("B19013_001E"),
    medianAge: get("B01002_001E"),
    year: ACS_YEAR,
  };
}

export function isCensusAvailable(): boolean {
  return !!process.env.CENSUS_API_KEY;
}
