/**
 * Shared portal nav-item definitions, consumed by both the desktop
 * `PortalSidebar` and the mobile slide-out `PortalSidebarMobile`. The
 * two surfaces show the same nav with the same progress rings — only
 * the chrome differs (pinned rail vs. drawer + top bar) — so we
 * centralize the items here to keep them in sync.
 */
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  Search,
  type LucideIcon,
} from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Pathname prefixes that should also light this item up. Useful
   *  when, e.g., `/portal/section/foo` should highlight Blueprint. */
  matchPrefixes?: string[];
  /** Optional progress ring — 0..100. */
  progressPct?: number;
  /**
   * Tranche 13: when true, the item renders with a gold lock icon and
   * the click handler opens the upsell modal instead of navigating.
   * Free-tier-only feature; ignored on paid sidebars.
   */
  locked?: boolean;
  /**
   * Tranche 13: short benefit-led copy shown in the upsell modal when
   * a free user clicks this locked item. Plain English, outcome
   * framed. Per the conversion research: never feature-led
   * ("Build tab"), always outcome-led ("Codify your operations
   * into a franchise-ready manual"). 1-2 short sentences.
   */
  lockedCarrot?: string;
};

export type PortalNavItems = {
  primary: PortalNavItem;
  secondary: PortalNavItem[];
};

/**
 * Build the portal nav. Caller passes the two derived progress
 * percentages so the rings stay in sync with whatever the layout
 * computed at request time. `isFree` flips to the locked free-tier
 * nav structure (Tranche 13).
 */
export function getPortalNavItems({
  blueprintPct = 0,
  checklistPct = 0,
  isFree = false,
}: {
  blueprintPct?: number;
  checklistPct?: number;
  isFree?: boolean;
} = {}): PortalNavItems {
  if (isFree) {
    return getFreeTierNavItems();
  }

  const primary: PortalNavItem = {
    href: "/portal/blueprint-builder",
    label: "Continue Building",
    icon: ArrowRight,
    progressPct: blueprintPct,
  };

  const secondary: PortalNavItem[] = [
    {
      href: "/portal",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/portal/lab/blueprint",
      label: "Blueprint",
      icon: BookOpen,
      matchPrefixes: ["/portal/lab/blueprint", "/portal/section/"],
    },
    {
      href: "/portal/checklist",
      label: "Launch Checklist",
      icon: ListChecks,
      progressPct: checklistPct,
    },
    {
      href: "/portal/library",
      label: "Library",
      icon: Library,
    },
    {
      href: "/portal/coaching",
      label: "Coaching",
      icon: GraduationCap,
    },
    {
      href: "/portal/coaching/schedule",
      label: "Schedule a Call",
      icon: Calendar,
    },
  ];

  return { primary, secondary };
}

/**
 * Free-tier nav structure. Tranche 13 (2026-05-10).
 *
 * The visitor signed up after running a market analysis, so the
 * primary CTA is "Run another analysis" (re-engages with the only
 * unlocked feature). The Dashboard tab is the only unlocked entry
 * — everything else renders with a gold lock icon and triggers the
 * upsell modal on click.
 *
 * Items removed entirely (vs paid sidebar):
 *   - "Continue Building" (no Blueprint to build)
 *   - "Schedule a Call" (a coaching feature, locked behind a tab)
 *   - "Coaching" — folded into the Decode/Train carrots
 *
 * Items kept but LOCKED with carrot copy:
 *   - Audit, Build, Model, Codify, Train, Decode, Score (Real Estate),
 *     Qualify, Close — the 9 capabilities from the Blueprint
 *     operating system, minus "Score Real Estate" which is
 *     partially what Market Analysis already does (we don't lock
 *     a feature the visitor is already using a lite version of).
 *
 * Copy convention per Mutiny / Superwall research: outcome-led
 * ("Codify your operations into a franchise-ready manual"), not
 * feature-led ("Open the Codify tab").
 */
function getFreeTierNavItems(): PortalNavItems {
  const primary: PortalNavItem = {
    href: "/portal",
    label: "Run Market Analysis",
    icon: Search,
  };

  const secondary: PortalNavItem[] = [
    {
      href: "/portal",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/portal/locked/audit",
      label: "Audit Your Business",
      icon: ListChecks,
      locked: true,
      lockedCarrot:
        "Get a 150-point readiness audit covering every detail attorneys and franchisees will ask about — long before they ask.",
    },
    {
      href: "/portal/locked/model",
      label: "Model Your Unit Economics",
      icon: BarChart3,
      locked: true,
      lockedCarrot:
        "Pro forma templates for FDD Items 7 and 19 — the numbers candidates evaluate before they sign.",
    },
    {
      href: "/portal/locked/codify",
      label: "Codify Your Operations",
      icon: BookOpen,
      locked: true,
      lockedCarrot:
        "Turn how you run today into a 100+ page operations manual a franchisee can run from on day one.",
    },
    {
      href: "/portal/locked/decode",
      label: "Decode the FDD",
      icon: Library,
      locked: true,
      lockedCarrot:
        "All 23 federal disclosure items in plain English — walk into your franchise attorney prepared, not lost.",
    },
    {
      href: "/portal/locked/qualify",
      label: "Qualify Every Candidate",
      icon: ListChecks,
      locked: true,
      lockedCarrot:
        "A weighted scoring matrix that picks the right franchisees on data, not gut feel.",
    },
    {
      href: "/portal/locked/close",
      label: "Close Discovery Day",
      icon: GraduationCap,
      locked: true,
      lockedCarrot:
        "A 29-slide sales presentation engineered to convert qualified leads into signed franchisees.",
    },
    {
      href: "/portal/locked/coaching",
      label: "1:1 Coaching",
      icon: Calendar,
      locked: true,
      lockedCarrot:
        "Six months of weekly coaching with Jason — 30 years of franchise development, by your side through your first signed franchisee.",
    },
  ];

  return { primary, secondary };
}

/**
 * Returns true if the given nav item should render as active for the
 * current pathname. Exported so the desktop sidebar and mobile drawer
 * use identical matching logic.
 */
export function isPortalNavItemActive(
  item: PortalNavItem,
  pathname: string,
): boolean {
  if (pathname === item.href) return true;
  if (item.matchPrefixes?.some((p) => pathname.startsWith(p))) return true;
  return false;
}

/** Support email shared between desktop and mobile "Need a hand?". */
export const PORTAL_SUPPORT_EMAIL = "team@thefranchisorblueprint.com";
