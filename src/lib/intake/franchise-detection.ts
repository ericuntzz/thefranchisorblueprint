import "server-only";

import { CACHE_5M, CHAT_MODEL, getAnthropic } from "@/lib/agent/anthropic";
import type { ScrapeArtifacts } from "@/lib/agent/scrape";

/**
 * Signal that the URL we just scraped belongs to a business that is
 * ALREADY franchising. Eric flagged 2026-05-10: when costavida.com
 * (94 locations, mature franchise) ran through the readiness pipeline
 * it scored 53/100 — which is meaningless for a brand that's already
 * completed the journey. The whole "are you ready to franchise?"
 * funnel doesn't apply.
 *
 * This module runs a cheap LLM pass over the scrape looking for
 * franchise-development indicators. The orchestrator uses the result
 * to (a) skip the readiness number entirely and (b) pivot the
 * recommended-tier copy from "you'd benefit from coaching" to
 * "you're already franchising — let's talk portfolio strategy."
 */
export type ExistingFranchisorSignal = {
  /**
   * True when ANY of the indicators below fired. The flag is binary
   * because the UX impact is binary: existing-franchisor branch or
   * the standard readiness branch.
   */
  isFranchising: boolean;
  /**
   * Categorize what flavor of existing franchisor we're looking at —
   * affects the recommended-next-step copy:
   *
   *   active-franchise-sales — site has explicit franchise-recruitment
   *     content ("franchise with us," "Apply now," "Item 19," etc).
   *     They're actively marketing to prospective franchisees.
   *
   *   multi-unit-mature — no explicit franchise-sales content, but
   *     the site references many locations (5+) suggesting they're
   *     running a multi-unit / franchise system already even if it
   *     isn't the website's lead message.
   *
   *   none — no signal. Treat as a candidate franchisor.
   */
  signalType: "active-franchise-sales" | "multi-unit-mature" | "none";
  /**
   * Short list of strings the LLM extracted as evidence. Useful for
   * (a) debug, (b) future "why did we say this?" UI affordance, and
   * (c) the gap-generation prompt downstream.
   */
  evidence: string[];
  /**
   * Approximate location count if mentioned anywhere on the site.
   * Drives the existing-franchisor copy ("with 94 locations…"), and
   * the existing-footprint exclusion in candidate selection.
   */
  locationCount: number | null;
  /**
   * Free-form list of metros / cities the customer's website mentions
   * as places they already operate. Used by the candidate-pool
   * filter — if "Salt Lake City" or "Denver" shows up here, those
   * metros get dropped from the expansion-candidate set so we don't
   * recommend a market they already saturate.
   *
   * Empty array if the site doesn't enumerate locations (e.g. a
   * single-location coffee shop or a sparse-website edge case).
   */
  existingMetros: string[];
  /**
   * Free-form list of US state codes (2-letter) the customer mentions
   * operating in. Coarser than existingMetros but useful when the
   * locations page only says "Available in UT, NV, AZ, CO" without
   * naming individual cities. Empty array if not derivable.
   */
  existingStates: string[];
};

const NEUTRAL_SIGNAL: ExistingFranchisorSignal = {
  isFranchising: false,
  signalType: "none",
  evidence: [],
  locationCount: null,
  existingMetros: [],
  existingStates: [],
};

/**
 * Single-call LLM pass that classifies whether this URL belongs to an
 * existing franchisor and pulls cheap evidence. Returns a NEUTRAL
 * signal on any error — we'd rather miss the existing-franchisor
 * branch on a flaky LLM call than block the whole pipeline.
 */
