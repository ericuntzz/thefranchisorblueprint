import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileText,
  PlayCircle,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  PHASES,
  capabilitiesForTier,
  getCapability,
} from "@/lib/capabilities";
import type { Tier, Purchase, CapabilityProgress } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ capability: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { capability: slug } = await params;
  const cap = getCapability(slug);
  return {
    title: cap ? `${cap.title} | Portal | The Franchisor Blueprint` : "Portal",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function CapabilityDetailPage({ params }: PageProps) {
  const { capability: slug } = await params;
  const cap = getCapability(slug);
  if (!cap) notFound();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const [{ data: purchasesData }, { data: progressData }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "paid"),
    supabase
      .from("capability_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("capability_slug", slug)
      .maybeSingle(),
  ]);

  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");

  const tier = (Math.max(...purchases.map((p) => p.tier), 1) as Tier);
  if (cap.minTier > tier) redirect("/portal");

  const completion = (progressData ?? null) as CapabilityProgress | null;
  const completed = !!completion?.completed_at;

  // Fire-and-forget view log (records started_at on first view + bumps
  // last_viewed_at on every view). Used by the "stuck for 14+ days"
  // nudge below. Doesn't block render — if it fails, we log and move on.
  void supabase.rpc("log_capability_view", { uid: user.id, slug }).then(({ error }) => {
    if (error) console.error(`[portal] log_capability_view failed: ${error.message}`);
  });

  // For the stuck nudge: started >= 14 days ago AND not yet completed.
  const isStuck =
    !completed &&
    completion?.started_at !== null &&
    completion?.started_at !== undefined &&
    Date.now() - new Date(completion.started_at).getTime() > 14 * 24 * 3600 * 1000;

  // Prev/next within the customer's accessible journey
  const allowed = capabilitiesForTier(tier);
  const idx = allowed.findIndex((c) => c.slug === cap.slug);
  const prev = idx > 0 ? allowed[idx - 1] : null;
  const next = idx < allowed.length - 1 ? allowed[idx + 1] : null;

  const phaseInfo = PHASES[cap.phase];
  const hasContent = !!cap.storagePath;
  const hasVideo = !!cap.videoUrl;

  return (
    <>
      {/* ===== Mastery hero ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to portal
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm border-b-2 border-gold pb-0.5">
                  Mastery {String(cap.number).padStart(2, "0")} · {cap.verb}
                </span>
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-grey-4">
                  Phase {phaseInfo.number} — {phaseInfo.label}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-navy mb-3">{cap.title}</h1>
              <p className="text-grey-3 text-base md:text-lg max-w-[820px]">
                {cap.description}
              </p>
            </div>

            {/* Status pill */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-[0.12em] uppercase ${
                completed
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-grey-1 text-grey-3 border border-navy/10"
              }`}
            >
              {completed ? (
                <>
                  <CheckCircle2 size={14} /> Completed
                </>
              ) : (
                <>
                  <Circle size={14} /> Not yet complete
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Video walkthrough (if present) ===== */}
      {hasVideo && (
        <section className="bg-grey-1/40 py-8 md:py-10 border-b border-navy/5">
          <div className="max-w-[900px] mx-auto px-6 md:px-8">
            <div className="flex items-center gap-2 mb-3 text-navy">
              <PlayCircle size={18} className="text-gold" />
              <span className="font-bold text-sm">90-second walkthrough with Jason</span>
            </div>
            <div className="bg-black rounded-2xl overflow-hidden shadow-[0_18px_40px_rgba(30,58,95,0.18)]">
              <div className="relative" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={cap.videoUrl ?? ""}
                  className="absolute inset-0 w-full h-full"
                  title={`${cap.title} — Jason's walkthrough`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Document viewer ===== */}
      <section className="py-10 md:py-14">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          {hasContent ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-navy">
                  <FileText size={18} className="text-gold" />
                  <span className="font-bold text-sm">{cap.title}</span>
                  <span className="text-[10px] text-grey-4 font-semibold tracking-wider uppercase">
                    {cap.format}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/portal/file/${cap.slug}?mode=view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-navy font-semibold text-sm hover:text-gold-warm transition-colors"
                  >
                    <ExternalLink size={14} />
                    Open in new tab
                  </a>
                  <a
                    href={`/api/portal/file/${cap.slug}?mode=download`}
                    className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </a>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_18px_40px_rgba(30,58,95,0.08)] overflow-hidden">
                <iframe
                  src={`/api/portal/file/${cap.slug}?mode=view`}
                  className="w-full block bg-grey-1"
                  style={{ height: "78vh", minHeight: "600px" }}
                  title={cap.title}
                />
              </div>
              <p className="text-grey-4 text-xs mt-3 leading-relaxed">
                Preview is rendered via Microsoft Office Online. For best results, download the file and edit it in Word, Pages, or Google Docs to fill in your business&apos;s specifics.
              </p>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-navy/20 p-10 md:p-14 text-center">
              <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-4">
                <FileText size={22} />
              </div>
              <h2 className="text-navy font-bold text-xl mb-2">Coming online soon</h2>
              <p className="text-grey-3 text-sm md:text-base max-w-[520px] mx-auto leading-relaxed">
                We&apos;re finalizing this Mastery with Jason. We&apos;ll email you the moment it&apos;s ready, and your onboarding call will cover the underlying frameworks in the meantime.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===== Stuck-on-this-phase nudge (shows only when started ≥ 14d ago and not done) ===== */}
      {isStuck && (
        <section className="pb-6">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <div className="bg-gradient-to-r from-cream to-white border-2 border-gold/40 rounded-2xl p-6 md:p-7 flex flex-wrap items-start gap-5 shadow-[0_4px_14px_rgba(212,162,76,0.10)]">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <PlayCircle size={18} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
                  Want a coach for this phase?
                </div>
                <h3 className="text-navy font-bold text-lg mb-2">
                  This is one of the harder ones — most customers add coaching here
                </h3>
                <p className="text-grey-3 text-sm leading-relaxed mb-4">
                  You opened {cap.title} a while back. {phaseInfo.label} is where most
                  founders rely on a coach the most. 6 calls focused on this phase, $1,500.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/portal/coaching"
                    className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark transition-colors"
                  >
                    Add phase coaching <ArrowRight size={14} />
                  </Link>
                  <a
                    href={`mailto:team@thefranchisorblueprint.com?subject=Help%20with%20${encodeURIComponent(cap.title)}`}
                    className="inline-flex items-center gap-2 text-navy font-semibold text-sm underline hover:text-gold-warm transition-colors"
                  >
                    Email a question instead
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Completion toggle ===== */}
      <section className="pb-10 md:pb-14">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div
            className={`rounded-2xl p-6 md:p-7 border flex flex-wrap items-center justify-between gap-4 ${
              completed
                ? "bg-green-50/60 border-green-200"
                : "bg-cream border-gold/30"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  completed
                    ? "bg-green-100 text-green-700"
                    : "bg-gradient-to-br from-navy to-navy-light text-gold"
                }`}
              >
                {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </div>
              <div>
                <h3 className="text-navy font-bold text-base mb-0.5">
                  {completed
                    ? "Marked complete"
                    : "Done with this Mastery?"}
                </h3>
                <p className="text-grey-3 text-sm">
                  {completed
                    ? completion?.completed_at
                      ? `Completed ${new Date(completion.completed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                      : "You marked this complete."
                    : hasContent
                      ? "Tap below once you've filled in your version of the template."
                      : "We'll email you when this Mastery ships — feel free to mark it complete then."}
                </p>
              </div>
            </div>
            <form action={`/api/portal/progress/${cap.slug}`} method="POST">
              <input
                type="hidden"
                name="action"
                value={completed ? "unmark" : "mark"}
              />
              <button
                type="submit"
                className={`inline-flex items-center gap-2 font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full transition-colors cursor-pointer ${
                  completed
                    ? "bg-white text-grey-3 border-2 border-grey-1 hover:border-grey-3 hover:text-navy"
                    : "bg-gold text-navy hover:bg-gold-dark"
                }`}
              >
                {completed ? "Mark as not complete" : "Mark complete"}
                {!completed && <ArrowRight size={15} />}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ===== Prev / next nav ===== */}
      {(prev || next) && (
        <section className="pb-16 md:pb-24">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 grid sm:grid-cols-2 gap-4">
            {prev ? (
              <Link
                href={`/portal/${prev.slug}`}
                className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors"
              >
                <div className="flex items-center gap-1 text-grey-4 text-[10px] font-bold tracking-[0.16em] uppercase mb-1">
                  <ArrowLeft size={11} />
                  Previous
                </div>
                <div className="text-navy font-bold text-base">{prev.title}</div>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                href={`/portal/${next.slug}`}
                className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors text-right"
              >
                <div className="text-grey-4 text-[10px] font-bold tracking-[0.16em] uppercase mb-1">
                  Next →
                </div>
                <div className="text-navy font-bold text-base">{next.title}</div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </section>
      )}
    </>
  );
}

