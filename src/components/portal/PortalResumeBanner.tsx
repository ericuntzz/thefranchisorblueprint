"use client";

/**
 * Floating "continue your blueprint" banner for the portal dashboard.
 *
 * Replaces the prior inline "Continue where you left off / Your next
 * move" section that lived between the Command Center and the phase
 * sections. Pulled into a floating surface to mirror the
 * AssessmentResumeBanner pattern — same design language (cream + gold
 * border, gradient navy icon tile, gold pill CTA, dismiss X) and the
 * same fixed bottom-center position so the customer learns one place
 * to look for "what's next."
 *
 * Server-rendered data is passed in via props — no fetch on mount.
 *
 * Dismissal is keyed on the capability slug, so when the customer
 * finishes one capability and a new "next move" appears, the banner
 * comes back. This avoids the failure mode where dismissing once
 * silences guidance for the rest of the session.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

const DISMISS_KEY = "tfb_portal_resume_banner_dismissed_slug";

interface PortalResumeBannerProps {
  capabilitySlug: string;
  capabilityTitle: string;
  /**
   * true  → customer started this capability already → "Continue where you left off"
   * false → customer hasn't started yet → "Your next move"
   */
  isReturning: boolean;
}

export function PortalResumeBanner({
  capabilitySlug,
  capabilityTitle,
  isReturning,
}: PortalResumeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Re-run when the slug changes — finishing one capability and getting
  // a new "next move" should bring the banner back even if they
  // dismissed the previous one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(DISMISS_KEY);
    setDismissed(stored === capabilitySlug);
  }, [capabilitySlug]);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, capabilitySlug);
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  const label = isReturning ? "Continue where you left off" : "Your next move";

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(640px,calc(100%-2rem))] tfb-stage-in"
      role="region"
      aria-label="Continue your Blueprint"
    >
      <div className="bg-cream border border-gold/40 rounded-2xl shadow-[0_24px_48px_rgba(30,58,95,0.20),0_8px_16px_rgba(30,58,95,0.08)] flex items-center gap-3 pl-3 pr-2 py-2.5 md:pl-4 md:pr-3 md:py-3">
        <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
          <ArrowRight size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] md:text-[11px] font-bold tracking-[0.16em] uppercase text-gold-warm leading-tight">
            {label}
          </div>
          <div className="text-navy font-bold text-sm md:text-[15px] leading-tight mt-0.5 truncate">
            {capabilityTitle}
          </div>
        </div>
        <Link
          href={`/portal/${capabilitySlug}`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-gold text-navy font-bold text-[11px] md:text-xs uppercase tracking-[0.1em] px-3.5 py-2 md:px-4 md:py-2.5 rounded-full hover:bg-gold-dark transition-colors whitespace-nowrap"
        >
          Continue
          <ArrowRight size={13} />
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 w-8 h-8 rounded-full text-navy/50 hover:text-navy hover:bg-navy/5 flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
