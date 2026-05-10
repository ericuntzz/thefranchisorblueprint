// NOTE: this file used to import "server-only" but was unrestricted
// 2026-05-10 so the parameter-sweep harness in scripts/qa/ can call
// computeFinalProximityBias from a Node script. The helpers are pure
// math (no fetch / no env / no DB) so there's no actual server-only
// requirement. Don't add server-side calls here without restoring
// the import — keep the boundary clean.

/**
 * Geographic-bias helpers used by the expansion-market scorer.
 *
 * Eric flagged 2026-05-10: a Utah-based business getting Denver/LA/
 * Summerlin as its top 3 expansion markets is technically correct
 * (high 4-pillar scores) but operationally weird — most operators
 * expand contiguously because supply chain, regional managers, and
 * their own car all run on geography. This module bakes that
 * intuition into the scoring math.
 *
 * Two kinds of bias get applied at different stages of the pipeline:
 *
 *  1. **Selection bias** (orchestrator step 2 — top-5 candidate cut).
 *     Same-state and same-region candidates get a similarity tailwind
 *     so they're more likely to land in the top-5 candidate pool.
 *     This is what already existed before tranche 3.
 *
 *  2. **Final-ranking bias** (added in tranche 3).
 *     After the 4-pillar / 100-point score is computed, we apply a
 *     bonus or penalty based on (a) state proximity, (b) drive-time
 *     to the home market, and (c) cost-base parity. Surfaces the
 *     home region in the visible top-3 even when 4-pillar scores
 *     would otherwise rank a far-flung high-income metro first.
 */

// ─── Adjacent-state map ──────────────────────────────────────────────
// Sourced from the standard US Census state-adjacency dataset. Used
// for the "adjacent-state +6" bonus — operators expanding from UT
// reach for ID/CO/AZ/NV/NM/WY before California or Texas because
// supply chain + management drive radius matters more than
// "Western US in general."
//
// DC included as adjacent to MD/VA. AK and HI have no adjacent states
// (commented as empty arrays so the lookup returns false-ish cleanly).

