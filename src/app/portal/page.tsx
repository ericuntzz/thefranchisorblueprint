import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  ShieldOff,
  Sparkles,
  Trophy,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  CAPABILITIES,
  PHASES,
  capabilitiesByPhase,
  capabilitiesForTier,
  type Capability,
  type CapabilityPhase,
} from "@/lib/capabilities";
import {
  getActiveOffersForUser,
  isPromoActive,
} from "@/lib/upgrade-offers";
import { OfferCountdown } from "@/components/OfferCountdown";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { getProduct, type ProductSlug } from "@/lib/products";
import type {
  CapabilityProgress,
  Profile,
  Purchase,
  Tier,
  UpgradeOffer,
} from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Your Blueprint Portal | The Franchisor Blueprint",
  description: "Access the franchisor operating system.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<Tier, string> = {
  1: "The Blueprint",
  2: "Navigator",
  3: "Builder",
};

interface PortalPageProps {
  searchParams: Promise<{ just_purchased?: string; session_id?: string }>;
}

export default async function PortalDashboard({ searchParams }: PortalPageProps) {
  const { just_purchased: justPurchasedSlug } = await searchParams;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const [
    { data: profileData },
    { data: purchasesData },
    { data: progressData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("capability_progress").select("*").eq("user_id", user.id),
  ]);

  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Purchase[];
  const progress = (progressData ?? []) as CapabilityProgress[];

  const paidPurchases = purchases.filter((p) => p.status === "paid");
  const refundedPurchases = purchases.filter((p) => p.status === "refunded");
  const hasActiveAccess = paidPurchases.length > 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  if (!hasActiveAccess) {
    return <RevokedAccessView firstName={firstName} hadRefund={refundedPurchases.length > 0} />;
  }

  const tier = (Math.max(...paidPurchases.map((p) => p.tier)) as Tier);
  const visibleCaps = capabilitiesForTier(tier);
  const phaseGroups = capabilitiesByPhase(tier);
  // Updated: a row in capability_progress now means "viewed" (not necessarily
  // "completed"). Use completed_at to determine actual completion.
  const completedSlugs = new Set(
    progress.filter((p) => p.completed_at).map((p) => p.capability_slug),
  );
  const startedSlugs = new Set(progress.map((p) => p.capability_slug));
  const completedCount = visibleCaps.filter((c) => completedSlugs.has(c.slug)).length;
  const totalCount = visibleCaps.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;
  const lockedCaps = CAPABILITIES.filter((c) => c.minTier > tier);

  // First not-yet-completed capability in journey order — surfaced as "next step"
  const nextCapability = visibleCaps.find((c) => !completedSlugs.has(c.slug)) ?? null;

  // The "current phase" is the phase containing the first not-yet-completed
  // capability. Used for visual hierarchy (current = highlighted, completed
  // = de-emphasized, future = dimmed).
  const currentPhase: CapabilityPhase | null = nextCapability?.phase ?? null;
  const phaseOrder: CapabilityPhase[] = ["discover", "architect", "activate", "acquire"];
  function phaseState(phase: CapabilityPhase): "completed" | "current" | "future" {
    const caps = phaseGroups[phase];
    if (caps.length === 0) return "future";
    const allDone = caps.every((c) => completedSlugs.has(c.slug));
    if (allDone) return "completed";
    if (phase === currentPhase) return "current";
    // Phases before currentPhase that aren't all-done are still "current"-ish;
    // phases after are future.
    const currentIdx = currentPhase ? phaseOrder.indexOf(currentPhase) : 99;
    return phaseOrder.indexOf(phase) < currentIdx ? "current" : "future";
  }

  // Phase 1 complete = "Discover" phase done. This is the moment we surface
  // the upgrade prompt prominently (per upgrade strategy).
  const phase1Caps = phaseGroups.discover;
  const phase1Done = phase1Caps.length > 0 && phase1Caps.every((c) => completedSlugs.has(c.slug));

  // First-run detection: a brand-new customer has zero capability rows AND
  // zero completed slugs. We surface a dedicated "Day 1 — Start with Audit"
  // hero in place of the standard "Your next move" CTA.
  const isFirstRun = startedSlugs.size === 0 && completedCount === 0;

  // Days since the customer joined (profile created_at). Used for the
  // "Day X of your journey" marker in the hero.
  const joinedAt = profile?.created_at ? new Date(profile.created_at) : null;
  const daysSinceJoined = joinedAt
    ? Math.max(1, Math.floor((Date.now() - joinedAt.getTime()) / (24 * 3600 * 1000)) + 1)
    : null;

  // Active 48hr promo offer — surfaced via the inline UpgradeBanner component
  const offers = tier < 3 ? await getActiveOffersForUser(user.id) : [];
  const activePromo = offers
    .filter((o) => isPromoActive(o))
    .sort((a, b) => new Date(a.promo_expires_at).getTime() - new Date(b.promo_expires_at).getTime())[0] ?? null;

  return (
    <>
      {/* ===== Welcome ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase border-b-2 border-gold pb-1">
                  {isFirstRun ? "Day 1" : "Welcome to your portal"}
                </span>
                {daysSinceJoined !== null && !isFirstRun && (
                  <span className="text-[11px] text-grey-4 font-semibold tracking-wider uppercase">
                    Day {daysSinceJoined} of your journey
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-navy">
                {isFirstRun
                  ? firstName
                    ? `Welcome aboard, ${firstName}`
                    : "Welcome aboard"
                  : firstName
                    ? `Welcome back, ${firstName}`
                    : "Welcome back"}
              </h1>
              <p className="text-grey-3 text-base md:text-lg mt-2 max-w-[640px]">
                {isFirstRun
                  ? "Your franchisor operating system — 9 capabilities, 4 phases. Start with the Audit (about 60 minutes) and you'll know whether your business is franchise-ready."
                  : `Your franchisor operating system — ${completedCount} of ${totalCount} capabilities complete.`}
              </p>
            </div>
            <div className="flex items-stretch gap-3">
              <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                  Your access tier
                </div>
                <div className="text-navy font-bold text-base">{TIER_LABELS[tier]}</div>
              </div>
              <CoachingCreditsChip credits={profile?.coaching_credits ?? 0} tier={tier} />
            </div>
          </div>

          {/* Progress bar — single source of truth on "where am I" */}
          <ProgressMeter percent={percentComplete} completed={completedCount} total={totalCount} />
        </div>
      </section>

      {/* ===== "Just purchased" banner — appears once after upgrades/add-ons ===== */}
      {justPurchasedSlug && (
        <JustPurchasedBanner
          productSlug={justPurchasedSlug as ProductSlug}
          coachingCredits={profile?.coaching_credits ?? 0}
        />
      )}

      {/* ===== Active promo banner (subtle, only when 48hr promo is live) ===== */}
      {activePromo && tier < 3 && (
        <PromoBanner offer={activePromo} tier={tier} />
      )}

      {/* ===== Phase 1 complete → upgrade hero card (more prominent) ===== */}
      {phase1Done && !isAllComplete && tier < 3 && (
        <Phase1UpgradeHero
          firstName={firstName}
          tier={tier}
          coachingCredits={profile?.coaching_credits ?? 0}
        />
      )}

      {/* ===== Final readiness milestone ===== */}
      {isAllComplete && <FinalReadinessCard firstName={firstName} />}

      {/* ===== Day 1 onboarding (first-time visitors only) ===== */}
      {!isAllComplete && isFirstRun && nextCapability && (
        <Day1OnboardingHero firstName={firstName} firstCap={nextCapability} />
      )}

      {/* ===== Next step CTA (returning customers) ===== */}
      {!isAllComplete && !isFirstRun && nextCapability && (
        <section className="bg-cream border-b border-gold/20 py-7">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                  <ArrowRight size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                    {startedSlugs.has(nextCapability.slug) ? "Continue where you left off" : "Your next move"}
                  </div>
                  <div className="text-navy font-bold text-base md:text-lg">
                    {nextCapability.title}
                  </div>
                </div>
              </div>
              <Link
                href={`/portal/${nextCapability.slug}`}
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
              >
                Continue <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== Phases ===== */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 space-y-12 md:space-y-16">
          {(Object.keys(PHASES) as CapabilityPhase[]).map((phaseKey) => {
            const phase = PHASES[phaseKey];
            const caps = phaseGroups[phaseKey];
            if (caps.length === 0) return null;
            const phaseDone = caps.every((c) => completedSlugs.has(c.slug));
            const state = phaseState(phaseKey);
            return (
              <PhaseSection
                key={phaseKey}
                number={phase.number}
                label={phase.label}
                tagline={phase.tagline}
                caps={caps}
                completedSlugs={completedSlugs}
                state={state}
                phaseDone={phaseDone}
              />
            );
          })}

          {lockedCaps.length > 0 && (
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-8">
              <h3 className="text-navy font-bold text-base mb-2">Available with a higher tier</h3>
              <p className="text-grey-3 text-sm mb-4">
                These capabilities unlock when you upgrade. Want to talk through it?{" "}
                <Link href="/strategy-call" className="text-navy font-semibold underline">
                  Book a strategy call
                </Link>
                .
              </p>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-grey-3">
                {lockedCaps.map((cap) => (
                  <li key={cap.slug} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-grey-4" />
                    <span>{cap.title}</span>
                    <span className="text-[10px] text-grey-4 font-semibold uppercase">Tier {cap.minTier}+</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ===== Tier-specific sections (Tier 2/3 scaffolding) ===== */}
      {tier >= 2 && <CoachingPanel tier={tier} />}
      {tier >= 3 && <ProjectPanel />}

      {/* ===== Onboarding + support ===== */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-base mb-1">Onboarding call</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Our team will reach out within one business day to schedule your 60-minute white-glove kickoff call with Jason.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-base mb-1">Need a hand?</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Email{" "}
                  <a
                    href="mailto:team@thefranchisorblueprint.com"
                    className="text-navy font-semibold underline"
                  >
                    team@thefranchisorblueprint.com
                  </a>{" "}
                  any time during your 30-day support window.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Lab discovery (hidden in-progress surfaces) ===== */}
      {/* This card is intentionally subtle — it links to the in-development
          agentic-portal flows so we (Eric + Jason + early test customers)
          can exercise them. Remove or promote once Phase 1 lands on the
          main portal. */}
      <LabDiscovery />

      <JasonChatDock pageContext="/portal (dashboard)" firstName={firstName} />
    </>
  );
}

function LabDiscovery() {
  return (
    <section className="bg-cream border-t border-navy/10">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8">
        <div className="rounded-2xl border-2 border-dashed border-gold/40 bg-gradient-to-br from-cream to-white px-6 md:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
              In development · early access
            </div>
            <div className="text-navy font-bold text-lg">
              Try the new agentic flow
            </div>
            <p className="text-grey-3 text-sm mt-1 max-w-[520px]">
              Drop your website URL and the agent learns your brand and
              concept story before you say a word.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/lab/intake"
              className="inline-flex items-center gap-2 bg-navy text-cream font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy-light transition-colors"
            >
              Open intake <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/portal/lab/blueprint"
              className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy hover:text-cream transition-colors"
            >
              Open Blueprint <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressMeter({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed: number;
  total: number;
}) {
  return (
    <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-2xl px-6 md:px-8 py-6 md:py-7 shadow-[0_18px_40px_rgba(30,58,95,0.18)]">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-gold">
          % Franchise Ready
        </div>
        <div className="text-white font-extrabold text-3xl md:text-4xl tabular-nums leading-none">
          {percent}%
        </div>
      </div>
      <div
        className="h-3 w-full bg-white/10 rounded-full overflow-hidden ring-1 ring-white/5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-gold via-gold to-gold-warm rounded-full transition-all shadow-[0_0_12px_rgba(212,162,76,0.5)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-white/70 text-xs md:text-sm mt-3 font-medium">
        {completed} of {total} capabilities marked complete
      </div>
    </div>
  );
}

function PhaseSection({
  number,
  label,
  tagline,
  caps,
  completedSlugs,
  phaseDone,
  state,
}: {
  number: number;
  label: string;
  tagline: string;
  caps: Capability[];
  completedSlugs: Set<string>;
  phaseDone: boolean;
  state: "completed" | "current" | "future";
}) {
  const completedInPhase = caps.filter((c) => completedSlugs.has(c.slug)).length;

  // Visual treatment per phase state — completed dims slightly, current
  // gets a gold ring + "you are here" pill, future is faded.
  const containerClass =
    state === "completed"
      ? "bg-white rounded-3xl border-2 border-green-200 shadow-[0_4px_18px_rgba(22,163,74,0.06)] overflow-hidden opacity-90"
      : state === "current"
        ? "bg-white rounded-3xl border-2 border-gold shadow-[0_12px_36px_rgba(212,162,76,0.18)] overflow-hidden ring-1 ring-gold/30"
        : "bg-white/70 rounded-3xl border-2 border-navy/10 shadow-[0_4px_14px_rgba(30,58,95,0.04)] overflow-hidden opacity-75";

  const stripClass =
    state === "completed"
      ? "bg-gradient-to-r from-green-400 via-green-500 to-green-400"
      : state === "current"
        ? "bg-gradient-to-r from-gold via-gold-warm to-gold"
        : "bg-gradient-to-r from-navy/15 via-navy/25 to-navy/15";

  const badgeClass =
    state === "completed"
      ? "bg-green-100 text-green-700 ring-green-50"
      : state === "current"
        ? "bg-gradient-to-br from-navy to-navy-light text-gold ring-gold/30"
        : "bg-grey-1 text-grey-4 ring-grey-1/50";

  return (
    <div className={containerClass}>
      <div className={`h-1.5 ${stripClass}`} aria-hidden />

      <div className="p-6 md:p-9">
        {/* Phase header with numbered badge */}
        <div className="flex items-start gap-4 mb-6 md:mb-7">
          <div
            className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-extrabold text-lg md:text-xl ring-4 transition-colors ${badgeClass}`}
            aria-hidden
          >
            {phaseDone ? <CheckCircle2 size={22} /> : number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold tracking-[0.18em] uppercase ${
                  state === "future" ? "text-grey-4" : "text-gold-warm"
                }`}
              >
                Phase {number}
              </span>
              {state === "completed" && (
                <div className="flex items-center gap-1 text-[10px] font-bold tracking-[0.16em] uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <CheckCircle2 size={11} />
                  Phase complete
                </div>
              )}
              {state === "current" && (
                <>
                  <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-navy bg-gold/20 px-2 py-0.5 rounded-full border border-gold/40">
                    You are here
                  </span>
                  {completedInPhase > 0 && (
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-grey-4 bg-grey-1 px-2 py-0.5 rounded-full">
                      {completedInPhase} of {caps.length}
                    </span>
                  )}
                </>
              )}
              {state === "future" && (
                <span className="text-[10px] font-semibold tracking-wider uppercase text-grey-4 bg-grey-1 px-2 py-0.5 rounded-full">
                  Coming up
                </span>
              )}
            </div>
            <h2
              className={`font-extrabold text-2xl md:text-3xl mb-1 leading-tight ${
                state === "future" ? "text-navy/70" : "text-navy"
              }`}
            >
              {label}
            </h2>
            <p
              className={`text-base md:text-lg ${
                state === "future" ? "text-grey-4" : "text-grey-3"
              }`}
            >
              {tagline}
            </p>
          </div>
        </div>

        {/* Capability cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {caps.map((cap) => (
            <CapabilityCard key={cap.slug} cap={cap} completed={completedSlugs.has(cap.slug)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ cap, completed }: { cap: Capability; completed: boolean }) {
  const comingSoon = !cap.storagePath;
  return (
    <Link
      href={`/portal/${cap.slug}`}
      className={`group relative bg-white rounded-2xl border-2 p-5 md:p-6 transition-all flex flex-col ${
        completed
          ? "border-green-300 bg-gradient-to-br from-white to-green-50/50 shadow-[0_4px_14px_rgba(22,163,74,0.10)]"
          : "border-navy/15 shadow-[0_2px_10px_rgba(30,58,95,0.05)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,58,95,0.18)] hover:border-gold/50"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {completed ? (
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-green-700" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-grey-1 border-2 border-navy/15 flex items-center justify-center">
              <span className="text-[10px] font-extrabold text-grey-4 tabular-nums">
                {String(cap.number).padStart(2, "0")}
              </span>
            </div>
          )}
          <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">
            {completed ? `Mastery ${String(cap.number).padStart(2, "0")}` : cap.verb}
          </span>
        </div>
        <ArrowUpRight
          size={18}
          className="text-grey-4 group-hover:text-gold transition-colors"
        />
      </div>
      <h3 className="text-navy font-extrabold text-lg mb-2 leading-tight">
        {cap.title}
      </h3>
      <p className="text-grey-3 text-sm leading-relaxed flex-1 mb-4">
        {cap.description}
      </p>
      <div className="flex items-center gap-2 text-[11px] text-grey-4 font-semibold uppercase tracking-wider pt-3 border-t border-navy/5">
        <FileText size={12} />
        <span>{cap.format}</span>
        {comingSoon && (
          <span className="text-[10px] text-gold-warm font-bold tracking-[0.12em] uppercase ml-auto">
            Coming soon
          </span>
        )}
      </div>
    </Link>
  );
}

function FinalReadinessCard({ firstName }: { firstName: string | null }) {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-navy to-navy-light text-white">
      <div className="max-w-[820px] mx-auto px-6 md:px-8">
        <div className="bg-white/5 border border-gold/30 backdrop-blur-sm rounded-2xl p-8 md:p-12 text-center">
          <div className="inline-flex w-16 h-16 rounded-full bg-gold/20 items-center justify-center text-gold mb-5">
            <Trophy size={28} />
          </div>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold mb-3">
            All capabilities complete
          </div>
          <h2 className="text-white text-3xl md:text-4xl font-extrabold mb-3">
            {firstName ? `${firstName}, you're franchise ready` : "You're franchise ready"}
          </h2>
          <p className="text-white/80 text-base md:text-lg max-w-[600px] mx-auto leading-relaxed mb-7">
            Book a final 60-minute readiness review with Jason. He&apos;ll validate your work, flag anything risky before you file, and confirm you&apos;re ready to launch.
          </p>
          <a
            href="https://calendly.com/team-thefranchisorblueprint/60-minute-final-readiness-review-coaching-call"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
          >
            Book your final readiness review <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

function CoachingPanel({ tier }: { tier: Tier }) {
  return (
    <section className="pb-12 md:pb-16">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-8">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm">
              {tier === 3 ? "Builder coaching" : "Navigator coaching"}
            </span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
              <MessageSquare size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-navy font-bold text-xl mb-2">Your weekly coaching with Jason</h2>
              <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-4">
                You have 24 weekly coaching calls and unlimited Slack/email access included. We&apos;re finalizing your custom coaching schedule and milestone-gate dashboard — your dedicated coach will reach out shortly.
              </p>
              <div className="text-grey-4 text-xs italic">
                Coaching tools coming online soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectPanel() {
  return (
    <section className="pb-12 md:pb-16">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-8">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm">
              Builder project
            </span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
              <Briefcase size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-navy font-bold text-xl mb-2">Your done-with-you build</h2>
              <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-4">
                Our team is building your franchise system in parallel — your custom FDD, Operations Manual, training program, and franchisee recruitment pipeline. Your project dashboard with vendor coordination, asset deliverables, and candidate pipeline is being prepared.
              </p>
              <div className="text-grey-4 text-xs italic">
                Project tools coming online soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Day1OnboardingHero({
  firstName,
  firstCap,
}: {
  firstName: string | null;
  firstCap: Capability;
}) {
  return (
    <section className="bg-gradient-to-br from-navy to-navy-light text-white py-10 md:py-14 border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-12 items-center">
          <div>
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold mb-3 inline-block border-b-2 border-gold pb-1">
              Day 1 — Start Here
            </div>
            <h2 className="text-white text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
              {firstName ? `${firstName}, your first 60 minutes` : "Your first 60 minutes"}
            </h2>
            <p className="text-white/85 text-base md:text-lg leading-relaxed mb-6">
              Before anything else, run the <strong className="text-white">{firstCap.title}</strong>. It&apos;s a 150-point checklist that maps your business against the franchise-ready bar — and it&apos;s the one document that tells you whether you should keep going (or wait six months and fix some things first).
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={`/portal/${firstCap.slug}`}
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Start the {firstCap.verb} <ArrowRight size={16} />
              </Link>
              <span className="text-white/60 text-sm">~60 minutes</span>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold mb-3">
                What happens next
              </div>
              <ol className="space-y-3 text-white/85 text-sm leading-relaxed">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Today: Run the Audit (~60 min)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>This week: Model your unit economics</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Within 1–2 days: Onboarding call with Jason</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">4</span>
                  <span>Months 1–3: The Architect phase (the real work)</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function JustPurchasedBanner({
  productSlug,
  coachingCredits,
}: {
  productSlug: ProductSlug;
  coachingCredits: number;
}) {
  const product = getProduct(productSlug);
  if (!product) return null;

  // Build the right success message based on what they bought.
  let title: string;
  let body: string;
  if (productSlug.startsWith("upgrade-")) {
    title = `You're upgraded to ${product.grantsTier === 2 ? "Navigator" : "Builder"}`;
    body =
      product.grantsTier === 2
        ? "All Navigator-level access + 24 coaching calls are now active. Your coaching team will reach out within one business day to schedule your first session."
        : "All Builder access + done-with-you support are now active. Our concierge team will reach out within one business day.";
  } else if (productSlug === "sample-call") {
    title = "Coaching call added";
    body = `You now have ${coachingCredits} coaching ${coachingCredits === 1 ? "credit" : "credits"}. Email team@thefranchisorblueprint.com to schedule.`;
  } else if (productSlug === "phase-coaching") {
    title = "6 coaching calls added";
    body = `You now have ${coachingCredits} coaching ${coachingCredits === 1 ? "credit" : "credits"} in your account. Email team@thefranchisorblueprint.com to schedule your sessions.`;
  } else {
    title = `Welcome to ${product.name}`;
    body = "Your purchase is confirmed. Everything's now active in your portal.";
  }

  return (
    <section className="bg-gradient-to-r from-green-50 via-cream to-green-50 border-b border-green-300/40">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
            <CheckCircle2 size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-green-700 mb-0.5">
              Purchase confirmed
            </div>
            <div className="text-navy font-bold text-base">{title}</div>
            <div className="text-grey-3 text-sm">{body}</div>
          </div>
          <Link
            href="/portal"
            className="text-grey-4 hover:text-navy text-sm font-semibold underline"
          >
            Dismiss
          </Link>
        </div>
      </div>
    </section>
  );
}

function PromoBanner({ offer, tier }: { offer: UpgradeOffer; tier: Tier }) {
  const targetName = offer.target_tier === 2 ? "Navigator" : "Builder";
  return (
    <section className="bg-gradient-to-r from-navy via-navy-light to-navy text-white border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-4 flex flex-wrap items-center gap-4">
        <Clock size={18} className="text-gold flex-shrink-0" />
        <div className="flex-1 min-w-[260px]">
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold mb-0.5">
            48-hour upgrade promo active
          </div>
          <div className="text-white text-sm md:text-base font-semibold">
            10% off your upgrade to {targetName} ends in{" "}
            <span className="text-gold font-bold tabular-nums">
              <OfferCountdown expiresAt={offer.promo_expires_at} />
            </span>
          </div>
        </div>
        <Link
          href="/portal/upgrade"
          className="inline-flex items-center gap-1.5 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-2.5 rounded-full hover:bg-gold-dark transition-colors"
        >
          See upgrade <ArrowRight size={13} />
        </Link>
      </div>
      {/* Tier passthrough silence — used for type narrowing only */}
      {tier === tier && null}
    </section>
  );
}

function Phase1UpgradeHero({
  firstName,
  tier,
  coachingCredits,
}: {
  firstName: string | null;
  tier: Tier;
  coachingCredits: number;
}) {
  // Tier 3 customers don't get an upgrade hero — they're at the top.
  if (tier >= 3) return null;

  const isTier1 = tier === 1;
  const targetName = isTier1 ? "Navigator" : "Builder";

  // Tier-specific copy + secondary CTA. Tier 1 buyers don't have any
  // coaching credits yet, so the secondary CTA points at /portal/coaching
  // where they can pick from sample call ($97) or phase coaching ($1,500).
  // Tier 2 buyers DO have credits — push them toward booking instead of
  // buying more coaching.
  const headline = firstName
    ? `${firstName}, you've validated you're ready`
    : "You've validated you're ready";

  const body = isTier1
    ? "The next phase (Architect) is where 80% of your time gets spent and where 1:1 coaching dramatically compresses the timeline. Want a coach for the hard parts?"
    : `You've got ${coachingCredits} coaching ${coachingCredits === 1 ? "call" : "calls"} included. Architect is where most Navigator customers use them — book your first session for this phase.`;

  return (
    <section className="py-10 md:py-14 bg-cream border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border-2 border-gold/30 shadow-[0_8px_28px_rgba(212,162,76,0.12)] p-7 md:p-9 flex flex-wrap items-start gap-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
              Phase 1 complete
            </div>
            <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-2">
              {headline}
            </h2>
            <p className="text-grey-3 text-base leading-relaxed mb-4">{body}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/portal/upgrade"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
              >
                Upgrade to {targetName} <ArrowRight size={14} />
              </Link>
              {isTier1 ? (
                <Link
                  href="/portal/coaching"
                  className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:border-navy hover:bg-navy hover:text-white transition-colors"
                >
                  Add coaching <ArrowRight size={14} />
                </Link>
              ) : (
                <Link
                  href="/portal/coaching/schedule"
                  className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:border-navy hover:bg-navy hover:text-white transition-colors"
                >
                  Schedule a coaching call <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Compact chip that lives next to the access-tier badge on the dashboard.
 * Shows the customer's available coaching credits and links to either:
 *   - the coaching purchase page (if they have 0 — encourages add-on)
 *   - the coaching schedule page (if they have ≥ 1 — encourages booking)
 */
function CoachingCreditsChip({ credits, tier }: { credits: number; tier: Tier }) {
  // Tier 3 customers always get coaching included — chip would feel weird
  // for them. (We can revisit this once we have actual Tier 3 buyers.)
  if (tier >= 3 && credits === 0) return null;

  const hasCredits = credits > 0;
  const href = hasCredits ? "/portal/coaching/schedule" : "/portal/coaching";
  return (
    <Link
      href={href}
      className={`group rounded-xl px-5 py-4 border transition-colors ${
        hasCredits
          ? "bg-white border-navy/15 hover:border-gold/50"
          : "bg-grey-1/40 border-navy/10 hover:border-navy/25"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
        Coaching credits
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-navy font-bold text-base tabular-nums">
          {credits}
        </div>
        <div className="text-[11px] text-grey-4 group-hover:text-navy transition-colors">
          {hasCredits ? "→ Book a call" : "→ Add coaching"}
        </div>
      </div>
    </Link>
  );
}

function RevokedAccessView({
  firstName,
  hadRefund,
}: {
  firstName: string | null;
  hadRefund: boolean;
}) {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[640px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_18px_40px_rgba(30,58,95,0.10)] p-8 md:p-12 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-5">
            <ShieldOff size={22} />
          </div>
          <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
            {firstName ? `Hi ${firstName}, your access is paused` : "Your access is paused"}
          </h1>
          <p className="text-grey-3 text-base leading-relaxed mb-7">
            {hadRefund
              ? "We've processed a refund on your purchase, so portal access has been turned off. If this is unexpected — or you'd like to talk through anything before deciding — we'd love to hear from you."
              : "We don't see an active purchase on your account. If you bought recently and the portal hasn't caught up, give it a few minutes and refresh. Otherwise, our team is happy to help."}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/programs/blueprint"
              className="inline-block bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Re-purchase The Blueprint
            </Link>
            <a
              href="mailto:team@thefranchisorblueprint.com"
              className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-navy hover:text-white transition-colors"
            >
              Email our team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Suppress unused-warning until tier-aware nav uses it.
void Sparkles;
