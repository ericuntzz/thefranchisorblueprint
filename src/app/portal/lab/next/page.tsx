import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  type CustomerMemory,
  type Profile,
  type Purchase,
} from "@/lib/supabase/types";
import { computeQuestionQueue, summarizeQueue } from "@/lib/memory/queue";
import type { MemoryFieldsMap } from "@/lib/calc";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { SiteFooter } from "@/components/SiteFooter";
import { QuestionQueueClient } from "./QuestionQueueClient";
import { saveQueueAnswer } from "./actions";

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
 * the queue empties for a phase, we surface a "Ready to draft <chapter>"
 * affordance pointing into the Blueprint canvas.
 *
 * This is the TurboTax-style guided flow that Phase 2A introduces. The
 * existing /portal/lab/blueprint stays as the "View full draft" mode
 * for power users; this is what most DIY buyers should live in.
 */
export default async function GuidedNextPage() {
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

  // Read every chapter's fields jsonb so the queue can scan the full
  // Memory state. Service-role client because the queue page is a
  // server component reading the customer's own data — RLS would
  // also work but we already use admin elsewhere on this surface.
  const admin = getSupabaseAdmin();
  const { data: memoryRows } = await admin
    .from("customer_memory")
    .select("file_slug, fields")
    .eq("user_id", user.id);

  const allFields: MemoryFieldsMap = {};
  for (const row of (memoryRows ?? []) as Pick<
    CustomerMemory,
    "file_slug" | "fields"
  >[]) {
    allFields[row.file_slug as keyof MemoryFieldsMap] = (row.fields ??
      {}) as Record<string, string | number | boolean | string[] | null>;
  }

  const queue = computeQuestionQueue(allFields);
  const summary = summarizeQueue(queue);

  return (
    <>
      <main className="min-h-[calc(100vh-200px)] bg-cream">
        {/* Top nav */}
        <div className="border-b border-navy/5 bg-white">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold transition-colors"
            >
              <ArrowLeft size={14} />
              Back to portal
            </Link>
            <Link
              href="/portal/lab/blueprint"
              className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-xs font-semibold transition-colors"
            >
              View full Blueprint
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Surface */}
        <section className="py-8 md:py-14">
          <div className="max-w-[760px] mx-auto px-4 sm:px-6 md:px-8">
            {queue.length === 0 ? (
              <AllCaughtUpPanel firstName={firstName} />
            ) : (
              <QuestionQueueClient
                initialQueue={queue}
                initialSummary={summary}
                save={saveQueueAnswer}
              />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
      <JasonChatDock pageContext="/portal/lab/next" firstName={firstName} />
    </>
  );
}

function AllCaughtUpPanel({ firstName }: { firstName: string | null }) {
  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center">
      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-bold mb-3">
        Nothing to answer right now
      </div>
      <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
        {firstName
          ? `${firstName}, you've caught up to Jason.`
          : "You've caught up to Jason."}
      </h1>
      <p className="text-emerald-900/85 mb-6 max-w-[520px] mx-auto leading-relaxed">
        Every required question Jason has for the foundational chapters is
        answered. Time to head into the Blueprint canvas, redraft a chapter
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
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy hover:text-cream transition-colors"
        >
          Back to portal
        </Link>
      </div>
    </div>
  );
}
