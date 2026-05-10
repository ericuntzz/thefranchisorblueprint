/**
 * Intake-prefill orchestrator.
 *
 * Given a URL, runs the full enrichment pipeline that powers the
 * home-page lead magnet:
 *
 *   1. Scrape the website (existing fetchSiteArtifacts)
 *   2. Extract business name + address from scrape via LLM
 *   3. Geocode current location via Places → resolve current ZIP
 *   4. Census ACS demographics for current ZIP (= home-market profile)
 *   5. Places nearby-search for competitor density at current location
 *   6. Match against the 60-ZIP candidate pool: fetch Census for each,
 *      score similarity to home market, take top 5
 *   7. Refine top 5 with live Places competitor-density check, take top 3
 *   8. Compute readiness score from operational signals + named gaps
 *   9. Synthesize a one-paragraph home-market summary via LLM
 *
 * Yields IntakeEvent values throughout so the API route can stream
 * them as Server-Sent Events. Persistence to the intake_sessions row
 * happens incrementally — each phase writes its output as it lands.
 */

import "server-only";
import { fetchSiteArtifacts, type ScrapeArtifacts } from "@/lib/agent/scrape";
import {
  geocodeAddress,
  nearbyPlaces,
  isPlacesAvailable,
} from "@/lib/agent/research/places";
import {
  zipDemographics,
  isCensusAvailable,
} from "@/lib/agent/research/census";
import { CACHE_5M, CHAT_MODEL, getAnthropic } from "@/lib/agent/anthropic";
import {
  CANDIDATE_ZIPS,
  excludeSourceLocation,
  type CandidateZip,
} from "./candidate-zips";
import {
  detectFranchiseSignals,
  type ExistingFranchisorSignal,
} from "./franchise-detection";
import {
  computeFinalProximityBias,
  DEFAULT_GEO_WEIGHTS,
  type GeoBiasWeights,
} from "./geo-bias";

/**
 * Normalized success-shape demographics. The Census wrapper returns
 * fields as `number | null` (a 5-digit ZIP that doesn't tabulate
 * household income, for instance, will return null for that field).
 * The orchestrator filters those out so downstream code can treat
 * the values as numbers.
 */
type Demographics = {
  zip: string;
  population: number;
  medianHouseholdIncome: number;
  medianAge: number;
};

// ─── Types ─────────────────────────────────────────────────────────

export type IntakeEvent =
  | { kind: "progress"; phase: IntakePhase; message: string }
  | { kind: "phase-done"; phase: IntakePhase; data?: unknown }
  | { kind: "error"; phase: IntakePhase; message: string }
  | { kind: "complete"; snapshot: IntakeSnapshot };

export type IntakePhase =
  | "scrape"
  | "business"
  | "geocode"
  | "demographics"
  | "competitors"
  | "expansion"
  | "score"
  | "summary";

/** What the user sees on the snapshot screen. */
export type IntakeSnapshot = {
  business: BusinessInfo;
  /**
   * Profile of the customer's current/home location. Renamed from
   * `prototype` 2026-05-10 — Eric flagged that "prototype" reads as
   * lab-science jargon to a small business owner. The schema key now
   * mirrors the user-facing "Where your business operates today"
   * eyebrow. Backward-compat reader handles older cached rows
   * elsewhere (intake_sessions JSONB column may still hold rows
   * keyed `prototype`).
   */
  homeMarket: HomeMarketProfile;
  /**
   * Top expansion markets to show the visitor. Up to 4 entries.
   * Tranche 11 (2026-05-10) — restructured into a slotted layout:
   *
   *   expansion[0] : "BEST LOCAL OPPORTUNITY" — top-scoring market
   *                  in the same state as business.state. Null-slot
   *                  if business state is unknown OR no candidate
   *                  ZIPs are in that state — in which case
   *                  expansion[0] is just the #2 by score.
   *   expansion[1] : "BEST EXPANSION OPPORTUNITY" — top-scoring
   *                  market NOT in the home state. Always populated.
   *   expansion[2] : runner-up (national), shown blurred until
   *                  visitor saves email + creates an account.
   *   expansion[3] : second runner-up (local if available, else
   *                  national), shown blurred.
   *
   * Slot identity is carried by ExpansionMarket.slot. UI keys off
   * that field to show the right eyebrow ("local" vs "national") and
   * to decide which cards to blur.
   */
  expansion: ExpansionMarket[];
  /**
   * Retained for backward compat — still computed and returned but
   * the UI no longer toggles to it as a separate ranking. Slot
   * structure above renders both proximity and pure picks in one
   * view. Will likely be deprecated once the new slotted layout
   * stabilizes; keeping for one or two cache cycles in case we want
   * to revert.
   */
  expansionAnywhere: ExpansionMarket[];
  readiness: ReadinessScore;
  /**
   * Optional. Populated only when the franchise-detection LLM pass
   * found indicators that this URL belongs to a business already
   * operating as a franchisor. UI uses this to branch from
   * "are you ready to franchise?" framing into a portfolio-strategy
   * conversation (Eric flagged 2026-05-10 — Costa Vida scored 53/100
   * which is meaningless for a 94-location existing franchise).
   */
  existingFranchisor?: ExistingFranchisorSignal;
  /** Approximate cost in cents (used to enforce daily cap). */
  costCents: number;
};

export type BusinessInfo = {
  name: string | null;
  oneLineConcept: string | null;
  brandVoice: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /**
   * Short, Places-API-friendly business category (e.g. "Mexican
   * restaurant", "coffee shop", "fitness studio"). Drives the
   * competitor-density nearby search — the long concept narrative
   * was too specific and hit the 20-result page cap on every
   * market identically. The category gives a more meaningful
   * saturation signal.
   */
  placesCategory: string | null;
};

export type HomeMarketProfile = {
  zip: string | null;
  /** Plain-English narrative of "what makes their current spot work". */
  narrative: string;
  demographics: Demographics | null;
  competitorCount: number | null;
};

export type ExpansionMarket = {
  zip: string;
  label: string;
  metro: string;
  state: string;
  /** 0-100 overall fit score. */
  score: number;
  /** Per-pillar breakdown — matches the FDD Item 11 4-pillar structure. */
  pillars: {
    demographicsAndMarket: number;   // 0-25
    trafficAndAccess: number;        // 0-25 (proxied by trade-area type)
    competition: number;             // 0-25 (lower competitor density → higher score)
    financialAndLegal: number;       // 0-25 (proxied by HHI as a buying-power signal)
  };
  /**
   * Tranche 11 slot identity — which "kind" of recommendation this
   * card is. UI keys off this to render the eyebrow ("local" vs
   * "national") and choose blur state. "local" = same state as the
   * business; "national" = different state; null = pre-tranche-11
   * row that hasn't been re-classified yet (UI falls back to index).
   */
  slot?: "local-primary" | "national-primary" | "locked-runner-up" | null;
  /** One-sentence "why it matches" narrative. Plain English, no jargon. */
  why: string;
  /**
   * Three short bullets explaining why this market is worth considering
   * for THIS specific business. Generated by an LLM pass that sees the
   * candidate demographics, competitor count, and the customer's home
   * market context. Plain English (Eric's ask 2026-05-10) — no
   * franchise/finance jargon, written so a busy small business owner
   * can scan it in 5 seconds. Empty array on LLM failure.
   */
  bullets: string[];
  competitorCount: number;
};

export type ReadinessScore = {
  overall: number;                   // 0-100 preliminary
  /** Three named gaps that drag the score down most. */
  gaps: string[];
  /** Tier suggestion based on the score band. */
  suggestedTier: "blueprint" | "navigator" | "builder" | "not-yet";
};

// ─── Cost accounting (rough estimates per Stripe's API price sheets) ─

const COST = {
  PLACES_GEOCODE_CENTS: 1,
  PLACES_NEARBY_CENTS: 4,
  CENSUS_CENTS: 0,
  LLM_BUSINESS_EXTRACT_CENTS: 2,
  /** LLM pass that classifies whether the URL is an existing franchisor. */
  LLM_FRANCHISE_DETECT_CENTS: 2,
  /** LLM pass that emits 3 plain-English bullets per top market. */
  LLM_MARKET_BULLETS_CENTS: 3,
  LLM_SUMMARY_CENTS: 3,
} as const;

// ─── Public entry point ────────────────────────────────────────────

