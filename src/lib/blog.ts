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
  // ─── Pillar: Pricing ────────────────────────────────────────────────────
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
  // ─── Pillar: Readiness ──────────────────────────────────────────────────
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

  // ─── Cluster: FDD Foundations ──────────────────────────────────────────
  {
    slug: "franchise-disclosure-document-explained",
    title: "The Franchise Disclosure Document (FDD) Explained: All 23 Items in Plain English",
    excerpt:
      "The FDD is the single most important document in franchising — and the most misunderstood. Here's what every one of the 23 federally required items actually means, in plain English.",
    category: "FDD",
    date: "2026-04-29",
    readingTimeMin: 14,
    tags: ["fdd", "legal", "readiness"],
  },
  {
    slug: "fdd-item-7-initial-investment",
    title: "FDD Item 7 Explained: How to Calculate the Total Initial Investment Range",
    excerpt:
      "Item 7 is the number every franchise candidate scrolls to first. Get it wrong and you scare off good leads — or worse, attract under-capitalized ones. Here's how to build it right.",
    category: "FDD",
    date: "2026-04-29",
    readingTimeMin: 9,
    tags: ["fdd", "financials", "legal"],
  },
  {
    slug: "fdd-item-19-financial-performance-representations",
    title: "FDD Item 19: Should Your Franchise Make Financial Performance Representations?",
    excerpt:
      "Item 19 is optional. Most new franchisors skip it. That's almost always a mistake. Here's what disclosing real financial performance does for your sales — and how to do it without legal exposure.",
    category: "FDD",
    date: "2026-04-29",
    readingTimeMin: 10,
    tags: ["fdd", "financials", "sales"],
  },

  // ─── Cluster: Franchise Economics ──────────────────────────────────────
  {
    slug: "franchise-royalty-rate-benchmarks",
    title: "How to Set Franchise Royalty Rates: Industry Benchmarks by Sector (2026)",
    excerpt:
      "Royalty rates make or break your unit economics. Set them too low and you starve the system. Too high and franchisees can't make money. Here are the real benchmarks by sector — and the framework for picking your number.",
    category: "Economics",
    date: "2026-04-29",
    readingTimeMin: 13,
    tags: ["pricing", "financials", "operations"],
  },
  {
    slug: "franchise-fee-vs-royalty",
    title: "Initial Franchise Fee vs. Royalty: What Each One Pays For (And How to Price Both)",
    excerpt:
      "These two numbers determine whether your franchise system is a real business or a pyramid in disguise. Here's what each one is for, what the market expects, and how to price both without leaving money on the table.",
    category: "Economics",
    date: "2026-04-29",
    readingTimeMin: 9,
    tags: ["pricing", "financials", "fdd"],
  },

  // ─── Cluster: Operations ───────────────────────────────────────────────
  {
    slug: "how-to-write-franchise-operations-manual",
    title: "How to Write a Franchise Operations Manual: The 17-Section Framework Every Franchisor Needs",
    excerpt:
      "Your Operations Manual is the document franchisees actually live by. Skip it or write it weak and your brand standards collapse the moment you sell unit #5. Here's the 17-section framework that separates real franchise systems from glorified licensing deals.",
    category: "Operations",
    date: "2026-04-29",
    readingTimeMin: 14,
    tags: ["operations", "fdd", "readiness"],
  },

  // ─── Cluster: Sales / Recruitment ──────────────────────────────────────
  {
    slug: "how-to-recruit-first-10-franchisees",
    title: "How to Recruit Your First 10 Franchisees: A Marketing Playbook for Emerging Brands",
    excerpt:
      "The first 10 franchisees are the hardest. No track record, no peer testimonials, no Item 19 numbers worth showing. Here's the actual playbook — channels, copy patterns, qualification, and the five-step funnel that converts in this market.",
    category: "Sales",
    date: "2026-04-29",
    readingTimeMin: 13,
    tags: ["sales", "marketing", "operations"],
  },
  {
    slug: "discovery-day-playbook",
    title: "Discovery Day Playbook: How Top Franchisors Convert Qualified Candidates Into Signed Agreements",
    excerpt:
      "Discovery Day is the closing instrument of franchise sales. Run it well and you sign the candidate that day. Run it as a tour and you lose them to the next firm with a sharper presentation. Here's the agenda, the materials, and the close.",
    category: "Sales",
    date: "2026-04-29",
    readingTimeMin: 10,
    tags: ["sales", "marketing"],
  },

  // ─── Cluster: Decision / Strategy ──────────────────────────────────────
  {
    slug: "franchise-vs-license-vs-company-owned",
    title: "Franchise vs. License vs. Company-Owned Expansion: Which Growth Model Fits Your Business?",
    excerpt:
      "Franchising isn't the only way to scale. License agreements, dealer networks, and company-owned expansion all have their place. Here's how to decide — without the bias of someone trying to sell you franchise development.",
    category: "Strategy",
    date: "2026-04-29",
    readingTimeMin: 12,
    tags: ["strategy", "readiness", "fdd"],
  },
  {
    slug: "why-new-franchisors-stall-in-year-2",
    title: "Why Most New Franchisors Stall in Year 2: 7 Patterns and How to Avoid Each",
    excerpt:
      "Most new franchise systems hit a wall around month 14–18. They sell the first three franchises on hustle and friends-and-family, then growth flatlines for a year. Here are the seven patterns we see repeatedly — and the systemic fixes.",
    category: "Strategy",
    date: "2026-04-29",
    readingTimeMin: 11,
    tags: ["strategy", "operations", "sales"],
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
