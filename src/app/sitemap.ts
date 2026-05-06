import type { MetadataRoute } from "next";
import { allPosts } from "@/lib/blog";
import { allStates } from "@/lib/franchise-states";
import { allIndustries } from "@/lib/franchise-industries";
import { allGlossaryTerms } from "@/lib/franchise-glossary";
import { allComparisons } from "@/lib/franchise-comparisons";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    // No trailing slash on root — must match the canonical Next.js renders
    // (which strips the trailing slash from metadataBase). GSC was reporting
    // the homepage as "Duplicate, Google chose different canonical than user"
    // because the sitemap declared "/" while the canonical link omitted it.
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/programs/blueprint`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/strategy-call`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/strategy-call/blueprint`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/strategy-call/builder`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
    { url: `${SITE_URL}/assessment`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/franchise-by-state`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/franchise-by-industry`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_URL}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/earnings-disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/franchise-disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Programmatic state pages — 51 entries (50 + DC)
  const stateRoutes: MetadataRoute.Sitemap = allStates.map((s) => ({
    url: `${SITE_URL}/franchise-your-business-in/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Programmatic industry pages — 16 sectors
  const industryRoutes: MetadataRoute.Sitemap = allIndustries.map((i) => ({
    url: `${SITE_URL}/franchise-your/${i.slug}/business`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Glossary detail pages
  const glossaryRoutes: MetadataRoute.Sitemap = allGlossaryTerms.map((t) => ({
    url: `${SITE_URL}/glossary/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.55,
  }));

  // Comparison pages
  const comparisonRoutes: MetadataRoute.Sitemap = allComparisons.map((c) => ({
    url: `${SITE_URL}/compare/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75, // Higher than blog/glossary because of commercial intent
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...stateRoutes,
    ...industryRoutes,
    ...glossaryRoutes,
    ...comparisonRoutes,
  ];
}
