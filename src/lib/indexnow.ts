/**
 * IndexNow — instant search-engine pinging.
 *
 * IndexNow is a shared protocol used by Bing, Yandex, Naver, Seznam,
 * and others. One POST tells all participating engines that a URL
 * has been added/updated/deleted, and they recrawl within minutes
 * instead of weeks. Google does NOT participate, so IndexNow is a
 * supplement to (not replacement for) GSC sitemap pings.
 *
 * Setup:
 *   1. INDEXNOW_KEY below must match the filename of the verification
 *      file at the site root (public/{KEY}.txt). Engines fetch that
 *      file to prove we own the host.
 *   2. submitToIndexNow() POSTs a JSON payload to api.indexnow.org,
 *      which fan-outs to all participating engines.
 *
 * Rotation: regenerate the key, update both the constant below and
 * the public/{key}.txt filename, and engines will re-verify on the
 * next submission.
 */

export const INDEXNOW_KEY = "d911b16ff3c64d969a9c973f814ae677";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface SubmitResult {
  ok: boolean;
  status: number;
  count: number;
  message?: string;
}

/**
 * Submit one or more URLs to IndexNow. URLs must all share the same host.
 * Returns the HTTP status — 200/202 = accepted, 400 = bad request,
 * 403 = key/host mismatch, 422 = URL not within keyLocation scope,
 * 429 = rate limited.
 *
 * IndexNow accepts up to 10,000 URLs per POST. We don't enforce that
 * here — it's the caller's responsibility (we only have ~95 URLs total).
 */
export async function submitToIndexNow(
  host: string,
  urls: string[],
): Promise<SubmitResult> {
  if (urls.length === 0) {
    return { ok: true, status: 200, count: 0, message: "no urls" };
  }
  // Normalize host: strip protocol + trailing slash.
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const body = {
    host: cleanHost,
    key: INDEXNOW_KEY,
    keyLocation: `https://${cleanHost}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "tfb-indexnow/1.0",
    },
    body: JSON.stringify(body),
  });
  return {
    ok: res.ok,
    status: res.status,
    count: urls.length,
    message: res.ok ? undefined : await res.text().catch(() => undefined),
  };
}
