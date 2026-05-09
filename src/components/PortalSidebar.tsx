"use client";

/**
 * PortalSidebar — persistent left-side navigation for the customer
 * portal, modeled after QuickBooks-style enterprise apps.
 *
 * Design:
 *  - Navy background, cream/white text. Active item is a white pill
 *    with navy text — inversion mirrors the contrast of the rest
 *    of the portal where chapter cards are white on cream.
 *  - "Continue Building" sits at the top in gold to project the
 *    primary call-to-action; matches the gold "Continue building"
 *    pill on the dashboard so users recognize it as the same path.
 *  - Two derived progress circles (Continue Building, Launch
 *    Checklist) — same visual idiom as the Claude Code context
 *    indicator. Expanded: ring sits to the right of the label.
 *    Collapsed: ring wraps around the icon (more space-efficient).
 *  - Collapse toggle anchored at the bottom near Account so it
 *    doesn't compete for attention with the primary nav items.
 *  - Auto-collapses when the Jason chat dock opens, via the
 *    `tfb-jason-dock-state` custom event.
 *  - Need a hand entry at the very bottom with copy-to-clipboard.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  CircleUser,
  HelpCircle,
  Mail,
  Sparkles,
} from "lucide-react";
import type { Tier } from "@/lib/supabase/types";
import {
  getPortalNavItems,
  isPortalNavItemActive,
  PORTAL_SUPPORT_EMAIL,
  type PortalNavItem,
} from "@/lib/portal/nav";

type Props = {
  displayName: string | null;
  email: string | null;
  tier?: Tier;
  /** Overall blueprint progress (0–100). Drives the ring around the
   *  primary "Continue Building" entry. */
  blueprintPct?: number;
  /** Launch-checklist progress (0–100). Drives the ring around the
   *  Launch Checklist entry. */
  checklistPct?: number;
};

