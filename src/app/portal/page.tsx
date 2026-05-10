import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Globe,
  ShieldOff,
  Sparkles,
  Trophy,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeSectionReadiness,
  indexMemoryRows,
  memoryFieldsFromRows,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import {
  computeQuestionQueue,
  summarizeQueue,
} from "@/lib/memory/queue";
import { CommandCenter } from "@/components/portal/CommandCenter";
import { IntakeWelcomeBanner } from "@/components/portal/IntakeWelcomeBanner";
import {
  DeliverableExplorer,
  type SectionDataBundle,
  type DeliverableViewModel,
} from "@/components/portal/DeliverableExplorer";
import { ActivityFeed } from "@/components/portal/ActivityFeed";
import { getRecentActivity } from "@/lib/activity/feed";
import { loadBuildContext } from "@/lib/export/load";
import { reviewDeliverable } from "@/lib/export/deliverable-readiness";
import {
  DELIVERABLES,
  DELIVERABLE_DISPLAY_ORDER,
} from "@/lib/export/deliverables";
import { MEMORY_FILES, MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { getSectionSchema } from "@/lib/memory/schemas";
import type { MemoryFieldsMap } from "@/lib/calc";
import { saveMemoryFields } from "@/app/portal/lab/blueprint/actions";
import type { DeliverableReview } from "@/lib/export/deliverable-readiness";
import type { DeliverableId } from "@/lib/export/types";
import type {
  SectionAttachment,
  CustomerMemory,
  CustomerMemory as CM,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import {
  getActiveOffersForUser,
  isPromoActive,
} from "@/lib/upgrade-offers";
import { OfferCountdown } from "@/components/OfferCountdown";
import { getProduct, type ProductSlug } from "@/lib/products";
import type {
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

  const [{ data: profileData }, { data: purchasesData }, { data: intakeData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    // Most recent merged intake — drives the "Picking up where we left off"
    // welcome banner. Show whenever it exists; the data flowed into the
    // sections at merge time and is persistent context worth surfacing.
    supabase
      .from("intake_sessions")
      .select("domain, score_data, expansion_data, merged_at")
      .eq("user_id", user.id)
      .not("merged_at", "is", null)
      .order("merged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Purchase[];

  const paidPurchases = purchases.filter((p) => p.status === "paid");
  const refundedPurchases = purchases.filter((p) => p.status === "refunded");
  const hasActiveAccess = paidPurchases.length > 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  if (!hasActiveAccess) {
    return <RevokedAccessView firstName={firstName} hadRefund={refundedPurchases.length > 0} />;
  }

  const tier = (Math.max(...paidPurchases.map((p) => p.tier)) as Tier);

  // Days since the customer joined (profile created_at). Used for the
  // "Day X of your journey" marker in the hero.
  const joinedAt = profile?.created_at ? new Date(profile.created_at) : null;
  const daysSinceJoined = joinedAt
    ? Math.max(1, Math.floor((Date.now() - joinedAt.getTime()) / (24 * 3600 * 1000)) + 1)
    : null;

  // ---- Franchise Readiness Command Center + DeliverableExplorer inputs ----
  // Read every customer_memory row + provenance so we can compute
  // per-section readiness, the question queue, AND render the inline
  // section editors inside the deliverable explorer. Service-role
  // client because the dashboard is auth-gated and we want this in
  // one round-trip.
  const admin = getSupabaseAdmin();
  const [{ data: memoryRowsRaw }, { data: provenanceRows }] = await Promise.all([
    admin.from("customer_memory").select("*").eq("user_id", user.id),
    admin
      .from("customer_memory_provenance")
      .select("*")
      .eq("user_id", user.id),
  ]);
  const memoryBySlug = new Map<string, CustomerMemory>();
  for (const row of (memoryRowsRaw ?? []) as CustomerMemory[]) {
    memoryBySlug.set(row.file_slug, row);
  }
  const provenanceBySlug = new Map<string, CustomerMemoryProvenance[]>();
  for (const row of (provenanceRows ?? []) as CustomerMemoryProvenance[]) {
    const list = provenanceBySlug.get(row.file_slug) ?? [];
    list.push(row);
    provenanceBySlug.set(row.file_slug, list);
  }
  const memoryIndexed = indexMemoryRows(
    (memoryRowsRaw ?? []) as Array<
      Pick<
        CM,
        "file_slug" | "content_md" | "fields" | "confidence" | "attachments"
      >
    >,
  );
  const sectionReadiness = computeSectionReadiness(memoryIndexed);
  const readinessPct = overallReadinessPct(sectionReadiness);
  const queueItems = computeQuestionQueue(memoryFieldsFromRows(memoryIndexed));
  const queueSummary = summarizeQueue(queueItems);

  // ---- Milestone fire conditions ----
  // Keyed on overall readiness percent across the 16 sections:
  //   isFirstRun     readinessPct === 0    no Memory data yet
  //   midwayThere    >= 50                 halfway, upgrade pitch lands
  //   isAllComplete  >= 95                 close enough to call done
  // Tweak thresholds here if the feel of those moments shifts; the
  // underlying scoring is in lib/memory/readiness.
  const isFirstRun = readinessPct === 0;
  const midwayThere = readinessPct >= 50;
  const isAllComplete = readinessPct >= 95;

  // ---- Per-deliverable readiness ----
  // Reuses loadBuildContext (same pipeline the API endpoint uses) so
  // the readiness number on each deliverable card matches what the
  // customer sees on the pre-export review screen.
  const buildCtx = await loadBuildContext(user.id);
  const exportReadiness = DELIVERABLE_DISPLAY_ORDER.reduce(
    (acc, id) => {
      const def = DELIVERABLES[id];
      if (def) acc[id] = reviewDeliverable(def, buildCtx);
      return acc;
    },
    {} as Record<DeliverableId, DeliverableReview>,
  );

  // Recent activity feed — read-only summary of what's happened to the
  // customer's Memory. Hidden when empty (brand-new customer). The
  // card shows 5 by default and expands to 10 (with internal scroll
  // beyond that), so we fetch a generous 25 to make the disclosure
  // meaningful for active accounts.
  const recentActivity = await getRecentActivity(user.id, 25);

  // Regulatory milestones moved to /portal/checklist — no need to
  // load them here.

  // Active 48hr promo offer — surfaced via the inline UpgradeBanner component
  const offers = tier < 3 ? await getActiveOffersForUser(user.id) : [];
  const activePromo = offers
    .filter((o) => isPromoActive(o))
    .sort((a, b) => new Date(a.promo_expires_at).getTime() - new Date(b.promo_expires_at).getTime())[0] ?? null;

  // ---- DeliverableExplorer view models ----
  // Build a per-section bundle once (shared across deliverables that
  // include the section) and an explorer view model per deliverable.
  // Cross-section fields map drives the section editor's computed
  // formulas (e.g. franchisee_profile.minimum_liquid_capital depends
  // on unit_economics.initial_investment_high).
  const allFieldsMap: MemoryFieldsMap = {};
  for (const [slug, row] of memoryBySlug) {
    allFieldsMap[slug as keyof MemoryFieldsMap] = (row.fields ?? {}) as Record<
      string,
      string | number | boolean | string[] | null
    >;
  }
  // Cross-section attachments index (only sections that have ≥1
  // attachment) — fed to SectionCard so the pre-draft modal can offer
  // "pull a reference from another section."
  const allAttachmentsBySection: Array<{
    slug: MemoryFileSlug;
    attachments: SectionAttachment[];
  }> = MEMORY_FILES.flatMap((s) => {
    const att = (memoryBySlug.get(s)?.attachments ?? []) as SectionAttachment[];
    return att.length > 0 ? [{ slug: s, attachments: att }] : [];
  });
  // Per-section bundle. Sections not yet in memoryBySlug (brand-new
  // accounts) still get a bundle with empty content so the explorer
  // can render them as "Not started."
  const sectionBundles = new Map<MemoryFileSlug, SectionDataBundle>();
  for (const slug of MEMORY_FILES) {
    const row = memoryBySlug.get(slug);
    const content = row?.content_md ?? "";
    const fields = (row?.fields ?? {}) as Record<string, string | number | boolean | string[] | null>;
    const hasFields = Object.keys(fields).length > 0;
    const confidence: "verified" | "inferred" | "draft" | "empty" =
      !content.trim() && !hasFields
        ? "empty"
        : ((row?.confidence ?? "draft") as "verified" | "inferred" | "draft");
    const otherSectionsFields: MemoryFieldsMap = {};
    for (const [otherSlug, otherFields] of Object.entries(allFieldsMap)) {
      if (otherSlug !== slug) {
        otherSectionsFields[otherSlug as keyof MemoryFieldsMap] = otherFields;
      }
    }
    sectionBundles.set(slug, {
      slug,
      title: MEMORY_FILE_TITLES[slug],
      contentMd: content,
      confidence,
      readinessState: sectionReadiness[slug]?.state ?? "gray",
      lastUpdatedBy: row?.last_updated_by ?? null,
      updatedAt: row?.updated_at ?? null,
      provenance: provenanceBySlug.get(slug) ?? [],
      attachments: (row?.attachments ?? []) as SectionAttachment[],
      allAttachmentsBySection,
      fields,
      fieldStatus: (row?.field_status ?? undefined) as SectionDataBundle["fieldStatus"],
      otherSectionsFields,
      schema: getSectionSchema(slug),
    });
  }
  const deliverableViewModels: DeliverableViewModel[] = DELIVERABLE_DISPLAY_ORDER.flatMap(
    (id) => {
      const def = DELIVERABLES[id];
      const review = exportReadiness[id];
      if (!def || !review) return [];
      const sourceSections = def.sourceSections
        .map((slug) => sectionBundles.get(slug))
        .filter((b): b is SectionDataBundle => !!b);
      return [{
        id,
        name: def.name,
        description: def.description,
        kind: def.kind,
        review,
        sourceSections,
      }];
    },
  );

  // ─── Intake-merge banner data ────────────────────────────────────
  // If this user signed up after dropping their URL on the home page,
  // surface a "you're already X% Franchise Ready" banner so the work
  // they did pre-signup feels preserved.
  const intakeBanner = (() => {
    if (!intakeData) return null;
    const scoreData = intakeData.score_data as
      | { snapshot?: { readiness?: { overall?: number }; expansion?: unknown[] } }
      | null;
    const readinessPct = scoreData?.snapshot?.readiness?.overall ?? null;
    const expansionMarketCount = Array.isArray(scoreData?.snapshot?.expansion)
      ? scoreData!.snapshot!.expansion!.length
      : 0;
    if (readinessPct === null) return null;
    return {
      domain: intakeData.domain as string,
      readinessPct,
      expansionMarketCount,
    };
  })();

  return (
    <>
      {intakeBanner && (
        <IntakeWelcomeBanner
          domain={intakeBanner.domain}
          readinessPct={intakeBanner.readinessPct}
          expansionMarketCount={intakeBanner.expansionMarketCount}
        />
      )}
      {/* ===== Welcome ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 md:px-12 lg:px-14 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
            <div>
              {/* Eyebrow consolidated 2026-05-09 per Eric: was a gold
                  "Welcome to your portal" + a gray "Day X of your
                  journey" secondary tag — two welcomes felt redundant
                  with the H1 below. Now a single gold underlined
                  eyebrow with the day count, which is the more useful
                  signal anyway. Falls back to "Day 1" when joinedAt is
                  null so the eyebrow always renders. */}
              <div className="mb-3">
                <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase border-b-2 border-gold pb-1">
                  Day {daysSinceJoined ?? 1} of your journey
                </span>
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
                  ? "Your franchisor operating system. Pre-fill from your website and answer your first questions — most customers are 25% complete after their first session."
                  : "Your franchisor operating system. Every section you fill compiles into the deliverables your attorney needs."}
              </p>
            </div>
            {/* Coaching-credits chip removed 2026-05-09 per Eric — the
                /portal/coaching surface (and the sidebar Coaching link)
                already covers credits + booking; the dashboard hero
                doesn't need to surface it. Kept the wrapper around the
                tier card so the layout slot stays consistent if we
                ever add a second hero chip. */}
            <div className="flex items-stretch gap-3">
              <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
                <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                  Your access tier
                </div>
                <div className="text-navy font-bold text-base">{TIER_LABELS[tier]}</div>
              </div>
            </div>
          </div>

          {/* Legacy capability-progress meter intentionally removed —
              the Command Center below now owns the "% complete /
              what's next" surface, scored against the 16-section
              Blueprint instead of the older 9-capability framing. */}
        </div>
      </section>

      {/* ===== Franchise Readiness Command Center ===== */}
      {/* The primary surface for DIY buyers — guided next-best-step
          + deliverable checklist. Now leads with a navy hero (since
          the legacy "% FRANCHISE READY" navy block was removed from
          the welcome hero above). The /portal/lab/blueprint canvas
          remains available as expert mode via the Command Center's
          secondary "View full Blueprint" link. */}
      <section className="bg-cream-soft py-6 md:py-10 border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 md:px-12 lg:px-14 space-y-8 md:space-y-10">
          <CommandCenter
            firstName={firstName}
            readinessPct={readinessPct}
            queue={queueSummary}
          />
          {/* Recent activity sits between the next-question hero and
              the deliverable explorer. Reads as: "here's what's
              happened recently" before the larger "here's everything
              left to build" grid below. Card scrolls internally
              after ~4 rows so it never dominates the dashboard. */}
          <ActivityFeed events={recentActivity} />
          {/* DeliverableExplorer — the dashboard's canonical
              "what's left to build + download" grid. Each
              deliverable card expands to show its contributing
              sections; each section row expands to a full inline
              editor. Bundle download UI lives at the top of the grid. */}
          <DeliverableExplorer
            deliverables={deliverableViewModels}
            saveFields={saveMemoryFields}
            isFirstRun={isFirstRun}
            firstName={firstName}
          />
          {/* RegulatoryMilestones moved to /portal/checklist — that's the
              "what has to happen before launch" surface, distinct from
              the per-section readiness grid above. */}
          {/* WhatIfCoach moved to /portal/coaching, above the booking CTAs. */}
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
        <PromoBanner offer={activePromo} />
      )}

      {/* ===== Halfway → upgrade hero card (fires at 50% readiness) ===== */}
      {midwayThere && !isAllComplete && tier < 3 && (
        <MidwayUpgradeHero
          firstName={firstName}
          tier={tier}
          coachingCredits={profile?.coaching_credits ?? 0}
        />
      )}

      {/* ===== Final readiness milestone (fires at 95% readiness) ===== */}
      {isAllComplete && <FinalReadinessCard firstName={firstName} />}

      {/* ===== Day 1 onboarding (first-time visitors only) ===== */}
      {!isAllComplete && isFirstRun && (
        <Day1OnboardingHero firstName={firstName} />
      )}

      {/* Progress is tracked against the 16-section Memory system.
          The Command Center + Deliverable Explorer above are the
          canonical "what's next" surface; /portal/section/[slug] is
          the per-section deep-link. */}

      {/* ===== Tier-specific sections (Tier 2/3 scaffolding) ===== */}
      {tier >= 2 && <CoachingPanel tier={tier} />}
      {tier >= 3 && <ProjectPanel />}

      {/* Onboarding call + Need a hand cards removed — Need a hand
          is now the bottom entry of the sidebar with copy-to-clipboard,
          and the onboarding-call promise is delivered at purchase
          time, not as an in-app card. */}

      {/* Floating PortalResumeBanner removed: the Command Center
          high on the page already surfaces "what's next" with live
          next-question copy + a single primary CTA. The floating
          banner was duplicate guidance and the underlying nextCap
          data went away with the 9-cap migration. */}
    </>
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
            Blueprint complete
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
    <section className="pt-12 md:pt-16 pb-12 md:pb-16">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-card-border p-6 md:p-8">
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
              <div className="text-grey-3 text-xs italic">
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
        <div className="bg-white rounded-2xl border border-card-border p-6 md:p-8">
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
              <div className="text-grey-3 text-xs italic">
                Project tools coming online soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Day1OnboardingHero({ firstName }: { firstName: string | null }) {
  return (
    <section className="bg-gradient-to-br from-navy to-navy-light text-white py-10 md:py-14 border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-8 md:gap-12 items-center">
          <div>
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold mb-3 inline-block border-b-2 border-gold pb-1">
              Day 1 — Start Here
            </div>
            <h2 className="text-white text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
              {firstName
                ? `${firstName}, let's start with your website`
                : "Let's start with your website"}
            </h2>
            <p className="text-white/85 text-base md:text-lg leading-relaxed mb-6">
              Drop your URL and Jason will pre-fill what he can — concept, brand voice, daily operations basics. Then he walks you through the questions that build the rest of your Blueprint. Most people are 25% complete after their first session.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {/* Single primary CTA. The "skip" path stays available
                  but as a text link so it doesn't compete visually
                  with the recommended Pre-fill flow. */}
              <Link
                href="/portal/lab/intake"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-8 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                <Globe size={15} />
                Pre-fill from your website
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/portal/blueprint-builder"
                className="text-white/70 hover:text-white text-xs font-bold uppercase tracking-[0.1em] underline underline-offset-4 decoration-white/30 hover:decoration-white transition-colors"
              >
                or skip and answer questions instead
              </Link>
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
                  <span>Today: Pre-fill from your website (~5 min)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Today: Answer the first questions Jason needs (~30 min)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>This week: Fill in the rest of your Blueprint</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">4</span>
                  <span>Within 1–2 days: Onboarding call with Jason</span>
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
            className="text-grey-3 hover:text-navy text-sm font-semibold underline"
          >
            Dismiss
          </Link>
        </div>
      </div>
    </section>
  );
}

function PromoBanner({ offer }: { offer: UpgradeOffer }) {
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
    </section>
  );
}

function MidwayUpgradeHero({
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
    ? `${firstName}, you're well into your Blueprint`
    : "You're well into your Blueprint";

  const body = isTier1
    ? "The hardest sections are still ahead — unit economics, royalty structure, FDD posture. 1:1 coaching dramatically compresses the timeline through them. Want a coach for the hard parts?"
    : `You've got ${coachingCredits} coaching ${coachingCredits === 1 ? "call" : "calls"} included. Most Navigator customers spend them on the back half of the Blueprint — book your first session.`;

  return (
    <section className="py-10 md:py-14 bg-cream-soft border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border-2 border-gold/30 shadow-[0_8px_28px_rgba(212,162,76,0.12)] p-7 md:p-9 flex flex-wrap items-start gap-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
              Halfway there
            </div>
            <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-2">
              {headline}
            </h2>
            <p className="text-grey-3 text-base leading-relaxed mb-4">{body}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {/* Single primary CTA per visual section. The secondary
                  path (coaching) is intentionally demoted to a text
                  link so the customer's eye lands on Upgrade first. */}
              <Link
                href="/portal/upgrade"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
              >
                Upgrade to {targetName} <ArrowRight size={14} />
              </Link>
              {isTier1 ? (
                <Link
                  href="/portal/coaching"
                  className="text-navy hover:text-navy-light text-xs font-bold uppercase tracking-[0.1em] underline underline-offset-4 decoration-navy/30 hover:decoration-navy transition-colors"
                >
                  or add coaching first
                </Link>
              ) : (
                <Link
                  href="/portal/coaching/schedule"
                  className="text-navy hover:text-navy-light text-xs font-bold uppercase tracking-[0.1em] underline underline-offset-4 decoration-navy/30 hover:decoration-navy transition-colors"
                >
                  or schedule your next coaching call
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
        <div className="text-[11px] text-grey-3 group-hover:text-navy transition-colors">
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
        <div className="bg-white rounded-2xl border border-card-border shadow-[0_18px_40px_rgba(30,58,95,0.10)] p-8 md:p-12 text-center">
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

