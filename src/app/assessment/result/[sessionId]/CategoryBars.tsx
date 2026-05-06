"use client";

/**
 * Animated category bars for the assessment result page. The bars animate
 * from 0 → ratio on mount via a one-shot useEffect + CSS transition. Pure
 * presentational — fed by the server-side computeResult() output.
 */

import { useEffect, useState } from "react";
import type { CategoryResult } from "@/lib/assessment/scoring";

export function CategoryBars({ categories }: { categories: CategoryResult[] }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Tiny delay so the initial 0% paints before the transition runs.
    const t = window.setTimeout(() => setRevealed(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <ol className="space-y-5 list-none">
      {categories.map((c, i) => {
        const targetWidth = revealed ? `${Math.max(2, c.ratio * 100)}%` : "0%";
        return (
          <li key={c.slug}>
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-navy font-bold text-sm md:text-base">
                {c.title}
              </h3>
              <div className="text-grey-3 text-xs md:text-sm font-bold tabular-nums">
                {c.score} / {c.max}
              </div>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(c.ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 bg-navy/8 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(30, 58, 95, 0.08)" }}
              aria-label={`${c.title}: ${c.score} of ${c.max}`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold-warm"
                style={{
                  width: targetWidth,
                  transition: `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${
                    i * 80
                  }ms`,
                }}
              />
            </div>
            <p className="text-grey-3 text-xs md:text-[13px] leading-relaxed mt-1.5">
              {c.description}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
