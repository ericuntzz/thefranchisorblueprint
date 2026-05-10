import Link from "next/link";
import { ArrowRight, BarChart3, Lock, MapPin, Search, Sparkles } from "lucide-react";

/**
 * FreeTierDashboard — main work surface for free-tier portal users.
 *
 * Shown to authenticated users with zero paid purchases. Surfaces:
 *  1. A friendly welcome + their email (we don't ask for name yet)
 *  2. The 5-analyses-per-month quota meter
 *  3. Past intake snapshots (each with a "view" link back to the
 *     homepage's resume mode via ?intake=<id>)
 *  4. "Run another analysis" CTA → links to the homepage URL drop
 *  5. Inline upsell card describing what The Blueprint adds
 *
 * Design follows the free-to-paid conversion research:
 *  - The free thing is finishable (each market analysis is a
 *    complete deliverable, not a teaser).
 *  - Upgrade carrot is "MORE and DEEPER" — not "the real thing."
 *  - Inline upsell is benefit-led, single CTA.
 *  - Locked sidebar tabs render the contextual modal on click.
 *
 * Tranche 14 (2026-05-10).
 */

export type FreeTierAnalysis = {
  id: string;
  domain: string;
  business_name: string | null;
  readiness_score: number | null;
  created_at: string;
  resume_path: string;
};

export type FreeTierDashboardProps = {
  /** The authenticated user's email — shown in the welcome line. */
  email: string;
  /** Past intake analyses for this user. Most recent first. */
  analyses: FreeTierAnalysis[];
  /** How many analyses this user has run in the rolling 30 days. */
  usedThisMonth: number;
  /** Monthly cap (default 5). */
  monthlyCap: number;
};

