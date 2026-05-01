import { Check, X, Minus } from "lucide-react";

type Cell = "yes" | "no" | "partial";

interface ComparisonRow {
  label: string;
  diy: Cell;
  consultant: Cell;
  tfb: Cell;
}

const rows: ComparisonRow[] = [
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

interface PlanMeta {
  key: "tfb" | "consultant" | "diy";
  eyebrow: string;
  title: string;
  price: string;
  timeToLaunch: string;
  /** Pull the cell value for this plan from a row. */
  cellOf: (r: ComparisonRow) => Cell;
}

const PLANS: PlanMeta[] = [
  {
    key: "tfb",
    eyebrow: "The Smarter Path",
    title: "Franchisor Blueprint",
    price: "$2,997 – $29,500",
    timeToLaunch: "6 months",
    cellOf: (r) => r.tfb,
  },
  {
    key: "consultant",
    eyebrow: "Traditional",
    title: "Consulting Firms",
    price: "$40,000 – $80,000+",
    timeToLaunch: "12+ months",
    cellOf: (r) => r.consultant,
  },
  {
    key: "diy",
    eyebrow: "DIY",
    title: "Going It Alone",
    price: "$0 – $5,000",
    timeToLaunch: "Varies (often 18+ months)",
    cellOf: (r) => r.diy,
  },
];

function CellIcon({ value, size = 7 }: { value: Cell; size?: 6 | 7 }) {
  const dim = size === 6 ? "w-6 h-6" : "w-7 h-7";
  const icon = size === 6 ? 14 : 16;
  if (value === "yes") {
    return (
      <div className={`inline-flex ${dim} rounded-full bg-emerald-500/15 items-center justify-center flex-shrink-0`}>
        <Check size={icon} className="text-emerald-600" strokeWidth={3} />
      </div>
    );
  }
  if (value === "no") {
    return (
      <div className={`inline-flex ${dim} rounded-full bg-red-500/10 items-center justify-center flex-shrink-0`}>
        <X size={icon} className="text-red-500" strokeWidth={3} />
      </div>
    );
  }
  return (
    <div className={`inline-flex ${dim} rounded-full bg-amber-500/15 items-center justify-center flex-shrink-0`}>
      <Minus size={icon} className="text-amber-600" strokeWidth={3} />
    </div>
  );
}

export function ComparisonTable() {
  return (
    <div>
      {/* ─── Desktop / tablet: side-by-side comparison table ──────────────── */}
      <DesktopTable />

      {/* ─── Mobile: stacked cards, TFB first (featured) ─────────────────── */}
      <MobileStack />
    </div>
  );
}

// ─── Desktop layout (unchanged from prior version, just hidden on mobile) ──
function DesktopTable() {
  return (
    <div className="hidden md:block">
      <div className="md:mx-0 md:px-0 pt-4 pb-2">
        {/*
          We can't use `overflow-hidden` here because it would clip the
          BEST VALUE badge that floats above the navy column. Instead, the
          four corner cells get their own corner radii so the table still
          reads as a single rounded card.
        */}
        <div className="rounded-2xl shadow-[0_20px_50px_rgba(30,58,95,0.18)] border border-navy/10 bg-white">
          {/* Header row */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-grey-1 rounded-t-2xl">
            <div className="px-6 py-6 md:px-8 md:py-8 rounded-tl-2xl" />
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
            <div className="px-2 py-6 md:py-8 text-center bg-navy text-white relative rounded-tr-2xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.14em] whitespace-nowrap shadow-[0_4px_10px_rgba(30,58,95,0.18)]">
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
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-navy/[0.04] border-t-2 border-navy/10 rounded-b-2xl">
            <div className="px-6 py-5 md:px-8 md:py-6 text-sm md:text-[15px] text-navy font-extrabold uppercase tracking-wide rounded-bl-2xl">
              Time to Launch
            </div>
            <div className="px-2 py-5 md:py-6 text-center text-grey-3 text-sm font-bold border-l border-navy/10">
              Varies (often 18+ mo)
            </div>
            <div className="px-2 py-5 md:py-6 text-center text-grey-3 text-sm font-bold border-l border-navy/10">
              12+ months
            </div>
            <div className="px-2 py-5 md:py-6 text-center text-navy text-sm font-extrabold bg-navy/[0.06] border-l border-navy/10 rounded-br-2xl">
              6 months
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile layout (stacked cards, TFB featured) ───────────────────────────
// Three plan cards stacked vertically. TFB card is visually dominant
// (navy header bar + BEST VALUE ribbon + amplified shadow) so the eye
// lands on the answer first; the other two are flatter "foil" cards
// that the reader scrolls past for verification rather than evaluation.
function MobileStack() {
  return (
    <div className="md:hidden flex flex-col gap-5 pt-4">
      {PLANS.map((plan) => (
        <PlanCard key={plan.key} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanMeta }) {
  const isFeatured = plan.key === "tfb";
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isFeatured
          ? "border-navy/10 shadow-[0_20px_50px_rgba(30,58,95,0.18)] bg-white relative"
          : "border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.06)] bg-white"
      }`}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.14em] whitespace-nowrap shadow-[0_4px_10px_rgba(30,58,95,0.18)] z-10">
          BEST VALUE
        </div>
      )}

      {/* Plan header */}
      <div
        className={`px-5 py-5 ${
          isFeatured ? "bg-navy text-white" : "bg-grey-1 text-navy"
        }`}
      >
        <div
          className={`text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5 ${
            isFeatured ? "text-gold" : "text-grey-3"
          }`}
        >
          {plan.eyebrow}
        </div>
        <div
          className={`font-extrabold text-lg leading-tight ${
            isFeatured ? "text-white" : "text-navy"
          }`}
        >
          {plan.title}
        </div>
        <div
          className={`text-sm mt-0.5 ${
            isFeatured ? "text-white/75" : "text-grey-4"
          }`}
        >
          {plan.price}
        </div>
      </div>

      {/* Feature rows */}
      <ul className="divide-y divide-navy/5">
        {rows.map((r) => {
          const value = plan.cellOf(r);
          return (
            <li
              key={r.label}
              className="flex items-center gap-3 px-5 py-3"
            >
              <CellIcon value={value} size={6} />
              <span
                className={`text-[13.5px] leading-snug ${
                  value === "no"
                    ? "text-grey-4"
                    : value === "partial"
                      ? "text-grey-3"
                      : "text-navy font-medium"
                }`}
              >
                {r.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Time to launch footer */}
      <div
        className={`flex items-center justify-between px-5 py-4 border-t ${
          isFeatured
            ? "bg-navy/[0.06] border-navy/10"
            : "bg-grey-1/40 border-navy/5"
        }`}
      >
        <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-navy">
          Time to Launch
        </span>
        <span
          className={`text-[13px] font-extrabold ${
            isFeatured ? "text-navy" : "text-grey-3"
          }`}
        >
          {plan.timeToLaunch}
        </span>
      </div>
    </div>
  );
}
