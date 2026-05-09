import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type CustomerMemory,
  type Profile,
  type Purchase,
} from "@/lib/supabase/types";
import {
  computeQuestionQueue,
  focusQueueOnSections,
  summarizeQueue,
} from "@/lib/memory/queue";
import type { MemoryFieldsMap } from "@/lib/calc";
import { DELIVERABLES } from "@/lib/export/deliverables";
import type { DeliverableId } from "@/lib/export/types";
import { SiteFooter } from "@/components/SiteFooter";
import { QuestionQueueClient } from "./QuestionQueueClient";
import { saveQueueAnswer } from "./actions";

type SearchParams = Promise<{ focus?: string }>;

export const metadata: Metadata = {
  title: "What's Next | The Franchisor Blueprint",
  description:
    "The next questions Jason needs answered before drafting your Blueprint.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /portal/lab/next — the guided "next best step" surface.
 *
 * The portal's primary CTA points here. Customer answers one question
 * at a time; each answer writes to Memory and advances the queue. When
 * the queue empties for a phase, we surface a "Ready to draft <section>"
 * affordance pointing into the Blueprint canvas.
 *
 * This is the TurboTax-style guided flow that Phase 2A introduces. The
 * existing /portal/lab/blueprint stays as the "View full draft" mode
 * for power users; this is what most DIY buyers should live in.
 */
export default async function GuidedNextPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { focus: focusParam } = await searchParams;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/lab/next");

  const [{ data: profileRow }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "paid"),
  ]);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");
  const profile = (profileRow ?? null) as Profile | null;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  // Has the customer already pre-filled from their website? Profiles
  // stores the URL once they've used /portal/lab/intake at least
  // once. We use this to gate a "skip the typing — add your website"
  // banner at the top of the queue + on brand-related cards.
  const hasWebsite =
    !!(profile?.website_url && profile.website_url.trim().length > 0);

  // Read every section's fields + attachments. Service-role client
  // because the queue page is a server component reading the
  // customer's own data — RLS would also work but we already use
  // admin elsewhere on this surface. Attachments feed the inline
  // doc-prompt banner: only show the prompt for sections that have
  // zero attachments (no point asking for an ops manual if they've
  // already uploaded one).
  const admin = getSupabaseAdmin();
  const { data: memoryRows } = await admin
    .from("customer_memory")
    .select("file_slug, fields, attachments")
    .eq("user_id", user.id);

  const allFields: MemoryFieldsMap = {};
  const attachmentCountBySlug: Record<string, number> = {};
  for (const row of (memoryRows ?? []) as Pick<
    CustomerMemory,
    "file_slug" | "fields" | "attachments"
  >[]) {
    allFields[row.file_slug as keyof MemoryFieldsMap] = (row.fields ??
      {}) as Record<string, string | number | boolean | string[] | null>;
    attachmentCountBySlug[row.file_slug] = Array.isArray(row.attachments)
      ? row.attachments.length
      : 0;
  }

  // Two callers, two behaviors:
  //   - Sidebar's Continue Building → no focus param → global next-best
  //     question, walks all 16 sections in phase order.
  //   - Dashboard's per-card "Complete Section" → ?focus=<deliverable-id>
  //     → questions from THAT deliverable's source sections bubble to the
  //     top of the queue. After clearing them, the rest of the queue
  //     follows in normal order.
  const baseQueue = computeQuestionQueue(allFields);
  const focusedDeliverable =
    focusParam && Object.prototype.hasOwnProperty.call(DELIVERABLES, focusParam)
      ? DELIVERABLES[focusParam as DeliverableId]
      : null;
  const queue = focusedDeliverable
    ? focusQueueOnSections(baseQueue, focusedDeliverable.sourceSections)
    : baseQueue;
  const summary = summarizeQueue(queue);

  return (
    <>
      {/* Vertically center the question card within the viewport-minus-
          footer area. Without `flex items-center` the form collapses to
          the top of `<main>` and looks stranded on tall screens (1080p
          desktop, ultrawides). The `min-h` accounts for the SiteFooter
          rendered just below; py-10/16 stays so on short viewports the
          card has breathing room above + below instead of butting up
          against the rails. */}
      <main className="min-h-[calc(100vh-200px)] bg-cream-soft flex items-center">
        {/* Top nav lives INSIDE the queue client (above the progress
            bar) so the buttons sit in the question flow rather than
            a separate header band. Per Eric's feedback. */}

        <section className="w-full py-10 md:py-16">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8">
            {queue.length === 0 ? (
              <AllCaughtUpPanel firstName={firstName} />
            ) : (
              <QuestionQueueClient
                initialQueue={queue}
                initialSummary={summary}
                hasWebsite={hasWebsite}
                attachmentCountBySlug={attachmentCountBySlug}
                save={saveQueueAnswer}
              />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function AllCaughtUpPanel({ firstName }: { firstName: string | null }) {
  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center">
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-emerald-700 font-bold mb-3">
        Nothing to answer right now
      </div>
      <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
        {firstName
          ? `${firstName}, you've caught up to Jason.`
          : "You've caught up to Jason."}
      </h1>
      <p className="text-emerald-900/85 mb-6 max-w-[520px] mx-auto leading-relaxed">
        Every required question Jason has for the foundational sections is
        answered. Time to head into the Blueprint canvas, redraft a section
        with the new context, or open advanced questions if you want to dig
        deeper.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/portal/lab/blueprint"
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
        >
          Open the Blueprint <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