export async function* runIntake(args: {
  url: string;
}): AsyncGenerator<IntakeEvent, void, unknown> {
  let costCents = 0;

  // ─── Phase 1: Scrape ─────────────────────────────────────────────
  yield {
    kind: "progress",
    phase: "scrape",
    message: "Reading your website…",
  };

  let scrape: ScrapeArtifacts;
  try {
    scrape = await fetchSiteArtifacts(args.url);
  } catch (err) {
    yield {
      kind: "error",
      phase: "scrape",
      message:
        err instanceof Error
          ? `Couldn't reach that website: ${err.message}`
          : "Couldn't reach that website",
    };
    return;
  }

  yield { kind: "phase-done", phase: "scrape", data: { resolvedOrigin: scrape.resolvedOrigin } };

  // ─── Phase 2: Extract business info via LLM ──────────────────────
  yield {
    kind: "progress",
    phase: "business",
    message: "Identifying your business…",
  };

  // Two LLM passes run in parallel — extraction (name/concept/voice/
  // address/category) and existing-franchisor detection. Both read
  // the same scrape; we save wall-clock by parallelizing instead of
  // chaining. Costs accumulate either way.
  const [business, existingFranchisor] = await Promise.all([
    extractBusinessInfo(scrape),
    detectFranchiseSignals(scrape),
  ]);
  costCents += COST.LLM_BUSINESS_EXTRACT_CENTS;
  costCents += COST.LLM_FRANCHISE_DETECT_CENTS;

  // Fallback: if the LLM couldn't extract a business name (thin page,
  // JS-rendered SPA, etc.), derive one from the page title or domain
  // before downstream phases lean on it. Better to show "Costa Vida"
  // (from costavida.com) than the placeholder "Your Business" UX flagged.
  if (!business.name) {
    business.name = inferBusinessNameFallback(scrape, args.url);
  }

  yield { kind: "phase-done", phase: "business", data: business };

  // ─── Phase 3: Geocode current location ───────────────────────────
  yield {
    kind: "progress",
    phase: "geocode",
    message: "Mapping your trade area…",
  };

  let sourceLocation: {
    zip: string;
    lat: number;
    lng: number;
    formattedAddress: string;
  } | null = null;

  if (isPlacesAvailable() && (business.address || business.name)) {
    const query = business.address ?? `${business.name} ${business.city ?? ""} ${business.state ?? ""}`.trim();
    try {
      const geo = await geocodeAddress(query);
      costCents += COST.PLACES_GEOCODE_CENTS;
      if (geo.ok) {
        const zipMatch = geo.formattedAddress.match(/\b(\d{5})(?:-\d{4})?\b/);
        if (zipMatch) {
          sourceLocation = {
            zip: zipMatch[1],
            lat: geo.lat,
            lng: geo.lng,
            formattedAddress: geo.formattedAddress,
          };
        }
        // Backfill business.state from the geocoded address — independent
        // of zipMatch so even chain HQs without a specific street address
        // contribute a state for the proximity bonus. Lenient regex
        // catches the state in either "City, ST 12345" or "City, ST, USA"
        // shapes that Google returns for different precision levels.
        if (!business.state) {
          const stateMatch =
            geo.formattedAddress.match(/,\s*([A-Z]{2})\s+\d{5}\b/) ??
            geo.formattedAddress.match(/,\s*([A-Z]{2}),\s*USA\b/);
          if (stateMatch) business.state = stateMatch[1];
        }
      }
    } catch {
      // Geocoding failed — fall through.
    }
  }

  // Final-fallback state extraction: scan the scraped title + about-page
  // text for "City, UT" patterns when the LLM and geocode both missed it.
  // Costa Vida's About page literally says "Layton, Utah" — we should
  // catch that.
  if (!business.state) {
    const haystack = [scrape.title ?? "", scrape.metaDescription ?? "", scrape.aboutText ?? "", scrape.homeText.slice(0, 4000)].join(" ");
    // Two-letter state right after a comma + space: "Layton, UT"
    const codeMatch = haystack.match(/,\s+([A-Z]{2})\b(?!\w)/);
    if (codeMatch && REGION_BY_STATE[codeMatch[1]]) {
      business.state = codeMatch[1];
    } else {
      // Spelled-out state name: "Layton, Utah"
      const STATE_NAME_TO_CODE: Record<string, string> = {
        Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
        California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
        Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
        Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
        Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
        Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
        Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
        "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
        "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
        Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
        "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
        Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
        Virginia: "VA", Washington: "WA", "West Virginia": "WV",
        Wisconsin: "WI", Wyoming: "WY",
      };
      for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
        if (new RegExp(`,\\s+${name}\\b`, "i").test(haystack)) {
          business.state = code;
          break;
        }
      }
    }
  }

  yield { kind: "phase-done", phase: "geocode", data: sourceLocation };

  // ─── Phase 4 + 5: Demographics + competitor density (parallel) ───
  yield {
    kind: "progress",
    phase: "demographics",
    message: "Pulling demographics and competitor density…",
  };

  let prototypeDemographics: Demographics | null = null;
  let prototypeCompetitorCount: number | null = null;

  if (sourceLocation) {
    const [demoRes, compRes] = await Promise.allSettled([
      isCensusAvailable() ? zipDemographics(sourceLocation.zip) : Promise.resolve(null),
      isPlacesAvailable()
        ? nearbyPlaces({
            centerLat: sourceLocation.lat,
            centerLng: sourceLocation.lng,
            radiusMeters: 1609, // 1 mile
            // Places API works best with simple category terms ("Mexican
            // restaurant", "coffee shop") rather than long concept
            // narratives. The LLM extracts a placesCategory specifically
            // for this use; fall back to name → "restaurant" if missing.
            keyword: business.placesCategory ?? business.name ?? "restaurant",
          })
        : Promise.resolve(null),
    ]);

    if (demoRes.status === "fulfilled" && demoRes.value && demoRes.value.ok) {
      prototypeDemographics = normalizeDemographics(demoRes.value);
    }
    if (compRes.status === "fulfilled" && compRes.value && compRes.value.ok) {
      prototypeCompetitorCount = compRes.value.places.length;
      costCents += COST.PLACES_NEARBY_CENTS;
    }
  }

  yield {
    kind: "phase-done",
    phase: "demographics",
    data: { demographics: prototypeDemographics, competitors: prototypeCompetitorCount },
  };

  // ─── Phase 6: Score expansion-market candidates ──────────────────
  yield {
    kind: "progress",
    phase: "expansion",
    message: "Scoring expansion markets across the country…",
  };

  // Tranche 4 (2026-05-10): exclude metros/states the franchise-
  // detection LLM identified as places the customer ALREADY operates.
  // Costa Vida shouldn't get "Salt Lake City" recommended as an
  // expansion pick — they have 30 locations there; the metro is
  // saturated by their own brand. Match is case-insensitive on
  // candidate.metro and case-insensitive on state code. Logic stays
  // conservative (only drops candidates where we have HIGH confidence
  // they're already there) — false negatives from LLM extraction
  // just mean we keep showing a metro they're already in, which is
  // suboptimal but not harmful.
  const existingMetroSet = new Set(
    existingFranchisor.existingMetros.map((m) => m.toLowerCase().trim()),
  );
  // existingStates is captured but NOT used as an exclusion source
  // here. Reasoning: a UT operator's site lists UT in their existing
  // states; using state-level exclusion would drop every UT candidate
  // including the home market itself (already handled by
  // excludeSourceLocation). State-level signal will be useful in
  // tranche 7's parameter sweep for the "expand contiguously vs
  // anywhere" preference, where someone in UT/NV/AZ might want to
  // skip the entire West cluster they already saturate. Leaving the
  // door open without acting on it yet.
  const candidatePool = excludeSourceLocation(
    CANDIDATE_ZIPS,
    sourceLocation?.zip ?? null,
  ).filter((c) => {
    const metroKey = c.metro.toLowerCase().trim();
    if (existingMetroSet.has(metroKey)) return false;
    // Some candidate metros are named "Salt Lake City" while a chain
    // might list "SLC" or "Salt Lake" — fuzzy substring match catches
    // those. Only fire when the candidate metro contains the existing
    // metro name as a whole word (avoids "Cityville" matching "City").
    for (const existing of existingMetroSet) {
      if (existing.length < 4) continue;
      // Whole-word containment in either direction.
      if (
        metroKey.includes(existing) ||
        (existing.includes(metroKey) && metroKey.length >= 4)
      ) {
        return false;
      }
    }
    return true;
  });

  // Step 1: Fetch demographics for every candidate (parallel; Census is
  // fast and free). We bail to a graceful smaller list if Census is down.
  const demoResults = isCensusAvailable()
    ? await Promise.allSettled(candidatePool.map((c) => zipDemographics(c.zip)))
    : [];

  type ScoredCandidate = {
    candidate: CandidateZip;
    demographics: Demographics | null;
    similarity: number; // 0-100, higher = closer to prototype
  };

  const scored: ScoredCandidate[] = candidatePool.map((c, i) => {
    const result = demoResults[i];
    const d =
      result && result.status === "fulfilled" && result.value && result.value.ok
        ? normalizeDemographics(result.value)
        : null;
    return {
      candidate: c,
      demographics: d,
      similarity: scoreSimilarity(prototypeDemographics, d),
    };
  });

  // Step 2: Take the best 5 candidates, with TWO selection rules:
  //   (a) Geographic proximity bias — same-state markets ranked first,
  //       then same-region, then far-flung. Most franchise operators
  //       expand within their own region first because operational
  //       support, brand recognition, and real-estate familiarity all
  //       radiate outward. A Utah business getting "Dallas" as its top
  //       expansion pick (which Eric flagged in QA) reads as the
  //       algorithm not understanding franchise development.
  //   (b) Metro diversity — keep only the best-similarity candidate
  //       per metro so the downstream top-3 picker always gets 5
  //       different metros, not clusters.
  const sourceState = business.state ?? null;
  const sourceRegion = sourceState ? regionForState(sourceState) : null;
  const sortedBySimilarity = scored
    .filter((s) => s.demographics !== null)
    // Apply a similarity bonus for same-state / same-region candidates
    // BEFORE sorting so the proximity preference shows up in the
    // top-5 selection naturally, without breaking the 4-pillar /
    // 100-point rubric framing the user sees.
    .map((s) => {
      const candState = s.candidate.state;
      const candRegion = regionForState(candState);
      let proximityBonus = 0;
      if (sourceState && candState === sourceState) proximityBonus = 25;
      else if (sourceRegion && candRegion === sourceRegion) proximityBonus = 12;
      return { ...s, similarity: Math.min(100, s.similarity + proximityBonus) };
    })
    .sort((a, b) => b.similarity - a.similarity);
  const seenMetros = new Set<string>();
  const top5: typeof sortedBySimilarity = [];
  for (const s of sortedBySimilarity) {
    if (seenMetros.has(s.candidate.metro)) continue;
    seenMetros.add(s.candidate.metro);
    top5.push(s);
    if (top5.length >= 5) break;
  }

  // Tranche 11 (2026-05-10): guaranteed-local inclusion. The new
  // snapshot layout slots a "BEST LOCAL OPPORTUNITY" card alongside
  // the national pick, so we need to make sure the top-5 candidate
  // pool ALWAYS includes the best in-state market (when one exists)
  // — otherwise the local slot has nothing to render. If the best
  // local is already in top5, this is a no-op; otherwise we swap it
  // in for the 5th-place candidate.
  if (sourceState) {
    const bestLocalAnywhere = sortedBySimilarity.find(
      (s) => s.candidate.state.toUpperCase() === sourceState.toUpperCase(),
    );
    const localAlreadyInTop5 =
      bestLocalAnywhere &&
      top5.some((t) => t.candidate.zip === bestLocalAnywhere.candidate.zip);
    if (bestLocalAnywhere && !localAlreadyInTop5) {
      // Replace the weakest-similarity entry in top5 with the
      // guaranteed local. Drop the metro of the displaced entry from
      // seenMetros so future logic (if any) doesn't think it's still
      // claimed.
      const displaced = top5.pop();
      if (displaced) seenMetros.delete(displaced.candidate.metro);
      top5.push(bestLocalAnywhere);
      seenMetros.add(bestLocalAnywhere.candidate.metro);
    }
  }

  // Step 3: Live Places competitor-density check on top 5.
  yield {
    kind: "progress",
    phase: "competitors",
    message: "Checking competitor saturation in top markets…",
  };

  const compChecks = isPlacesAvailable()
    ? await Promise.allSettled(
        top5.map((s) =>
          nearbyPlaces({
            centerLat: s.candidate.lat,
            centerLng: s.candidate.lng,
            radiusMeters: 1609,
            // Places API works best with simple category terms ("Mexican
            // restaurant", "coffee shop") rather than long concept
            // narratives. The LLM extracts a placesCategory specifically
            // for this use; fall back to name → "restaurant" if missing.
            keyword: business.placesCategory ?? business.name ?? "restaurant",
          }),
        ),
      )
    : [];
  costCents += top5.length * COST.PLACES_NEARBY_CENTS;

  const competitorCounts = compChecks.map((r) =>
    r.status === "fulfilled" && r.value && r.value.ok ? r.value.places.length : 0,
  );

  // Detect the "saturated keyword" failure mode. When LLM business-name
  // extraction fails, we fall back to a generic Places search keyword
  // ("restaurant"), which hits the 20-cap on every metro. The signal-
  // reliability check rolls in whether to trust the competitor counts
  // for scoring + narrative.
  const competitorSignalReliable = isCompetitorSignalReliable(competitorCounts);

  // Step 4: Final scoring per market — uses the reliability flag to
  // avoid both (a) ranking saturated markets as top picks and (b)
  // narrating them as "crowded — 20 within 1 mile."
  //
  // Tranche 3 (2026-05-10): geographic bias is also applied to the
  // FINAL overall score (not just to selection-time similarity) so
  // home-region markets actually surface in the visible top-3.
  // Previously the +25 same-state similarity bonus only gated entry
  // into the top-5 candidate pool; the 4-pillar score had the final
  // say, and saturation-aware competition scoring was knocking
  // home-state markets out of the visible top-3. The post-pillar
  // bias closes that loop.
  const geoWeights: GeoBiasWeights = DEFAULT_GEO_WEIGHTS;
  const expansion: ExpansionMarket[] = top5.map((s, i) => {
    const compCount = competitorCounts[i];
    const pillars = computePillars({
      candidate: s.candidate,
      demographics: s.demographics,
      similarity: s.similarity,
      competitorCount: compCount,
      prototypeCompetitorCount,
      competitorSignalReliable,
    });
    const pillarSum =
      pillars.demographicsAndMarket +
      pillars.trafficAndAccess +
      pillars.competition +
      pillars.financialAndLegal;
    const proximity = computeFinalProximityBias({
      sourceState: business.state ?? null,
      sourceLat: sourceLocation?.lat ?? null,
      sourceLng: sourceLocation?.lng ?? null,
      sourceMedianHHI: prototypeDemographics?.medianHouseholdIncome ?? null,
      candState: s.candidate.state,
      candLat: s.candidate.lat,
      candLng: s.candidate.lng,
      candMedianHHI: s.demographics?.medianHouseholdIncome ?? null,
      regionForState,
      weights: geoWeights,
    });
    // Clamp to [0, 100]; the visible "X/100 score" framing breaks
    // outside that range and a -8 penalty stack is harmless to floor.
    const overall = Math.max(0, Math.min(100, pillarSum + proximity.delta));
    return {
      zip: s.candidate.zip,
      label: s.candidate.label,
      metro: s.candidate.metro,
      state: s.candidate.state,
      score: overall,
      pillars,
      why: explainMatch({
        candidate: s.candidate,
        demographics: s.demographics,
        prototypeDemographics,
        competitorCount: compCount,
        competitorSignalReliable,
      }),
      // Bullets populated AFTER pickDiverseTop3 by a batched LLM call.
      // Default to empty here so the type stays satisfied.
      bullets: [],
      competitorCount: compCount,
    };
  });

  expansion.sort((a, b) => b.score - a.score);
  // Tranche 11 (2026-05-10): slot-aware top-4 picker. UI renders
  // a 2-up-visible / 2-blurred layout that explicitly slots a "best
  // local opportunity" alongside a "best expansion opportunity"
  // (national pick). pickSlottedTop4 attaches a `slot` field to
  // each entry so the UI can pick the right eyebrow and blur state.
  const topExpansion = pickSlottedTop4(expansion, business.state ?? null);

  // Tranche 6: alternate ranking with NO geo bias — pure 4-pillar
  // score across the same candidate pool. Lets the snapshot UI offer
  // a "open to anywhere?" toggle that surfaces different markets when
  // the customer isn't constrained to home-region expansion. Same
  // candidate pool (existing-footprint exclusion still applies) so we
  // don't recommend metros they already saturate either way.
  const expansionAnywhere: ExpansionMarket[] = top5
    .map((s, i) => {
      const compCount = competitorCounts[i];
      const pillars = computePillars({
        candidate: s.candidate,
        demographics: s.demographics,
        similarity: s.similarity,
        competitorCount: compCount,
        prototypeCompetitorCount,
        competitorSignalReliable,
      });
      const pillarSum =
        pillars.demographicsAndMarket +
        pillars.trafficAndAccess +
        pillars.competition +
        pillars.financialAndLegal;
      // Pure 4-pillar score, no proximity / drive-time / cost-parity
      // delta. Visible "X/100" framing stays meaningful.
      const overall = Math.max(0, Math.min(100, pillarSum));
      return {
        zip: s.candidate.zip,
        label: s.candidate.label,
        metro: s.candidate.metro,
        state: s.candidate.state,
        score: overall,
        pillars,
        why: explainMatch({
          candidate: s.candidate,
          demographics: s.demographics,
          prototypeDemographics,
          competitorCount: compCount,
          competitorSignalReliable,
        }),
        bullets: [],
        competitorCount: compCount,
      };
    })
    .sort((a, b) => b.score - a.score);
  const topExpansionAnywhere = pickDiverseTop3(expansionAnywhere);
  // If the alternate ranking happens to match the proximity-weighted
  // top 3 (rare — common when home market is high-income coastal,
  // pillar score and proximity bonus point the same way), don't
  // duplicate the data in the payload. UI hides the toggle when
  // expansionAnywhere is empty.
  const isSameAsTop = (a: ExpansionMarket[], b: ExpansionMarket[]) =>
    a.length === b.length &&
    a.every((m, i) => b[i] && m.zip === b[i].zip);
  const topExpansionAnywhereOrEmpty = isSameAsTop(
    topExpansion,
    topExpansionAnywhere,
  )
    ? []
    : topExpansionAnywhere;

  // Tranche 8 (2026-05-10): plain-English bullets per market. Replaces
  // the algorithmically-generated `why` sentence (which read as
  // jargon-y per Eric's QA) with 3 short bullets written by the LLM.
  // Single batched call for all 3 top markets so cost stays at ~3¢.
  // Pass the underlying Census demographics for each top market so
  // the LLM can produce concrete number references ("$20K higher
  // income than your home market") rather than vague comparisons.
  const candidateDemoMap = new Map<string, Demographics>();
  for (const s of top5) {
    if (s.demographics) {
      candidateDemoMap.set(s.candidate.zip, s.demographics);
    }
  }
  const bulletsByZip = await generateMarketBullets({
    business,
    homeMarketDemographics: prototypeDemographics,
    homeMarketCompetitorCount: prototypeCompetitorCount,
    markets: topExpansion,
    candidateDemographicsByZip: candidateDemoMap,
  });
  costCents += COST.LLM_MARKET_BULLETS_CENTS;
  // Merge bullets into each market. Missing bullets fall back to an
  // empty array; the UI renders nothing rather than crashing.
  for (const m of topExpansion) {
    m.bullets = bulletsByZip.get(m.zip) ?? [];
  }
  for (const m of topExpansionAnywhereOrEmpty) {
    // Reuse the same bullets when the same zip appears in both lists
    // (common for high-scoring near-home picks). The bullets describe
    // the market, not the ranking they appeared in.
    m.bullets = bulletsByZip.get(m.zip) ?? m.bullets ?? [];
  }

  yield { kind: "phase-done", phase: "expansion", data: topExpansion };

  // ─── Phase 7: Readiness score + website-specific observations ────
  yield {
    kind: "progress",
    phase: "score",
    message: "Reading what stands out about your business…",
  };

  // Score + tier come from deterministic signals (signal completeness,
  // demographic match, expansion viability). Gaps come from an LLM
  // pass over the actual scraped content so they reference what we
  // can OBSERVE, not generic franchise-readiness checklists.
  const baseReadiness = computeReadiness({
    business,
    sourceLocation,
    prototypeDemographics,
    prototypeCompetitorCount,
    expansionScores: topExpansion.map((e) => e.score),
  });

  const llmGaps = await generateWebsiteSpecificGaps({
    scrape,
    business,
    sourceLocation,
    homeMarketDemographics: prototypeDemographics,
    homeMarketCompetitorCount: prototypeCompetitorCount,
    topExpansion,
    existingFranchisor,
  });
  costCents += COST.LLM_SUMMARY_CENTS;

  const readiness: ReadinessScore = {
    overall: baseReadiness.overall,
    suggestedTier: baseReadiness.suggestedTier,
    gaps: llmGaps,
  };

  yield { kind: "phase-done", phase: "score", data: readiness };

  // ─── Phase 8: Home-market summary via LLM ────────────────────────
  yield {
    kind: "progress",
    phase: "summary",
    message: "Drafting your home-market summary…",
  };

  const narrative = await synthesizeHomeMarketNarrative({
    business,
    sourceLocation,
    homeMarketDemographics: prototypeDemographics,
    homeMarketCompetitorCount: prototypeCompetitorCount,
  });
  costCents += COST.LLM_SUMMARY_CENTS;

  const snapshot: IntakeSnapshot = {
    business,
    homeMarket: {
      zip: sourceLocation?.zip ?? null,
      narrative,
      demographics: prototypeDemographics,
      competitorCount: prototypeCompetitorCount,
    },
    expansion: topExpansion,
    expansionAnywhere: topExpansionAnywhereOrEmpty,
    readiness,
    // Only attach the existing-franchisor signal when it actually
    // fired — keeps the JSON payload minimal for the common case
    // (candidate franchisor scoring through the standard rubric).
    ...(existingFranchisor.isFranchising
      ? { existingFranchisor }
      : {}),
    costCents,
  };

  yield { kind: "complete", snapshot };
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Coarse US-region grouping used by the proximity bias in expansion-
 * market scoring. Same-state and same-region candidates get a
 * similarity bonus before the top-5 cut, so the snapshot prefers
 * markets the owner could realistically support out of their existing
 * organization. Region buckets follow common franchise-development
 * convention (West / Mountain West roll up together for support
 * radius purposes; Texas usually gets bridged into both South and
 * West because of how franchisor field-ops territories are drawn).
 */
