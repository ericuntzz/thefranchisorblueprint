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
// SiteFooter intentionally not rendered on this surface — Eric flagged
// 2026-05-09 that the marketing footer (EXPLORE / RESOURCES / CONNECT
// columns) leaking into a guided question flow felt off-brand.
// TurboTax, Plaid Link, Stripe Connect, etc. keep guided onboarding
// chrome-free; the left sidebar already carries portal nav. Same
// removal applied to /portal/lab/blueprint, /portal/lab/intake,
// /portal/section/[slug] for consistency.
//
// Renamed 2026-05-10 from /portal/lab/next → /portal/blueprint-builder.
// Eric flagged "lab/next" as opaque user-facing copy; "blueprint-builder"
// matches the customer's mental model. Legacy /portal/lab/next still
// resolves via a thin redirect at src/app/portal/lab/next/page.tsx.
import { QuestionQueueClient } from "./QuestionQueueClient";
import { saveQueueAnswer } from "./actions";

type SearchParams = Promise<{ focus?: string }>;

export const metadata: Metadata = {
  title: "Blueprint Builder | The Franchisor Blueprint",
  description:
    "The next questions Jason needs answered before drafting your Blueprint.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /portal/blueprint-builder — the guided "next best step" surface.
 *
 * The portal's primary CTA points here. Customer answers one question
 * at a time; each answer writes to Memory and advances the queue. When
 * the queue empties for a phase, we surface a "Ready to draft <section>"
 * affordance pointing into the Blueprint canvas.
 *
 * This is the TurboTax-style guided flow. /portal/lab/blueprint is
 * the "View full draft" mode for power users; this is where most
 * DIY buyers live.
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
  if (!user) redirect("/portal/login?next=/portal/blueprint-builder");

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
      {/* Layout 2026-05-09 per Eric: "this entire section should be
          a little bigger and longer to fill the screen a bit more."
          Dropped `flex items-center` (the strict vertical centering
          pinned content to the middle of tall viewports with empty
          space above and below). Now top-anchored with generous
          padding so the stack reads as a substantial workspace and
          bg-cream-soft fills the rest naturally. Container widened
          to ~1080px so cards aren't squeezed into a narrow column. */}
      <main className="min-h-screen bg-cream-soft">
        {/* Top nav lives INSIDE the queue client (above the progress
            bar) so the buttons sit in the question flow rather than
            a separate header band. Per Eric's feedback. */}

        <section className="w-full py-12 md:py-16 lg:py-20">
          <div className="max-w-[1080px] mx-auto px-4 sm:px-6 md:px-8">
            {queue.length === 0 ? (
              <AllCaughtUpPanel firstName={firstName} />
            ) : (
              <QuestionQueueClient
                userId={user.id}
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
