"use client";

/**
 * Site-wide "you started the assessment, come back and finish it" banner.
 *
 * Renders only when ALL of these are true:
 *   - /api/assessment/status reports inProgress (it reads the HttpOnly
 *     resume cookie server-side; the client doesn't see the token)
 *   - The user hasn't dismissed the banner this browser session
 *   - The user isn't currently on /assessment (they're already there)
 *   - The user isn't on /portal (paying customer, different journey)
 *
 * Mounted in src/app/layout.tsx so it follows the user across the site.
 * Cheap: a single fetch on mount, no polling. Style matches the rest of
 * the site — cream + navy + gold pill, gentle slide-up from the bottom.
 *
 * Note on the cookie: the previous version read a JS-readable cookie to
 * decide whether to even hit /status. The cookie is now HttpOnly so the
 * banner unconditionally calls /status — the server returns
 * inProgress:false in <50ms when there's no cookie, and the banner just
 * stays hidden. Cost is one cheap request per page load on non-portal
 * marketing routes; benefit is the result-page credential is no longer
 * exposed to client-side scripts.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";

const DISMISS_KEY = "tfb_assessment_banner_dismissed";

interface Status {
  inProgress: boolean;
  answered?: number;
  total?: number;
}

/**
 * Pages where the banner has nothing useful to add and would be in the
 * way: the assessment itself, the result page, the portal, the login,
 * and any embedded auth pages. Matched as path-prefixes.
 */
const HIDDEN_PREFIXES = ["/assessment", "/portal", "/auth", "/api"];

export function AssessmentResumeBanner() {
  const pathname = usePathname() ?? "/";
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Decide eligibility before any fetch so we don't waste a request on
  // pages where we'd hide the banner anyway.
  const isOnHiddenSurface = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    if (isOnHiddenSurface) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        // No token in URL — the HttpOnly cookie auto-attaches and the
        // server reads it. Returns inProgress:false fast when no cookie
        // is present, so this is cheap on cookieless visits too.
        const res = await fetch("/api/assessment/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (cancelled) return;
        // Only surface if they actually started answering — banner for an
        // empty session would feel pestering.
        if (
          data.inProgress &&
          (data.answered ?? 0) > 0 &&
          (data.answered ?? 0) < (data.total ?? 15)
        ) {
          setStatus(data);
        }
      } catch {
        /* network error — banner just stays hidden, no impact */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isOnHiddenSurface]);

  if (isOnHiddenSurface || dismissed || !status?.inProgress) return null;

  const answered = status.answered ?? 0;
  const total = status.total ?? 15;
  const remaining = total - answered;
  // ~25 seconds per question is a reasonable estimate for "X minutes left."
  const minutesLeft = Math.max(1, Math.ceil((remaining * 25) / 60));

  function dismiss() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(640px,calc(100%-2rem))] tfb-stage-in"
      role="region"
      aria-label="Resume Franchise Readiness Assessment"
    >
      <div className="bg-cream border border-gold/40 rounded-2xl shadow-[0_24px_48px_rgba(30,58,95,0.20),0_8px_16px_rgba(30,58,95,0.08)] flex items-center gap-3 pl-3 pr-2 py-2.5 md:pl-4 md:pr-3 md:py-3">
        <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-navy font-bold text-sm md:text-[15px] leading-tight">
            You&apos;re {answered} of {total} into the assessment.
          </div>
          <div className="text-grey-3 text-xs md:text-[13px] leading-tight mt-0.5">
            About {minutesLeft} {minutesLeft === 1 ? "minute" : "minutes"} to your franchise readiness score.
          </div>
        </div>
        <Link
          href="/assessment"
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-gold text-navy font-bold text-[11px] md:text-xs uppercase tracking-[0.1em] px-3.5 py-2 md:px-4 md:py-2.5 rounded-full hover:bg-gold-dark transition-colors whitespace-nowrap"
        >
          Resume
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