const REGION_BY_STATE: Record<string, string> = {
  // West / Mountain West / Pacific
  AK: "West", AZ: "West", CA: "West", CO: "West", HI: "West",
  ID: "West", MT: "West", NV: "West", NM: "West", OR: "West",
  UT: "West", WA: "West", WY: "West",
  // Midwest
  IL: "Midwest", IN: "Midwest", IA: "Midwest", KS: "Midwest",
  MI: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest",
  ND: "Midwest", OH: "Midwest", SD: "Midwest", WI: "Midwest",
  // South / Southeast
  AL: "South", AR: "South", FL: "South", GA: "South", KY: "South",
  LA: "South", MS: "South", NC: "South", OK: "South", SC: "South",
  TN: "South", TX: "South", VA: "South", WV: "South",
  // Northeast / Mid-Atlantic
  CT: "Northeast", DC: "Northeast", DE: "Northeast", MA: "Northeast",
  MD: "Northeast", ME: "Northeast", NH: "Northeast", NJ: "Northeast",
  NY: "Northeast", PA: "Northeast", RI: "Northeast", VT: "Northeast",
};

function regionForState(state: string | null | undefined): string | null {
  if (!state) return null;
  return REGION_BY_STATE[state.toUpperCase()] ?? null;
}

/**
 * Last-ditch business-name inference when the LLM extract returns null.
 * Tries two paths in order of reliability:
 *
 *   1. Parse the page <title>. Real titles look like "Costa Vida — Fresh
 *      Mexican Grill" or "Costa Vida | Order Online" — we take the
 *      chunk before the first separator (em-dash, en-dash, hyphen,
 *      pipe, colon).
 *   2. Derive from the domain. `costavida.com` → "Costavida". Not
 *      pretty for concatenated domains, but materially better than
 *      "Your Business" — at minimum it tells the visitor we know
 *      whose URL they dropped.
 *
 * Returns null only if both fail (very rare — title is almost always
 * present, and domain canonicalization upstream guarantees a domain).
 */
