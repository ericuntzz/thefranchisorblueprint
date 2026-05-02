import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type CustomerMemory,
  type CustomerMemoryProvenance,
  type Profile,
  type Purchase,
} from "@/lib/supabase/types";
import { MEMORY_FILES, MEMORY_FILE_TITLES } from "@/lib/memory/files";
import { ChapterCard } from "@/components/agent/ChapterCard";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { TypedHeading } from "@/components/agent/TypedHeading";
import { SiteFooter } from "@/components/SiteFooter";

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

  // Quick stats for the hero — how far along is the Blueprint?
  const filledCount = MEMORY_FILES.filter(
    (s) => (memoryBySlug.get(s)?.content_md ?? "").trim().length > 0,
  ).length;
  const pct = Math.round((filledCount / MEMORY_FILES.length) * 100);

  return (
    <>
      <main className="min-h-[calc(100vh-200px)] bg-cream">
        {/* Back to portal */}
        <div className="border-b border-navy/5 bg-white">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold transition-colors"
            >
              <ArrowLeft size={14} />
              Back to portal
            </Link>
            <span className="text-xs uppercase tracking-wider text-gold-warm font-bold">
              /lab · in development
            </span>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-white border-b border-navy/5">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Your living document
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
            <p className="text-grey-3 text-base md:text-lg max-w-[680px] mb-5">
              One document, sixteen chapters, growing as you and Jason feed it.
              At export time, this compiles into the polished bundle your
              attorney needs.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-full bg-navy text-cream px-5 py-2 text-sm font-bold">
                {filledCount} / {MEMORY_FILES.length} chapters started ·{" "}
                {pct}%
              </div>
              <Link
                href="/portal/lab/intake"
                className="inline-flex items-center gap-2 text-navy font-semibold text-sm hover:text-gold transition-colors"
              >
                Pre-fill from your website <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* Chapter grid */}
        <section className="py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 grid md:grid-cols-[220px_1fr] gap-8">
            {/* Sidebar TOC */}
            <aside className="hidden md:block">
              <div className="sticky top-6">
                <div className="text-[10px] uppercase tracking-[0.18em] text-grey-4 font-bold mb-3">
                  Chapters
                </div>
                <ol className="space-y-1.5 text-sm">
                  {MEMORY_FILES.map((slug, idx) => {
                    const filled = (memoryBySlug.get(slug)?.content_md ?? "").trim().length > 0;
                    return (
                      <li key={slug}>
                        <a
                          href={`#chapter-${slug}`}
                          className="flex items-center gap-2 text-grey-3 hover:text-navy transition-colors"
                        >
                          <span className="font-mono text-[10px] text-grey-4 w-5 text-right">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${filled ? "bg-emerald-500" : "bg-grey-3/40"}`}
                          />
                          <span className="truncate">{MEMORY_FILE_TITLES[slug]}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </aside>

            {/* Chapter cards */}
            <div className="space-y-6">
              {MEMORY_FILES.map((slug) => {
                const row = memoryBySlug.get(slug);
                const provenance = provenanceBySlug.get(slug) ?? [];
                const content = row?.content_md ?? "";
                const confidence = !content.trim()
                  ? ("empty" as const)
                  : (row?.confidence ?? "draft");
                return (
                  <ChapterCard
                    key={slug}
                    slug={slug}
                    title={MEMORY_FILE_TITLES[slug]}
                    contentMd={content}
                    confidence={confidence}
                    lastUpdatedBy={row?.last_updated_by ?? null}
                    updatedAt={row?.updated_at ?? null}
                    provenance={provenance}
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
