/**
 * Intake-prefill orchestrator.
 *
 * Given a URL, runs the full enrichment pipeline that powers the
 * home-page lead magnet:
 *
 *   1. Scrape the website (existing fetchSiteArtifacts)
 *   2. Extract business name + address from scrape via LLM
 *   3. Geocode current location via Places → resolve current ZIP
 *   4. Census ACS demographics for current ZIP (= prototype profile)
 *   5. Places nearby-search for competitor density at current location
 *   6. Match against the 60-ZIP candidate pool: fetch Census for each,
 *      score similarity to prototype, take top 5
 *   7. Refine top 5 with live Places competitor-density check, take top 3
 *   8. Compute readiness score from operational signals + named gaps
 *   9. Synthesize a one-paragraph prototype-profile summary via LLM
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
  prototype: PrototypeProfile;
  expansion: ExpansionMarket[];
  readiness: ReadinessScore;
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

export type PrototypeProfile = {
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
  /** One-sentence "why it matches" narrative. */
  why: string;
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

  const business = await extractBusinessInfo(scrape);
  costCents += COST.LLM_BUSINESS_EXTRACT_CENTS;

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
        // Extract ZIP from the formatted address (Google's response includes
        // ZIP within "City, ST 12345, USA" formatting).
        const zipMatch = geo.formattedAddress.match(/\b(\d{5})(?:-\d{4})?\b/);
        if (zipMatch) {
          sourceLocation = {
            zip: zipMatch[1],
            lat: geo.lat,
            lng: geo.lng,
            formattedAddress: geo.formattedAddress,
          };
        }
      }
    } catch {
      // Geocoding failed — fall through. We can still produce useful output
      // without the prototype demographics, just less personalized.
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

  const candidatePool = excludeSourceLocation(
    CANDIDATE_ZIPS,
    sourceLocation?.zip ?? null,
  );

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

  // Step 2: Take top 5 by demographic similarity.
  const top5 = scored
    .filter((s) => s.demographics !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

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
    const overall =
      pillars.demographicsAndMarket +
      pillars.trafficAndAccess +
      pillars.competition +
      pillars.financialAndLegal;
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
      competitorCount: compCount,
    };
  });

  expansion.sort((a, b) => b.score - a.score);
  // Geographic + trade-area diversity: take the top-scoring market, then
  // for #2 prefer a different metro, then for #3 prefer a different metro
  // AND different trade-area type. This stops the snapshot from showing
  // three near-identical urban-core picks when 5 of the candidate pool
  // happen to match. Falls back to raw score order if diversity can't
  // be satisfied.
  const topExpansion = pickDiverseTop3(expansion);

  yield { kind: "phase-done", phase: "expansion", data: topExpansion };

  // ─── Phase 7: Readiness score + named gaps ───────────────────────
  yield {
    kind: "progress",
    phase: "score",
    message: "Building your preliminary readiness score…",
  };

  const readiness = computeReadiness({
    business,
    sourceLocation,
    prototypeDemographics,
    prototypeCompetitorCount,
    expansionScores: topExpansion.map((e) => e.score),
  });

  yield { kind: "phase-done", phase: "score", data: readiness };

  // ─── Phase 8: Prototype-profile summary via LLM ──────────────────
  yield {
    kind: "progress",
    phase: "summary",
    message: "Drafting your prototype profile…",
  };

  const narrative = await synthesizePrototypeNarrative({
    business,
    sourceLocation,
    prototypeDemographics,
    prototypeCompetitorCount,
  });
  costCents += COST.LLM_SUMMARY_CENTS;

  const snapshot: IntakeSnapshot = {
    business,
    prototype: {
      zip: sourceLocation?.zip ?? null,
      narrative,
      demographics: prototypeDemographics,
      competitorCount: prototypeCompetitorCount,
    },
    expansion: topExpansion,
    readiness,
    costCents,
  };

  yield { kind: "complete", snapshot };
}

