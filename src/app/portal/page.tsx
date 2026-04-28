import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Circle,
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
import type {
  CapabilityProgress,
  Profile,
  Purchase,
  Tier,
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

export default async function PortalDashboard() {
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
    supabase.from("profiles").select("*").eq("id", user.id).single(),
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
  const completedSlugs = new Set(progress.map((p) => p.capability_slug));
  const completedCount = visibleCaps.filter((c) => completedSlugs.has(c.slug)).length;
  const totalCount = visibleCaps.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;
  const lockedCaps = CAPABILITIES.filter((c) => c.minTier > tier);

  // First not-yet-completed capability in journey order — surfaced as "next step"
  const nextCapability = visibleCaps.find((c) => !completedSlugs.has(c.slug)) ?? null;

  return (
    <>
      {/* ===== Welcome ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
                Welcome to your portal
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy">
                {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
              </h1>
              <p className="text-grey-3 text-base md:text-lg mt-2 max-w-[640px]">
                Your franchisor operating system — {completedCount} of {totalCount} capabilities complete.
              </p>
            </div>
            <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                Your access tier
              </div>
              <div className="text-navy font-bold text-base">{TIER_LABELS[tier]}</div>
            </div>
          </div>

          {/* Progress bar — single source of truth on "where am I" */}
          <ProgressMeter percent={percentComplete} completed={completedCount} total={totalCount} />
        </div>
      </section>

      {/* ===== Final readiness milestone ===== */}
      {isAllComplete && <FinalReadinessCard firstName={firstName} />}

      {/* ===== Next step CTA ===== */}
      {!isAllComplete && nextCapability && (
        <section className="bg-cream border-b border-gold/20 py-7">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                  <ArrowRight size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                    Your next move
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
            return (
              <PhaseSection
                key={phaseKey}
                number={phase.number}
                label={phase.label}
                tagline={phase.tagline}
                caps={caps}
                completedSlugs={completedSlugs}
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
    </>
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
    <div className="bg-white">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm">
          % Franchise Ready
        </div>
        <div className="text-navy font-extrabold text-2xl tabular-nums">
          {percent}%
        </div>
      </div>
      <div className="h-2.5 w-full bg-grey-1 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold to-gold-warm rounded-full transition-all"
          style={{ width: `${percent}%` }}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <div className="text-grey-4 text-xs mt-2">
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
}: {
  number: number;
  label: string;
  tagline: string;
  caps: Capability[];
  completedSlugs: Set<string>;
  phaseDone: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm">
          Phase {number}
        </div>
        {phaseDone && (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-[0.16em] uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            <CheckCircle2 size={11} />
            Phase complete
          </div>
        )}
      </div>
      <h2 className="text-navy font-bold text-2xl md:text-3xl mb-1">{label}</h2>
      <p className="text-grey-3 text-base md:text-lg mb-6">{tagline}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {caps.map((cap) => (
          <CapabilityCard key={cap.slug} cap={cap} completed={completedSlugs.has(cap.slug)} />
        ))}
      </div>
    </div>
  );
}

function CapabilityCard({ cap, completed }: { cap: Capability; completed: boolean }) {
  const comingSoon = !cap.storagePath;
  return (
    <Link
      href={`/portal/${cap.slug}`}
      className={`group bg-white rounded-2xl border p-6 transition-all flex flex-col ${
        completed
          ? "border-green-300 shadow-[0_8px_20px_rgba(22,163,74,0.10)]"
          : "border-navy/10 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,58,95,0.18)] hover:border-gold/40"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {completed ? (
            <CheckCircle2 size={18} className="text-green-600" />
          ) : (
            <Circle size={18} className="text-grey-3" />
          )}
          <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">
            Capability {String(cap.number).padStart(2, "0")}
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
      <div className="flex items-center gap-2 text-[11px] text-grey-4 font-semibold uppercase tracking-wider">
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
            Book a final 30-minute readiness review with Jason. He&apos;ll validate your work, flag anything risky before you file, and confirm you&apos;re ready to launch.
          </p>
          <a
            href="https://calendly.com/team-thefranchisorblueprint/30-minute-discovery-call"
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
