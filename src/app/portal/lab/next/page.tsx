/**
 * /portal/lab/next — legacy redirect.
 *
 * The route was renamed from /portal/lab/next → /portal/blueprint-builder
 * on 2026-05-10. Eric flagged "lab/next" as opaque user-facing copy
 * ("lab/next" makes no sense to a franchisor); "blueprint-builder"
 * matches the customer's mental model.
 *
 * Old bookmarks, email-link references, and chat-history links still
 * use /portal/lab/next. This file does a server-side redirect to the
 * new path and preserves both query parameters the surface accepts:
 *   - ?focus=<deliverable-id> — the dashboard's per-card "Complete
 *     Section" CTA bubbles questions for that deliverable's source
 *     sections to the top of the queue.
 *   - ?at=<chapter>.<field> — places the customer at a specific
 *     question on refresh / deep-link.
 *
 * Mirrors the pattern in /portal/chapter/[slug]/page.tsx (the
 * chapter→section rename redirect).
 */

import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LegacyLabNextRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.append(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/portal/blueprint-builder?${suffix}` : "/portal/blueprint-builder");
}