function inferBusinessNameFallback(scrape: ScrapeArtifacts, url: string): string | null {
  // Path 1: page title before the first common separator.
  if (scrape.title) {
    const SEPARATORS = /[—–|:·•\-]/; // em, en, pipe, colon, mid-dot, bullet, hyphen
    const head = scrape.title.split(SEPARATORS)[0]?.trim();
    if (head && head.length >= 2 && head.length <= 60) {
      // Skip obvious placeholders ("Home", "Welcome", etc.)
      const generic = /^(home|welcome|index|untitled|page|loading)$/i;
      if (!generic.test(head)) {
        return head;
      }
    }
  }

  // Path 2: derive from domain. Strip TLD, replace dashes with spaces,
  // title-case word boundaries. `costavida.com` → "Costavida";
  // `high-point-coffee.com` → "High Point Coffee".
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const sld = host.split(".")[0];
    if (sld && sld.length >= 2) {
      const titled = sld
        .split(/[-_]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return titled;
    }
  } catch {
    // Fall through.
  }

  return null;
}

async function extractBusinessInfo(scrape: ScrapeArtifacts): Promise<BusinessInfo> {
  const anthropic = getAnthropic();
  const sysPrompt = `Extract structured info about a business from its scraped website. Return JSON only:
{
  "name": "business name or null",
  "oneLineConcept": "5-10 word concept (e.g., 'fast-casual Mexican grill') or null",
  "brandVoice": "8-15 word characterization of brand voice or null",
  "address": "street address with city/state if found, else null",
  "city": "city or null",
  "state": "2-letter state or null",
  "zip": "5-digit ZIP or null",
  "placesCategory": "short Google-Places-friendly category (1-3 words, e.g., 'Mexican restaurant', 'coffee shop', 'fitness studio', 'auto repair'). Should be specific enough to find competitors but not so specific it returns zero results. Null if business type unclear."
}
Be concise. Use null when not confident — do not guess.`;

  try {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      system: [
        { type: "text", text: sysPrompt, cache_control: CACHE_5M },
      ],
      messages: [
        {
          role: "user",
          content: `Title: ${scrape.title ?? "(none)"}
Meta description: ${scrape.metaDescription ?? "(none)"}

Home page text (first 2500 chars):
${scrape.homeText.slice(0, 2500)}

About page text (first 2500 chars):
${scrape.aboutText?.slice(0, 2500) ?? "(no about page found)"}`,
        },
      ],
    });

    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n") ?? "";

    // Parse out the JSON object — Claude sometimes wraps in code fences.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return emptyBusinessInfo();
    }
    const parsed = JSON.parse(jsonMatch[0]) as Partial<BusinessInfo>;
    return {
      name: parsed.name ?? null,
      oneLineConcept: parsed.oneLineConcept ?? null,
      brandVoice: parsed.brandVoice ?? null,
      address: parsed.address ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      zip: parsed.zip ?? null,
      placesCategory: parsed.placesCategory ?? null,
    };
  } catch {
    return emptyBusinessInfo();
  }
}

