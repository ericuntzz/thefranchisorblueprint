import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow all standard crawlers everywhere except API/private routes.
      // /portal/* is the customer portal (auth-gated); we also set
      // robots: noindex on its layout, but disallowing here prevents the
      // crawl in the first place — defense in depth.
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/portal/",
          "/strategy-call/builder/preview",
        ],
      },
      // Explicitly welcome the major LLM search crawlers — these are the
      // bots that index your content for AI search results.
      { userAgent: "GPTBot", allow: "/" },                     // OpenAI training/indexing
      { userAgent: "OAI-SearchBot", allow: "/" },              // ChatGPT browsing
      { userAgent: "ChatGPT-User", allow: "/" },               // ChatGPT plugin fetches
      { userAgent: "anthropic-ai", allow: "/" },               // Claude
      { userAgent: "Claude-Web", allow: "/" },                 // Claude browsing
      { userAgent: "ClaudeBot", allow: "/" },                  // Claude indexing
      { userAgent: "PerplexityBot", allow: "/" },              // Perplexity
      { userAgent: "Perplexity-User", allow: "/" },            // Perplexity user fetch
      { userAgent: "Google-Extended", allow: "/" },            // Google AI (Gemini, AI Overviews)
      { userAgent: "Applebot-Extended", allow: "/" },          // Apple Intelligence
      { userAgent: "Bytespider", allow: "/" },                 // ByteDance / Doubao
      { userAgent: "DuckAssistBot", allow: "/" },              // DuckDuckGo AI
      { userAgent: "Meta-ExternalAgent", allow: "/" },         // Meta AI fetch
      { userAgent: "Amazonbot", allow: "/" },                  // Alexa / Amazon
      { userAgent: "CCBot", allow: "/" },                      // Common Crawl (used by many LLMs)
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
