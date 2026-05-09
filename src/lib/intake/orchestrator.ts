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
            keyword: business.oneLineConcept ?? business.name ?? "restaurant",
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
            keyword: business.oneLineConcept ?? business.name ?? "restaurant",
          }),
        ),
      )
    : [];
  costCents += top5.length * COST.PLACES_NEARBY_CENTS;

  const competitorCounts = compChecks.map((r) =>
    r.status === "fulfilled" && r.value && r.value.ok ? r.value.places.length : 0,
  );

  // Step 4: Final scoring — combine demographic similarity (60%) + saturation (30%) + trade-area type fit (10%).
  const expansion: ExpansionMarket[] = top5.map((s, i) => {
    const compCount = competitorCounts[i];
    const pillars = computePillars({
      candidate: s.candidate,
      demographics: s.demographics,
      similarity: s.similarity,
      competitorCount: compCount,
      prototypeCompetitorCount,
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
      }),
      competitorCount: compCount,
    };
  });

  expansion.sort((a, b) => b.score - a.score);
  const topExpansion = expansion.slice(0, 3);

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
  "zip": "5-digit ZIP or null"
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

function computePillars(args: {
  candidate: CandidateZip;
  demographics: Demographics | null;
  similarity: number;
  competitorCount: number;
  prototypeCompetitorCount: number | null;
}): ExpansionMarket["pillars"] {
  // Demographics & Market (0-25): scaled from similarity.
  const demographicsAndMarket = Math.round((args.similarity / 100) * 25);

  // Traffic & Access (0-25): proxied by trade-area type — urban-core and
  // edge-city tend to score higher on traffic; outer-suburb depends on
  // anchor tenants which we'd need a separate Places call to verify.
  const trafficByType: Record<CandidateZip["type"], number> = {
    "urban-core": 22,
    "edge-city": 23,
    "inner-suburb": 19,
    "outer-suburb": 17,
  };
  const trafficAndAccess = trafficByType[args.candidate.type];

  // Competition (0-25): lower saturation = higher score. Calibrated
  // against the prototype's competitor count (we want comparable, not
  // empty — empty might mean bad concept-market fit).
  const ideal = args.prototypeCompetitorCount ?? 5;
  const delta = Math.abs(args.competitorCount - ideal);
  const competition = Math.max(8, Math.round(25 - delta * 1.5));

  // Financial & Legal (0-25): proxied by HHI (buying power) + state
  // franchise-friendliness. We don't have legal data wired yet, so
  // this is mostly a HHI scaler with a fixed bonus for franchise-
  // friendly states (no FDD registration requirement).
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
}): string {
  const d = args.demographics;
  const p = args.prototypeDemographics;
  const parts: string[] = [];

  if (d && p) {
    const hhiDelta = ((d.medianHouseholdIncome - p.medianHouseholdIncome) / p.medianHouseholdIncome) * 100;
    const hhiPhrase =
      Math.abs(hhiDelta) < 10
        ? "income level closely matches your home market"
        : hhiDelta > 0
          ? `income level runs ${Math.round(hhiDelta)}% higher`
          : `income level runs ${Math.abs(Math.round(hhiDelta))}% lower`;
    parts.push(hhiPhrase);
  }

  if (args.competitorCount === 0) {
    parts.push("no direct competitors within a one-mile trade area");
  } else if (args.competitorCount <= 3) {
    parts.push(`light competitive saturation (${args.competitorCount} comparable concepts within 1 mile)`);
  } else if (args.competitorCount <= 7) {
    parts.push(`healthy density of comparable concepts within 1 mile`);
  } else {
    parts.push(`crowded — ${args.competitorCount} comparable concepts within 1 mile`);
  }

  const typeLabel: Record<CandidateZip["type"], string> = {
    "urban-core": "urban-core foot traffic",
    "edge-city": "edge-city anchor pattern",
    "inner-suburb": "inner-suburb residential density",
    "outer-suburb": "outer-suburb daytime/evening traffic",
  };
  parts.push(typeLabel[args.candidate.type]);

  return capitalize(parts.join("; "));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  // Business signal completeness (40 points)
  if (args.business.name) score += 10;
  else gaps.push("Brand name unclear from website");
  if (args.business.oneLineConcept) score += 10;
  else gaps.push("Concept narrative not yet codified");
  if (args.business.brandVoice) score += 10;
  if (args.business.address || args.sourceLocation) score += 10;
  else gaps.push("No public business address found — limits site selection analysis");

  // Market signal (30 points)
  if (args.prototypeDemographics) score += 15;
  if (args.prototypeCompetitorCount !== null) score += 15;

  // Expansion-market viability (30 points) — average of top-3 expansion scores, normalized
  if (args.expansionScores.length > 0) {
    const avg =
      args.expansionScores.reduce((a, b) => a + b, 0) / args.expansionScores.length;
    score += Math.round((avg / 100) * 30);
  } else {
    gaps.push("Insufficient market data to score expansion viability");
  }

  // Cap at 100, floor at 0
  score = Math.max(0, Math.min(100, score));

  // Tier suggestion
  let suggestedTier: ReadinessScore["suggestedTier"];
  if (score < 35) suggestedTier = "not-yet";
  else if (score < 55) suggestedTier = "blueprint";
  else if (score < 80) suggestedTier = "navigator";
  else suggestedTier = "builder";

  // Always surface 3 gaps minimum so the user sees something to act on.
  // Pad with generic gaps if our checks didn't produce enough.
  if (gaps.length < 3) {
    const generic = [
      "Unit economics not yet modeled to FDD Item 19 standard",
      "Operations manual not yet codified for replication",
      "FDD draft not yet started",
      "Site-selection rubric not yet documented",
      "Training program not yet built for franchisee onboarding",
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
