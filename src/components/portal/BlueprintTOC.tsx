"use client";

/**
 * Sidebar table-of-contents for the assembled-view Blueprint page.
 *
 * Three jobs the prior server-rendered version couldn't do:
 *
 *   1. Scrollspy — the row whose chapter is currently in the
 *      viewport "active band" lights up, so as the customer reads
 *      down the assembled doc the sidebar tracks where they are.
 *      Active band = top 25% of viewport (rootMargin trick) — a
 *      chapter becomes active when its top crosses into that band.
 *
 *   2. Sticky behavior that doesn't cut the header off — the panel
 *      is capped at viewport height with internal overflow so even
 *      when content exceeds the screen, the "Your Blueprint" eyebrow
 *      stays visible at the top.
 *
 *   3. Click-to-jump that immediately sets active state without
 *      waiting for the IntersectionObserver to fire on next paint.
 *      Avoids the visual flicker where the wrong row stays
 *      highlighted for ~100ms after click.
 *
 * Intentionally a thin client island — the page above it is fully
 * server-rendered, this only hydrates on the client because
 * IntersectionObserver and click handlers need to live there.
 */

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export interface BlueprintTOCItem {
  slug: string;
  title: string;
  filled: boolean;
}

interface BlueprintTOCProps {
  items: BlueprintTOCItem[];
}

export function BlueprintTOC({ items }: BlueprintTOCProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(
    items[0]?.slug ?? null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Track which chapter is currently in the "active band" near the
    // top of the viewport. rootMargin negative-top + negative-bottom
    // creates a thin horizontal strip; whichever chapter has its top
    // inside this strip is the active one.
    //
    // -20% top means: nothing counts as active until it's scrolled
    // past the top 20% of the viewport.
    // -70% bottom means: chapters whose tops are below the 30% mark
    // don't count as active either.
    // Result: a 10%-tall band roughly 20-30% from the top of the
    // viewport — same pattern docs sites use.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id.startsWith("chapter-")) {
              setActiveSlug(id.slice("chapter-".length));
            }
          }
        }
      },
      {
        rootMargin: "-20% 0% -70% 0%",
        threshold: 0,
      },
    );

    const elements: Element[] = [];
    for (const { slug } of items) {
      const el = document.getElementById(`chapter-${slug}`);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => observer.disconnect();
  }, [items]);

  function handleClick(
    e: MouseEvent<HTMLAnchorElement>,
    slug: string,
  ) {
    // Set active immediately — IntersectionObserver lags by a frame
    // and we don't want the wrong row staying highlighted while the
    // browser scrolls. The href="#..." still does the actual
    // navigation; we don't preventDefault.
    void e;
    setActiveSlug(slug);
  }

  return (
    <nav
      className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1 -mr-1"
      aria-label="Chapters"
    >
      <div className="mb-4 pb-4 border-b border-navy/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
          Your Blueprint
        </div>
        <div className="text-grey-4 text-xs">{items.length} chapters</div>
      </div>
      <ol className="space-y-0.5">
        {items.map(({ slug, title, filled }, idx) => {
          const isActive = activeSlug === slug;
          return (
            <li key={slug}>
              <a
                href={`#chapter-${slug}`}
                onClick={(e) => handleClick(e, slug)}
                aria-current={isActive ? "location" : undefined}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                  isActive
                    ? "bg-white text-navy ring-1 ring-gold/40 shadow-[0_2px_8px_rgba(30,58,95,0.06)]"
                    : "text-grey-3 hover:text-navy hover:bg-white"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tabular-nums w-5 text-right transition-colors ${
                    isActive
                      ? "text-gold-warm font-bold"
                      : "text-grey-4 group-hover:text-gold-warm"
                  }`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {/* Status indicator — empty state is a pure ring,
                    filled state is the same ring + check icon, so
                    the geometric center is identical between both
                    states (no offset from inner-dot rendering). */}
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded-full ring-inset flex items-center justify-center transition-colors ${
                    filled
                      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                      : isActive
                        ? "bg-white ring-1 ring-navy/30"
                        : "bg-white ring-1 ring-grey-3/40 group-hover:ring-navy/25"
                  }`}
                  aria-label={filled ? "Filled" : "Empty"}
                >
                  {filled && <Check size={10} strokeWidth={3} />}
                </span>
                <span
                  className={`text-[13px] leading-snug ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {title}
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      {/* "Continue building" CTA mirrors the end-of-doc closing card.
          Lives at the bottom of the TOC scroll area so it appears
          when the customer scrolls the sidebar list to the end —
          same forward push as the closing card, but reachable
          without scrolling the whole document. */}
      <div className="mt-5 pt-4 border-t border-navy/10">
        <Link
          href="/portal/lab/next"
          className="group flex items-center justify-between gap-2 rounded-full bg-gold text-navy hover:bg-gold-dark font-bold text-[11px] uppercase tracking-[0.1em] pl-4 pr-3 py-2.5 transition-colors"
        >
          <span>Continue building</span>
          <ArrowRight
            size={13}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        <p className="mt-2 text-[11px] text-grey-4 leading-snug">
          Pick up where you left off — Jason has the next question
          ready.
        </p>
      </div>
    </nav>
  );
}
