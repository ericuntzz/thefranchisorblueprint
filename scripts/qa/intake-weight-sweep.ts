/**
 * Intake weight-sweep harness.
 *
 * Eric's ask 2026-05-10: "Once you're done building, I want you to
 * efficiently run 10-20 different tests that utilize different
 * weights around each of these calculations so that we can find the
 * best weighted outcome for our market."
 *
 * What this script does:
 *   - Defines a small set of representative SCENARIOS (each = a
 *     home-market profile + a top-5 candidate pool with realistic
 *     pillar scores, demographics, and lat/lng).
 *   - Defines a grid of WEIGHT_COMBOS — different settings of the
 *     geo-bias parameters (same-state, adjacent-state, drive-time,
 *     cost-parity).
 *   - For each (scenario × combo), applies computeFinalProximityBias
 *     deterministically and prints the resulting top-3 ranking.
 *   - Outputs a markdown report so Eric can eyeball which combo
 *     produces the most sensible home-region surfacing across cases.
 *
 * Why fixtures, not live API calls:
 *   - The full pipeline costs ~30¢ per URL and is non-deterministic
 *     (LLM extraction has temperature variance, Places nearby has
 *     real-time variance). Running 4 URLs × 12 combos = 48 calls =
 *     ~$15 with results that conflate API noise with weight effects.
 *   - The geo-bias formula is pure math against pillar sums + lat/
 *     lng + state codes + HHI numbers. We CAN extract realistic
 *     fixtures from production runs once and re-score 1000 ways for
 *     free.
 *   - The numbers below are taken from actual costavida.com output
 *     plus reasonable extrapolations for the other scenarios. If
 *     they drift from prod over time, just re-fixture from a fresh
 *     run.
 *
 * Run with:
 *   npx tsx scripts/qa/intake-weight-sweep.ts
 */

import {
  computeFinalProximityBias,
  DEFAULT_GEO_WEIGHTS,
  type GeoBiasWeights,
} from "../../src/lib/intake/geo-bias";

// Coarse 4-region grouping — duplicated here to avoid importing the
// orchestrator (which would pull server-only modules). Keep in sync
// with src/lib/intake/orchestrator.ts REGION_BY_STATE.
const REGION_BY_STATE: Record<string, string> = {
  AK: "West", AZ: "West", CA: "West", CO: "West", HI: "West",
  ID: "West", MT: "West", NV: "West", NM: "West", OR: "West",
  UT: "West", WA: "West", WY: "West",
  IL: "Midwest", IN: "Midwest", IA: "Midwest", KS: "Midwest",
  MI: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest",
  ND: "Midwest", OH: "Midwest", SD: "Midwest", WI: "Midwest",
  AL: "South", AR: "South", FL: "South", GA: "South", KY: "South",
  LA: "South", MS: "South", NC: "South", OK: "South", SC: "South",
  TN: "South", TX: "South", VA: "South", WV: "South",
  CT: "Northeast", DC: "Northeast", DE: "Northeast", MA: "Northeast",
  MD: "Northeast", ME: "Northeast", NH: "Northeast", NJ: "Northeast",
  NY: "Northeast", PA: "Northeast", RI: "Northeast", VT: "Northeast",
};

function regionForState(state: string | null | undefined): string | null {
  if (!state) return null;
  return REGION_BY_STATE[state.toUpperCase()] ?? null;
}

// ─── Test scenarios ──────────────────────────────────────────────────
//
// Each scenario represents a home market and a slate of candidate
// markets with their pre-bias pillar scores. Numbers are realistic:
// HHI from Census ACS, pillar sums in line with what production
// emits today.

type Candidate = {
  label: string;
  state: string;
  lat: number;
  lng: number;
  /** Census ACS median household income ($). */
  medianHHI: number;
  /** Sum of the four 0-25 pillars BEFORE geo-bias is applied. */
  pillarSum: number;
};

