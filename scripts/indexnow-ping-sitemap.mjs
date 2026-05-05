#!/usr/bin/env node
/**
 * Post-build hook: ping IndexNow with every URL in the production sitemap.
 *
 * Triggered by the `postbuild` npm script after `next build` completes.
 * On Vercel, that's once per production deploy. On preview/dev builds we
 * skip — IndexNow is only useful for URLs that are actually live.
 *
 * Why ping the entire sitemap rather than just changed URLs:
 *   - The site is small (≈100 URLs); IndexNow accepts up to 10k/POST.
 *   - Diff-aware submission would need a record of last-deployed URLs,
 *     and IndexNow tolerates re-submitting unchanged URLs (it just
 *     deduplicates server-side). Simplicity > cleverness here.
 *
 * Failure mode: a non-2xx response logs a warning but does NOT fail the
 * build. Search-engine pinging is best-effort — we never want a flaky
 * IndexNow endpoint to block a Vercel deploy.
 */

const KEY = "d911b16ff3c64d969a9c973f814ae677";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.thefranchisorblueprint.com";

// Only run on production deploys. VERCEL_ENV is set by Vercel during
// build to "production" | "preview" | "development".
const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`[indexnow] skipping (VERCEL_ENV=${env})`);
  process.exit(0);
}

// On local `npm run build` outside Vercel, also skip — we don't want
// dev-machine builds pinging Bing.
if (!env && !process.env.INDEXNOW_FORCE) {
  console.log("[indexnow] skipping (not on Vercel — set INDEXNOW_FORCE=1 to override)");
  process.exit(0);
}

async function main() {
  console.log(`[indexnow] fetching ${SITE_URL}/sitemap.xml`);
  let sitemap;
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`, { redirect: "follow" });
    if (!res.ok) {
      console.warn(`[indexnow] sitemap fetch failed: ${res.status}`);
      process.exit(0);
    }
    sitemap = await res.text();
  } catch (err) {
    console.warn(`[indexnow] sitemap fetch error: ${err.message}`);
    process.exit(0);
  }

  const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
    (m) => m[1],
  );
  if (urls.length === 0) {
    console.warn("[indexnow] no URLs found in sitemap");
    process.exit(0);
  }
  console.log(`[indexnow] submitting ${urls.length} URLs`);

  const host = SITE_URL.replace(/^https?:\/\//, "");
  const body = {
    host,
    key: KEY,
    keyLocation: `https://${host}/${KEY}.txt`,
    urlList: urls,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "tfb-indexnow/1.0",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      console.log(`[indexnow] ok (${res.status}) — submitted ${urls.length} URLs`);
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`[indexnow] non-OK ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(`[indexnow] POST error: ${err.message}`);
  }
}

main();
