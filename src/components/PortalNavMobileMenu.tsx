"use client";

/**
 * Mobile menu for the portal nav. Renders as a hamburger button on small
 * screens; opens an inline dropdown panel below the nav with Account /
 * Upgrade / Sign out so phone-sized users aren't stuck with just a logo
 * + sign-out button.
 *
 * Hidden on md+ where the desktop nav already exposes all of these
 * affordances inline. Closes on:
 *   - Esc key
 *   - Clicking outside the panel
 *   - Selecting any link inside (path nav does this naturally on
 *     client-side route change, but we explicitly close on click for
 *     same-page anchors / immediate visual feedback)
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Library, LogOut, Menu, Sparkles, User, X } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";

interface MobileMenuProps {
  label: string;
  /** undefined → don't show Upgrade. < 3 → show. */
  tier?: Tier;
}

export function PortalNavMobileMenu({ label, tier }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showUpgrade = tier !== undefined && tier < 3;

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="md:hidden relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="portal-mobile-menu"
        className="w-10 h-10 flex items-center justify-center rounded-full text-navy hover:bg-navy/5 transition-colors"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          id="portal-mobile-menu"
          role="menu"
          aria-label="Portal menu"
          className="absolute right-0 top-full mt-2 w-[260px] bg-white rounded-2xl border border-navy/10 shadow-[0_18px_40px_rgba(30,58,95,0.18)] py-2 z-50"
        >
          {label && (
            <div className="px-4 py-3 border-b border-navy/5">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-0.5">
                Signed in
              </div>
              <div className="text-navy font-semibold text-sm truncate">
                {label}
              </div>
            </div>
          )}

          <Link
            href="/portal/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-navy hover:bg-cream transition-colors"
          >
            <User size={16} className="text-grey-4" />
            <span className="text-sm font-semibold">Account</span>
          </Link>

          <Link
            href="/portal/library"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-navy hover:bg-cream transition-colors"
          >
            <Library size={16} className="text-grey-4" />
            <span className="text-sm font-semibold">Library</span>
          </Link>

          {showUpgrade && (
            <Link
              href="/portal/upgrade"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-navy hover:bg-cream transition-colors"
            >
              <Sparkles size={16} className="text-gold-warm" />
              <span className="text-sm font-bold text-gold-warm">Upgrade</span>
            </Link>
          )}

          <div className="border-t border-navy/5 mt-1 pt-1">
            <form action="/api/portal/logout" method="POST">
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-3 text-navy hover:bg-cream transition-colors cursor-pointer"
              >
                <LogOut size={16} className="text-grey-4" />
                <span className="text-sm font-semibold">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
