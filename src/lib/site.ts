/**
 * Single source of truth for the site's canonical URL.
 *
 * Sitemap, robots.txt, llms.txt, schema.org JSON-LD, OG metadata, and
 * canonical link tags all read from this. Change here → propagates everywhere.
 *
 * Currently `https://www.thefranchisorblueprint.com` because Vercel's
 * domain config redirects apex → www. If we ever flip to apex-canonical
 * (Vercel dashboard → Domains → set primary domain), set
 * NEXT_PUBLIC_SITE_URL=https://thefranchisorblueprint.com in Vercel env
 * vars and this constant will follow without a code change.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.thefranchisorblueprint.com";
