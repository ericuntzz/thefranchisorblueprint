/**
 * Single source of truth for blog posts.
 *
 * Add a new post:
 *   1. Create src/app/blog/(posts)/<slug>/page.mdx
 *   2. Add a corresponding entry below
 *
 * Sitemap, blog index, and related-posts components all read from this list.
 */

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readingTimeMin: number;
  /** Optional override for OG image; defaults to dynamic /opengraph-image */
  image?: string;
  /** Topical-cluster tag — used for related-posts grouping */
  tags?: string[];
};

export const allPosts: BlogPost[] = [
  {
    slug: "the-real-cost-of-franchising-your-business",
    title: "The Real Cost of Franchising Your Business in 2026",
    excerpt:
      "What franchise development actually costs in 2026 — broken down by tier, with the line items most consultants don't want you to see.",
    category: "Pricing",
    date: "2026-04-27",
    readingTimeMin: 9,
    tags: ["pricing", "fdd", "consulting"],
  },
  {
    slug: "is-my-business-ready-to-franchise",
    title: "Is My Business Ready to Franchise? A 10-Point Checklist",
    excerpt:
      "The non-negotiable signals that separate a franchise-ready business from a great single location. Use this before you spend a dollar with a consultant.",
    category: "Readiness",
    date: "2026-04-27",
    readingTimeMin: 11,
    tags: ["readiness", "operations", "fdd"],
  },
];

/** Look up by slug, throws if not found (callers should pass a slug they got from allPosts). */
export function getPost(slug: string): BlogPost {
  const post = allPosts.find((p) => p.slug === slug);
  if (!post) throw new Error(`Blog post not found: ${slug}`);
  return post;
}

/** Posts other than the current one, scored by tag overlap. */
export function relatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = allPosts.find((p) => p.slug === slug);
  if (!current) return allPosts.slice(0, limit);
  const others = allPosts.filter((p) => p.slug !== slug);
  return others
    .map((p) => ({
      post: p,
      overlap: (p.tags ?? []).filter((t) => (current.tags ?? []).includes(t)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((x) => x.post);
}
