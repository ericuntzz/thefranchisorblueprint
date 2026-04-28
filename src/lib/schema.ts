/**
 * Centralized schema.org JSON-LD builders for SEO + AEO.
 *
 * All values are exact, source-of-truth — change here, propagate everywhere.
 * Reference: https://schema.org/, https://developers.google.com/search/docs/appearance/structured-data
 */

import { SITE_URL } from "@/lib/site";

// ─── Brand-level constants ──────────────────────────────────────────────────

export const ORG = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "The Franchisor Blueprint",
  alternateName: "TFB",
  legalName: "The Franchisor Blueprint",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logos/tfb-logo-color.png`,
    width: "1080",
    height: "692",
  },
  email: "team@thefranchisorblueprint.com",
  founder: {
    "@type": "Person",
    "@id": `${SITE_URL}/about/#jason-stowe`,
    name: "Jason Stowe",
    jobTitle: "Founder",
    sameAs: ["https://www.linkedin.com/in/jason-stowe-a8093539"],
  },
  sameAs: ["https://www.linkedin.com/in/jason-stowe-a8093539"],
  description:
    "Franchise development consulting firm. We help business owners franchise their brand for a fraction of what traditional consulting firms charge — by combining a complete 9-framework operating system with 6 months of 1:1 coaching from founder Jason Stowe.",
} as const;

// ─── Top-level schemas (rendered in root layout) ────────────────────────────

export const organizationSchema = {
  "@context": "https://schema.org",
  ...ORG,
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "The Franchisor Blueprint",
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en-US",
};

// ─── Per-page builders ──────────────────────────────────────────────────────

export const personJasonStoweSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE_URL}/about/#jason-stowe`,
  name: "Jason Stowe",
  jobTitle: "Founder, The Franchisor Blueprint",
  worksFor: { "@id": `${SITE_URL}/#organization` },
  description:
    "Three decades inside the franchise industry — building, scaling, and advising emerging brands. Founder of The Franchisor Blueprint.",
  url: `${SITE_URL}/about`,
  image: `${SITE_URL}/images/jason.png`,
  sameAs: ["https://www.linkedin.com/in/jason-stowe-a8093539"],
  knowsAbout: [
    "Franchise development",
    "Franchise Disclosure Document (FDD)",
    "Franchise operations manuals",
    "Franchise sales",
    "Operations systems and SOPs",
    "Site selection and franchisee qualification",
  ],
};

type FaqEntry = { q: string; a: string };
export function faqPageSchema(items: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

type ServiceParams = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceCurrency?: string;
  url: string;
  category?: string;
};
export function serviceSchema(p: ServiceParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}${p.url}#${p.id}`,
    name: p.name,
    description: p.description,
    provider: { "@id": `${SITE_URL}/#organization` },
    serviceType: p.category ?? "Franchise development consulting",
    areaServed: { "@type": "Country", name: "United States" },
    url: `${SITE_URL}${p.url}`,
    offers: {
      "@type": "Offer",
      price: p.price.toString(),
      priceCurrency: p.priceCurrency ?? "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${p.url}`,
    },
  };
}

type ProductParams = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceCurrency?: string;
  url: string;
  image?: string;
  brand?: string;
};
export function productSchema(p: ProductParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}${p.url}#${p.id}`,
    name: p.name,
    description: p.description,
    image: p.image ?? `${SITE_URL}/logos/tfb-logo-color.png`,
    brand: { "@type": "Brand", name: p.brand ?? "The Franchisor Blueprint" },
    offers: {
      "@type": "Offer",
      price: p.price.toString(),
      priceCurrency: p.priceCurrency ?? "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${p.url}`,
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };
}

type BreadcrumbItem = { name: string; url: string };
export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${SITE_URL}${it.url}`,
    })),
  };
}

type BlogPostingParams = {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO
  dateModified?: string; // ISO
  authorName?: string;
  authorUrl?: string;
  image?: string;
  wordCount?: number;
};
export function blogPostingSchema(p: BlogPostingParams) {
  const url = `${SITE_URL}/blog/${p.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: p.title,
    description: p.description,
    datePublished: p.datePublished,
    dateModified: p.dateModified ?? p.datePublished,
    author: {
      "@type": "Person",
      name: p.authorName ?? "Jason Stowe",
      url: p.authorUrl ?? `${SITE_URL}/about`,
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    image: p.image ?? `${SITE_URL}/images/jason.png`,
    inLanguage: "en-US",
    url,
    ...(p.wordCount ? { wordCount: p.wordCount } : {}),
  };
}
