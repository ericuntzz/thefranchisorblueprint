/**
 * Website pre-fill service.
 *
 * Given a customer's website URL, fetch their home page (and About page if
 * we can find it), extract brand metadata via Cheerio, then ask Claude
 * Sonnet 4.6 to summarize the brand voice, mission, and concept narrative
 * in Jason's prose style.
 *
 * Output goes straight into customer_memory under `business_overview` and
 * `brand_voice`, marked as confidence="inferred" with provenance pointing
 * back to the scraped pages. The customer can verify, edit, or reject in
 * the Blueprint canvas.
 */

import "server-only";
import * as cheerio from "cheerio";
import {
  CACHE_5M,
  CHAT_MODEL,
  EFFORT_FOR_CHAT,
  getAnthropic,
} from "./anthropic";
import {
  upsertMemoryWithProvenance,
  writeMemoryFields,
} from "@/lib/memory";
import { extractFieldsFromContent } from "./extract-fields";

/**
 * Lightweight, polite fetch with a sensible UA, a timeout, and a body
 * cap. We don't render JavaScript — most marketing sites have enough
 * static HTML in the initial response that Cheerio can do useful work.
 * SPA-only sites would need Playwright; that's a Phase 3 upgrade.
 */
async function politeFetch(url: string, timeoutMs = 12_000): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Identify the bot honestly so site owners can block if they want.
        // Header values are ByteString (Latin-1 only) — no smart quotes or
        // em-dashes here, or fetch() throws "cannot convert to ByteString".
        "User-Agent":
          "TheFranchisorBlueprintBot/1.0 (+https://thefranchisorblueprint.com - agentic-portal pre-fill)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      throw new Error(`Expected HTML, got ${ct} from ${url}`);
    }
    // 1 MB cap — enough for nearly every marketing page; protects us from
    // a customer pointing us at a 200 MB PDF gallery or video CDN.
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 1_000_000) {
      throw new Error(
        `Response too large (${buf.byteLength} bytes) for ${url}`,
      );
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

export type ScrapeArtifacts = {
  /** Origin we ended up on, after redirects. */
  resolvedOrigin: string;
  /** Raw text content of the home page, lightly cleaned. */
  homeText: string;
  /** Raw text content of the about page if found, else null. */
  aboutText: string | null;
  /** Site title from <title> on the home page. */
  title: string | null;
  /** Meta description from the home page. */
  metaDescription: string | null;
  /** OG image URL on the home page (logo / hero) — we surface this for the brand chapter. */
  ogImage: string | null;
  /** First N words of visible body text from the home page. */
  homeExcerpt: string;
};

/**
 * Pull the artifacts we need for the brand-voice summary. Parsing-only;
 * no LLM calls. Separate from the synthesis step so it can be tested
 * deterministically.
 */
export async function fetchSiteArtifacts(
  rawUrl: string,
): Promise<ScrapeArtifacts> {
  // Normalize: tolerate `domain.com` and `www.domain.com/`. URL throws
  // on bad input, which we catch upstream.
  const homeUrl = new URL(
    /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
  );
  const html = await politeFetch(homeUrl.toString());
  const $ = cheerio.load(html);

  // Strip noise so the LLM sees signal, not nav menus.
  $("script, style, noscript, svg, header nav, footer, [aria-hidden=true]").remove();

  const title = $("head > title").text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const ogImageRaw =
    $('meta[property="og:image"]').attr("content")?.trim() ||
    $('link[rel="apple-touch-icon"]').attr("href")?.trim() ||
    null;
  const ogImage = ogImageRaw
    ? safeAbsoluteUrl(ogImageRaw, homeUrl.toString())
    : null;

  // Visible body text — squashed whitespace, trimmed to 8K chars (well
  // inside Sonnet 4.6's appetite for this kind of input).
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const homeText = bodyText.slice(0, 8_000);
  const homeExcerpt = bodyText.slice(0, 1_500);

  // Look for an About page via common URL conventions and link text.
  // We try paths first (cheapest — single fetch attempt) then anchor
  // text scanning as a fallback.
  let aboutText: string | null = null;
  for (const candidate of ["/about", "/about-us", "/our-story", "/story"]) {
    try {
      const aboutUrl = new URL(candidate, homeUrl.origin).toString();
      const aboutHtml = await politeFetch(aboutUrl, 8_000);
      const $$ = cheerio.load(aboutHtml);
      $$("script, style, noscript, svg, header nav, footer").remove();
      aboutText = $$("body").text().replace(/\s+/g, " ").trim().slice(0, 8_000);
      break;
    } catch {
      // Try next candidate.
    }
  }
  if (!aboutText) {
    // Anchor-text fallback: any <a> whose visible text contains "about".
    const aboutLink = $("a")
      .filter((_, el) => {
        const txt = $(el).text().trim().toLowerCase();
        return txt === "about" || txt === "about us" || txt === "our story";
      })
      .first();
    const href = aboutLink.attr("href");
    if (href) {
      try {
        const aboutUrl = safeAbsoluteUrl(href, homeUrl.toString());
        if (aboutUrl) {
          const aboutHtml = await politeFetch(aboutUrl, 8_000);
          const $$ = cheerio.load(aboutHtml);
          $$("script, style, noscript, svg, header nav, footer").remove();
          aboutText = $$("body").text().replace(/\s+/g, " ").trim().slice(0, 8_000);
        }
      } catch {
        // give up gracefully — we'll work from home page alone
      }
    }
  }

  return {
    resolvedOrigin: homeUrl.origin,
    homeText,
    aboutText,
    title,
    metaDescription,
    ogImage,
    homeExcerpt,
  };
}

function safeAbsoluteUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/**
 * Belt-and-suspenders cleanup for the synthesis output. The prompt
 * already forbids section labels, but if the model echoes one anyway
 * we strip it here. Targets common "### Section 1: ...", "**FIRST body**",
 * "Section 2 (markdown):", "Brand Voice:", and similar lead-ins on the
 * first non-empty line.
 */
function stripScaffolding(body: string): string {
  let trimmed = body.trim();
  // Repeat a couple of passes to catch e.g. heading + label combos.
  for (let i = 0; i < 3; i++) {
    const before = trimmed;
    trimmed = trimmed
      .replace(/^#{1,6}\s*(section\s*\d+|first body|second body|brand voice|brand standards|business overview|concept (?:&|and) story)\b[^\n]*\n+/i, "")
      .replace(/^\*{0,2}\s*(section\s*\d+|first body|second body|brand voice|brand standards|business overview|concept (?:&|and) story)\b[^\n]*\*{0,2}\s*\n+/i, "")
      .trim();
    if (trimmed === before) break;
  }
  return trimmed;
}

export type ScrapeWriteResult = {
  artifacts: ScrapeArtifacts;
  brandVoiceSummary: string;
  businessOverviewSummary: string;
};

/**
 * End-to-end: scrape the site, summarize via Sonnet 4.6, and write the
 * results into customer_memory under `brand_voice` and `business_overview`
 * with provenance pointing back to the scraped pages.
 *
 * Returns the artifacts + summaries so the caller can render a status
 * card or store them for debugging.
 */
export async function scrapeAndIngestWebsite(args: {
  userId: string;
  websiteUrl: string;
}): Promise<ScrapeWriteResult> {
  const artifacts = await fetchSiteArtifacts(args.websiteUrl);

  const client = getAnthropic();
  // Strict output contract: two markdown bodies separated by a `---` line.
  // No section headers, no preamble, no closing notes — the parser
  // splits on the separator and stores each body as-is. Echoing section
  // headers leaks the prompt scaffolding into the customer's Blueprint.
  const synthesisPrompt = `You are extracting brand and concept information from a customer's website to seed their Franchisor Blueprint. Be faithful to what the site actually says — do not invent details. If a field can't be confidently derived, write "—" for that field.

The customer's site:
- URL: ${artifacts.resolvedOrigin}
- <title>: ${artifacts.title ?? "(none)"}
- <meta description>: ${artifacts.metaDescription ?? "(none)"}
- OG image: ${artifacts.ogImage ?? "(none)"}

Home page text (truncated):
${artifacts.homeText}

${artifacts.aboutText ? `About page text (truncated):\n${artifacts.aboutText}` : "(No About page found.)"}

You must output exactly TWO markdown bodies, separated by a single line containing only three hyphens (\`---\`).

FIRST body — a polished one-page Brand Standards draft covering: brand name, mission/positioning summary in 1-2 sentences, voice/tone description (3-5 adjectives + a sentence describing how they speak), an inferred color/type vibe if discernible from copy, and any tagline/slogan visible on the site. Keep it tight — this is a starting point for the customer to verify, not the final manual.

SECOND body — a 2-3 paragraph Concept & Story draft for FDD Item 1 / Operations Manual §1: what the business does, who it's for, when/how it started if mentioned, and what makes it distinctive. First-person from the franchisor's perspective is fine if the site uses that voice; otherwise write in third person. Use the customer's actual wording where possible.

CRITICAL OUTPUT RULES:
- Start the first body directly with markdown content (e.g. \`## Brand Standards\` or just a paragraph). DO NOT prefix with "Section 1", "FIRST body", "Brand voice:", or any other label.
- Same for the second body — start directly with content, no "Section 2" label.
- Use \`\\n---\\n\` as the ONLY separator. Do not put it inside either body.
- No preamble before the first body, no commentary after the second.`;

  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT_FOR_CHAT },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: synthesisPrompt,
            cache_control: CACHE_5M,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Split on a standalone --- line (with optional surrounding whitespace).
  // If the model misbehaves and doesn't include one, fall back to
  // "everything goes into brand_voice and business_overview is empty".
  const parts = text.split(/\n\s*---\s*\n/);
  const brandVoiceSummary = stripScaffolding(parts[0] ?? "");
  const businessOverviewSummary = stripScaffolding(parts[1] ?? "");

  // Provenance: every scraped chapter ties back to either the home or
  // about page, with the source_excerpt being the snippet we showed the
  // model. This is what the on-hover UI will surface.
  const homeProvenance = {
    claimId: "site-home",
    sourceType: "scraper" as const,
    sourceRef: artifacts.resolvedOrigin,
    sourceExcerpt: artifacts.homeExcerpt.slice(0, 500),
  };
  const aboutProvenance = artifacts.aboutText
    ? [
        {
          claimId: "site-about",
          sourceType: "scraper" as const,
          sourceRef: `${artifacts.resolvedOrigin}/about`,
          sourceExcerpt: artifacts.aboutText.slice(0, 500),
        },
      ]
    : [];

  // Combined source material — both extraction calls below benefit
  // from seeing the synthesized summaries AND the raw scrape so they
  // can pull facts from either.
  const sourceMaterial = [
    businessOverviewSummary,
    brandVoiceSummary,
    artifacts.title ? `Site title: ${artifacts.title}` : "",
    artifacts.metaDescription
      ? `Meta description: ${artifacts.metaDescription}`
      : "",
    `Home page text:\n${artifacts.homeText}`,
    artifacts.aboutText ? `About page text:\n${artifacts.aboutText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (brandVoiceSummary) {
    await upsertMemoryWithProvenance({
      userId: args.userId,
      slug: "brand_voice",
      contentMd:
        `<!-- claim:site-home -->\n${brandVoiceSummary}\n\n` +
        (artifacts.ogImage
          ? `\n_Logo / hero image detected:_ ${artifacts.ogImage}\n`
          : ""),
      confidence: "inferred",
      lastUpdatedBy: "scraper",
      provenance: [homeProvenance, ...aboutProvenance],
    });

    // Extract brand_voice structured fields from the synthesized
    // brand voice summary. brand_name / tagline / voice_adjectives /
    // voice_description / typography_pairing / things_to_avoid all
    // pull from prose Claude already wrote. brand_colors usually
    // aren't extractable from prose alone — leave for the customer
    // to fill in. Eric's feedback: brand questions shouldn't appear
    // when a website is set; this fix auto-fills as much as
    // possible from the scrape so the queue surfaces only the gaps.
    try {
      const extractedBV = await extractFieldsFromContent({
        slug: "brand_voice",
        content: brandVoiceSummary,
        contextNotes: sourceMaterial,
      });
      if (Object.keys(extractedBV).length > 0) {
        await writeMemoryFields({
          userId: args.userId,
          slug: "brand_voice",
          changes: extractedBV,
          source: "scraper",
        });
      }
    } catch (err) {
      console.error(
        "[scrape] brand_voice field extraction failed (non-fatal):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (businessOverviewSummary) {
    await upsertMemoryWithProvenance({
      userId: args.userId,
      slug: "business_overview",
      contentMd: `<!-- claim:site-home -->\n${businessOverviewSummary}`,
      confidence: "inferred",
      lastUpdatedBy: "scraper",
      provenance: [homeProvenance, ...aboutProvenance],
    });

    // Extract business_overview structured fields. Reuses the
    // sourceMaterial composed above so both extraction passes see
    // the same scrape context. Best-effort: if extraction fails the
    // prose still ships.
    try {
      const extracted = await extractFieldsFromContent({
        slug: "business_overview",
        content: businessOverviewSummary,
        contextNotes: sourceMaterial,
      });
      if (Object.keys(extracted).length > 0) {
        await writeMemoryFields({
          userId: args.userId,
          slug: "business_overview",
          changes: extracted,
          source: "scraper",
        });
      }
    } catch (err) {
      // Field extraction is best-effort. Log and move on so the prose
      // (which is the customer-visible artifact) still lands.
      console.error(
        "[scrape] business_overview field extraction failed (non-fatal):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { artifacts, brandVoiceSummary, businessOverviewSummary };
}
