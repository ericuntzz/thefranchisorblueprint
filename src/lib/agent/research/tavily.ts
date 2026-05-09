/**
 * Tavily web-search wrapper.
 *
 * Tavily is purpose-built for AI agents — it returns a small array of
 * relevant URLs with titles, AI-extracted excerpts, and (optionally)
 * raw page content. We use it to back the `web_search` tool for the
 * research-heavy sections (market_strategy, competitor_landscape).
 *
 * Env-gated on `TAVILY_API_KEY`. When unset, every call returns
 * { ok: false, reason: "no_api_key" } and the caller falls back to
 * Memory-only drafting. Free tier: 1000 calls/month.
 */

import "server-only";

const TAVILY_URL = "https://api.tavily.com/search";

export type TavilyResult =
  | {
      ok: true;
      query: string;
      answer?: string;
      results: Array<{
        title: string;
        url: string;
        content: string;
        score: number;
      }>;
    }
  | {
      ok: false;
      reason: "no_api_key" | "api_error" | "request_error";
      message?: string;
    };

export async function tavilySearch(args: {
  query: string;
  /** "basic" returns ~5 results; "advanced" returns deeper context. */
  searchDepth?: "basic" | "advanced";
  /** How many results to return. Capped at 10 by the API. */
  maxResults?: number;
  /** Restrict to specific domains. */
  includeDomains?: string[];
  /** Filter out specific domains. */
  excludeDomains?: string[];
}): Promise<TavilyResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "no_api_key" };
  }
  const body = {
    api_key: apiKey,
    query: args.query,
    search_depth: args.searchDepth ?? "basic",
    max_results: Math.min(args.maxResults ?? 5, 10),
    include_answer: true,
    include_domains: args.includeDomains,
    exclude_domains: args.excludeDomains,
  };
  let res: Response;
  try {
    res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "request_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "api_error",
      message: `${res.status}: ${text.slice(0, 300)}`,
    };
  }
  const json = (await res.json()) as {
    query: string;
    answer?: string;
    results?: Array<{
      title: string;
      url: string;
      content: string;
      score: number;
    }>;
  };
  return {
    ok: true,
    query: json.query,
    answer: json.answer,
    results: json.results ?? [],
  };
}

export function isWebSearchAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}
