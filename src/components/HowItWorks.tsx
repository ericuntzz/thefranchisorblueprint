import { Microscope, Layers, Scale, GraduationCap, Target, Rocket } from "lucide-react";

const months = [
  {
    n: "Month 1",
    title: "Foundation & Discovery",
    body: "Brand audit, financial review, and strategic planning. We map the entire engagement to your business model.",
    Icon: Microscope,
  },
  {
    n: "Month 2",
    title: "System Design",
    body: "Drafting the Operations Manual and defining brand standards franchisees can replicate.",
    Icon: Layers,
  },
  {
    n: "Month 3",
    title: "Legal Framework",
    body: "Structuring your FDD points and preparing for franchise attorney review and filing.",
    Icon: Scale,
  },
  {
    n: "Month 4",
    title: "Training & Operations",
    body: "Building the franchisee training curriculum and the LMS structure that supports it.",
    Icon: GraduationCap,
  },
  {
    n: "Month 5",
    title: "Sales Strategy",
    body: "Territory mapping, marketing plan, and the franchisee profile you'll be selling to.",
    Icon: Target,
  },
  {
    n: "Month 6",
    title: "Launch Readiness",
    body: "Final reviews, mock Discovery Day, and your go-to-market launch as a franchise-ready brand.",
    Icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <div className="relative">
      {/* Vertical connector line on desktop */}
      <div
        className="hidden md:block absolute left-1/2 top-8 bottom-8 w-0.5 -translate-x-1/2"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 0%, #d4af37 8%, #d4af37 92%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="space-y-6 md:space-y-10">
        {months.map((m, i) => {
          const isEven = i % 2 === 0;
          return (
            <div key={m.n} className="relative">
              {/* Center node on desktop */}
              <div
                className="hidden md:flex absolute left-1/2 top-8 -translate-x-1/2 w-12 h-12 rounded-full bg-white border-4 border-gold items-center justify-center shadow-[0_4px_12px_rgba(30,58,95,0.18)] z-10"
                aria-hidden
              >
                <span className="text-navy font-extrabold text-sm">{i + 1}</span>
              </div>

              <div
                className={`md:grid md:grid-cols-2 md:gap-16 ${isEven ? "" : "md:[&>*:first-child]:col-start-2"}`}
              >
                <div
                  className={`bg-white rounded-2xl p-7 md:p-8 shadow-[0_10px_30px_rgba(30,58,95,0.10)] border border-navy/10 ${isEven ? "md:text-right" : ""}`}
                >
                  <div
                    className={`flex items-center gap-3 mb-3 ${isEven ? "md:justify-end" : ""}`}
                  >
                    <div className="md:hidden flex-shrink-0 w-9 h-9 rounded-full bg-white border-2 border-gold flex items-center justify-center">
                      <span className="text-navy font-extrabold text-xs">{i + 1}</span>
                    </div>
                    <div className="text-gold-warm font-bold text-xs tracking-[0.16em] uppercase">
                      {m.n}
                    </div>
                  </div>
                  <h3 className="text-navy font-bold text-xl md:text-2xl mb-3">{m.title}</h3>
                  <p className="text-grey-3 text-[15px] leading-relaxed">{m.body}</p>
                </div>

                {/* Spacer + decorative icon column on desktop */}
                <div
                  className={`hidden md:flex items-center ${isEven ? "" : "justify-end"}`}
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold shadow-[0_10px_30px_rgba(30,58,95,0.18)]">
                    <m.Icon size={32} strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
