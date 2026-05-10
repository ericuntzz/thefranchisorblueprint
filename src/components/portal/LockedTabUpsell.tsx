"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Sparkles, X } from "lucide-react";

/**
 * LockedTabUpsell — contextual upsell modal mounted at the portal-
 * layout level. Listens for "tfb:locked-tab-click" custom events
 * emitted by the sidebar when a free-tier user clicks a locked
 * capability. Displays an outcome-framed carrot for that specific
 * capability + a single CTA into the strategy-call funnel.
 *
 * Tranche 13 (2026-05-10). Design follows the free-to-paid research
 * findings:
 *   - Show, don't hide (we let the user *see* what's locked)
 *   - Contextual paywall, not nag wall (modal fires ONLY on click,
 *     never on timer or login)
 *   - Headline the outcome (per-tab lockedCarrot copy is benefit-led)
 *   - Single CTA (Book a strategy call — pricing belongs on /programs,
 *     not on a modal)
 *   - Easy dismiss (X + click-outside + Escape)
 */

type LockedDetail = {
  href: string;
  label: string;
  carrot: string;
};

export function LockedTabUpsell() {
  const [detail, setDetail] = useState<LockedDetail | null>(null);

  useEffect(() => {
    function onLockedClick(e: Event) {
      const ce = e as CustomEvent<LockedDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
    }
    window.addEventListener("tfb:locked-tab-click", onLockedClick);
    return () =>
      window.removeEventListener("tfb:locked-tab-click", onLockedClick);
  }, []);

  // Escape-to-dismiss + body-scroll lock while open.
  useEffect(() => {
    if (!detail) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetail(null);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detail]);

  if (!detail) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="locked-upsell-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm"
      onClick={() => setDetail(null)}
    >
      <div
        className="relative max-w-[520px] w-full bg-cream rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.35)] p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setDetail(null)}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 text-grey-3 hover:text-navy transition-colors cursor-pointer"
        >
          <X size={20} aria-hidden />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/15">
            <Lock size={14} className="text-gold-warm" aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-warm">
            Blueprint capability
          </span>
        </div>

        <h2
          id="locked-upsell-title"
          className="text-navy font-bold text-2xl md:text-[26px] leading-tight mb-3"
        >
          {detail.label}
        </h2>

        <p className="text-navy/85 text-base md:text-[17px] leading-relaxed mb-6">
          {detail.carrot}
        </p>

        {/* Frosted preview placeholder — Tranche 13 ships the simpler
            version with copy only. A future tranche could mount the
            actual deliverable component here with a CSS mask blur. */}
        <div className="bg-white/60 border border-navy/10 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-gold-warm" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-warm">
              What unlocks with The Blueprint
            </span>
          </div>
          <ul className="space-y-1.5 text-navy/85 text-sm leading-relaxed">
            <li className="flex gap-2">
              <span className="text-gold-warm flex-shrink-0">→</span>
              <span>The complete 9-capability franchisor operating system.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-warm flex-shrink-0">→</span>
              <span>
                A 10× deeper market analysis — every U.S. ZIP, 20+ demographic
                and competitive signals, drive-time trade areas.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-warm flex-shrink-0">→</span>
              <span>
                A real partner through your first signed franchisee —
                not a binder and silence.
              </span>
            </li>
          </ul>
        </div>

        <Link
          href="/strategy-call"
          className="block w-full bg-gold hover:bg-gold-dark text-navy font-bold text-base px-7 py-4 rounded-full transition-colors text-center inline-flex items-center justify-center gap-2"
          onClick={() => setDetail(null)}
        >
          Book a 15-min strategy call
          <ArrowRight size={18} aria-hidden />
        </Link>

        <p className="text-center mt-4">
          <Link
            href="/programs"
            className="text-grey-3 hover:text-navy text-sm underline-offset-4 hover:underline transition-colors"
            onClick={() => setDetail(null)}
          >
            See what&apos;s included
          </Link>
        </p>
      </div>
    </div>
  );
}
