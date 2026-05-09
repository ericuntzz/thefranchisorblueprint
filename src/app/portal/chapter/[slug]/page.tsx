/**
 * /portal/chapter/[slug] — legacy redirect.
 *
 * The route was renamed from /portal/chapter/[slug] → /portal/section/[slug]
 * on 2026-05-09 when "chapter" was retired in favor of "section" across
 * the product (franchisors think in business / FDD terms — sections —
 * not creative-writing terms — chapters).
 *
 * Old bookmarks, email-link references, and chat-history links still
 * use /portal/chapter/[slug]. This file does a permanent server-side
 * redirect to the new path so nothing 404s. The legacy folder can be
 * deleted in a follow-up after enough time has passed that no live
 * link references it.
 */

import { redirect } from "next/navigation";
import { isValidMemoryFileSlug } from "@/lib/memory/files";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LegacyChapterRedirect({ params }: Props) {
  const { slug } = await params;
  if (isValidMemoryFileSlug(slug)) {
    redirect(`/portal/section/${slug}`);
  }
  redirect("/portal");
}
