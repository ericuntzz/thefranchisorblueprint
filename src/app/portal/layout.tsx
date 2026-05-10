import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PortalSidebar } from "@/components/PortalSidebar";
import { PortalSidebarMobile } from "@/components/PortalSidebarMobile";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { LockedTabUpsell } from "@/components/portal/LockedTabUpsell";
import {
  computeSectionReadiness,
  indexMemoryRows,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import {
  computeMilestoneSummary,
  indexMilestones,
  readMilestones,
} from "@/lib/milestones/state";
import type {
  CustomerMemory as CM,
  Profile,
  Purchase,
  Tier,
} from "@/lib/supabase/types";

/**
 * The customer portal is gated content meant only for paying customers.
 * Even though most routes 401 unauthenticated callers, the shell pages
 * can leak to crawlers. Cascade `noindex,nofollow` to every /portal/*
 * route so it never appears in search results.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated routes (login page) bring their own chrome
  // (SiteNav at top, no footer per Eric 2026-05-09 — see
  // /portal/login/page.tsx for rationale).
  if (!user) {
    return <>{children}</>;
  }

  const admin = getSupabaseAdmin();
  const [
    { data: profileData },
    { data: purchasesData },
    { data: memoryRowsRaw },
    milestoneRows,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("tier,status").eq("user_id", user.id).eq("status", "paid"),
    admin
      .from("customer_memory")
      .select("file_slug, content_md, fields, confidence, attachments")
      .eq("user_id", user.id),
    readMilestones(user.id),
  ]);

  const profile = profileData as Pick<Profile, "full_name"> | null;
  const purchases = (purchasesData ?? []) as Pick<Purchase, "tier" | "status">[];
  // Tranche 13 (2026-05-10): "isFree" is true when the user has zero
  // paid purchases — they signed up via the intake-save free flow but
  // haven't upgraded to Blueprint/Navigator/Builder yet. tier still
  // defaults to 1 for type-compat with the existing sidebar API; the
  // isFree flag is what actually drives the locked-tab rendering.
  const isFree = purchases.length === 0;
  const tier = (purchases.length > 0
    ? Math.max(...purchases.map((p) => p.tier))
    : 1) as Tier;

  // Blueprint progress = overall readiness across the 16 sections.
  // Drives the ring next to "Continue Building".
  const memoryIndexed = indexMemoryRows(
    (memoryRowsRaw ?? []) as Array<
      Pick<CM, "file_slug" | "content_md" | "fields" | "confidence" | "attachments">
    >,
  );
  const sectionReadiness = computeSectionReadiness(memoryIndexed);
  const blueprintPct = overallReadinessPct(sectionReadiness);

  // Launch checklist progress = % of regulatory milestones complete.
  // These are external-facing (regulators, attorneys, audit firms),
  // distinct from the section-fill progress above. Drives the ring
  // next to "Launch Checklist".
  const milestoneSummary = computeMilestoneSummary(indexMilestones(milestoneRows));
  const checklistPct = milestoneSummary.percentComplete;

  // First name from full_name, used for Jason's greeting.
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="min-h-screen bg-grey-1/40">
      {/* Desktop: persistent left sidebar (md+). Hidden on mobile. */}
      <PortalSidebar
        displayName={profile?.full_name ?? null}
        email={user.email ?? null}
        tier={tier}
        blueprintPct={blueprintPct}
        checklistPct={checklistPct}
        isFree={isFree}
      />
      {/* Mobile: top bar + slide-out drawer mirroring the desktop
          sidebar. Hidden on md+ where the desktop rail takes over. */}
      <PortalSidebarMobile
        displayName={profile?.full_name ?? null}
        email={user.email ?? null}
        tier={tier}
        blueprintPct={blueprintPct}
        checklistPct={checklistPct}
        isFree={isFree}
      />
      {/* Main content offset by the sidebar width on desktop. The
          sidebar exposes its current width via the --portal-sidebar-w
          CSS variable (240px expanded, 64px collapsed); we read it
          here so the margin transitions in lockstep with the
          collapse animation. */}
      <main className="ml-0 md:[margin-left:var(--portal-sidebar-w,240px)] transition-[margin-left] duration-200">
        {children}
      </main>
      {/* Mounted once at the layout level so chat state (transcript,
          open/closed, draft, in-flight stream) survives client-side
          navigation between portal pages. The dock derives its
          pageContext from usePathname() internally. */}
      <JasonChatDock firstName={firstName} />
      {/* Tranche 13 (2026-05-10): contextual upsell modal for
          free-tier users. Listens for tfb:locked-tab-click events
          emitted by the sidebar; no-op for paid users since their
          sidebar never emits that event (no locked items). */}
      <LockedTabUpsell />
    </div>
  );
}