type Scenario = {
  name: string;
  description: string;
  sourceState: string;
  sourceLat: number;
  sourceLng: number;
  sourceMedianHHI: number;
  candidates: Candidate[];
  /** Eric's intuition for the right top 3 (used to score combos). */
  expectedTopStatesAnyOrder: string[];
};

const SCENARIOS: Scenario[] = [
  {
    name: "Costa Vida (UT, mature franchise)",
    description:
      "94 locations across UT/CO/NV/AZ. SLC and Phoenix get filtered " +
      "out by existing-footprint exclusion (tranche 4). Remaining " +
      "candidates are far-flung. Eric's intuition: surface adjacent " +
      "states or short drive (Boise, Albuquerque) over LA/Denver.",
    sourceState: "UT",
    sourceLat: 40.76,
    sourceLng: -111.89,
    sourceMedianHHI: 87000,
    candidates: [
      // Drop SLC, Phoenix, Denver, Vegas (existing-footprint excludes).
      // Remaining realistic top-5 after the filter:
      { label: "Boise — Downtown",        state: "ID", lat: 43.62, lng: -116.21, medianHHI: 81000,  pillarSum: 72 },
      { label: "Albuquerque — NW",        state: "NM", lat: 35.13, lng: -106.65, medianHHI: 64000,  pillarSum: 65 },
      { label: "Los Angeles — West LA",   state: "CA", lat: 34.05, lng: -118.43, medianHHI: 124000, pillarSum: 77 },
      { label: "Portland — Pearl",        state: "OR", lat: 45.52, lng: -122.68, medianHHI: 85000,  pillarSum: 70 },
      { label: "Austin — South Congress", state: "TX", lat: 30.27, lng:  -97.74, medianHHI: 91000,  pillarSum: 76 },
    ],
    expectedTopStatesAnyOrder: ["ID", "OR", "NM"],
  },
  {
    name: "High Point Coffee (AL, single location)",
    description:
      "Single coffee shop in Daphne, AL (Baldwin County). Eric's " +
      "intuition: South-region picks (TN, GA, MS, FL) should beat " +
      "Northeast or West Coast on proximity bias.",
    sourceState: "AL",
    sourceLat: 30.62,
    sourceLng: -87.90,
    sourceMedianHHI: 74000,
    candidates: [
      { label: "Atlanta — Midtown",     state: "GA", lat: 33.78, lng:  -84.39, medianHHI: 110000, pillarSum: 79 },
      { label: "Charlotte — South End", state: "NC", lat: 35.21, lng:  -80.85, medianHHI: 100000, pillarSum: 79 },
      { label: "Dallas — Downtown",     state: "TX", lat: 32.78, lng:  -96.80, medianHHI: 103000, pillarSum: 79 },
      { label: "Nashville — The Gulch", state: "TN", lat: 36.15, lng:  -86.78, medianHHI:  88000, pillarSum: 75 },
      { label: "Denver — LoDo",         state: "CO", lat: 39.74, lng: -105.00, medianHHI: 104000, pillarSum: 79 },
    ],
    expectedTopStatesAnyOrder: ["GA", "TN", "NC"],
  },
  {
    name: "NYC concept (single location, Manhattan)",
    description:
      "Coastal Northeast operator. Eric's intuition: Northeast/Mid-" +
      "Atlantic picks first (NJ, MA, PA), then drive-time chains. " +
      "Tests that high-HHI coastal stays competitive without " +
      "massive penalty for cost-parity-mismatch with itself.",
    sourceState: "NY",
    sourceLat: 40.75,
    sourceLng: -73.99,
    sourceMedianHHI: 95000,
    candidates: [
      { label: "Boston — Back Bay",      state: "MA", lat: 42.35, lng: -71.07, medianHHI: 105000, pillarSum: 78 },
      { label: "Philadelphia — Center",  state: "PA", lat: 39.95, lng: -75.16, medianHHI:  78000, pillarSum: 73 },
      { label: "Hoboken — NJ Transit",   state: "NJ", lat: 40.74, lng: -74.03, medianHHI: 112000, pillarSum: 80 },
      { label: "Chicago — West Loop",    state: "IL", lat: 41.88, lng: -87.65, medianHHI:  95000, pillarSum: 76 },
      { label: "Miami — Brickell",       state: "FL", lat: 25.76, lng: -80.19, medianHHI:  85000, pillarSum: 75 },
    ],
    expectedTopStatesAnyOrder: ["NJ", "MA", "PA"],
  },
  {
    name: "Texas BBQ concept (Austin)",
    description:
      "TX home, regional concept. Adjacent-state fires for AR/LA/" +
      "NM/OK. Same-state for TX. Tests how aggressively the bias " +
      "pulls Texas-adjacent ahead of higher-pillar coastal picks.",
    sourceState: "TX",
    sourceLat: 30.27,
    sourceLng: -97.74,
    sourceMedianHHI: 91000,
    candidates: [
      { label: "Houston — Heights",     state: "TX", lat: 29.79, lng: -95.40, medianHHI:  68000, pillarSum: 68 },
      { label: "OKC — Bricktown",       state: "OK", lat: 35.47, lng: -97.51, medianHHI:  62000, pillarSum: 64 },
      { label: "New Orleans — Garden",  state: "LA", lat: 29.93, lng: -90.10, medianHHI:  58000, pillarSum: 62 },
      { label: "San Diego — Mission",   state: "CA", lat: 32.78, lng: -117.18, medianHHI: 96000, pillarSum: 78 },
      { label: "Atlanta — Midtown",     state: "GA", lat: 33.78, lng:  -84.39, medianHHI: 110000, pillarSum: 79 },
    ],
    expectedTopStatesAnyOrder: ["TX", "OK", "LA"],
  },
];

