"use client";

/**
 * PortalSidebarMobile — phone/tablet companion to `PortalSidebar`.
 *
 * Below md the desktop sidebar is hidden, so we render two pieces:
 *
 *  1. A compact top bar (hamburger + brand mark + small wordmark)
 *     pinned to the top of the viewport. The hamburger toggles the
 *     drawer.
 *  2. A slide-out left drawer that mirrors the desktop sidebar's
 *     content — same primary CTA, same secondary nav with progress
 *     rings, same Account / Upgrade / Need a hand affordances.
 *
 * Behavior:
 *  - Drawer slides in from -translate-x-full → translate-x-0.
 *  - Backdrop fades in behind it; tapping it closes the drawer.
 *  - Esc closes; selecting any nav item closes (handled both by the
 *    explicit onClick + a usePathname effect for client-side route
 *    changes that don't bubble through onClick).
 *  - Body scroll is locked while the drawer is open so the user
 *    can't scroll the underlying page through the backdrop.
 *
 *  Sign-out is intentionally absent — it lives on /portal/account
 *  now (mirrors the desktop sidebar).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  CircleUser,
  HelpCircle,
  Lock,
  Mail,
  Menu,
  Sparkles,
  X,
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
  blueprintPct?: number;
  checklistPct?: number;
  /** Tranche 13: free-tier flag — mirrors PortalSidebar.isFree. */
  isFree?: boolean;
};