// ─── Helpers ───────────────────────────────────────────────────────

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
  const d = args.demographics;
  const p = args.prototypeDemographics;
  const parts: string[] = [];

  // Demographic comparison — the strongest "why this market" signal.
  if (d && p) {
    const hhiDelta = ((d.medianHouseholdIncome - p.medianHouseholdIncome) / p.medianHouseholdIncome) * 100;
    if (Math.abs(hhiDelta) < 10) {
      parts.push("household incomes look a lot like your home market");
    } else if (hhiDelta > 0) {
      parts.push(`buying power runs about ${Math.round(hhiDelta)}% higher than your home market`);
    } else {
      parts.push(`income runs about ${Math.abs(Math.round(hhiDelta))}% lower — a more value-conscious crowd`);
    }
  } else if (d) {
    parts.push(
      `median household income of $${Math.round(d.medianHouseholdIncome / 1000)}K`,
    );
  }

  // Competitor narrative — only present when the signal is meaningful.
  // Critically: we never frame a TOP recommendation as "crowded."
  // The scoring algorithm above already downranks saturated markets,
  // so any market that surfaces here with a high competitor count is
  // almost always reaching us through a Places signal-failure path —
  // which the reliability check filters out.
  if (args.competitorSignalReliable) {
    if (args.competitorCount === 0) {
      parts.push("nobody else doing your concept within a mile (open whitespace)");
    } else if (args.competitorCount <= 3) {
      parts.push("very few comparable concepts within a mile — first-mover territory");
    } else if (args.competitorCount <= 8) {
      parts.push("healthy demand signal with room to differentiate");
    } else if (args.competitorCount <= 14) {
      parts.push("established corridor — proven demand, you'll need a sharp angle to win");
    }
    // 15+ scores too low to surface as a top recommendation, so we
    // intentionally don't emit a saturated-narrative line here.
  }

  // Trade-area type — frames the kind of operator who'd succeed.
  const typeLabel: Record<CandidateZip["type"], string> = {
    "urban-core": "dense urban foot traffic",
    "edge-city": "anchor-driven edge-city traffic pattern",
    "inner-suburb": "established inner-suburb residential base",
    "outer-suburb": "fast-growing suburb with strong daytime + evening traffic",
  };
  parts.push(typeLabel[args.candidate.type]);

  return capitalize(parts.join("; ")) + ".";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

function computeReadiness(args: {
  business: BusinessInfo;
  sourceLocation: { zip: string } | null;
  prototypeDemographics: Demographics | null;
  prototypeCompetitorCount: number | null;
  expansionScores: number[];
}): ReadinessScore {
  let score = 0;
  const gaps: string[] = [];

  // Each gap is a full sentence that explains WHY this gap matters and
  // what the customer needs to do about it. Fragments like "Brand name
  // unclear" leave first-time visitors guessing — they don't know yet
  // that an FDD even exists, let alone why it matters.

  // Business signal completeness (40 points)
  if (args.business.name) score += 10;
  else gaps.push(
    "Your brand name isn't framed clearly on your home page. Franchise candidates need a 5-second answer to “what is this business?” before they'll consider opening one.",
  );
  if (args.business.oneLineConcept) score += 10;
  else gaps.push(
    "There's no single reusable description of your concept. You'll write this once and reuse it across your FDD, your operations manual, and every Discovery Day pitch — get it right early.",
  );
  if (args.business.brandVoice) score += 10;
  if (args.business.address || args.sourceLocation) score += 10;
  else gaps.push(
    "We couldn't find your physical address from your website. Your prototype location's traits — its trade area, demographics, foot-traffic pattern — are the foundation for telling future franchisees where their unit should go.",
  );

  // Market signal (30 points)
  if (args.prototypeDemographics) score += 15;
  if (args.prototypeCompetitorCount !== null) score += 15;

  // Expansion-market viability (30 points) — average of top-3 expansion scores, normalized
  if (args.expansionScores.length > 0) {
    const avg =
      args.expansionScores.reduce((a, b) => a + b, 0) / args.expansionScores.length;
    score += Math.round((avg / 100) * 30);
  } else {
    gaps.push(
      "We don't have enough public market data to score expansion viability for your concept yet. A 15-minute call with our team usually closes that gap quickly.",
    );
  }

  // Cap at 100, floor at 0
  score = Math.max(0, Math.min(100, score));

  // Tier suggestion
  let suggestedTier: ReadinessScore["suggestedTier"];
  if (score < 35) suggestedTier = "not-yet";
  else if (score < 55) suggestedTier = "blueprint";
  else if (score < 80) suggestedTier = "navigator";
  else suggestedTier = "builder";

  // Generic gaps used to pad to 3. These are written for first-time
  // visitors who may not know what an FDD or Item 19 is — each one
  // names the artifact AND why it matters.
  if (gaps.length < 3) {
    const generic = [
      "Unit economics aren't yet modeled to FDD Item 19 standard. Item 19 is the financial-performance representation prospective franchisees rely on to project returns; without an audited version, your franchise is harder to sell and easier for attorneys to challenge.",
      "Your day-to-day playbook isn't written down yet. To franchise, the operations that live in your team's heads need to become a 100+ page manual every franchisee can run from — without you in the room.",
      "The Franchise Disclosure Document (FDD) is your legal contract with every franchisee. It's 23 federally mandated items, takes 60–120 days to assemble, and is the single biggest milestone before you can legally sell a franchise.",
      "There's no documented site-selection rubric yet. Your future franchisees will ask “how do I find a location like yours?” — you'll need a written 4-pillar scoring sheet (the same kind we'd build into your FDD Item 11).",
      "Training program isn't built for franchisee onboarding. Without a structured 4–6 week training curriculum, every new franchisee opens slower and inconsistently — the #1 cause of multi-unit-brand failures.",
    ];
    for (const g of generic) {
      if (gaps.length >= 3) break;
      gaps.push(g);
    }
  }

  return { overall: score, gaps: gaps.slice(0, 3), suggestedTier };
}

