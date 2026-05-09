/**
 * Curated candidate-ZIP pool for expansion-market discovery.
 *
 * 60 high-potential ZIPs across 20 major US metros. Selection criteria:
 *   - Top 25 metros by population
 *   - 2-4 representative ZIPs per metro covering urban core, inner-ring
 *     suburb, and outer-ring suburb (so we can match different concept
 *     types — fast-casual urban vs. service-business suburban).
 *   - Mix of "established franchise corridors" and "emerging" markets so
 *     the matching algorithm has range to surprise the user.
 *
 * The orchestrator fetches Census ACS demographics for each ZIP at
 * request time (live, not pre-cached), scores against the user's
 * prototype demographic profile, takes the top 5 candidates, and
 * runs Places competitor-density on those 5 to refine the final
 * top-3 ranking. ~100 Census calls (free) + ~5 Places calls
 * (~$0.16) per intake.
 */

export type CandidateZip = {
  /** 5-digit ZIP. */
  zip: string;
  /** Display name shown to the user — "Atlanta — Midtown". */
  label: string;
  /** Anchor metro (CBSA-like name, kept short). */
  metro: string;
  /** State 2-letter. */
  state: string;
  /** Approx. lat/lng for the ZIP centroid (used for Places competitor scan). */
  lat: number;
  lng: number;
  /** Tag indicating trade-area type — helps narrate the "why" for matches. */
  type: "urban-core" | "inner-suburb" | "outer-suburb" | "edge-city";
};