// ─── Weight combinations to sweep ────────────────────────────────────

type Combo = {
  name: string;
  weights: GeoBiasWeights;
  notes: string;
};

const COMBOS: Combo[] = [
  {
    name: "01-no-bias",
    weights: {
      sameStateBonus: 0,
      adjacentStateBonus: 0,
      sameRegionBonus: 0,
      within250MiBonus: 0,
      within500MiBonus: 0,
      costParityHighPenalty: 0,
      costParityLowPenalty: 0,
    },
    notes: "Pure 4-pillar score. Baseline — what production looked like before tranche 3.",
  },
  {
    name: "02-default",
    weights: DEFAULT_GEO_WEIGHTS,
    notes: "Current production weights as of tranche 3.",
  },
  {
    name: "03-light-home",
    weights: {
      sameStateBonus: 6,
      adjacentStateBonus: 3,
      sameRegionBonus: 1,
      within250MiBonus: 4,
      within500MiBonus: 2,
      costParityHighPenalty: -2,
      costParityLowPenalty: -2,
    },
    notes: "Half the default bias. Tests whether a lighter touch still surfaces home-region.",
  },
  {
    name: "04-aggressive-home",
    weights: {
      sameStateBonus: 20,
      adjacentStateBonus: 10,
      sameRegionBonus: 4,
      within250MiBonus: 14,
      within500MiBonus: 7,
      costParityHighPenalty: -6,
      costParityLowPenalty: -4,
    },
    notes: "~1.7× the default. Tests whether home is over-weighted — does it overshadow real fit signals?",
  },
  {
    name: "05-state-only",
    weights: {
      sameStateBonus: 14,
      adjacentStateBonus: 8,
      sameRegionBonus: 3,
      within250MiBonus: 0,
      within500MiBonus: 0,
      costParityHighPenalty: 0,
      costParityLowPenalty: 0,
    },
    notes: "State and region only — no drive-time, no cost-parity. Simpler model.",
  },
  {
    name: "06-drive-time-only",
    weights: {
      sameStateBonus: 0,
      adjacentStateBonus: 0,
      sameRegionBonus: 0,
      within250MiBonus: 12,
      within500MiBonus: 6,
      costParityHighPenalty: 0,
      costParityLowPenalty: 0,
    },
    notes: "Drive-time-only. Tests whether geographic distance is the simpler/better proxy for proximity than state codes.",
  },
  {
    name: "07-no-cost-parity",
    weights: {
      ...DEFAULT_GEO_WEIGHTS,
      costParityHighPenalty: 0,
      costParityLowPenalty: 0,
    },
    notes: "Default minus cost-parity. Tests whether cost-parity adds signal or just noise.",
  },
  {
    name: "08-heavy-cost-parity",
    weights: {
      ...DEFAULT_GEO_WEIGHTS,
      costParityHighPenalty: -10,
      costParityLowPenalty: -8,
    },
    notes: "Default but cost-parity is now a hammer. Tests whether penalizing income mismatch hard improves fit.",
  },
  {
    name: "09-state-heavy-time-light",
    weights: {
      sameStateBonus: 18,
      adjacentStateBonus: 9,
      sameRegionBonus: 3,
      within250MiBonus: 4,
      within500MiBonus: 2,
      costParityHighPenalty: -4,
      costParityLowPenalty: -3,
    },
    notes: "State weighted heavier than drive-time. For franchisor support radius, state lines often matter more than miles (regulatory + brand recognition).",
  },
  {
    name: "10-time-heavy-state-light",
    weights: {
      sameStateBonus: 6,
      adjacentStateBonus: 3,
      sameRegionBonus: 1,
      within250MiBonus: 14,
      within500MiBonus: 7,
      costParityHighPenalty: -4,
      costParityLowPenalty: -3,
    },
    notes: "Drive-time weighted heavier than state. Operationally accurate — actual cost of supporting a unit scales with distance, not arbitrary state lines.",
  },
  {
    name: "11-balanced-symmetric",
    weights: {
      sameStateBonus: 10,
      adjacentStateBonus: 5,
      sameRegionBonus: 2,
      within250MiBonus: 10,
      within500MiBonus: 5,
      costParityHighPenalty: -3,
      costParityLowPenalty: -3,
    },
    notes: "State and drive-time both at 10/5; cost-parity symmetric. Even-handed test combo.",
  },
  {
    name: "12-extreme-no-bias-restored",
    weights: {
      sameStateBonus: 25,
      adjacentStateBonus: 12,
      sameRegionBonus: 6,
      within250MiBonus: 16,
      within500MiBonus: 8,
      costParityHighPenalty: -8,
      costParityLowPenalty: -6,
    },
    notes: "Maximum aggressiveness. Tests the upper bound — does the algorithm break down (always picks home regardless of pillar score)?",
  },
];