export function PortalSidebarMobile({
  displayName,
  email,
  tier,
  blueprintPct = 0,
  checklistPct = 0,
  isFree = false,
}: Props) {
  const pathname = usePathname() || "";
  const showUpgrade = isFree || (tier !== undefined && tier < 3);
  const label = displayName?.trim() || email || "";
  const [open, setOpen] = useState(false);

  const { primary, secondary } = getPortalNavItems({
    blueprintPct,
    checklistPct,
    isFree,
  });

  const isActive = (item: PortalNavItem) =>
    isPortalNavItemActive(item, pathname);

  // Auto-close on client-side route change. usePathname updates after
  // navigation completes, so this fires once the user lands on the
  // new route — covers the case where Link's onClick fires but the
  // user hits Back, or where an outer element triggers navigation.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* Top bar — visible only below md, pinned to viewport top.
          Sits above the page (z-30) but below the drawer/backdrop
          (z-40) and the Jason chat dock (z-50). */}
      <div className="md:hidden sticky top-0 z-30 h-[56px] bg-navy text-cream border-b border-cream/10 flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="portal-mobile-drawer"
          className="w-10 h-10 flex items-center justify-center rounded-md text-cream hover:bg-cream/10 transition-colors"
        >
          <Menu size={22} />
        </button>
        <Link
          href="/portal"
          className="flex items-center gap-2 min-w-0"
          title="Dashboard"
        >
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <Image
              src="/icon-master.png"
              alt="The Franchisor Blueprint"
              width={32}
              height={32}
              priority
              className="brightness-0 invert"
            />
          </div>
          <span className="text-cream font-bold text-[13px] truncate">
            The Franchisor Blueprint
          </span>
        </Link>
      </div>

      {/* Backdrop — fades in/out. pointer-events-none when closed so
          it doesn't intercept taps on the page below. */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-40 bg-navy/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer — slides in from left. Always mounted so the slide
          animation runs both ways. aria-hidden flips with `open`. */}
      <aside
        id="portal-mobile-drawer"
        aria-label="Portal navigation"
        aria-hidden={!open}
        className={`md:hidden fixed top-0 left-0 h-screen w-[280px] max-w-[85vw] bg-navy text-cream z-40 flex flex-col shadow-[8px_0_32px_rgba(30,58,95,0.32)] transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header: brand + close button. Mirrors the desktop logo
            row but trades the collapse toggle for an X. */}
        <div className="flex items-center justify-between gap-3 h-[72px] px-3 border-b border-cream/10 flex-shrink-0">
          <Link
            href="/portal"
            onClick={close}
            className="flex items-center gap-3 min-w-0"
            title="Dashboard"
          >
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <Image
                src="/icon-master.png"
                alt="The Franchisor Blueprint"
                width={36}
                height={36}
                className="brightness-0 invert"
              />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden min-w-0">
              <span className="text-cream font-bold text-[13px] truncate">
                The Franchisor Blueprint
              </span>
              <span className="text-cream/55 text-[10px] uppercase tracking-[0.14em] font-semibold truncate">
                Customer Portal
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="w-9 h-9 flex items-center justify-center rounded-md text-cream/70 hover:text-cream hover:bg-cream/10 transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary CTA — gold "Continue Building". */}
        <div className="px-2 pt-3 pb-2 flex-shrink-0">
          <DrawerItem
            item={primary}
            active={isActive(primary)}
            onSelect={close}
            variant="primary"
          />
        </div>

        {/* Secondary nav. */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          <ul className="space-y-0.5">
            {secondary.map((item) => (
              <li key={item.href}>
                <DrawerItem
                  item={item}
                  active={isActive(item)}
                  onSelect={close}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom anchor: Account, Upgrade, Need a hand. No sign-out
            — that lives on /portal/account. */}
        <div className="border-t border-cream/10 px-2 py-2 flex-shrink-0 space-y-0.5">
          <Link
            href="/portal/account"
            onClick={close}
            title="Account"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              pathname === "/portal/account"
                ? "bg-cream text-navy"
                : "text-cream/80 hover:bg-cream/10 hover:text-cream"
            }`}
          >
            <CircleUser size={18} className="flex-shrink-0" />
            <span className="flex flex-col leading-tight overflow-hidden">
              <span className="truncate">Account</span>
              {label && (
                <span className="text-[11px] text-cream/55 font-normal truncate">
                  {label}
                </span>
              )}
            </span>
          </Link>
          {showUpgrade && (
            <Link
              href="/portal/upgrade"
              onClick={close}
              title="Upgrade your tier"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                pathname === "/portal/upgrade"
                  ? "bg-gold text-navy"
                  : "text-gold hover:bg-gold/15"
              }`}
            >
              <Sparkles size={18} className="flex-shrink-0" />
              <span className="truncate">Upgrade</span>
            </Link>
          )}
          <NeedAHandButton />
        </div>
      </aside>
    </>
  );
}

/**
 * DrawerItem — visually identical to the expanded `SidebarItem` in
 * `PortalSidebar`, since the drawer never collapses to icon-only.
 */
function DrawerItem({
  item,
  active,
  onSelect,
  variant = "default",
}: {
  item: PortalNavItem;
  active: boolean;
  onSelect: () => void;
  variant?: "default" | "primary";
}) {
  const Icon = item.icon;
  const hasProgress = typeof item.progressPct === "number";

  if (variant === "primary") {
    return (
      <Link
        href={item.href}
        onClick={onSelect}
        title={item.label}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm transition-colors ${
          active
            ? "bg-gold text-navy shadow-sm"
            : "bg-gold/95 text-navy hover:bg-gold"
        }`}
      >
        <Icon size={18} className="flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {hasProgress ? (
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
        ) : (
          <ArrowRight size={14} className="ml-auto flex-shrink-0" />
        )}
      </Link>
    );
  }

  // Tranche 13 (2026-05-10) — locked free-tier item in mobile drawer.
  // Mirrors the desktop sidebar: render as a button, dispatch the
  // tfb:locked-tab-click event. Also closes the drawer via onSelect.
  if (item.locked) {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("tfb:locked-tab-click", {
                detail: {
                  href: item.href,
                  label: item.label,
                  carrot: item.lockedCarrot ?? "",
                },
              }),
            );
          }
          onSelect?.();
        }}
        title={item.label}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-cream/55 hover:text-cream hover:bg-cream/10 cursor-pointer"
      >
        <Icon size={18} className="flex-shrink-0" />
        <span className="truncate flex-1 text-left">{item.label}</span>
        <Lock size={14} className="ml-auto flex-shrink-0 text-gold-warm" aria-hidden />
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onSelect}
      title={item.label}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-cream text-navy"
          : "text-cream/80 hover:bg-cream/10 hover:text-cream"
      }`}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span className="truncate">{item.label}</span>
      {hasProgress && (
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
 * ProgressRing — thin SVG ring matching the desktop sidebar's
 * indicator. Inline stroke colors so Tailwind's class extractor
 * doesn't purge them.
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
 * NeedAHandButton — copies the support email and shows a brief
 * "Email copied" toast. Mirrors the desktop sidebar's behavior but
 * positions the toast above the button (the drawer is anchored to
 * the left edge, so a left-side tooltip would clip).
 */
function NeedAHandButton() {
  const [phase, setPhase] = useState<"idle" | "visible" | "fading">("idle");

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(PORTAL_SUPPORT_EMAIL);
      setPhase("visible");
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
        title={`Copy ${PORTAL_SUPPORT_EMAIL}`}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-cream/80 hover:bg-cream/10 hover:text-cream transition-colors"
      >
        <HelpCircle size={18} className="flex-shrink-0" />
        <span className="flex flex-col items-start leading-tight overflow-hidden text-left">
          <span className="truncate">Need a hand?</span>
          <span className="text-[10px] text-cream/55 font-normal truncate">
            {PORTAL_SUPPORT_EMAIL}
          </span>
        </span>
      </button>
      {phase !== "idle" && (
        <div
          className="absolute left-3 right-3 bottom-full mb-2 z-50 rounded-lg bg-emerald-600 text-white text-xs px-3 py-2 shadow-lg transition-opacity duration-1000"
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
    </div>
  );
}
