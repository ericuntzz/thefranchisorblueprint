import { Sparkles } from "lucide-react";

/**
 * Welcome banner shown on /portal when the customer's signup
 * carried an intake snapshot merge with it. Communicates the
 * sunk-cost angle: "you already did meaningful work — here's
 * what we kept."
 *
 * Server-rendered. Hidden when nothing was merged.
 */
export function IntakeWelcomeBanner({
  domain,
  readinessPct,
  expansionMarketCount,
}: {
  domain: string;
  readinessPct: number;
  expansionMarketCount: number;
}) {
  return (
    <div className="bg-gradient-to-br from-navy to-navy-light text-white border-b border-gold/30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-6 md:py-7">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center text-gold">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold mb-1">
              Picking up where we left off
            </p>
            <p className="text-white text-base md:text-lg font-semibold leading-snug">
              You&apos;re already{" "}
              <span className="text-gold font-extrabold tabular-nums">
                {readinessPct}% Franchise Ready
              </span>
              .
            </p>
            <p className="text-white/75 text-sm leading-relaxed mt-1">
              When you dropped <span className="font-semibold text-white">{domain}</span>{" "}
              on our home page, we pre-filled your concept, brand voice, prototype trade
              area, and{" "}
              <span className="font-semibold text-white">
                {expansionMarketCount} expansion-market
                {expansionMarketCount === 1 ? "" : "s"}
              </span>{" "}
              into your portal. Verify what we got right, fix what we got wrong, and
              Jason AI will guide you through the rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