export function PortalSidebar({
  displayName,
  email,
  tier,
  blueprintPct = 0,
  checklistPct = 0,
}: Props) {
  const pathname = usePathname() || "";
  const showUpgrade = tier !== undefined && tier < 3;
  const label = displayName?.trim() || email || "";

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("tfb-sidebar-collapsed");
      if (v === "1") setCollapsed(true);
    } catch {
      /* localStorage may be blocked — non-fatal */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("tfb-sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      /* non-fatal */
    }
    document.documentElement.style.setProperty(
      "--portal-sidebar-w",
      collapsed ? "64px" : "240px",
    );
  }, [collapsed]);
  useEffect(() => {
    function onDockState(e: Event) {
      const ce = e as CustomEvent<{ open: boolean }>;
      if (ce.detail?.open) setCollapsed(true);
    }
    window.addEventListener("tfb-jason-dock-state", onDockState);
    return () => window.removeEventListener("tfb-jason-dock-state", onDockState);
  }, []);

  const { primary, secondary } = getPortalNavItems({
    blueprintPct,
    checklistPct,
  });

  const isActive = (item: PortalNavItem) =>
    isPortalNavItemActive(item, pathname);

  const widthClass = collapsed ? "w-[64px]" : "w-[240px]";
  const showLabels = !collapsed;

  return (
    <aside
      className={`hidden md:flex flex-col fixed top-0 left-0 h-screen bg-navy text-cream z-30 transition-[width] duration-200 ${widthClass}`}
      aria-label="Portal navigation"
    >
      {/* Logo. The PNG mark is rendered with a brightness/invert
          filter so it shows white on the navy bar. Avoids the round-
          trip of authoring a separate white SVG. */}
      <Link
        href="/portal"
        className="flex items-center gap-3 h-[72px] px-3 border-b border-cream/10 flex-shrink-0"
        title="Dashboard"
      >
        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
          <Image
            src="/icon-master.png"
            alt="The Franchisor Blueprint"
            width={36}
            height={36}
            priority
            className="brightness-0 invert"
          />
        </div>
        {showLabels && (
          <div className="flex flex-col leading-tight overflow-hidden min-w-0">
            <span className="text-cream font-bold text-[13px] truncate">
              The Franchisor Blueprint
            </span>
            <span className="text-cream/55 text-[10px] uppercase tracking-[0.14em] font-semibold truncate">
              Customer Portal
            </span>
          </div>
        )}
      </Link>

      {/* Primary CTA — gold "Continue Building" */}
      <div className="px-2 pt-3 pb-2 flex-shrink-0">
        <SidebarItem
          item={primary}
          active={isActive(primary)}
          collapsed={collapsed}
          variant="primary"
        />
      </div>

      {/* Secondary nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <ul className="space-y-0.5">
          {secondary.map((item) => (
            <li key={item.href}>
              <SidebarItem
                item={item}
                active={isActive(item)}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom anchor: Account, Upgrade, Need a hand, then a small
          collapse toggle row. Sign-out lives inside the Account page
          now. */}
      <div className="border-t border-cream/10 px-2 py-2 flex-shrink-0 space-y-0.5">
        <Link
          href="/portal/account"
          title="Account"
          className={`flex items-center gap-3 ${
            collapsed ? "justify-center" : ""
          } px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            pathname === "/portal/account"
              ? "bg-cream text-navy"
              : "text-cream/80 hover:bg-cream/10 hover:text-cream"
          }`}
        >
          <CircleUser size={18} className="flex-shrink-0" />
          {showLabels && (
            <span className="flex flex-col leading-tight overflow-hidden">
              <span className="truncate">Account</span>
              {label && (
                <span className="text-[11px] text-cream/55 font-normal truncate">
                  {label}
                </span>
              )}
            </span>
          )}
        </Link>
        {showUpgrade && (
          <Link
            href="/portal/upgrade"
            title="Upgrade your tier"
            className={`flex items-center gap-3 ${
              collapsed ? "justify-center" : ""
            } px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              pathname === "/portal/upgrade"
                ? "bg-gold text-navy"
                : "text-gold hover:bg-gold/15"
            }`}
          >
            <Sparkles size={18} className="flex-shrink-0" />
            {showLabels && <span className="truncate">Upgrade</span>}
          </Link>
        )}
        <NeedAHandButton collapsed={collapsed} />
        {/* Collapse toggle row — small, low-priority, lives at the
            very bottom so it doesn't compete with primary nav. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center gap-2 ${
            collapsed ? "justify-center" : ""
          } px-3 py-2 rounded-md text-cream/55 hover:text-cream hover:bg-cream/5 transition-colors`}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          {showLabels && (
            <span className="text-[11px] font-normal">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  active,
  collapsed,
  variant = "default",
}: {
  item: PortalNavItem;
  active: boolean;
  collapsed: boolean;
  variant?: "default" | "primary";
}) {
  const Icon = item.icon;
  const hasProgress = typeof item.progressPct === "number";
  const showLabels = !collapsed;

  if (variant === "primary") {
    return (
      <Link
        href={item.href}
        title={item.label}
        className={`flex items-center gap-3 ${
          collapsed ? "justify-center px-2" : "px-3"
        } py-3 rounded-xl font-bold text-sm transition-colors ${
          active
            ? "bg-gold text-navy shadow-sm"
            : "bg-gold/95 text-navy hover:bg-gold"
        }`}
      >
        {hasProgress && collapsed ? (
          // Collapsed: progress ring wraps the icon (most efficient
          // use of the 64px rail).
          <ProgressRing
            pct={item.progressPct ?? 0}
            fillColor="#1E3A5F"
            trackColor="rgba(30, 58, 95, 0.18)"
            size={32}
          >
            <Icon size={17} className="text-navy" />
          </ProgressRing>
        ) : (
          <Icon size={18} className="flex-shrink-0" />
        )}
        {showLabels && <span className="truncate">{item.label}</span>}
        {showLabels && hasProgress && (
          // Expanded: progress ring sits at the right edge so it
          // reads as a status indicator next to the label.
          <span className="ml-auto flex-shrink-0">
            <ProgressRing
              pct={item.progressPct ?? 0}
              fillColor="#1E3A5F"
              trackColor="rgba(30, 58, 95, 0.18)"
              size={20}
            >
              <span className="text-[9px] font-bold text-navy tabular-nums leading-none">
                {Math.round(item.progressPct ?? 0)}
              </span>
            </ProgressRing>
          </span>
        )}
        {showLabels && !hasProgress && (
          <ArrowRight size={14} className="ml-auto flex-shrink-0" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={item.label}
      className={`flex items-center gap-3 ${
        collapsed ? "justify-center px-2" : "px-3"
      } py-2.5 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-cream text-navy"
          : "text-cream/80 hover:bg-cream/10 hover:text-cream"
      }`}
    >
      {hasProgress && collapsed ? (
        <ProgressRing
          pct={item.progressPct ?? 0}
          fillColor={active ? "#1E3A5F" : "#D4A24C"}
          trackColor={
            active ? "rgba(30, 58, 95, 0.18)" : "rgba(245, 240, 224, 0.22)"
          }
          size={32}
        >
          <Icon size={17} className={active ? "text-navy" : "text-cream"} />
        </ProgressRing>
      ) : (
        <Icon size={18} className="flex-shrink-0" />
      )}
      {showLabels && <span className="truncate">{item.label}</span>}
      {showLabels && hasProgress && (
        <span className="ml-auto flex-shrink-0">
          <ProgressRing
            pct={item.progressPct ?? 0}
            fillColor={active ? "#1E3A5F" : "#D4A24C"}
            trackColor={
              active ? "rgba(30, 58, 95, 0.18)" : "rgba(245, 240, 224, 0.22)"
            }
            size={20}
          >
            <span
              className={`text-[9px] font-bold tabular-nums leading-none ${
                active ? "text-navy" : "text-cream"
              }`}
            >
              {Math.round(item.progressPct ?? 0)}
            </span>
          </ProgressRing>
        </span>
      )}
    </Link>
  );
}

/**
 * ProgressRing — small SVG ring that draws stroke proportional to
 * `pct` (0..100). Used next to "Continue Building" and "Launch
 * Checklist" entries as a Claude-Code-style context indicator.
 *
 * Stroke colors are passed inline (not via Tailwind classes) because
 * Tailwind's class extractor can't see template-string class names
 * and would purge them.
 */
function ProgressRing({
  pct,
  size = 22,
  fillColor = "#D4A24C",
  trackColor = "rgba(245, 240, 224, 0.22)",
  children,
}: {
  pct: number;
  size?: number;
  fillColor?: string;
  trackColor?: string;
  children: React.ReactNode;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (safe / 100) * c;
  return (
    <span
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${Math.round(safe)}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={trackColor}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          stroke={fillColor}
        />
      </svg>
      <span className="relative flex items-center justify-center">
        {children}
      </span>
    </span>
  );
}

/**
 * NeedAHandButton — bottom-of-rail support entry. Click copies the
 * support email to the clipboard and shows a brief "Email copied"
 * tooltip with a slow fade-out so the customer has time to read it.
 */
function NeedAHandButton({ collapsed }: { collapsed: boolean }) {
  // Two-phase state lets us trigger the fade-out a moment before
  // the actual unmount: 'visible' = fully shown, 'fading' = opacity
  // 0 with a transition, then unmount.
  const [phase, setPhase] = useState<"idle" | "visible" | "fading">("idle");
  const showLabels = !collapsed;

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(PORTAL_SUPPORT_EMAIL);
      setPhase("visible");
      // Stay fully visible for 4.5s, then fade for 1.2s, then unmount.
      window.setTimeout(() => setPhase("fading"), 4500);
      window.setTimeout(() => setPhase("idle"), 5700);
    } catch {
      window.location.href = `mailto:${PORTAL_SUPPORT_EMAIL}`;
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        title={showLabels ? `Copy ${PORTAL_SUPPORT_EMAIL}` : "Need a hand?"}
        className={`w-full flex items-center gap-3 ${
          collapsed ? "justify-center px-2" : "px-3"
        } py-2.5 rounded-lg text-sm font-semibold text-cream/80 hover:bg-cream/10 hover:text-cream transition-colors`}
      >
        <HelpCircle size={18} className="flex-shrink-0" />
        {showLabels && (
          <span className="flex flex-col items-start leading-tight overflow-hidden text-left">
            <span className="truncate">Need a hand?</span>
            <span className="text-[10px] text-cream/55 font-normal truncate">
              {PORTAL_SUPPORT_EMAIL}
            </span>
          </span>
        )}
      </button>
      {phase !== "idle" && showLabels && (
        <div
          className="absolute left-full ml-3 bottom-0 z-50 w-[240px] rounded-lg bg-emerald-600 text-white text-xs px-3 py-2 shadow-lg transition-opacity duration-1000"
          style={{ opacity: phase === "fading" ? 0 : 1 }}
        >
          <div className="flex items-center gap-1.5 font-semibold mb-0.5">
            <Mail size={12} />
            Email copied
          </div>
          <div className="text-emerald-50">
            Drop us a line — we usually reply within a few hours.
          </div>
        </div>
      )}
      {phase !== "idle" && !showLabels && (
        <div
          className="absolute left-full ml-2 bottom-2 z-50 rounded-md bg-emerald-600 text-white text-xs px-2 py-1 shadow-lg whitespace-nowrap font-semibold transition-opacity duration-1000"
          style={{ opacity: phase === "fading" ? 0 : 1 }}
        >
          Email copied
        </div>
      )}
    </div>
  );
}