export const ADJACENT_STATES: Record<string, string[]> = {
  AL: ["FL", "GA", "MS", "TN"],
  AK: [],
  AZ: ["CA", "CO", "NM", "NV", "UT"],
  AR: ["LA", "MO", "MS", "OK", "TN", "TX"],
  CA: ["AZ", "NV", "OR"],
  CO: ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"],
  DC: ["MD", "VA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: [],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IA", "IN", "KY", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  ME: ["NH"],
  MD: ["DC", "DE", "PA", "VA", "WV"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IA", "IL", "KS", "KY", "NE", "OK", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["MA", "ME", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NM", "NV", "WY"],
  VT: ["MA", "NH", "NY"],
  VA: ["DC", "KY", "MD", "NC", "TN", "WV"],
  WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WI: ["IA", "IL", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
};

export function isAdjacentState(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const aU = a.toUpperCase();
  if (aU === b.toUpperCase()) return false;
  return (ADJACENT_STATES[aU] ?? []).includes(b.toUpperCase());
}

// ─── Drive-time approximation via Haversine ──────────────────────────
// We have lat/lng for both source and candidate, so a Haversine great-
// circle distance gives a reasonable proxy for drive time without
// pinging a routing API. Real driving distance is typically 1.2-1.4×
// great-circle in the contiguous US — close enough for a tier bonus.

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 0.621371;
}

// ─── Bias weights (defaults; tunable in tranche 7's parameter sweep) ─

/**
 * Default weights for the final-ranking proximity bias. Tranche 7's
 * parameter-sweep harness will exercise alternate values across a
 * small labeled test set to find the combination that best matches
 * Eric's intuition for the canonical inputs (Utah operator → home
 * region first; coastal operator → coastal expansion first; existing
 * franchisor → no proximity bonus needed since the funnel branches).
 *
 * Math: applied AFTER the 4-pillar 0-100 score is computed, then
 * clamped to [0, 100]. Total max bonus = 12 + 6 + 8 = 26 points;
 * total max penalty = 6 (cost-parity). In practice the same-state
 * branch dominates and other branches stack on top.
 */
export type GeoBiasWeights = {
  /** Same-state final bonus (default +12). */
  sameStateBonus: number;
  /** Adjacent-state final bonus (default +6). Mutually exclusive with sameState. */
  adjacentStateBonus: number;
  /** Same-region (coarse 4-region map) bonus, only when not adjacent (default +2). */
  sameRegionBonus: number;
  /** Within 250 driving-miles approx (default +8). */
  within250MiBonus: number;
  /** Within 500 driving-miles approx (default +4). Mutually exclusive with within250. */
  within500MiBonus: number;
  /** Cost-parity penalty when candidate HHI ≥ 1.4× source HHI (default -4). */
  costParityHighPenalty: number;
  /** Cost-parity penalty when candidate HHI ≤ 0.7× source HHI (default -3). */
  costParityLowPenalty: number;
};

export const DEFAULT_GEO_WEIGHTS: GeoBiasWeights = {
  sameStateBonus: 12,
  adjacentStateBonus: 6,
  sameRegionBonus: 2,
  within250MiBonus: 8,
  within500MiBonus: 4,
  costParityHighPenalty: -4,
  costParityLowPenalty: -3,
};

// ─── Final-ranking bias computation ──────────────────────────────────

export type FinalProximityInput = {
  sourceState: string | null;
  sourceLat: number | null;
  sourceLng: number | null;
  /** Median household income at the source ZIP from Census ACS. */
  sourceMedianHHI: number | null;
  candState: string;
  candLat: number;
  candLng: number;
  candMedianHHI: number | null;
  /**
   * Coarse-region resolver — passed in to avoid coupling this module
   * to the orchestrator's REGION_BY_STATE table directly. Returns the
   * 4-region bucket ("West"/"Midwest"/"South"/"Northeast") or null.
   */
  regionForState: (state: string | null | undefined) => string | null;
  weights?: GeoBiasWeights;
};

/**
 * Compute the proximity bias to apply to a candidate's final 0-100
 * score. Returns a SIGNED delta — positive for proximity boosts,
 * negative for cost-parity mismatches. Caller adds this to the
 * pillar-summed score and clamps to [0, 100].
 *
 * Same-state, adjacent-state, and same-region are mutually exclusive
 * (highest one wins). Drive-time bonuses are independent and stack.
 * Cost-parity penalty is independent and stacks negatively.
 */
export function computeFinalProximityBias(args: FinalProximityInput): {
  delta: number;
  /** Breakdown for debug / parameter-sweep telemetry. */
  components: {
    stateOrRegion: number;
    driveTime: number;
    costParity: number;
  };
} {
  const w = args.weights ?? DEFAULT_GEO_WEIGHTS;
  let stateOrRegion = 0;
  let driveTime = 0;
  let costParity = 0;

  const src = args.sourceState ? args.sourceState.toUpperCase() : null;
  const cand = args.candState.toUpperCase();

  // State/region tier — pick the strongest applicable, no stacking.
  if (src && cand === src) {
    stateOrRegion = w.sameStateBonus;
  } else if (src && isAdjacentState(src, cand)) {
    stateOrRegion = w.adjacentStateBonus;
  } else {
    const srcRegion = args.regionForState(src);
    const candRegion = args.regionForState(cand);
    if (srcRegion && candRegion && srcRegion === candRegion) {
      stateOrRegion = w.sameRegionBonus;
    }
  }

  // Drive-time tier — best one wins, no stacking.
  if (args.sourceLat != null && args.sourceLng != null) {
    const mi = haversineMiles(
      args.sourceLat,
      args.sourceLng,
      args.candLat,
      args.candLng,
    );
    if (mi < 250) driveTime = w.within250MiBonus;
    else if (mi < 500) driveTime = w.within500MiBonus;
  }

  // Cost-base parity — a $74K-median operator getting a $130K-median
  // candidate market means franchisee unit economics break (rent and
  // labor scale faster than ticket size). Same applies in reverse:
  // pushing a high-end concept into a low-income market drops AUV.
  // Penalty stays small because the demographics pillar already
  // partially encodes income; this is a tiebreaker, not a hammer.
  if (args.sourceMedianHHI != null && args.candMedianHHI != null) {
    const ratio = args.candMedianHHI / args.sourceMedianHHI;
    if (ratio >= 1.4) costParity = w.costParityHighPenalty;
    else if (ratio <= 0.7) costParity = w.costParityLowPenalty;
  }

  return {
    delta: stateOrRegion + driveTime + costParity,
    components: { stateOrRegion, driveTime, costParity },
  };
}
