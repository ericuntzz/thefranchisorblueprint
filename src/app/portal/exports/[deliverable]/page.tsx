/**
 * Pre-export confidence review.
 *
 * Customer lands here from the ExportsSection's "Review before export"
 * link. Renders:
 *
 *   1. Headline readiness for THIS deliverable (not overall Memory).
 *   2. Per-chapter checklist with state pill + filled/required count
 *      + per-gap "Fix it" link to the chapter editor.
 *   3. Markdown preview of the document as it will render.
 *   4. Footer CTAs: Download .docx, Download .md, Back.
 *
 * The TurboTax "review your return" pattern: nothing is hidden, every
 * gap is named, and the customer is in charge of when to ship.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getDeliverable,
  isValidDeliverableId,
} from "@/lib/export/deliverables";
import { loadBuildContext } from "@/lib/export/load";
import { reviewDeliverable, type ChapterReviewState } from "@/lib/export/deliverable-readiness";
import { renderMarkdown } from "@/lib/export/render-md";
import type { Purchase } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Pre-export review | The Franchisor Blueprint",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ deliverable: string }>;
}

export default async function PreExportReviewPage({ params }: Props) {
  const { deliverable: deliverableId } = await params;
  if (!isValidDeliverableId(deliverableId)) notFound();
  const def = getDeliverable(deliverableId);
  if (!def) notFound();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) redirect("/portal");

  const ctx = await loadBuildContext(user.id);
  const review = reviewDeliverable(def, ctx);
  if (def.kind !== "doc") redirect("/portal");
  const doc = def.build(ctx);
  const previewMd = renderMarkdown(doc);

  return (
    <main className="bg-cream min-h-screen pb-24">
      <div className="bg-white border-b border-navy/5">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-6">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-grey-4 hover:text-navy text-xs font-semibold uppercase tracking-[0.12em] transition-colors"
          >
            <ArrowLeft size={12} /> Back to portal
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10 grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Left column — header + preview */}
        <div className="min-w-0">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
            Pre-export review
          </div>
          <h1 className="text-navy font-extrabold text-3xl md:text-4xl mb-3 leading-tight">
            {def.name}
          </h1>
          <p className="text-grey-3 text-base md:text-lg leading-relaxed mb-5 max-w-[640px]">
            {def.description}
          </p>

          {/* Readiness bar */}
          <div className="bg-white rounded-2xl border border-navy/10 p-5 mb-6">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-navy font-bold">Document readiness</span>
              <span className="text-navy font-bold tabular-nums">
                {review.overallPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-grey-1 overflow-hidden mb-3">
              <div
                className={`h-full transition-all duration-500 ${
                  review.overallPct >= 95
                    ? "bg-emerald-500"
                    : review.overallPct >= 50
                      ? "bg-amber-500"
                      : "bg-grey-3"
                }`}
                style={{ width: `${review.overallPct}%` }}
              />
            </div>
            <div className="text-grey-3 text-sm">
              {review.totalGaps === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 size={14} /> Every required field is filled. Safe to download.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertCircle size={14} />
                  {`${review.totalGaps} required ${review.totalGaps === 1 ? "field" : "fields"} still empty · downloading now will leave them as "—".`}
                </span>
              )}
            </div>
          </div>

          {/* Markdown preview */}
          <div className="bg-white rounded-2xl border border-navy/10 p-5 md:p-7">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
                Live preview
              </span>
              <span className="text-[10px] text-grey-4">
                Generated {new Date(ctx.generatedAt).toLocaleString("en-US")}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-navy font-sans bg-cream/50 rounded-xl p-4 border border-navy/5 max-h-[800px] overflow-y-auto">
              {previewMd}
            </pre>
          </div>
        </div>

        {/* Right column — chapter checklist + downloads */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-navy/10 p-5 sticky top-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-2">
              Source chapters
            </div>
            <div className="space-y-2 mb-5">
              {review.chapters.map((c) => (
                <ChapterRow key={c.slug} chapter={c} />
              ))}
            </div>
            <div className="border-t border-navy/10 pt-4 space-y-2">
              <a
                href={`/api/agent/export/${def.id}?format=docx`}
                className="flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors w-full"
              >
                <Download size={14} />
                Download .docx
              </a>
              <a
                href={`/api/agent/export/${def.id}?format=md`}
                className="flex items-center justify-center gap-2 text-navy border-2 border-navy/15 hover:border-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-2.5 rounded-full transition-colors w-full"
              >
                <FileText size={12} />
                Download .md (plain text)
              </a>
            </div>
          </div>

          {/* Gap list — only when there are gaps. */}
          {review.totalGaps > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">
                <AlertCircle size={12} /> Required gaps to fill
              </div>
              <ul className="space-y-2">
                {review.chapters
                  .flatMap((c) => c.gaps)
                  .slice(0, 14)
                  .map((g) => (
                    <li
                      key={`${g.chapterSlug}.${g.fieldName}`}
                      className="text-sm text-amber-900"
                    >
                      <Link
                        href={`/portal/chapter/${g.chapterSlug}`}
                        className="hover:underline font-semibold"
                      >
                        {g.fieldLabel}
                      </Link>
                      <span className="text-amber-700 text-xs">
                        {" "}
                        · {g.chapterTitle}
                      </span>
                    </li>
                  ))}
                {review.chapters.flatMap((c) => c.gaps).length > 14 && (
                  <li className="text-xs text-amber-700 italic pt-1">
                    + {review.chapters.flatMap((c) => c.gaps).length - 14} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ChapterRow({ chapter }: { chapter: ChapterReviewState }) {
  return (
    <Link
      href={`/portal/chapter/${chapter.slug}`}
      className="flex items-center justify-between gap-3 py-1.5 group hover:bg-cream/50 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatePill state={chapter.state} />
        <span className="text-navy text-sm truncate group-hover:underline">
          {chapter.title}
        </span>
      </div>
      <span className="text-grey-4 text-xs tabular-nums flex-shrink-0">
        {chapter.filledRequired}/{chapter.totalRequired}
        <ArrowRight
          size={11}
          className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity"
        />
      </span>
    </Link>
  );
}

function StatePill({ state }: { state: ChapterReviewState["state"] }) {
  const styles =
    state === "green"
      ? "bg-emerald-500"
      : state === "amber"
        ? "bg-amber-500"
        : state === "red"
          ? "bg-red-500"
          : "bg-grey-3";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${styles}`}
      aria-hidden
    />
  );
}
