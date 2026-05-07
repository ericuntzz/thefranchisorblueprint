import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
import { BlueprintTOC } from "@/components/portal/BlueprintTOC";
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
        {/* Hero — sets the mental model: this is the assembled
            document, not a form. Per-chapter editing happens from
            the dashboard. */}
        <section className="bg-white border-b border-navy/5">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-12 md:py-16">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Assembled view
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-navy leading-[1.1] tracking-tight mb-4">
              {firstName
                ? `${firstName}'s Franchisor Blueprint`
                : "Your Franchisor Blueprint"}
            </h1>
            <p className="text-grey-3 text-base md:text-lg max-w-[640px] leading-relaxed mb-6">
              All {MEMORY_FILES.length} chapters, compiled into one document —
              the closest preview of what your attorney will see when
              you&apos;re ready to file.
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 bg-navy text-cream font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy-dark transition-colors"
            >
              <ArrowLeft size={13} />
              Back to your dashboard
            </Link>
          </div>
        </section>

        {/* Chapter grid */}
        <section className="py-8 sm:py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 grid md:grid-cols-[260px_1fr] gap-6 md:gap-10">
            {/* Sidebar TOC — see components/portal/BlueprintTOC for
                scrollspy + sticky-overflow behavior. The page stays
                server-rendered; this island hydrates only the TOC. */}
            <aside className="hidden md:block">
              <BlueprintTOC
                items={MEMORY_FILES.map((slug) => ({
                  slug,
                  title: MEMORY_FILE_TITLES[slug],
                  filled:
                    (memoryBySlug.get(slug)?.content_md ?? "").trim().length >
                    0,
                }))}
              />
            </aside>

            {/* Chapter cards. min-w-0 is critical: as a grid item in a
                `260px_1fr` track, this column would otherwise expand
                to its intrinsic content width (especially with no
                word-breaking on long markdown lines) and push the
                page into horizontal overflow at every breakpoint. */}
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

              {/* End-of-document affordance. Customer can edit
                  inline on this page, so the closing isn't a "go
                  elsewhere to edit" message — it's a forward push
                  into the guided question queue (/portal/lab/next)
                  where Jason walks them through the next thing
                  that's missing. Secondary "back to dashboard" stays
                  as a quieter exit option. */}
              <div className="rounded-2xl border border-card-border bg-white px-6 sm:px-8 py-8 text-center">
                <div className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold mb-2">
                  End of Blueprint
                </div>
                <h2 className="text-navy font-extrabold text-lg md:text-xl mb-2">
                  You&apos;ve reached the end
                </h2>
                <p className="text-grey-3 text-sm md:text-[15px] leading-relaxed max-w-[460px] mx-auto mb-6">
                  That&apos;s the full document. Pick up where you left off —
                  Jason has the next question ready when you are.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/portal/lab/next"
                    className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark transition-colors"
                  >
                    Continue building
                    <ArrowRight size={13} />
                  </Link>
                  <Link
                    href="/portal"
                    className="inline-flex items-center gap-2 text-grey-3 hover:text-navy font-semibold text-xs uppercase tracking-[0.1em] px-3 py-2 transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Back to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
