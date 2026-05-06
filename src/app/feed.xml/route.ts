import { allPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

/**
 * RSS 2.0 feed at /feed.xml.
 *
 * Listed in robots.txt and discoverable via the <link rel="alternate"
 * type="application/rss+xml"> tag in the root layout. Helps Google
 * Discover surface new posts and lets readers subscribe via Feedly etc.
 */
export const dynamic = "force-static";
export const revalidate = 3600; // regenerate hourly

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  // Sort newest first
  const posts = [...allPosts].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastBuildDate = new Date().toUTCString();
  const latestPostDate = posts[0]
    ? new Date(posts[0].date).toUTCString()
    : lastBuildDate;

  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      const pubDate = new Date(p.date).toUTCString();
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
      <category>${escapeXml(p.category)}</category>
      <author>noreply@thefranchisorblueprint.com (Jason Stowe)</author>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>The Franchisor Blueprint Blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Franchise development insights, FDD guidance, royalty benchmarks, and operations playbooks from Jason Stowe — 30 years inside the franchise industry.</description>
    <language>en-US</language>
    <copyright>© ${new Date().getFullYear()} The Franchisor Blueprint</copyright>
    <managingEditor>noreply@thefranchisorblueprint.com (Jason Stowe)</managingEditor>
    <webMaster>team@thefranchisorblueprint.com (TFB Team)</webMaster>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${latestPostDate}</pubDate>
    <ttl>60</ttl>
    <image>
      <url>${SITE_URL}/logos/tfb-logo-color.png</url>
      <title>The Franchisor Blueprint</title>
      <link>${SITE_URL}/blog</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