function emptyBusinessInfo(): BusinessInfo {
  return {
    name: null,
    oneLineConcept: null,
    brandVoice: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    placesCategory: null,
  };
}

/**
 * Normalize a Census ACS success-shape result into the orchestrator's
 * shape. Drops rows where any of the three core fields is null.
 */
function normalizeDemographics(
  raw: Extract<Awaited<ReturnType<typeof zipDemographics>>, { ok: true }>,
): Demographics | null {
  if (
    raw.population == null ||
    raw.medianHouseholdIncome == null ||
    raw.medianAge == null
  ) {
    return null;
  }
  return {
    zip: raw.zip,
    population: raw.population,
    medianHouseholdIncome: raw.medianHouseholdIncome,
    medianAge: raw.medianAge,
  };
}

/** Demographic similarity scoring — Euclidean distance in normalized space. */
function scoreSimilarity(
  proto: Demographics | null,
  cand: Demographics | null,
): number {
  if (!proto || !cand) {
    // No prototype demographics → fall back to neutral 50.
    return 50;
  }
  // Normalize to roughly 0-1 ranges so Euclidean distance is meaningful.
  const protoVec = [
    proto.medianHouseholdIncome / 200_000,
    proto.medianAge / 80,
    Math.log10(Math.max(proto.population, 1)) / 7, // log scale on pop
  ];
  const candVec = [
    cand.medianHouseholdIncome / 200_000,
    cand.medianAge / 80,
    Math.log10(Math.max(cand.population, 1)) / 7,
  ];
  let sumSq = 0;
  for (let i = 0; i < protoVec.length; i++) {
    sumSq += (protoVec[i] - candVec[i]) ** 2;
  }
  const distance = Math.sqrt(sumSq); // 0 = identical, ~sqrt(3) = polar opposite
  // Map distance → 0-100 score (higher = more similar)
  const similarity = Math.max(0, Math.min(100, 100 - distance * 80));
  return Math.round(similarity);
}

/**
 * Whether the competitor count for a market should be trusted as a real
 * signal. The Google Places nearby-search caps results at 20 — when we
 * see 18+ across the board (typically because business name extraction
 * failed and we fell back to a generic keyword like "restaurant"), the
 * counts are saturated and meaningless. In that case we fall back to a
 * neutral mid-range competition score and skip the saturation narrative
 * entirely so we never present "Crowded — 20 competitors" as a top pick.
 */
function isCompetitorSignalReliable(counts: number[]): boolean {
  if (counts.length === 0) return false;
  const saturated = counts.filter((c) => c >= 18).length;
  // If 80%+ of markets are saturated, the keyword was too generic.
  return saturated / counts.length < 0.8;
}

function computePillars(args: {
  candidate: CandidateZip;
  demographics: Demographics | null;
  similarity: number;
  competitorCount: number;
  prototypeCompetitorCount: number | null;
  competitorSignalReliable: boolean;
}): ExpansionMarket["pillars"] {
  // Demographics & Market (0-25): scaled from similarity.
  const demographicsAndMarket = Math.round((args.similarity / 100) * 25);

  // Traffic & Access (0-25): proxied by trade-area type. The deltas
  // here are small on purpose — we don't want trade-area type to
  // dominate the ranking because urban-core would always win.
  const trafficByType: Record<CandidateZip["type"], number> = {
    "urban-core": 21,
    "edge-city": 22,
    "inner-suburb": 19,
    "outer-suburb": 18,
  };
  const trafficAndAccess = trafficByType[args.candidate.type];

  // Competition (0-25): WHITESPACE (low competitor count) is the prize
  // for someone considering a new location, not "matching" the prototype.
  // Earlier scoring tried to match — wrong instinct. Franchise candidates
  // want markets where the demand exists (proven by the prototype) but
  // the supply doesn't yet, so they can be early movers.
  //
  // Calibration:
  //   0-3 competitors  → 25/25 (open whitespace, ideal)
  //   4-8              → 22/25 (healthy demand, real opportunity)
  //   9-14             → 14/25 (established corridor — viable but tight)
  //   15-19            → 7/25  (saturated, hard to differentiate)
  //   20+ (capped)     → 4/25  (over-served)
  //
  // BUT: when the competitor signal isn't reliable across the board
  // (saturated keyword), we use a neutral score so saturation doesn't
  // arbitrarily clip every market to the same low number.
  let competition: number;
  if (!args.competitorSignalReliable) {
    competition = 17; // neutral mid-range
  } else if (args.competitorCount <= 3) {
    competition = 25;
  } else if (args.competitorCount <= 8) {
    competition = 22;
  } else if (args.competitorCount <= 14) {
    competition = 14;
  } else if (args.competitorCount <= 19) {
    competition = 7;
  } else {
    competition = 4;
  }

  // Financial & Legal (0-25): proxied by HHI (buying power) + state
  // franchise-friendliness.
  const hhi = args.demographics?.medianHouseholdIncome ?? 70_000;
  const hhiScore = Math.min(20, Math.round((hhi / 100_000) * 20));
  const FRIENDLY_STATES = new Set(["TX", "FL", "AZ", "TN", "NC", "GA", "CO"]);
  const legalBonus = FRIENDLY_STATES.has(args.candidate.state) ? 5 : 3;
  const financialAndLegal = Math.min(25, hhiScore + legalBonus);

  return {
    demographicsAndMarket,
    trafficAndAccess,
    competition,
    financialAndLegal,
  };
}