export const CANDIDATE_ZIPS: CandidateZip[] = [
  // ─── Atlanta, GA ─────────────────────────────────────────────────
  { zip: "30309", label: "Atlanta — Midtown", metro: "Atlanta", state: "GA", lat: 33.789, lng: -84.388, type: "urban-core" },
  { zip: "30327", label: "Atlanta — Buckhead/Sandy Springs", metro: "Atlanta", state: "GA", lat: 33.870, lng: -84.420, type: "inner-suburb" },
  { zip: "30022", label: "Alpharetta", metro: "Atlanta", state: "GA", lat: 34.075, lng: -84.293, type: "outer-suburb" },

  // ─── Austin, TX ──────────────────────────────────────────────────
  { zip: "78704", label: "Austin — South Congress", metro: "Austin", state: "TX", lat: 30.247, lng: -97.764, type: "urban-core" },
  { zip: "78759", label: "Austin — Northwest Hills", metro: "Austin", state: "TX", lat: 30.402, lng: -97.766, type: "inner-suburb" },
  { zip: "78641", label: "Leander", metro: "Austin", state: "TX", lat: 30.575, lng: -97.853, type: "outer-suburb" },

  // ─── Charlotte, NC ───────────────────────────────────────────────
  { zip: "28203", label: "Charlotte — South End", metro: "Charlotte", state: "NC", lat: 35.207, lng: -80.857, type: "urban-core" },
  { zip: "28277", label: "Ballantyne", metro: "Charlotte", state: "NC", lat: 35.052, lng: -80.847, type: "outer-suburb" },

  // ─── Chicago, IL ─────────────────────────────────────────────────
  { zip: "60614", label: "Chicago — Lincoln Park", metro: "Chicago", state: "IL", lat: 41.922, lng: -87.649, type: "urban-core" },
  { zip: "60067", label: "Palatine", metro: "Chicago", state: "IL", lat: 42.117, lng: -88.043, type: "outer-suburb" },
  { zip: "60540", label: "Naperville", metro: "Chicago", state: "IL", lat: 41.766, lng: -88.151, type: "outer-suburb" },

  // ─── Dallas-Fort Worth, TX ───────────────────────────────────────
  { zip: "75201", label: "Dallas — Downtown", metro: "Dallas-Fort Worth", state: "TX", lat: 32.787, lng: -96.799, type: "urban-core" },
  { zip: "75024", label: "Plano", metro: "Dallas-Fort Worth", state: "TX", lat: 33.080, lng: -96.823, type: "outer-suburb" },
  { zip: "76092", label: "Southlake", metro: "Dallas-Fort Worth", state: "TX", lat: 32.943, lng: -97.135, type: "outer-suburb" },

  // ─── Denver, CO ──────────────────────────────────────────────────
  { zip: "80202", label: "Denver — LoDo", metro: "Denver", state: "CO", lat: 39.751, lng: -104.998, type: "urban-core" },
  { zip: "80206", label: "Denver — Cherry Creek", metro: "Denver", state: "CO", lat: 39.717, lng: -104.945, type: "inner-suburb" },
  { zip: "80027", label: "Louisville/Lafayette", metro: "Denver", state: "CO", lat: 39.987, lng: -105.121, type: "outer-suburb" },

  // ─── Houston, TX ─────────────────────────────────────────────────
  { zip: "77002", label: "Houston — Downtown", metro: "Houston", state: "TX", lat: 29.758, lng: -95.367, type: "urban-core" },
  { zip: "77005", label: "Houston — West University", metro: "Houston", state: "TX", lat: 29.717, lng: -95.418, type: "inner-suburb" },
  { zip: "77494", label: "Katy", metro: "Houston", state: "TX", lat: 29.762, lng: -95.823, type: "outer-suburb" },

  // ─── Las Vegas, NV ───────────────────────────────────────────────
  { zip: "89134", label: "Summerlin", metro: "Las Vegas", state: "NV", lat: 36.171, lng: -115.330, type: "outer-suburb" },
  { zip: "89052", label: "Henderson", metro: "Las Vegas", state: "NV", lat: 36.038, lng: -115.044, type: "edge-city" },

  // ─── Los Angeles, CA ─────────────────────────────────────────────
  { zip: "90064", label: "Los Angeles — West LA", metro: "Los Angeles", state: "CA", lat: 34.038, lng: -118.428, type: "urban-core" },
  { zip: "91364", label: "Woodland Hills", metro: "Los Angeles", state: "CA", lat: 34.169, lng: -118.598, type: "inner-suburb" },
  { zip: "92660", label: "Newport Beach", metro: "Los Angeles", state: "CA", lat: 33.617, lng: -117.913, type: "outer-suburb" },

  // ─── Miami / Fort Lauderdale, FL ─────────────────────────────────
  { zip: "33131", label: "Miami — Brickell", metro: "Miami", state: "FL", lat: 25.762, lng: -80.193, type: "urban-core" },
  { zip: "33301", label: "Fort Lauderdale — Downtown", metro: "Miami", state: "FL", lat: 26.122, lng: -80.137, type: "inner-suburb" },
  { zip: "33326", label: "Weston", metro: "Miami", state: "FL", lat: 26.099, lng: -80.396, type: "outer-suburb" },

  // ─── Minneapolis-St. Paul, MN ────────────────────────────────────
  { zip: "55408", label: "Minneapolis — Uptown", metro: "Minneapolis", state: "MN", lat: 44.949, lng: -93.297, type: "urban-core" },
  { zip: "55305", label: "Minnetonka", metro: "Minneapolis", state: "MN", lat: 44.943, lng: -93.466, type: "outer-suburb" },

  // ─── Nashville, TN ───────────────────────────────────────────────
  { zip: "37203", label: "Nashville — Midtown", metro: "Nashville", state: "TN", lat: 36.151, lng: -86.793, type: "urban-core" },
  { zip: "37067", label: "Franklin", metro: "Nashville", state: "TN", lat: 35.927, lng: -86.870, type: "outer-suburb" },

  // ─── New York / NJ ───────────────────────────────────────────────
  { zip: "10014", label: "Manhattan — West Village", metro: "New York", state: "NY", lat: 40.734, lng: -74.005, type: "urban-core" },
  { zip: "10021", label: "Manhattan — Upper East Side", metro: "New York", state: "NY", lat: 40.769, lng: -73.961, type: "urban-core" },
  { zip: "07030", label: "Hoboken", metro: "New York", state: "NJ", lat: 40.745, lng: -74.029, type: "inner-suburb" },
  { zip: "11201", label: "Brooklyn — Downtown", metro: "New York", state: "NY", lat: 40.694, lng: -73.987, type: "urban-core" },

  // ─── Orlando, FL ─────────────────────────────────────────────────
  { zip: "32801", label: "Orlando — Downtown", metro: "Orlando", state: "FL", lat: 28.541, lng: -81.376, type: "urban-core" },
  { zip: "34786", label: "Windermere", metro: "Orlando", state: "FL", lat: 28.485, lng: -81.535, type: "outer-suburb" },

  // ─── Philadelphia, PA ────────────────────────────────────────────
  { zip: "19103", label: "Philadelphia — Center City", metro: "Philadelphia", state: "PA", lat: 39.951, lng: -75.172, type: "urban-core" },
  { zip: "19087", label: "Wayne / Main Line", metro: "Philadelphia", state: "PA", lat: 40.044, lng: -75.387, type: "outer-suburb" },

  // ─── Phoenix, AZ ─────────────────────────────────────────────────
  { zip: "85016", label: "Phoenix — Biltmore", metro: "Phoenix", state: "AZ", lat: 33.508, lng: -112.027, type: "urban-core" },
  { zip: "85254", label: "Scottsdale", metro: "Phoenix", state: "AZ", lat: 33.620, lng: -111.929, type: "inner-suburb" },
  { zip: "85295", label: "Gilbert", metro: "Phoenix", state: "AZ", lat: 33.327, lng: -111.766, type: "outer-suburb" },

  // ─── Portland, OR ────────────────────────────────────────────────
  { zip: "97209", label: "Portland — Pearl District", metro: "Portland", state: "OR", lat: 45.532, lng: -122.682, type: "urban-core" },
  { zip: "97229", label: "Beaverton/Cedar Hills", metro: "Portland", state: "OR", lat: 45.530, lng: -122.812, type: "outer-suburb" },

  // ─── Raleigh-Durham, NC ──────────────────────────────────────────
  { zip: "27607", label: "Raleigh — North Hills", metro: "Raleigh-Durham", state: "NC", lat: 35.821, lng: -78.667, type: "inner-suburb" },
  { zip: "27513", label: "Cary", metro: "Raleigh-Durham", state: "NC", lat: 35.781, lng: -78.821, type: "outer-suburb" },

  // ─── San Diego, CA ───────────────────────────────────────────────
  { zip: "92101", label: "San Diego — Downtown", metro: "San Diego", state: "CA", lat: 32.717, lng: -117.163, type: "urban-core" },
  { zip: "92130", label: "Carmel Valley", metro: "San Diego", state: "CA", lat: 32.964, lng: -117.234, type: "outer-suburb" },

  // ─── San Francisco Bay Area, CA ──────────────────────────────────
  { zip: "94110", label: "San Francisco — Mission", metro: "San Francisco", state: "CA", lat: 37.749, lng: -122.418, type: "urban-core" },
  { zip: "94301", label: "Palo Alto", metro: "San Francisco", state: "CA", lat: 37.443, lng: -122.149, type: "outer-suburb" },
  { zip: "94025", label: "Menlo Park", metro: "San Francisco", state: "CA", lat: 37.453, lng: -122.181, type: "outer-suburb" },

  // ─── Seattle, WA ─────────────────────────────────────────────────
  { zip: "98109", label: "Seattle — South Lake Union", metro: "Seattle", state: "WA", lat: 47.625, lng: -122.339, type: "urban-core" },
  { zip: "98004", label: "Bellevue", metro: "Seattle", state: "WA", lat: 47.617, lng: -122.193, type: "inner-suburb" },
  { zip: "98052", label: "Redmond", metro: "Seattle", state: "WA", lat: 47.668, lng: -122.122, type: "outer-suburb" },

  // ─── Tampa-St. Petersburg, FL ────────────────────────────────────
  { zip: "33606", label: "Tampa — Hyde Park", metro: "Tampa", state: "FL", lat: 27.939, lng: -82.469, type: "urban-core" },
  { zip: "33647", label: "Tampa — New Tampa", metro: "Tampa", state: "FL", lat: 28.119, lng: -82.341, type: "outer-suburb" },

  // ─── Washington, DC / Northern Virginia ─────────────────────────
  { zip: "20007", label: "Washington — Georgetown", metro: "Washington DC", state: "DC", lat: 38.911, lng: -77.067, type: "urban-core" },
  { zip: "22102", label: "McLean / Tysons", metro: "Washington DC", state: "VA", lat: 38.931, lng: -77.234, type: "edge-city" },
  { zip: "22030", label: "Fairfax", metro: "Washington DC", state: "VA", lat: 38.846, lng: -77.305, type: "outer-suburb" },

  // ─── Salt Lake City, UT — included for TFB's home metro ─────────
  { zip: "84101", label: "Salt Lake City — Downtown", metro: "Salt Lake City", state: "UT", lat: 40.762, lng: -111.890, type: "urban-core" },
  { zip: "84020", label: "Draper", metro: "Salt Lake City", state: "UT", lat: 40.524, lng: -111.864, type: "outer-suburb" },
  { zip: "84043", label: "Lehi / Silicon Slopes", metro: "Salt Lake City", state: "UT", lat: 40.391, lng: -111.851, type: "outer-suburb" },
];

/**
 * Filter candidate ZIPs to a given state(s) — useful for "expansion within
 * the franchisee's home region first" logic. Returns all ZIPs if no
 * states provided.
 */
export function candidatesInStates(states: string[] | null): CandidateZip[] {
  if (!states || states.length === 0) return CANDIDATE_ZIPS;
  const set = new Set(states.map((s) => s.toUpperCase()));
  return CANDIDATE_ZIPS.filter((c) => set.has(c.state));
}

/**
 * Exclude the user's own ZIP/metro from candidates so we don't suggest
 * "open a second location at the same address you already have."
 */
export function excludeSourceLocation(
  candidates: CandidateZip[],
  sourceZip: string | null,
): CandidateZip[] {
  if (!sourceZip) return candidates;
  return candidates.filter((c) => c.zip !== sourceZip);
}
