import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type ChapterAttachment,
  type CustomerMemory,
  type CustomerMemoryProvenance,
  type Purchase,
} from "@/lib/supabase/types";
import {
  isValidMemoryFileSlug,
  MEMORY_FILES,
  MEMORY_FILE_TITLES,
} from "@/lib/memory/files";
import { getChapterSchema } from "@/lib/memory/schemas";
import {
  computeChapterReadiness,
  indexMemoryRows,
} from "@/lib/memory/readiness";
import type { MemoryFieldsMap } from "@/lib/calc";
import { SiteFooter } from "@/components/SiteFooter";
import {
  saveChapterSection,
  saveMemoryFields,
  setChapterConfidence,
} from "@/app/portal/lab/blueprint/actions";
import { FocusedChapterClient } from "./FocusedChapterClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidMemoryFileSlug(slug)) {
    return { title: "Chapter | The Franchisor Blueprint" };
  }
  return {
    title: `${MEMORY_FILE_TITLES[slug]} | The Franchisor Blueprint`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * /portal/chapter/[slug] — focused single-chapter workspace.
 *
 * The deliverable checklist on /portal links here. The customer picks
 * one chapter to work on and gets a complete workspace for it: field
 * editor, drafted-prose preview, attachments, Approve, Redraft with
 * Jason. Eric's structural ask: "click any section in the new portal
 * and open it as its own page, just like the old capability cards."
 *
 * What this is NOT:
 *   - Not a queue (that's /portal/lab/next).
 *   - Not the assembled document (that's /portal/lab/blueprint).
 *
 * It's the per-chapter equivalent of the old /portal/[capability]
 * detail pages — same depth-of-focus, but driven by Memory + the
 * structured-fields schema instead of a static .pdf iframe.
 */
export default async function FocusedChapterPage({ params }: Props) {
  const { slug } = await params;
  if (!isValidMemoryFileSlug(slug)) notFound();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/portal/login?next=/portal/chapter/${encodeURIComponent(slug)}`);

  // Profile/full_name now read at the layout level (drives the
  // Jason chat greeting). Chapter page only needs to gate on a
  // paid purchase.
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid");
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");

  // Load every chapter's row in one query — we need the current
  // chapter's data for the editor AND every other chapter's fields
  // for cross-chapter computed values (e.g.
  // franchisee_profile.minimum_liquid_capital depends on
  // unit_economics.initial_investment_high). Plus we want the
  // overall readiness state to render the cross-chapter "next /
  // previous chapter" navigation hints at the bottom of this page.
  const admin = getSupabaseAdmin();
  const [{ data: memoryRows }, { data: provenanceRows }] = await Promise.all([
    admin.from("customer_memory").select("*").eq("user_id", user.id),
    admin
      .from("customer_memory_provenance")
      .select("*")
      .eq("user_id", user.id)
      .eq("file_slug", slug),
  ]);

  const memoryBySlug = new Map<string, CustomerMemory>();
  for (const row of (memoryRows ?? []) as CustomerMemory[]) {
    memoryBySlug.set(row.file_slug, row);
  }
  const provenance = (provenanceRows ?? []) as CustomerMemoryProvenance[];

  const row = memoryBySlug.get(slug) ?? null;
  const schema = getChapterSchema(slug);

  // Cross-chapter map for cross-chapter formulas + the redraft modal's
  // "pull a reference from another chapter" feature.
  const allFields: MemoryFieldsMap = {};
  for (const [otherSlug, otherRow] of memoryBySlug) {
    allFields[otherSlug as keyof MemoryFieldsMap] = (otherRow.fields ??
      {}) as Record<string, string | number | boolean | string[] | null>;
  }
  const otherChaptersFields: MemoryFieldsMap = {};
  for (const [otherSlug, otherFields] of Object.entries(allFields)) {
    if (otherSlug !== slug) {
      otherChaptersFields[otherSlug as keyof MemoryFieldsMap] = otherFields;
    }
  }

  // Per-chapter readiness — used to render the ReadinessPill in the
  // hero so the customer sees the same status they saw on the
  // dashboard checklist (same green/amber/red/gray state computed
  // from the same readiness lib).
  const indexedRows = indexMemoryRows(
    Array.from(memoryBySlug.values()).map((r) => ({
      file_slug: r.file_slug,
      content_md: r.content_md,
      fields: r.fields,
      confidence: r.confidence,
      attachments: r.attachments ?? [],
    })),
  );
  const readiness = computeChapterReadiness(indexedRows);
  const myReadiness = readiness[slug];

  // Cross-chapter attachment index for the redraft modal.
  const allAttachmentsByChapter = MEMORY_FILES.flatMap((s) => {
    const att = (memoryBySlug.get(s)?.attachments ?? []) as ChapterAttachment[];
    return att.length > 0 ? [{ slug: s, attachments: att }] : [];
  });

  // Adjacent-chapter affordances. After saving, the customer should
  // be able to click a "next chapter" link without going back to the
  // dashboard. Use the canonical MEMORY_FILES order as the linear
  // path; chapters with no schema (none today, but future) are
  // skipped from the adjacent navigation.
  const slugIndex = MEMORY_FILES.indexOf(slug);
  const previousSlug =
    slugIndex > 0 ? MEMORY_FILES[slugIndex - 1] : null;
  const nextSlug =
    slugIndex >= 0 && slugIndex < MEMORY_FILES.length - 1
      ? MEMORY_FILES[slugIndex + 1]
      : null;

  const content = row?.content_md ?? "";
  const fields = (row?.fields ?? {}) as Record<
    string,
    string | number | boolean | string[] | null
  >;
  const fieldStatus = (row?.field_status ?? undefined) as
    | NonNullable<
        Parameters<typeof FocusedChapterClient>[0]["fieldStatus"]
      >
    | undefined;
  const attachments = (row?.attachments ?? []) as ChapterAttachment[];

  return (
    <>
      <main className="min-h-[calc(100vh-200px)] bg-cream-soft">
        {/* Top nav — matches the queue's nav buttons for visual
            consistency. Both anchors as ghost-pill buttons with
            chevrons; the right-hand one offers the canvas as a
            secondary view. */}
        <div className="border-b border-navy/10 bg-white">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-navy bg-white hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors"
            >
              <ArrowLeft size={12} />
              Back to dashboard
            </Link>
            <Link
              href={`/portal/lab/blueprint#chapter-${slug}`}
              className="inline-flex items-center gap-1.5 text-navy bg-white hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors"
            >
              <BookOpen size={12} />
              View in Blueprint
            </Link>
          </div>
        </div>

        <section className="py-8 md:py-12">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8">
            <FocusedChapterClient
              slug={slug}
              title={MEMORY_FILE_TITLES[slug]}
              schema={schema}
              schemaDescription={schema?.description ?? ""}
              schemaCompilesInto={schema?.compilesInto ?? ""}
              readinessState={myReadiness?.state ?? "gray"}
              confidence={
                !content.trim() && Object.keys(fields).length === 0
                  ? "empty"
                  : (row?.confidence ?? "draft")
              }
              fields={fields}
              fieldStatus={fieldStatus}
              otherChaptersFields={otherChaptersFields}
              contentMd={content}
              attachments={attachments}
              allAttachmentsByChapter={allAttachmentsByChapter}
              provenance={provenance}
              lastUpdatedBy={row?.last_updated_by ?? null}
              updatedAt={row?.updated_at ?? null}
              previousSlug={previousSlug}
              nextSlug={nextSlug}
              previousTitle={
                previousSlug ? MEMORY_FILE_TITLES[previousSlug] : null
              }
              nextTitle={nextSlug ? MEMORY_FILE_TITLES[nextSlug] : null}
              saveFields={saveMemoryFields}
              saveSection={saveChapterSection}
              setConfidence={setChapterConfidence}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
