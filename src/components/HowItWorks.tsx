import { Microscope, Layers, Scale, GraduationCap, Target, Rocket } from "lucide-react";

/**
 * 6-month roadmap. Renders as:
 *   - Mobile: vertical stack with gold connector line on the left,
 *     numbered node + card per row.
 *   - lg+ (≥1024px): single horizontal row with gold connector line
 *     running through the centers of all six numbered nodes; each
 *     card stacks beneath its node.
 *
 * Body copy is intentionally tight (5–8 words) so cards fit at narrow
 * desktop widths without wrapping into novels. The full per-month
 * scope lives on /programs/navigator.
 */
const months = [
  {
    n: "Month 1",
    title: "Foundation",
    body: "Brand audit, financial review, strategic plan.",
    Icon: Microscope,
  },
  {
    n: "Month 2",
    title: "System Design",
    body: "Operations Manual and replicable brand standards.",
    Icon: Layers,
  },
  {
    n: "Month 3",
    title: "Legal Framework",
    body: "FDD preparation and attorney review.",
    Icon: Scale,
  },
  {
    n: "Month 4",
    title: "Training & Ops",
    body: "Franchisee curriculum and LMS build.",
    Icon: GraduationCap,
  },
  {
    n: "Month 5",
    title: "Sales Strategy",
    body: "Territory map and ideal franchisee profile.",
    Icon: Target,
  },
  {
    n: "Month 6",
    title: "Launch Readiness",
    body: "Mock Discovery Day and go-to-market.",
    Icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <div className="relative">
      {/* ── Connector lines ─────────────────────────────────────────────
          Two variants, swapped at the lg breakpoint:
            • Mobile/tablet: vertical, sits at left=24px to bisect the
              48px-wide numbered nodes. top-6/bottom-6 anchors it to
              the first/last node centers.
            • lg+: horizontal, sits at top=24px (node center y=24),
              spans the full row width. The faded 4%/96% stops let
              the line dissolve at each end so it doesn't hard-stop
              into the page edge.
       ─────────────────────────────────────────────────────────────── */}
      <div
        className="lg:hidden absolute left-6 top-6 bottom-6 w-0.5"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 0%, #d4af37 4%, #d4af37 96%, transparent 100%)",
        }}
        aria-hidden
      />
      <div
        className="hidden lg:block absolute left-0 right-0 top-6 h-0.5"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 0%, #d4af37 4%, #d4af37 96%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-x-4 gap-y-8">
        {months.map((m, i) => (
          <div
            key={m.n}
            className="relative flex lg:flex-col items-start lg:items-center gap-5 lg:gap-0"
          >
            {/* Numbered node — same size on all breakpoints so the
                connector lines hit dead-center on both axes. */}
            <div
              className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-white border-4 border-gold flex items-center justify-center shadow-[0_4px_12px_rgba(30,58,95,0.18)]"
              aria-hidden
            >
              <span className="text-navy font-extrabold text-sm">{i + 1}</span>
            </div>

            {/* Card. On lg+ it sits centered beneath its node with a
                small gap; on mobile it sits to the right of its node. */}
            <div className="flex-1 lg:w-full lg:mt-6 bg-white rounded-2xl p-5 shadow-[0_10px_30px_rgba(30,58,95,0.10)] border border-navy/10 lg:text-center">
              {/* Icon — desktop only. On mobile the numbered node + the
                  Month X eyebrow already do enough visual lifting; the
                  extra icon would crowd a narrow row. */}
              <div className="hidden lg:flex w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light items-center justify-center text-gold mx-auto mb-4">
                <m.Icon size={24} strokeWidth={1.5} />
              </div>
              <div className="text-gold-warm font-bold text-xs tracking-[0.16em] uppercase mb-2">
                {m.n}
              </div>
              <h3 className="text-navy font-bold text-lg mb-2">{m.title}</h3>
              <p className="text-grey-3 text-sm leading-relaxed">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