// ─── Run the sweep ───────────────────────────────────────────────────

type RankedCandidate = Candidate & {
  bias: number;
  finalScore: number;
};

function runScenario(
  scenario: Scenario,
  weights: GeoBiasWeights,
): RankedCandidate[] {
  return scenario.candidates
    .map((c) => {
      const result = computeFinalProximityBias({
        sourceState: scenario.sourceState,
        sourceLat: scenario.sourceLat,
        sourceLng: scenario.sourceLng,
        sourceMedianHHI: scenario.sourceMedianHHI,
        candState: c.state,
        candLat: c.lat,
        candLng: c.lng,
        candMedianHHI: c.medianHHI,
        regionForState,
        weights,
      });
      const finalScore = Math.max(0, Math.min(100, c.pillarSum + result.delta));
      return { ...c, bias: result.delta, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function scoreOutcome(
  ranked: RankedCandidate[],
  expectedStates: string[],
): { matches: number; total: number } {
  const top3States = ranked.slice(0, 3).map((c) => c.state);
  let matches = 0;
  for (const s of expectedStates.slice(0, 3)) {
    if (top3States.includes(s)) matches += 1;
  }
  return { matches, total: Math.min(3, expectedStates.length) };
}

function main() {
  const lines: string[] = [];
  lines.push("# Intake weight-sweep results");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Scenarios: ${SCENARIOS.length}, weight combos: ${COMBOS.length}, total runs: ${SCENARIOS.length * COMBOS.length}.`);
  lines.push("");
  lines.push("Each row's `intuition match` column counts how many of Eric's expected top-3 states appear in this combo's top 3 (out of 3). Higher = closer to the expected ranking.");
  lines.push("");

  // Per-scenario tables
  for (const scenario of SCENARIOS) {
    lines.push(`## ${scenario.name}`);
    lines.push("");
    lines.push(`> ${scenario.description}`);
    lines.push("");
    lines.push(
      `Source: ${scenario.sourceState} · home HHI $${scenario.sourceMedianHHI.toLocaleString()} · expected top-3 states: ${scenario.expectedTopStatesAnyOrder.join(", ")}`,
    );
    lines.push("");
    lines.push("| combo | intuition match | top 3 (state, finalScore, bias) |");
    lines.push("|---|---|---|");
    for (const combo of COMBOS) {
      const ranked = runScenario(scenario, combo.weights);
      const top3 = ranked.slice(0, 3);
      const score = scoreOutcome(ranked, scenario.expectedTopStatesAnyOrder);
      const cells = top3
        .map(
          (c) =>
            `${c.state} ${c.label.split(" — ")[0]} (${c.finalScore.toFixed(0)}, ${c.bias >= 0 ? "+" : ""}${c.bias.toFixed(0)})`,
        )
        .join(" · ");
      lines.push(`| ${combo.name} | ${score.matches}/${score.total} | ${cells} |`);
    }
    lines.push("");
  }

  // Aggregate scoring across scenarios
  lines.push("## Aggregate score across all scenarios");
  lines.push("");
  lines.push("| combo | total intuition match | notes |");
  lines.push("|---|---|---|");
  const aggregateRows = COMBOS.map((combo) => {
    let totalMatches = 0;
    let totalPossible = 0;
    for (const scenario of SCENARIOS) {
      const ranked = runScenario(scenario, combo.weights);
      const score = scoreOutcome(ranked, scenario.expectedTopStatesAnyOrder);
      totalMatches += score.matches;
      totalPossible += score.total;
    }
    return { combo, totalMatches, totalPossible };
  });
  // Sort descending by intuition match.
  aggregateRows.sort((a, b) => b.totalMatches - a.totalMatches);
  for (const row of aggregateRows) {
    lines.push(`| ${row.combo.name} | ${row.totalMatches}/${row.totalPossible} | ${row.combo.notes} |`);
  }
  lines.push("");

  // Top combos detailed
  lines.push("## Top 3 combos detailed");
  lines.push("");
  for (const row of aggregateRows.slice(0, 3)) {
    const w = row.combo.weights;
    lines.push(`### ${row.combo.name} (${row.totalMatches}/${row.totalPossible} match)`);
    lines.push("");
    lines.push(`> ${row.combo.notes}`);
    lines.push("");
    lines.push("| weight | value |");
    lines.push("|---|---|");
    lines.push(`| sameStateBonus | +${w.sameStateBonus} |`);
    lines.push(`| adjacentStateBonus | +${w.adjacentStateBonus} |`);
    lines.push(`| sameRegionBonus | +${w.sameRegionBonus} |`);
    lines.push(`| within250MiBonus | +${w.within250MiBonus} |`);
    lines.push(`| within500MiBonus | +${w.within500MiBonus} |`);
    lines.push(`| costParityHighPenalty | ${w.costParityHighPenalty} |`);
    lines.push(`| costParityLowPenalty | ${w.costParityLowPenalty} |`);
    lines.push("");
  }

  const output = lines.join("\n");
  console.log(output);
}

main();
