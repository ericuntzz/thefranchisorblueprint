/**
 * Pre-draft research helper.
 *
 * Some sections (market_strategy, competitor_landscape) draft much
 * better with live external data than with Memory alone. Before the
 * draft pipeline calls Opus, this helper gathers a small bundle of
 * external context using the env-gated research wrappers (Tavily,
 * Google Places, Census) and returns a markdown block the draft
 * pipeline can splice into Opus's prompt.
 *
 * Every call is best-effort: missing API keys return null context
 * (the draft proceeds with Memory only), and any single sub-call
 * failing doesn't fail the whole bundle.
 *
 * The output is a single markdown string the caller wraps in
 * `<research>...</research>` and includes alongside the customer
 * Memory snapshot. Opus is told to cite research-derived claims
 * with `source_type: "research"` and `source_ref` pointing at the
 * tool used.
 */

import "server-only";
import type { MemoryFileSlug } from "@/lib/memory/files";
import {
  isWebSearchAvailable,
  tavilySearch,
} from "./tavily";
import {
  isPlacesAvailable,
  nearbyPlaces,
} from "./places";
import {
  isCensusAvailable,
  zipDemographics,
} from "./census";

export type SectionResearch = {
  /** Markdown block ready to splice into the prompt. Empty string if
   *  no research sources were available. */
  markdown: string;
  /** Tools that actually returned data — used by the draft pipeline
   *  to attach provenance hints in the post-draft step. */
  sourcesUsed: Array<"tavily" | "places" | "census">;
};

const MAX_TAVILY_RESULTS = 5;
const MAX_PLACES_RESULTS = 8;

/**
 * Run pre-draft research for a section that benefits from external
 * data. Returns a markdown block (possibly empty) summarizing what
 * we found.
 *
 * `seedFields` is the structured-fields blob from the relevant sections
 * — used to extract competitor names, location addresses, ZIP codes,
 * etc. The helper has minimal logic: it doesn't try to be clever
 * about which research to do, just runs the obvious queries for each
 * supported section.
 */
export async function performSectionResearch(args: {
  slug: MemoryFileSlug;
  /** Memory fields for the relevant source sections, indexed by slug. */
  fieldsBySlug: Partial<Record<MemoryFileSlug, Record<string, unknown>>>;
}): Promise<SectionResearch> {
  const { slug, fieldsBySlug } = args;

  if (slug === "market_strategy") {
    return researchMarketStrategy(fieldsBySlug);
  }
  if (slug === "competitor_landscape") {
    return researchCompetitorLandscape(fieldsBySlug);
  }
  if (slug === "territory_real_estate") {
    return researchTerritoryRealEstate(fieldsBySlug);
  }
  return { markdown: "", sourcesUsed: [] };
}

async function researchMarketStrategy(
  fieldsBySlug: Partial<Record<MemoryFileSlug, Record<string, unknown>>>,
): Promise<SectionResearch> {
  const overview = fieldsBySlug.business_overview ?? {};
  const competitors = fieldsBySlug.competitor_landscape ?? {};
  const lines: string[] = [];
  const sourcesUsed: SectionResearch["sourcesUsed"] = [];

  // Industry-trends search via Tavily.
  if (isWebSearchAvailable()) {
    const industry = stringField(overview.industry_category);
    const concept = stringField(overview.concept_summary);
    const query = industry
      ? `${industry} franchise industry trends 2026 growth outlook`
      : concept
        ? `${concept.split(/[.\n]/)[0]} franchise industry trends 2026`
        : "";
    if (query) {
      const result = await tavilySearch({
        query,
        searchDepth: "basic",
        maxResults: MAX_TAVILY_RESULTS,
      });
      if (result.ok && result.results.length > 0) {
        sourcesUsed.push("tavily");
        lines.push(`### Industry trends (Tavily web search — query: "${query}")`);
        if (result.answer) {
          lines.push(`**Synthesized answer:** ${result.answer}`);
        }
        for (const r of result.results.slice(0, 4)) {
          lines.push(`- **${r.title}** (${r.url}): ${r.content.slice(0, 280)}`);
        }
        lines.push("");
      }
    }
  }

  // Direct competitor research.
  if (isWebSearchAvailable()) {
    const direct = listField(competitors.direct_competitors);
    if (direct.length > 0) {
      const top = direct.slice(0, 3);
      lines.push(`### Direct competitor research`);
      for (const name of top) {
        const result = await tavilySearch({
          query: `${name} franchise model unit economics royalty`,
          searchDepth: "basic",
          maxResults: 3,
        });
        if (result.ok && result.results.length > 0) {
          if (!sourcesUsed.includes("tavily")) sourcesUsed.push("tavily");
          lines.push(`**${name}:**`);
          for (const r of result.results.slice(0, 2)) {
            lines.push(`  - ${r.title} (${r.url}): ${r.content.slice(0, 220)}`);
          }
        }
      }
      lines.push("");
    }
  }

  return {
    markdown: lines.join("\n"),
    sourcesUsed,
  };
}

