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
    readiness,
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
}): Promise<string[]> {
  const anthropic = getAnthropic();

  const sysPrompt = `You are Jason Stowe, a 30-year franchise development consultant doing a quick pre-screen of a business's public web presence. Your job: write three short observations (each 1-3 sentences, 30-60 words) that a franchise candidate would find genuinely useful — things you can SEE from their website that bear on their franchise readiness, plus a concrete next step.

CRITICAL CONSTRAINTS — read carefully:
- Reference what's ACTUALLY visible on their site: their menu, services, pricing, founding story, brand voice, locations count, review presence, About page content, etc.
- Do NOT prescribe specific franchise-development artifacts (FDD, Item 19, Operations Manual, training program, site-selection rubric) — we have no way to know if they have those things yet.
- Do NOT say "isn't yet codified" or "isn't yet built" or any prescriptive checklist language.
- Do say things like "We notice your home page leads with X — that's a strong/weak Y signal because Z."
- Use plain English. No franchise jargon unless the customer is clearly already a multi-unit operator.
- Each observation should feel like an experienced operator skimmed the site and noticed something specific. Not an AI templating itself into existence.

Return JSON only:
{
  "gaps": [
    "first observation (30-60 words)",
    "second observation (30-60 words)",
    "third observation (30-60 words)"
  ]
}`;

  const userPrompt = `Business: ${args.business.name ?? "(unknown)"}
Concept (LLM-extracted): ${args.business.oneLineConcept ?? "(unknown)"}
Brand voice: ${args.business.brandVoice ?? "(unknown)"}
Location: ${args.sourceLocation?.formattedAddress ?? "(unknown)"}

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