export function FreeTierDashboard({
  email,
  analyses,
  usedThisMonth,
  monthlyCap,
}: FreeTierDashboardProps) {
  const remaining = Math.max(0, monthlyCap - usedThisMonth);
  const overCap = remaining === 0;
  const friendlyEmail = email.split("@")[0] || email;

  return (
    <div className="min-h-screen bg-cream-soft px-6 md:px-12 lg:px-14 py-8 md:py-10">
      <div className="max-w-[1100px] mx-auto space-y-8 md:space-y-10">
        {/* ─── Header / welcome ──────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-gold/15 border border-gold/40 text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">
              Free
            </span>
            <span className="text-grey-3 text-sm">{email}</span>
          </div>
          <h1 className="text-navy font-bold text-3xl md:text-4xl tracking-tight">
            Welcome to your franchise readiness portal.
          </h1>
          <p className="text-grey-3 text-base md:text-lg leading-relaxed mt-2 max-w-[720px]">
            You&apos;ve unlocked the free tier — run up to {monthlyCap} market
            analyses every 30 days, save every snapshot to your portal, and
            upgrade to The Blueprint whenever you&apos;re ready for the full
            franchisor operating system.
          </p>
        </div>

        {/* ─── Run another analysis CTA + quota meter ────────────── */}
        <section className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-navy/5 flex items-center justify-center">
                <Search size={22} className="text-navy" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-warm mb-1">
                  Market analysis
                </p>
                <h2 className="text-navy font-bold text-xl md:text-2xl leading-tight">
                  {overCap
                    ? "You've used your 5 free analyses this month."
                    : `${remaining} ${remaining === 1 ? "analysis" : "analyses"} left this month`}
                </h2>
                <p className="text-grey-3 text-sm md:text-base leading-relaxed mt-1">
                  {overCap
                    ? "Your quota resets on a rolling 30-day window. Upgrade to The Blueprint to remove the cap and unlock deeper data."
                    : "Each analysis takes about a minute. Drop a URL on the homepage and we'll give you back your best local pick, best expansion pick, and your readiness score."}
                </p>
              </div>
            </div>
            {overCap ? (
              <Link
                href="/strategy-call"
                className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-navy font-bold text-sm uppercase tracking-[0.08em] px-7 py-3.5 rounded-full transition-colors"
              >
                Talk to us about upgrading
                <ArrowRight size={18} aria-hidden />
              </Link>
            ) : (
              <Link
                href="/?run=new"
                className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-navy hover:bg-navy-dark text-white font-bold text-sm uppercase tracking-[0.08em] px-7 py-3.5 rounded-full transition-colors"
              >
                Run another analysis
                <ArrowRight size={18} aria-hidden />
              </Link>
            )}
          </div>

          {/* Quota meter — 5 segments, gold for used, grey for unused. */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 flex gap-1.5">
              {Array.from({ length: monthlyCap }).map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < usedThisMonth ? "bg-gold" : "bg-navy/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-grey-4 text-xs font-semibold tabular-nums">
              {usedThisMonth} / {monthlyCap}
            </span>
          </div>
        </section>

        {/* ─── Past analyses ─────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-navy font-bold text-xl md:text-2xl">
              Your saved analyses
            </h2>
            <span className="text-grey-4 text-sm tabular-nums">
              {analyses.length} saved
            </span>
          </div>

          {analyses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-8 text-center">
              <p className="text-grey-3 text-base leading-relaxed">
                You haven&apos;t saved any analyses yet. Drop a URL on the home
                page to run your first.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {analyses.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.resume_path}
                    className="block bg-white rounded-2xl border border-navy/10 hover:border-navy/30 transition-colors p-5 md:p-6"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-navy font-bold text-lg md:text-xl truncate">
                          {a.business_name ?? a.domain}
                        </p>
                        <p className="text-grey-4 text-xs md:text-sm mt-0.5">
                          {a.domain} · saved {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {a.readiness_score != null && (
                        <div className="flex-shrink-0 flex items-baseline gap-1.5">
                          <span className="text-navy font-extrabold text-2xl md:text-3xl tabular-nums">
                            {a.readiness_score}
                          </span>
                          <span className="text-grey-4 text-sm font-bold">
                            /100
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-grey-3 text-sm mt-3 inline-flex items-center gap-1.5">
                      <ArrowRight size={14} className="text-gold-warm" aria-hidden />
                      Open this snapshot
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── The Blueprint carrot ──────────────────────────────── */}
        <section className="bg-navy text-cream rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.25)] p-6 md:p-9">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-gold-warm" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-warm">
              The Blueprint
            </span>
          </div>
          <h2 className="text-cream font-bold text-2xl md:text-[28px] leading-tight mb-3 tracking-tight">
            You&apos;re seeing the lite version. The Blueprint goes 10× deeper.
          </h2>
          <p className="text-cream/80 text-base md:text-[17px] leading-relaxed mb-6 max-w-[720px]">
            The free tier gives you a fast read on where you might expand
            next. The Blueprint gives you the full operating system to
            actually get there — every U.S. ZIP scored on 20+ signals,
            drive-time trade areas, your operations manual, your FDD in
            plain English, your candidate scoring matrix, and a partner
            through your first signed franchisee.
          </p>

          <ul className="grid sm:grid-cols-2 gap-4 mb-7">
            <FeatureLine
              icon={MapPin}
              label="Every U.S. ZIP, not just 60"
              copy="20+ demographic and competitive signals, drive-time trade areas, ranked top-50."
            />
            <FeatureLine
              icon={BarChart3}
              label="Model your unit economics"
              copy="Pro forma templates for FDD Items 7 and 19, the numbers candidates actually evaluate."
            />
            <FeatureLine
              icon={Lock}
              label="Codify your operations"
              copy="100+ page operations manual a new franchisee can run from on day one."
            />
            <FeatureLine
              icon={Sparkles}
              label="Six months of 1:1 coaching"
              copy="Jason and the team in your corner through your first signed franchisee, not after."
            />
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/strategy-call"
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-navy font-bold text-sm uppercase tracking-[0.08em] px-7 py-4 rounded-full transition-colors"
            >
              Book a 15-min strategy call
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/programs"
              className="inline-flex items-center justify-center gap-2 bg-transparent text-cream border border-cream/30 hover:bg-cream/10 font-bold text-sm uppercase tracking-[0.08em] px-7 py-4 rounded-full transition-colors"
            >
              See what&apos;s included
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureLine({
  icon: Icon,
  label,
  copy,
}: {
  icon: React.ElementType;
  label: string;
  copy: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-cream/10 flex items-center justify-center mt-0.5">
        <Icon size={16} className="text-gold-warm" />
      </span>
      <div className="min-w-0">
        <p className="text-cream font-bold text-base leading-snug">{label}</p>
        <p className="text-cream/70 text-sm leading-relaxed mt-1">{copy}</p>
      </div>
    </li>
  );
}