async function researchCompetitorLandscape(
  fieldsBySlug: Partial<Record<MemoryFileSlug, Record<string, unknown>>>,
): Promise<SectionResearch> {
  const overview = fieldsBySlug.business_overview ?? {};
  const competitors = fieldsBySlug.competitor_landscape ?? {};
  const lines: string[] = [];
  const sourcesUsed: SectionResearch["sourcesUsed"] = [];

  // Trade-area density of direct competitors via Google Places, anchored
  // on the customer's first-location address.
  if (isPlacesAvailable()) {
    const firstAddress = stringField(overview.first_location_address);
    const direct = listField(competitors.direct_competitors);
    if (firstAddress && direct.length > 0) {
      lines.push(`### Trade-area competitor density (Google Places — center: ${firstAddress})`);
      for (const name of direct.slice(0, 3)) {
        const result = await nearbyPlaces({
          keyword: name,
          centerAddress: firstAddress,
          radiusMeters: 5000,
        });
        if (result.ok) {
          if (!sourcesUsed.includes("places")) sourcesUsed.push("places");
          lines.push(
            `**${name}** within 5km: ${result.places.length} location${result.places.length === 1 ? "" : "s"}`,
          );
          for (const p of result.places.slice(0, MAX_PLACES_RESULTS)) {
            const rating = p.rating
              ? ` (${p.rating}★, ${p.userRatingsTotal ?? 0} reviews)`
              : "";
            lines.push(`  - ${p.name} — ${p.address}${rating}`);
          }
        }
      }
      lines.push("");
    }
  }

  // Web-search any indirect competitor names for positioning context.
  if (isWebSearchAvailable()) {
    const indirect = listField(competitors.indirect_competitors);
    if (indirect.length > 0) {
      const top = indirect.slice(0, 2);
      lines.push(`### Indirect competitor positioning research`);
      for (const name of top) {
        const result = await tavilySearch({
          query: `${name} target audience positioning`,
          searchDepth: "basic",
          maxResults: 2,
        });
        if (result.ok && result.results.length > 0) {
          if (!sourcesUsed.includes("tavily")) sourcesUsed.push("tavily");
          lines.push(`**${name}:**`);
          for (const r of result.results.slice(0, 1)) {
            lines.push(`  - ${r.title} (${r.url}): ${r.content.slice(0, 220)}`);
          }
        }
      }
      lines.push("");
    }
  }

  return {
    markdown: lines.join("\n"),
    sourcesUsed,
  };
}

async function researchTerritoryRealEstate(
  fieldsBySlug: Partial<Record<MemoryFileSlug, Record<string, unknown>>>,
): Promise<SectionResearch> {
  const overview = fieldsBySlug.business_overview ?? {};
  const territory = fieldsBySlug.territory_real_estate ?? {};
  const lines: string[] = [];
  const sourcesUsed: SectionResearch["sourcesUsed"] = [];

  // Demographics for priority markets via Census (if any are ZIPs).
  if (isCensusAvailable()) {
    const priority = listField(territory.priority_geographic_markets);
    const zips = priority
      .map((s) => /\d{5}/.exec(s)?.[0])
      .filter((z): z is string => !!z);
    if (zips.length > 0) {
      lines.push(`### Priority-market demographics (Census ACS)`);
      for (const zip of zips.slice(0, 5)) {
        const result = await zipDemographics(zip);
        if (result.ok) {
          if (!sourcesUsed.includes("census")) sourcesUsed.push("census");
          const pop = result.population != null ? result.population.toLocaleString() : "—";
          const inc =
            result.medianHouseholdIncome != null
              ? `$${result.medianHouseholdIncome.toLocaleString()}`
              : "—";
          const age = result.medianAge != null ? `${result.medianAge.toFixed(1)} yrs` : "—";
          lines.push(`- **${zip}**: pop ${pop} · median HH income ${inc} · median age ${age}`);
        }
      }
      lines.push("");
    }
  }

  // First-location demographics via Census (extract ZIP from the address string).
  if (isCensusAvailable()) {
    const firstAddress = stringField(overview.first_location_address);
    const zip = firstAddress ? /\b\d{5}\b/.exec(firstAddress)?.[0] : null;
    if (zip) {
      const result = await zipDemographics(zip);
      if (result.ok) {
        if (!sourcesUsed.includes("census")) sourcesUsed.push("census");
        lines.push(`### Home-market demographics (ZIP ${zip}, Census ACS ${result.year})`);
        const pop = result.population != null ? result.population.toLocaleString() : "—";
        const inc =
          result.medianHouseholdIncome != null
            ? `$${result.medianHouseholdIncome.toLocaleString()}`
            : "—";
        const age = result.medianAge != null ? `${result.medianAge.toFixed(1)} yrs` : "—";
        lines.push(`- Population: ${pop}`);
        lines.push(`- Median household income: ${inc}`);
        lines.push(`- Median age: ${age}`);
        lines.push("");
      }
    }
  }

  return {
    markdown: lines.join("\n"),
    sourcesUsed,
  };
}

function stringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function listField(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((s) => s.trim());
  }
  return [];
}
