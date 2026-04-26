import { CheckSquare } from "lucide-react";

/**
 * Device mockup composition for the Coaching Difference section.
 * Pure CSS/JSX — no external image dependencies.
 *
 *   [iPad behind, rotated]      [iPhone in front]
 *           [MacBook center stage with Ops Manual]
 *
 * Each "screen" content is a stylized representation of a real TFB
 * deliverable, branded in navy/gold.
 */
export function DeviceMockups() {
  return (
    <div className="relative w-full max-w-[640px] mx-auto aspect-[4/3]">
      {/* iPad — back left, slightly rotated */}
      <div className="absolute left-0 top-[8%] w-[44%] -rotate-6 z-10 drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]">
        <div className="bg-[#1a1a1a] rounded-[14px] p-[6px]">
          <div className="bg-white rounded-[10px] aspect-[3/4] overflow-hidden flex flex-col">
            {/* Discovery Day Deck mockup */}
            <div className="bg-navy h-1 flex-shrink-0" />
            <div className="px-3 pt-4 flex-1 flex flex-col">
              <div className="text-[6px] font-bold tracking-widest text-gold-warm uppercase mb-1">
                Discovery Day Deck
              </div>
              <div className="text-[10px] font-extrabold text-navy leading-tight mb-2">
                Why Franchise With Us
              </div>
              <div className="flex-1 bg-gradient-to-br from-navy to-navy-light rounded-sm flex items-center justify-center text-gold text-[8px] font-bold">
                <div className="text-center px-2">
                  <div className="text-[16px] font-extrabold leading-none mb-1">$33.5K</div>
                  <div className="text-[5px] tracking-widest uppercase opacity-80">System Value</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <div className="h-1 bg-navy/20 rounded-full" />
                <div className="h-1 bg-navy/20 rounded-full" />
                <div className="h-1 bg-gold rounded-full" />
              </div>
              <div className="text-[5px] text-navy/60 mt-1 text-center">3 / 29</div>
            </div>
          </div>
        </div>
      </div>

      {/* MacBook — center, dominant */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[12%] w-[78%] z-20 drop-shadow-[0_30px_50px_rgba(0,0,0,0.55)]">
        {/* Lid */}
        <div className="bg-[#2c2c2c] rounded-t-[10px] p-[6px] pb-0">
          <div className="bg-white rounded-t-[6px] aspect-[16/10] overflow-hidden">
            {/* Browser-style chrome */}
            <div className="bg-grey-1 border-b border-black/5 px-2 py-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
              <div className="ml-2 flex-1 bg-white rounded text-[5px] text-grey-4 px-2 py-0.5 truncate">
                operations-manual.pdf
              </div>
            </div>
            {/* Doc body */}
            <div className="px-5 py-4 bg-white">
              <div className="text-[7px] font-bold tracking-[0.18em] text-gold-warm uppercase mb-1.5">
                Chapter 4 · Brand Standards
              </div>
              <div className="text-[14px] font-extrabold text-navy leading-tight mb-3">
                Operations Manual
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div className="space-y-1">
                  <div className="h-1.5 bg-navy rounded-sm w-full" />
                  <div className="h-1 bg-navy/40 rounded-sm w-full" />
                  <div className="h-1 bg-navy/40 rounded-sm w-3/4" />
                  <div className="h-1 bg-navy/40 rounded-sm w-full" />
                  <div className="h-1 bg-navy/40 rounded-sm w-2/3" />
                  <div className="h-1.5 bg-gold rounded-sm w-full mt-2" />
                  <div className="h-1 bg-navy/40 rounded-sm w-full" />
                  <div className="h-1 bg-navy/40 rounded-sm w-1/2" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-grey-3/30 rounded w-full" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-11/12" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-full" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-10/12" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-full" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-11/12" />
                  <div className="h-3 bg-gold/15 border-l-2 border-gold mt-2" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-full mt-2" />
                  <div className="h-1.5 bg-grey-3/30 rounded w-9/12" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Hinge / base */}
        <div className="h-[10px] bg-gradient-to-b from-[#2c2c2c] to-[#1a1a1a] rounded-b-[3px] mx-[-3%]" />
        <div className="h-[3px] bg-[#0d0d0d] rounded-b-[6px] mx-[-3%]" />
      </div>

      {/* iPhone — front right */}
      <div className="absolute right-[2%] bottom-0 w-[20%] rotate-6 z-30 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]">
        <div className="bg-[#1a1a1a] rounded-[18px] p-[3px]">
          <div className="bg-white rounded-[15px] aspect-[9/19.5] overflow-hidden relative flex flex-col">
            {/* Notch */}
            <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-[35%] h-[6px] bg-[#1a1a1a] rounded-full z-10" />
            {/* Status bar */}
            <div className="bg-cream pt-3 pb-1 px-2 flex justify-end">
              <div className="text-[4px] font-semibold text-navy">100%</div>
            </div>
            {/* App content — Fact-Finding Checklist */}
            <div className="px-2 py-1.5 bg-white flex-1 flex flex-col">
              <div className="text-[5px] font-bold tracking-wider text-gold-warm uppercase">
                Fact-Finding
              </div>
              <div className="text-[7px] font-extrabold text-navy leading-tight mb-1">
                Checklist
              </div>
              <div className="flex-1 space-y-1 overflow-hidden">
                {[
                  { done: true, label: "Brand standards" },
                  { done: true, label: "Unit economics" },
                  { done: true, label: "Site selection" },
                  { done: false, label: "Vendor list" },
                  { done: false, label: "Training plan" },
                  { done: false, label: "Marketing kit" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${item.done ? "bg-gold" : "border border-navy/30"}`}
                    >
                      {item.done && (
                        <CheckSquare className="text-navy" size={6} />
                      )}
                    </div>
                    <div
                      className={`text-[5px] ${item.done ? "text-navy line-through opacity-60" : "text-navy font-semibold"}`}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-navy/10">
                <div className="text-[4px] text-navy/60 mb-0.5">Progress</div>
                <div className="h-0.5 bg-navy/10 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-gold" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
