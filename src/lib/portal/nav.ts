/**
 * Shared portal nav-item definitions, consumed by both the desktop
 * `PortalSidebar` and the mobile slide-out `PortalSidebarMobile`. The
 * two surfaces show the same nav with the same progress rings — only
 * the chrome differs (pinned rail vs. drawer + top bar) — so we
 * centralize the items here to keep them in sync.
 */
import {
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
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
};

export type PortalNavItems = {
  primary: PortalNavItem;
  secondary: PortalNavItem[];
};

/**
 * Build the portal nav. Caller passes the two derived progress
 * percentages so the rings stay in sync with whatever the layout
 * computed at request time.
 */
export function getPortalNavItems({
  blueprintPct = 0,
  checklistPct = 0,
}: {
  blueprintPct?: number;
  checklistPct?: number;
} = {}): PortalNavItems {
  const primary: PortalNavItem = {
    href: "/portal/lab/next",
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
