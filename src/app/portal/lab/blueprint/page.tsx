import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type ChapterAttachment,
  type CustomerMemory,
  type CustomerMemoryProvenance,
  type Profile,
  type Purchase,
} from "@/lib/supabase/types";
import { MEMORY_FILES, MEMORY_FILE_TITLES } from "@/lib/memory/files";
import { getChapterSchema } from "@/lib/memory/schemas";
import type { MemoryFieldsMap } from "@/lib/calc";
import { ChapterCard } from "@/components/agent/ChapterCard";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { TypedHeading } from "@/components/agent/TypedHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { saveChapterSection, saveMemoryFields, setChapterConfidence } from "./actions";
import {
  computeChapterReadiness,
  indexMemoryRows,
} from "@/lib/memory/readiness";

export const metadata: Metadata = {
  title: "Your Franchisor Blueprint | The Franchisor Blueprint",
  description: "The living document the agent is building from your business.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /portal/lab/blueprint — the customer's living Franchisor Blueprint.
 *
 * Renders all 16 chapters in their canonical order. Empty chapters show
 * a "Draft with Jason" CTA; populated chapters render the markdown with
 * an inline confidence pill and on-demand provenance tooltip.
 *
 * The whole page is one document with anchor jumps in the sidebar — the
 * customer reads it as a book, not as a list of forms.
 */
export default async function BlueprintLabPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/lab/blueprint");

  const [{ data: profileRow }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("*").eq("user_id", user.id).eq("status", "paid"),
  ]);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");
  const profile = (profileRow ?? null) as Profile | null;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  // Use service-role for the Memory reads. RLS would let us read the
  // user's own rows via getSupabaseServer() too, but we need provenance
  // (which has no SELECT policy yet) and the admin client is already
  // imported by neighboring routes.
  const admin = getSupabaseAdmin();
  const [{ data: memoryRows }, { data: provenanceRows }] = await Promise.all([
    admin.from("customer_memory").select("*").eq("user_id", user.id),
    admin
      .from("customer_memory_provenance")
      .select("*")
      .eq("user_id", user.id),
  ]);

  const memoryBySlug = new Map<string, CustomerMemory>();
  for (const row of (memoryRows ?? []) as CustomerMemory[]) {
    memoryBySlug.set(row.file_slug, row);
  }
  const provenanceBySlug = new Map<string, CustomerMemoryProvenance[]>();
  for (const row of (provenanceRows ?? []) as CustomerMemoryProvenance[]) {
    const list = provenanceBySlug.get(row.file_slug) ?? [];
    list.push(row);
    provenanceBySlug.set(row.file_slug, list);
  }

  // Build a cross-chapter fields map so ChapterCard can pass it down
  // to the field editor for cross-chapter computed-field formulas
  // (e.g. franchisee_profile.minimum_liquid_capital_dollars derives
  // from unit_economics.initial_investment_high_dollars).
  const allFields: MemoryFieldsMap = {};
  for (const [slug, row] of memoryBySlug) {
    allFields[slug as keyof MemoryFieldsMap] = (row.fields ?? {}) as Record<
      string,
      string | number | boolean | string[] | null
    >;
  }

  // Cross-chapter attachments index, fed to every ChapterCard so the
  // pre-draft modal can offer a "pull a reference from another
  // chapter" checkbox list. Only includes chapters that have at least
  // one attachment — keeps the list tight when most chapters are bare.
  const allAttachmentsByChapter = MEMORY_FILES.flatMap((s) => {
    const att = (memoryBySlug.get(s)?.attachments ?? []) as ChapterAttachment[];
    return att.length > 0 ? [{ slug: s, attachments: att }] : [];
  });

  // Per-chapter readiness state — drives the unified ReadinessPill on
  // each card and keeps the visual language consistent with the
  // Command Center checklist on /portal.
  const chapterReadiness = computeChapterReadiness(
    indexMemoryRows(
      Array.from(memoryBySlug.values()).map((r) => ({
        file_slug: r.file_slug,
        content_md: r.content_md,
        fields: r.fields,
        confidence: r.confidence,
        attachments: r.attachments ?? [],
      })),
    ),
  );

  return (
    <>
      <main className="min-h-[calc(100vh-200px)] bg-cream">
        {/* Top nav strip removed — duplicated the navy "Back to your
            dashboard" CTA inside the hero, and the "/lab · in
            development" tag was stale once the lab promoted out of
            in-development status (LabDiscovery card removed). */}

        {/* Hero — explicit "this is the assembled view" framing so
            the customer doesn't confuse this with the per-chapter
            editing surface. Edit individual chapters from the
            dashboard or the per-chapter pages. */}
        <section className="bg-white border-b border-navy/5">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Assembled view · Final touchup mode
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-navy leading-tight mb-3">
              <TypedHeading
                text={
                  firstName
                    ? `${firstName}'s Franchisor Blueprint`
                    : "Your Franchisor Blueprint"
                }
              />
            </h1>
            <p className="text-grey-3 text-base md:text-lg max-w-[680px] mb-3">
              The sixteen chapters compiled into one document — the closest
              preview of what your attorney will receive at export time.
            </p>
            <p className="text-grey-4 text-sm max-w-[680px] mb-5 italic">
              This page is for reading + final touchups. To answer questions
              and edit fields, head back to your dashboard and pick a
              chapter — each one has its own focused workspace.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 bg-navy text-cream font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy-dark transition-colors"
              >
                <ArrowLeft size={13} />
                Back to your dashboard
              </Link>
            </div>
            {/* "X / 16 chapters started" pill + "Pre-fill from your
                website" link removed — readiness % belongs on the
                Command Center on the dashboard (single source of
                truth), and the intake flow has its own discovery
                surface there too. Was duplicate guidance. */}
          </div>
        </section>

        {/* Chapter grid */}
        <section className="py-8 sm:py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 grid md:grid-cols-[260px_1fr] gap-6 md:gap-10">
            {/* Sidebar TOC.
                Redesigned: larger status circles (so the green ✓ reads
                at a glance instead of a 6px dot), each row is a real
                rounded hit-target with hover bg, more vertical
                breathing room, eyebrow tied to brand gold instead of
                muted grey. Column widened from 220→260 so titles like
                "Unit Economics & Financials" don't truncate. */}
            <aside className="hidden md:block">
              <nav className="sticky top-6" aria-label="Chapters">
                <div className="mb-4 pb-4 border-b border-navy/10">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
                    Your Blueprint
                  </div>
                  <div className="text-grey-4 text-xs">
                    {MEMORY_FILES.length} chapters
                  </div>
                </div>
                <ol className="space-y-0.5">
                  {MEMORY_FILES.map((slug, idx) => {
                    const filled =
                      (memoryBySlug.get(slug)?.content_md ?? "").trim().length >
                      0;
                    return (
                      <li key={slug}>
                        <a
                          href={`#chapter-${slug}`}
                          className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-grey-3 hover:text-navy hover:bg-white transition-colors"
                        >
                          <span className="font-mono text-[10px] tabular-nums text-grey-4 group-hover:text-gold-warm w-5 text-right transition-colors">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                              filled
                                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-white text-grey-4 ring-1 ring-grey-3/35 group-hover:ring-navy/20"
                            }`}
                            aria-label={filled ? "Filled" : "Empty"}
                          >
                            {filled ? (
                              <Check size={10} strokeWidth={3} />
                            ) : (
                              <span className="block w-1 h-1 rounded-full bg-current" />
                            )}
                          </span>
                          <span className="text-[13px] font-medium leading-snug">
                            {MEMORY_FILE_TITLES[slug]}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </aside>

            {/* Chapter cards. min-w-0 is critical: as a grid item in a
                `220px_1fr` track, this column would otherwise expand to
                its intrinsic content width (especially with no
                word-breaking on long markdown lines) and push the page
                into horizontal overflow at every breakpoint. */}
            <div className="space-y-6 min-w-0">
              {MEMORY_FILES.map((slug) => {
                const row = memoryBySlug.get(slug);
                const provenance = provenanceBySlug.get(slug) ?? [];
                const content = row?.content_md ?? "";
                const fields = (row?.fields ?? {}) as Record<
                  string,
                  string | number | boolean | string[] | null
                >;
                const hasFields = Object.keys(fields).length > 0;
                const confidence =
                  !content.trim() && !hasFields
                    ? ("empty" as const)
                    : (row?.confidence ?? "draft");
                const schema = getChapterSchema(slug);
                // Other chapters' fields, excluding self — passed to the
                // editor so cross-chapter computed formulas can resolve.
                const otherChaptersFields: MemoryFieldsMap = {};
                for (const [otherSlug, otherFields] of Object.entries(allFields)) {
                  if (otherSlug !== slug) {
                    otherChaptersFields[otherSlug as keyof MemoryFieldsMap] =
                      otherFields;
                  }
                }
                return (
                  <ChapterCard
                    key={slug}
                    slug={slug}
                    title={MEMORY_FILE_TITLES[slug]}
                    contentMd={content}
                    confidence={confidence}
                    readinessState={chapterReadiness[slug]?.state ?? "gray"}
                    lastUpdatedBy={row?.last_updated_by ?? null}
                    updatedAt={row?.updated_at ?? null}
                    provenance={provenance}
                    attachments={(row?.attachments ?? []) as ChapterAttachment[]}
                    allAttachmentsByChapter={allAttachmentsByChapter}
                    fields={fields}
                    fieldStatus={(row?.field_status ?? undefined) as Parameters<typeof ChapterCard>[0]["fieldStatus"]}
                    otherChaptersFields={otherChaptersFields}
                    schema={schema}
                    saveFields={saveMemoryFields}
                    setConfidence={setChapterConfidence}
                    saveSection={saveChapterSection}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <JasonChatDock pageContext="/portal/lab/blueprint" firstName={firstName} />
    </>
  );
}
