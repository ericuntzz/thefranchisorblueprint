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
   * later the existing-footprint exclusion in candidate selection
   * (Tranche 4).
   */
  locationCount: number | null;
};

const NEUTRAL_SIGNAL: ExistingFranchisorSignal = {
  isFranchising: false,
  signalType: "none",
  evidence: [],
  locationCount: null,
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
  // We deliberately include any /franchise* or /investor* sub-pages the
  // scraper picked up — those are where franchise-recruitment copy
  // lives on most existing-franchisor sites.
  const haystack = [
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

  const sys = `You analyze business websites and detect whether the company is ALREADY operating as a franchisor (selling franchises to other operators).

Respond with strict JSON only — no commentary, no markdown fences. Schema:
{
  "isFranchising": boolean,
  "signalType": "active-franchise-sales" | "multi-unit-mature" | "none",
  "evidence": [string, ...],   // up to 4 short evidence strings, each ≤ 100 chars
  "locationCount": number | null
}

Rules:
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

If the input is too sparse to judge, default to {"isFranchising": false, "signalType": "none", "evidence": [], "locationCount": null}.`;

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

    // Defensive: if the LLM said isFranchising=true but emitted no
    // evidence, downgrade to false. Prevents hallucinated positives.
    if (isFranchising && evidence.length === 0) {
      return NEUTRAL_SIGNAL;
    }

    return { isFranchising, signalType, evidence, locationCount };
  } catch (err) {
    console.error("[intake] detectFranchiseSignals failed:", err);
    return NEUTRAL_SIGNAL;
  }
}
