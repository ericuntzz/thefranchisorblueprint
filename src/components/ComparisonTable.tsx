import { Check, X, Minus } from "lucide-react";

type Cell = "yes" | "no" | "partial";

const rows: { label: string; diy: Cell; consultant: Cell; tfb: Cell }[] = [
  { label: "Complete Franchisor Operating System", diy: "no", consultant: "yes", tfb: "yes" },
  { label: "Decode the FDD (all 23 federal items)", diy: "no", consultant: "partial", tfb: "yes" },
  { label: "Codify Your Operations (17-chapter manual)", diy: "no", consultant: "yes", tfb: "yes" },
  { label: "Score Real Estate Like a Franchisor", diy: "no", consultant: "partial", tfb: "yes" },
  { label: "Qualify Every Candidate (scoring matrix)", diy: "no", consultant: "partial", tfb: "yes" },
  { label: "Close Discovery Day (29-slide deck)", diy: "no", consultant: "partial", tfb: "yes" },
  { label: "6-Month 1:1 Coaching Calls", diy: "no", consultant: "no", tfb: "yes" },
  { label: "Weekly Accountability + Milestones", diy: "no", consultant: "no", tfb: "yes" },
  { label: "Framework Review & Feedback", diy: "no", consultant: "no", tfb: "yes" },
  { label: "Attorney + CPA Referrals", diy: "no", consultant: "yes", tfb: "yes" },
  { label: "“Franchise Ready” Certification", diy: "no", consultant: "no", tfb: "yes" },
];

function CellIcon({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <div className="inline-flex w-7 h-7 rounded-full bg-emerald-500/15 items-center justify-center">
        <Check size={16} className="text-emerald-600" strokeWidth={3} />
      </div>
    );
  }
  if (value === "no") {
    return (
      <div className="inline-flex w-7 h-7 rounded-full bg-red-500/10 items-center justify-center">
        <X size={16} className="text-red-500" strokeWidth={3} />
      </div>
    );
  }
  return (
    <div className="inline-flex w-7 h-7 rounded-full bg-amber-500/15 items-center justify-center">
      <Minus size={16} className="text-amber-600" strokeWidth={3} />
    </div>
  );
}

export function ComparisonTable() {
  return (
    <div>
      {/* Mobile-only swipe hint */}
      <div className="md:hidden text-center text-xs text-grey-4 mb-3 italic">
        Swipe horizontally to see all columns →
      </div>
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2">
        <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(30,58,95,0.18)] border border-navy/10 bg-white min-w-[680px]">
          {/* Header row */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-grey-1">
        <div className="px-6 py-6 md:px-8 md:py-8" />
        <div className="px-2 py-6 md:py-8 text-center border-l border-navy/10">
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-3 mb-2">
            DIY
          </div>
          <div className="font-extrabold text-navy text-lg md:text-xl mb-1">Going It Alone</div>
          <div className="text-grey-4 text-xs md:text-sm">$0 – $5,000</div>
        </div>
        <div className="px-2 py-6 md:py-8 text-center border-l border-navy/10">
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-3 mb-2">
            Traditional
          </div>
          <div className="font-extrabold text-navy text-lg md:text-xl mb-1">Consulting Firms</div>
          <div className="text-grey-4 text-xs md:text-sm">$40,000 – $80,000+</div>
        </div>
        <div className="px-2 py-6 md:py-8 text-center bg-navy text-white relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.14em] whitespace-nowrap">
            BEST VALUE
          </div>
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold mb-2">
            The Smarter Path
          </div>
          <div className="font-extrabold text-white text-lg md:text-xl mb-1">
            Franchisor Blueprint
          </div>
          <div className="text-white/75 text-xs md:text-sm">$2,997 – $29,500</div>
        </div>
      </div>

      {/* Body rows */}
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center ${
            i % 2 === 0 ? "bg-white" : "bg-grey-1/50"
          }`}
        >
          <div className="px-6 py-4 md:px-8 md:py-5 text-sm md:text-[15px] text-navy font-semibold">
            {r.label}
          </div>
          <div className="px-2 py-4 md:py-5 text-center border-l border-navy/10">
            <CellIcon value={r.diy} />
          </div>
          <div className="px-2 py-4 md:py-5 text-center border-l border-navy/10">
            <CellIcon value={r.consultant} />
          </div>
          <div className="px-2 py-4 md:py-5 text-center bg-navy/[0.03] border-l border-navy/10">
            <CellIcon value={r.tfb} />
          </div>
        </div>
      ))}

      {/* Footer summary row */}
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-navy/[0.04] border-t-2 border-navy/10">
        <div className="px-6 py-5 md:px-8 md:py-6 text-sm md:text-[15px] text-navy font-extrabold uppercase tracking-wide">
          Time to Launch
        </div>
        <div className="px-2 py-5 md:py-6 text-center text-grey-3 text-sm font-bold border-l border-navy/10">
          Varies (often 18+ mo)
        </div>
        <div className="px-2 py-5 md:py-6 text-center text-grey-3 text-sm font-bold border-l border-navy/10">
          12+ months
        </div>
        <div className="px-2 py-5 md:py-6 text-center text-navy text-sm font-extrabold bg-navy/[0.06] border-l border-navy/10">
          6 months
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