export async function detectFranchiseSignals(
  scrape: ScrapeArtifacts,
): Promise<ExistingFranchisorSignal> {
  // Build the LLM context from the most signal-rich parts of the scrape.
  // The locationsText page (when found) is the strongest signal for
  // existingMetros/existingStates — chains list every city or state
  // they're in, often with a clickable map. We include it FIRST so it
  // doesn't get truncated by the LLM's attention budget on the home
  // page boilerplate.
  const haystack = [
    scrape.locationsText ? `LOCATIONS PAGE:\n${scrape.locationsText}` : "",
    scrape.title ?? "",
    scrape.metaDescription ?? "",
    scrape.aboutText ?? "",
    scrape.homeText.slice(0, 5000),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (haystack.trim().length < 50) {
    // Not enough signal to call. Stay neutral.
    return NEUTRAL_SIGNAL;
  }

  const sys = `You analyze business websites and detect (a) whether the company is ALREADY operating as a franchisor selling franchises, and (b) which US metros/states they already operate in. The geographic footprint is used downstream to avoid recommending markets they already saturate.

Respond with strict JSON only — no commentary, no markdown fences. Schema:
{
  "isFranchising": boolean,
  "signalType": "active-franchise-sales" | "multi-unit-mature" | "none",
  "evidence": [string, ...],   // up to 4 short evidence strings, each ≤ 100 chars
  "locationCount": number | null,
  "existingMetros": [string, ...],  // up to 30 US metros/cities they operate in
  "existingStates": [string, ...]   // up to 25 US 2-letter state codes they operate in
}

Rules for isFranchising:
- isFranchising = true if you see ANY of:
    * Direct franchise-recruitment language: "franchise with us", "franchising info", "become a franchisee", "franchise opportunity", "apply to franchise"
    * Regulatory artifacts only an existing franchisor would publish: "Item 19", "FDD", "FTC franchise rule", "franchise disclosure document"
    * Operating-economics signals: "royalty rate", "initial franchise fee", "territory rights", "protected territory"
    * Multi-unit references at scale: "150+ locations", "over 100 locations", "100+ stores", "stores nationwide", "franchisees nationwide"
    * Date-anchored franchise history: "franchising since 2008", "started franchising in 2010"
- signalType = "active-franchise-sales" when explicit franchise-recruitment copy is present.
- signalType = "multi-unit-mature" when location count is large (5+) but no explicit recruitment copy is visible.
- signalType = "none" when neither.
- evidence must be SHORT verbatim phrases or paraphrases from the input — don't fabricate.
- locationCount: extract any explicit number ("94 locations", "150 stores"). Null if not mentioned.

Rules for existingMetros / existingStates:
- existingMetros: list every distinct US metro or city name the input mentions as a place where this business operates a location. Use the metro name, not the neighborhood ("Salt Lake City" not "Sugar House"). Deduplicate. Skip a city if it's clearly just a customer story / press mention, not a location.
- existingStates: list every distinct US state where the business operates, as 2-letter postal codes (UT, CO, AZ). If the locations page lists states explicitly ("Available in: UT, NV, AZ"), use those. If only cities are listed, infer states from city → state mapping where obvious.
- Both lists empty if you can't determine geographic footprint with confidence.
- DO NOT include international locations (Mexico, Canada, etc) — US only.
- DO NOT fabricate locations; if the page doesn't mention specific cities/states, return empty arrays.

If the input is too sparse to judge, default to {"isFranchising": false, "signalType": "none", "evidence": [], "locationCount": null, "existingMetros": [], "existingStates": []}.`;

  const userPrompt = `Analyze this website content and emit the JSON described above.

---
${haystack}
---`;

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      system: [{ type: "text", text: sys, cache_control: CACHE_5M }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n") ?? "";

    // The model occasionally wraps in ```json fences despite the
    // explicit instruction. Strip a fenced JSON block if present
    // before falling back to a greedy { ... } match.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced?.[1]?.trim() ?? text.match(/\{[\s\S]*\}/)?.[0] ?? "";
    if (!candidate) return NEUTRAL_SIGNAL;

    const parsed = JSON.parse(candidate) as Partial<ExistingFranchisorSignal>;
    const isFranchising = parsed.isFranchising === true;
    const signalType: ExistingFranchisorSignal["signalType"] =
      parsed.signalType === "active-franchise-sales" ||
      parsed.signalType === "multi-unit-mature"
        ? parsed.signalType
        : isFranchising
          ? "active-franchise-sales"
          : "none";
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence
          .filter((e): e is string => typeof e === "string" && e.length <= 200)
          .slice(0, 4)
      : [];
    const rawCount = parsed.locationCount;
    const locationCount =
      typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
        ? Math.round(rawCount)
        : null;
    const existingMetros = Array.isArray(parsed.existingMetros)
      ? parsed.existingMetros
          .filter(
            (m): m is string =>
              typeof m === "string" && m.length > 1 && m.length <= 60,
          )
          .map((m) => m.trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];
    const existingStates = Array.isArray(parsed.existingStates)
      ? parsed.existingStates
          .filter(
            (s): s is string =>
              typeof s === "string" && /^[A-Za-z]{2}$/.test(s.trim()),
          )
          .map((s) => s.trim().toUpperCase())
          .slice(0, 25)
      : [];

    // Defensive: if the LLM said isFranchising=true but emitted no
    // evidence, downgrade to false. Prevents hallucinated positives.
    // BUT — keep existingMetros/States even if isFranchising flips
    // back to false; a 3-location operator who isn't actively
    // franchising still benefits from us not recommending those 3
    // metros as expansion picks.
    if (isFranchising && evidence.length === 0) {
      return {
        ...NEUTRAL_SIGNAL,
        existingMetros,
        existingStates,
        locationCount,
      };
    }

    return {
      isFranchising,
      signalType,
      evidence,
      locationCount,
      existingMetros,
      existingStates,
    };
  } catch (err) {
    console.error("[intake] detectFranchiseSignals failed:", err);
    return NEUTRAL_SIGNAL;
  }
}