function explainMatch(args: {
  candidate: CandidateZip;
  demographics: Demographics | null;
  prototypeDemographics: Demographics | null;
  competitorCount: number;
  competitorSignalReliable: boolean;
}): string {
  // Tranche 8 rewrite (2026-05-10): plain-English fallback used when
  // the LLM bullet generator fails. Eric flagged the old version
  // ("Buying power runs about 11% higher than your home market;
  // dense urban foot traffic.") as too jargon-y for a small business
  // owner skimming on their phone. Single short sentence, no
  // semicolons, no MBA-speak. The LLM bullet pass is the primary
  // copy — this is just a safety net.
  const d = args.demographics;
  const p = args.prototypeDemographics;

  // Income comparison — phrased in dollars not percentages.
  let incomePart: string | null = null;
  if (d && p) {
    const homeK = Math.round(p.medianHouseholdIncome / 1000);
    const candK = Math.round(d.medianHouseholdIncome / 1000);
    const delta = candK - homeK;
    if (Math.abs(delta) < 8) {
      incomePart = "Households here earn about what your home market earns";
    } else if (delta > 0) {
      incomePart = `Households here earn around $${candK}K, about $${delta}K more than your home market`;
    } else {
      incomePart = `Households here earn around $${candK}K, a bit less than your home market`;
    }
  } else if (d) {
    incomePart = `Households here earn around $${Math.round(d.medianHouseholdIncome / 1000)}K`;
  }

  // Competitor signal — only when it's a flattering picture, never
  // surface "crowded" framing on a top recommendation.
  let compPart: string | null = null;
  if (args.competitorSignalReliable) {
    if (args.competitorCount === 0) {
      compPart = "no direct competitors within a mile";
    } else if (args.competitorCount <= 3) {
      compPart = "very few competitors within a mile";
    } else if (args.competitorCount <= 8) {
      compPart = "competitive demand without saturation";
    }
  }

  // Trade-area type — plain English, no franchise jargon.
  const typeLabel: Record<CandidateZip["type"], string> = {
    "urban-core": "busy urban foot traffic",
    "edge-city": "anchor-driven edge-city traffic",
    "inner-suburb": "established residential base",
    "outer-suburb": "growing suburb with steady traffic",
  };

  const sentences: string[] = [];
  if (incomePart) sentences.push(incomePart + ".");
  const tailParts: string[] = [];
  if (compPart) tailParts.push(compPart);
  tailParts.push(typeLabel[args.candidate.type]);
  if (tailParts.length > 0) {
    sentences.push(capitalize(tailParts.join(", ")) + ".");
  }
  return sentences.join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate three plain-English bullet points per market explaining why
 * this location is worth considering for THIS business. Eric flagged
 * 2026-05-10 that the algorithmically-generated `why` sentence
 * ("Buying power runs about 11% higher than your home market; dense
 * urban foot traffic.") read as too complex for a small business owner
 * skimming on their phone. Bullets are written by an LLM with explicit
 * instructions to use plain English, no jargon, 8-14 word lines.
 *
 * Single batched call covers all top markets to keep cost at ~3¢.
 * Returns a Map keyed by zip → bullets. Empty Map on any error;
 * caller falls back to empty array per market.
 */
async function generateMarketBullets(args: {
  business: BusinessInfo;
  homeMarketDemographics: Demographics | null;
  homeMarketCompetitorCount: number | null;
  markets: ExpansionMarket[];
  /**
   * Map of candidate zip → Census demographics for that candidate.
   * Drives the dollar-figure references in the bullets ("households
   * here earn $20K more than your home market" requires real numbers
   * on both sides). Missing entries → LLM works from pillar scores
   * alone, which still produces decent bullets just less specific.
   */
  candidateDemographicsByZip: Map<string, Demographics>;
}): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (args.markets.length === 0) return result;

  // If we have no home demographics, the bullets would be context-free.
  // Better to skip the LLM call and let the UI render the algorithmic
  // `why` line as a fallback.
  if (!args.homeMarketDemographics) return result;

  const anthropic = getAnthropic();

  const sys = `You write three short, plain-English bullets for each of N expansion markets in a franchise-readiness snapshot.

WHO WILL READ THIS: a small business owner — possibly first-time franchisor — skimming on their phone in 30 seconds. They need to feel like the recommendation makes sense without translating jargon.

RULES — strict:
- Each bullet is 8-14 words. Plain English. No franchise jargon, no MBA-speak.
- Each bullet states something CONCRETE about why this market fits THEIR business.
- Pull from: the candidate's demographics (median income, age, population), trade-area type, competitor density, brand fit with their concept, geographic proximity, growth trajectory.
- Phrase from the OWNER'S perspective ("households here earn similar to your home market") not the data's perspective ("median household income is $87,420").
- Round numbers when you use them ("$80K incomes" not "$80,127"). Avoid percentages over 100% (just say "double").
- Don't repeat the same point across all three bullets — each makes a different case.
- Don't use semicolons. Don't use em dashes.

Return strict JSON only — no commentary, no markdown fences. Schema:
{
  "markets": [
    {
      "zip": "ZZZZZ",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    },
    ...
  ]
}

Include one entry per market in the input, keyed by zip. If you genuinely can't think of three distinct bullets for a market (sparse data), it's better to return two strong ones than three weak ones.`;

  const homeD = args.homeMarketDemographics;
  const marketLines = args.markets
    .map((m) => {
      const candD = args.candidateDemographicsByZip.get(m.zip);
      const demoStr = candD
        ? `median household income $${candD.medianHouseholdIncome.toLocaleString()}, median age ${candD.medianAge}, ZIP population ${candD.population.toLocaleString()}`
        : "Census demographics: not available (work from pillar scores)";
      return `  - zip ${m.zip} — ${m.label}, ${m.state} — score ${m.score}/100
    ${demoStr}
    Competitors within 1 mile: ${m.competitorCount}
    Pillars: demographics ${m.pillars.demographicsAndMarket}/25, traffic ${m.pillars.trafficAndAccess}/25, competition ${m.pillars.competition}/25, financial ${m.pillars.financialAndLegal}/25`;
    })
    .join("\n");

  const userPrompt = `Business: ${args.business.name ?? "(unknown)"}
Concept: ${args.business.oneLineConcept ?? "(unknown)"}
Brand voice: ${args.business.brandVoice ?? "(unknown)"}

Home market (where the business operates today):
  - ZIP ${homeD.zip}: median household income $${homeD.medianHouseholdIncome.toLocaleString()}, median age ${homeD.medianAge}, ZIP population ${homeD.population.toLocaleString()}
  - Competing concepts within 1 mile of home: ${args.homeMarketCompetitorCount ?? "(unknown)"}

Top expansion markets (write 3 bullets for each):
${marketLines}

Emit the JSON described in the system prompt.`;

  try {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1000,
      system: [{ type: "text", text: sys, cache_control: CACHE_5M }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n") ?? "";
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced?.[1]?.trim() ?? text.match(/\{[\s\S]*\}/)?.[0] ?? "";
    if (!candidate) return result;
    const parsed = JSON.parse(candidate) as {
      markets?: Array<{ zip?: string; bullets?: unknown }>;
    };
    if (!Array.isArray(parsed.markets)) return result;
    for (const m of parsed.markets) {
      if (typeof m.zip !== "string") continue;
      if (!Array.isArray(m.bullets)) continue;
      const cleaned = m.bullets
        .filter(
          (b): b is string =>
            typeof b === "string" && b.length >= 10 && b.length <= 200,
        )
        .slice(0, 3);
      if (cleaned.length > 0) result.set(m.zip, cleaned);
    }
    return result;
  } catch (err) {
    console.error("[intake] generateMarketBullets failed:", err);
    return result;
  }
}

/**
 * Diversity-aware top-3 picker. The raw score-sorted list often clusters
 * (e.g., three urban-cores in the same metro all score ~65). The user
 * sees that as "three identical recommendations" which makes the tool
 * feel dumb. This picker takes the #1 by score, then for #2 prefers a
 * different metro, then for #3 prefers a different metro AND different
 * trade-area type. Falls back to raw order if diversity can't be met.
 */
function pickDiverseTop3(
  rankedExpansion: ExpansionMarket[],
): ExpansionMarket[] {
  if (rankedExpansion.length <= 1) return rankedExpansion.slice(0, 3);
  const result: ExpansionMarket[] = [rankedExpansion[0]];
  const used = new Set([rankedExpansion[0].zip]);
  // Tag each candidate with its trade-area type by joining back to the
  // candidate-pool data. (We don't store the type on ExpansionMarket
  // directly so we look it up at picking time.)
  const typeFor = (zip: string): string =>
    CANDIDATE_ZIPS.find((c) => c.zip === zip)?.type ?? "unknown";

  // Pick #2: highest-scoring candidate in a different metro.
  for (const c of rankedExpansion) {
    if (used.has(c.zip)) continue;
    if (c.metro === result[0].metro) continue;
    result.push(c);
    used.add(c.zip);
    break;
  }
  // If we couldn't satisfy "different metro," fall back to next highest.
  if (result.length < 2) {
    for (const c of rankedExpansion) {
      if (used.has(c.zip)) continue;
      result.push(c);
      used.add(c.zip);
      break;
    }
  }

  // Pick #3: highest-scoring candidate in a metro NOT already represented
  // AND a trade-area type NOT already represented. Loose preference:
  // metro diversity matters more than type diversity.
  const usedMetros = new Set(result.map((r) => r.metro));
  const usedTypes = new Set(result.map((r) => typeFor(r.zip)));
  for (const c of rankedExpansion) {
    if (used.has(c.zip)) continue;
    if (usedMetros.has(c.metro)) continue;
    if (usedTypes.has(typeFor(c.zip))) continue;
    result.push(c);
    used.add(c.zip);
    break;
  }
  if (result.length < 3) {
    // Relaxed: just need a different metro for #3.
    for (const c of rankedExpansion) {
      if (used.has(c.zip)) continue;
      if (usedMetros.has(c.metro)) continue;
      result.push(c);
      used.add(c.zip);
      break;
    }
  }
  if (result.length < 3) {
    // Last resort: next-highest by raw score.
    for (const c of rankedExpansion) {
      if (used.has(c.zip)) continue;
      result.push(c);
      used.add(c.zip);
      if (result.length >= 3) break;
    }
  }
  return result;
}

/**
 * Tranche 11 (2026-05-10) slot-aware top-4 picker for the new
 * 2-up-visible / 2-blurred snapshot layout.
 *
 * Output structure (always length ≤ 4):
 *
 *   [0] slot = "local-primary"     — best-scoring same-state market
 *                                    (or "national-primary" if no
 *                                    in-state candidate exists)
 *   [1] slot = "national-primary"  — best-scoring different-state
 *                                    market
 *   [2] slot = "locked-runner-up"  — next-best market, blurred
 *   [3] slot = "locked-runner-up"  — second-runner-up, blurred
 *
 * If the home state is unknown OR no in-state candidates surfaced
 * in the scored pool, slot [0] degrades to "national-primary" and
 * the entire visible pair is national picks. UI handles that case
 * by relabeling the eyebrow ("YOUR BEST EXPANSION OPPORTUNITY"
 * + "STRONG ALTERNATE").
 *
 * Diversity preferences (loose, fall back if unavailable):
 *   - slot[1] in different metro than slot[0]
 *   - slot[2] in different metro than slots[0,1]
 *   - slot[3] in different metro than slots[0,1,2]
 */
function pickSlottedTop4(
  rankedExpansion: ExpansionMarket[],
  sourceState: string | null,
): ExpansionMarket[] {
  if (rankedExpansion.length === 0) return [];
  const used = new Set<string>();
  const result: ExpansionMarket[] = [];
  const sourceStateU = sourceState?.toUpperCase() ?? null;

  // Slot 0 — best local pick (if any).
  let localPick: ExpansionMarket | null = null;
  if (sourceStateU) {
    localPick =
      rankedExpansion.find(
        (c) => c.state.toUpperCase() === sourceStateU,
      ) ?? null;
  }
  if (localPick) {
    result.push({ ...localPick, slot: "local-primary" });
    used.add(localPick.zip);
  }

  // Slot 1 — best national pick. "National" = NOT the home state, and
  // (if we found a local) NOT the same zip as the local pick.
  let nationalPick: ExpansionMarket | null = null;
  for (const c of rankedExpansion) {
    if (used.has(c.zip)) continue;
    if (sourceStateU && c.state.toUpperCase() === sourceStateU) continue;
    // Prefer a different metro than local pick when local exists.
    if (localPick && c.metro === localPick.metro) continue;
    nationalPick = c;
    break;
  }
  // Diversity-relaxed fallback for national pick.
  if (!nationalPick) {
    for (const c of rankedExpansion) {
      if (used.has(c.zip)) continue;
      if (sourceStateU && c.state.toUpperCase() === sourceStateU) continue;
      nationalPick = c;
      break;
    }
  }
  if (nationalPick) {
    result.push({ ...nationalPick, slot: "national-primary" });
    used.add(nationalPick.zip);
  }

  // Degraded case: no local pick available (unknown state, or no
  // in-state candidate surfaced). Fall back to two national picks
  // with the first relabeled as national-primary so the UI knows.
  if (result.length === 0 || result[0].slot !== "local-primary") {
    // Either result is empty (no national either) or already has
    // national-primary in slot 0 — handled above. Nothing to do.
  }

  // Slots 2 and 3 — runners-up by raw score, diversity-preferred.
  const usedMetros = new Set(result.map((r) => r.metro));
  for (const c of rankedExpansion) {
    if (result.length >= 4) break;
    if (used.has(c.zip)) continue;
    if (usedMetros.has(c.metro)) continue;
    result.push({ ...c, slot: "locked-runner-up" });
    used.add(c.zip);
    usedMetros.add(c.metro);
  }
  // Fallback: if metro-dedup left us short, take next-best regardless.
  for (const c of rankedExpansion) {
    if (result.length >= 4) break;
    if (used.has(c.zip)) continue;
    result.push({ ...c, slot: "locked-runner-up" });
    used.add(c.zip);
  }

  return result;
}

function computeReadiness(args: {
  business: BusinessInfo;
  sourceLocation: { zip: string } | null;
  prototypeDemographics: Demographics | null;
  prototypeCompetitorCount: number | null;
  expansionScores: number[];
}): { overall: number; suggestedTier: ReadinessScore["suggestedTier"] } {
  let score = 0;

  // Business signal completeness (40 points)
  if (args.business.name) score += 10;
  if (args.business.oneLineConcept) score += 10;
  if (args.business.brandVoice) score += 10;
  if (args.business.address || args.sourceLocation) score += 10;

  // Market signal (30 points)
  if (args.prototypeDemographics) score += 15;
  if (args.prototypeCompetitorCount !== null) score += 15;

  // Expansion-market viability (30 points) — average of top-3 expansion scores, normalized
  if (args.expansionScores.length > 0) {
    const avg =
      args.expansionScores.reduce((a, b) => a + b, 0) / args.expansionScores.length;
    score += Math.round((avg / 100) * 30);
  }

  // Cap at 100, floor at 0
  score = Math.max(0, Math.min(100, score));

  // Tier suggestion
  let suggestedTier: ReadinessScore["suggestedTier"];
  if (score < 35) suggestedTier = "not-yet";
  else if (score < 55) suggestedTier = "blueprint";
  else if (score < 80) suggestedTier = "navigator";
  else suggestedTier = "builder";

  return { overall: score, suggestedTier };
}

/**
 * Generate three SPECIFIC observations from the customer's actual
 * website — not a generic franchise-readiness checklist. Eric's QA
 * surfaced that hardcoded gaps like "your FDD isn't started" or
 * "your operations manual doesn't exist" come across as us prescribing
 * artifacts the customer has never heard of, when we have no way to
 * actually know they don't have those things.
 *
 * The replacement: ask Claude to look at the same website data we
 * already have (title, meta, home page, about page, brand info) and
 * surface three things that an experienced franchise consultant would
 * NOTICE while reading the site as a 30-second pre-screen. Things we
 * can ACTUALLY observe: brand-voice consistency, founding-story
 * clarity, menu/service breadth, pricing transparency, multi-location
 * signals, etc. NOT things we can't observe (financial maturity,
 * operations documentation, FDD readiness).
 */
async function generateWebsiteSpecificGaps(args: {
  scrape: ScrapeArtifacts;
  business: BusinessInfo;
  sourceLocation: { formattedAddress: string } | null;
  /** Tranche 5: Census ACS demographics for the home ZIP. Lets the LLM
   *  reference real numbers ("$74K median income"), not just website
   *  copy. Null when we couldn't pin a home ZIP. */
  homeMarketDemographics: Demographics | null;
  /** Tranche 5: Google Places competitor count within 1 mi of home.
   *  Powers observations like "18 competing concepts within a mile —
   *  the home market is saturated." Null when Places is unavailable. */
  homeMarketCompetitorCount: number | null;
  /** Tranche 5: top expansion candidates with their pillar scores.
   *  Lets the LLM contrast home vs candidate ("home market scored 53
   *  on demographics; your top expansion candidate scored 78 — the
   *  gap is the buying-power difference between $74K and $108K
   *  median HHI"). */
  topExpansion: ExpansionMarket[];
  /** Tranche 5: existing-franchisor signal lets the LLM reframe the
   *  observations from "readiness gaps" to "growth observations" when
   *  the customer is already franchising. */
  existingFranchisor: ExistingFranchisorSignal;
}): Promise<string[]> {
  const anthropic = getAnthropic();
  const isExisting = args.existingFranchisor.isFranchising === true;

  const sysPrompt = `You are Jason Stowe, a 30-year franchise development consultant doing a quick pre-screen of a business's public web presence AND their home-market demographic + competitive data. Your job: write three short observations (each 1-3 sentences, 30-60 words) that the business owner would find genuinely useful, plus a concrete next step in each.

The observations should weave TOGETHER:
  • What's visible on their website (menu, pricing, story, brand voice, location count, review density)
  • What public demographic data tells us about their home market (median HHI, median age, household density from Census ACS)
  • What competitive density tells us about their trade area (how many comparable concepts within 1 mile)

CRITICAL CONSTRAINTS — read carefully:
- Reference SPECIFIC numbers when they're meaningful: "$74K median income," "18 competing coffee shops," etc.
- Do NOT prescribe specific franchise-development artifacts (FDD, Item 19, Operations Manual, training program, site-selection rubric) — we have no way to know if they have those things yet${isExisting ? ", and this customer is already franchising so prescribing them would be silly" : ""}.
- Do NOT say "isn't yet codified" or "isn't yet built" or any prescriptive checklist language.
- DO weave website + demographic + competitive signals into a single insight when possible. Examples:
  • "Your menu prices read like a $120K-median neighborhood, but your home ZIP is $74K-median Census. There's a pricing-vs-trade-area mismatch that'd hit franchisee unit economics in similar markets."
  • "Within 1 mile of your home location there are 18 competing coffee shops. That's saturated even before you franchise. Lean on your roastery as the differentiator — competitors here don't have one."
  • "Your home ZIP has projected -3% household growth 2024-2030 per Census. Soft tailwind. Lean expansion candidates toward growing metros so unit economics improve year-over-year."
${isExisting ? "- Frame observations as GROWTH or PORTFOLIO STRATEGY (not readiness gaps). The customer is already franchising — recommend things that affect their next 10-50 units, not their first one." : ""}
- Use plain English. No franchise jargon unless the customer is clearly already a multi-unit operator.
- Each observation should feel like an experienced operator skimmed the site AND looked at the underlying data. Not an AI templating itself into existence.

Return JSON only:
{
  "gaps": [
    "first observation (30-60 words)",
    "second observation (30-60 words)",
    "third observation (30-60 words)"
  ]
}`;

  // Build a compact data summary the LLM can lean on. Order matters —
  // demographic + competitive numbers first so they shape the
  // observations, then website context, then the existing-franchisor
  // signal at the bottom (only if it fired).
  const demoLine = args.homeMarketDemographics
    ? `Home market Census ACS (${args.homeMarketDemographics.zip}): median household income $${args.homeMarketDemographics.medianHouseholdIncome.toLocaleString()}, median age ${args.homeMarketDemographics.medianAge}, ZIP population ${args.homeMarketDemographics.population.toLocaleString()}.`
    : "Home market demographics: not available (couldn't pin a home ZIP).";
  const compLine =
    args.homeMarketCompetitorCount != null
      ? `Comparable concepts within 1 mile of home: ${args.homeMarketCompetitorCount}.`
      : "Competitive density: not available.";
  const expLine =
    args.topExpansion.length > 0
      ? `Top expansion candidates surfaced by our scoring: ${args.topExpansion
          .map(
            (m) =>
              `${m.label} (${m.state}, ZIP ${m.zip}): overall ${m.score}/100, demographics ${m.pillars.demographicsAndMarket}/25, competition ${m.pillars.competition}/25, financial ${m.pillars.financialAndLegal}/25, ${m.competitorCount} competitors within 1mi`,
          )
          .join("; ")}.`
      : "Expansion candidates: none ranked.";
  const existingLine = isExisting
    ? `Existing-franchisor signal FIRED: ${args.existingFranchisor.signalType}, ${
        args.existingFranchisor.locationCount ?? "?"
      }+ locations, evidence: ${args.existingFranchisor.evidence.join(" | ")}. Frame your observations as portfolio-strategy / growth observations, NOT readiness gaps.`
    : "";

  const userPrompt = `Business: ${args.business.name ?? "(unknown)"}
Concept (LLM-extracted): ${args.business.oneLineConcept ?? "(unknown)"}
Brand voice: ${args.business.brandVoice ?? "(unknown)"}
Location: ${args.sourceLocation?.formattedAddress ?? "(unknown)"}

DATA SIGNALS:
${demoLine}
${compLine}
${expLine}
${existingLine}

WEBSITE CONTEXT:
Site title: ${args.scrape.title ?? "(none)"}
Meta description: ${args.scrape.metaDescription ?? "(none)"}

Home-page text (first 3000 chars):
${args.scrape.homeText.slice(0, 3000)}

About-page text (first 2000 chars):
${args.scrape.aboutText?.slice(0, 2000) ?? "(no About page found)"}`;

  try {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 800,
      system: [{ type: "text", text: sysPrompt, cache_control: CACHE_5M }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n") ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { gaps?: unknown };
    if (!Array.isArray(parsed.gaps)) return [];
    return parsed.gaps
      .filter((g): g is string => typeof g === "string" && g.length > 20 && g.length < 500)
      .slice(0, 3);
  } catch (err) {
    console.error("[intake] generateWebsiteSpecificGaps failed:", err);
    return [];
  }
}

async function synthesizeHomeMarketNarrative(args: {
  business: BusinessInfo;
  sourceLocation: { zip: string; formattedAddress: string } | null;
  homeMarketDemographics: Demographics | null;
  homeMarketCompetitorCount: number | null;
}): Promise<string> {
  if (!args.business.name && !args.business.oneLineConcept) {
    return "We weren't able to extract a clear business profile from your website. Sign up to fill in the details and we'll generate the full home-market profile inside your portal.";
  }

  // If we don't have demographics, return a simpler narrative without an LLM call.
  if (!args.homeMarketDemographics) {
    return `${args.business.name ?? "Your business"} reads as ${args.business.oneLineConcept ?? "a service business"}. We weren't able to fully map your trade area from public data — sign up and add your address and we'll complete the analysis inside your portal.`;
  }

  const anthropic = getAnthropic();
  const sys = `You are Jason Stowe, a 30-year franchise development consultant. Write a single short paragraph (3-4 sentences, max 70 words) describing what makes this business's current trade area work — its demographic signature, density, and competitive context. Plain English, conversational, like an experienced operator dictating a memo. No marketing speak, no superlatives, no AI buzzwords.`;

  const d = args.homeMarketDemographics;
  const userPrompt = `Business: ${args.business.name ?? "(unknown)"}
Concept: ${args.business.oneLineConcept ?? "(unknown)"}
Brand voice: ${args.business.brandVoice ?? "(unknown)"}
Location: ${args.sourceLocation?.formattedAddress ?? "(unknown)"}
ZIP: ${args.sourceLocation?.zip ?? "(unknown)"}
Median household income: $${d.medianHouseholdIncome.toLocaleString()}
Median age: ${d.medianAge}
Population (5-digit ZIP): ${d.population.toLocaleString()}
Comparable concepts within 1 mile: ${args.homeMarketCompetitorCount ?? "(unknown)"}`;

  try {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 200,
      system: [{ type: "text", text: sys, cache_control: CACHE_5M }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n") ?? "";
    return text.trim() || "Home-market profile pending — sign up to complete the analysis inside your portal.";
  } catch {
    return `${args.business.name ?? "Your business"} sits in a market with median household income of $${d.medianHouseholdIncome.toLocaleString()} and ${args.homeMarketCompetitorCount ?? "an unknown number of"} comparable concepts within a 1-mile radius. The full analysis is waiting in your portal once you sign up.`;
  }
}