async function synthesizePrototypeNarrative(args: {
  business: BusinessInfo;
  sourceLocation: { zip: string; formattedAddress: string } | null;
  prototypeDemographics: Demographics | null;
  prototypeCompetitorCount: number | null;
}): Promise<string> {
  if (!args.business.name && !args.business.oneLineConcept) {
    return "We weren't able to extract a clear business profile from your website. Sign up to fill in the details and we'll generate the full prototype profile inside your portal.";
  }

  // If we don't have demographics, return a simpler narrative without an LLM call.
  if (!args.prototypeDemographics) {
    return `${args.business.name ?? "Your business"} reads as ${args.business.oneLineConcept ?? "a service business"}. We weren't able to fully map your trade area from public data — sign up and add your address and we'll complete the analysis inside your portal.`;
  }

  const anthropic = getAnthropic();
  const sys = `You are Jason Stowe, a 30-year franchise development consultant. Write a single short paragraph (3-4 sentences, max 70 words) describing what makes this business's current trade area work — its demographic signature, density, and competitive context. Plain English, conversational, like an experienced operator dictating a memo. No marketing speak, no superlatives, no AI buzzwords.`;

  const d = args.prototypeDemographics;
  const userPrompt = `Business: ${args.business.name ?? "(unknown)"}
Concept: ${args.business.oneLineConcept ?? "(unknown)"}
Brand voice: ${args.business.brandVoice ?? "(unknown)"}
Location: ${args.sourceLocation?.formattedAddress ?? "(unknown)"}
ZIP: ${args.sourceLocation?.zip ?? "(unknown)"}
Median household income: $${d.medianHouseholdIncome.toLocaleString()}
Median age: ${d.medianAge}
Population (5-digit ZIP): ${d.population.toLocaleString()}
Comparable concepts within 1 mile: ${args.prototypeCompetitorCount ?? "(unknown)"}`;

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
    return text.trim() || "Prototype profile pending — sign up to complete the analysis inside your portal.";
  } catch {
    return `${args.business.name ?? "Your business"} sits in a market with median household income of $${d.medianHouseholdIncome.toLocaleString()} and ${args.prototypeCompetitorCount ?? "an unknown number of"} comparable concepts within a 1-mile radius. The full analysis is waiting in your portal once you sign up.`;
  }
}
