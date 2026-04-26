import { Quote, Star } from "lucide-react";

/**
 * Testimonials — PLACEHOLDER COPY.
 *
 * TODO (Jason): replace with real testimonials from past clients.
 * For each: 1-2 sentence quote, full name, business name + role,
 * ideally a headshot (drop into public/testimonials/).
 *
 * The fake names below are clearly invented (no real person);
 * the result figures are believable for the franchise space but
 * NOT verified — swap before launch.
 */
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  result: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We'd been quoted $62,000 by a big firm just for the documents. Jason got us franchise-ready for a fraction of that — and actually walked us through every step. We sold our first three franchises four months after launch.",
    name: "[Sarah M.]",
    role: "Founder, [Restaurant Concept] · [City, ST]",
    result: "3 units sold in 4 months",
    initials: "SM",
  },
  {
    quote:
      "The 6-month coaching is what made the difference. I tried to DIY it for a year and got nowhere. Working with Jason weekly meant I actually finished the FDD and launched, instead of letting it sit on my desk forever.",
    name: "[Marcus T.]",
    role: "Owner, [Service Business] · [City, ST]",
    result: "Launched in 6 months",
    initials: "MT",
  },
  {
    quote:
      "Coming from corporate, I knew what good operations manuals looked like. The TFB system is genuinely on par with what the $80k firms produce — just without the price tag and with someone who actually returns your texts.",
    name: "[Jennifer L.]",
    role: "Founder, [Retail Brand] · [City, ST]",
    result: "Saved $50K+ vs. competitors",
    initials: "JL",
  },
];

export function Testimonials() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {testimonials.map((t) => (
        <div
          key={t.name}
          className="bg-white rounded-2xl p-8 shadow-[0_10px_30px_rgba(30,58,95,0.12)] border border-navy/10 flex flex-col relative"
        >
          {/* Decorative quote glyph */}
          <Quote
            className="absolute top-6 right-6 text-gold/30"
            size={36}
            strokeWidth={1.25}
          />

          {/* Stars */}
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} className="fill-gold text-gold" />
            ))}
          </div>

          {/* Quote */}
          <p className="text-grey-3 text-[15px] leading-relaxed flex-1 mb-6">
            &ldquo;{t.quote}&rdquo;
          </p>

          {/* Result chip */}
          <div className="inline-flex w-fit items-center gap-2 bg-gold/10 text-navy text-[11px] font-extrabold tracking-[0.1em] uppercase px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            {t.result}
          </div>

          {/* Person */}
          <div className="flex items-center gap-3 pt-5 border-t border-navy/10">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold font-extrabold text-sm">
              {t.initials}
            </div>
            <div>
              <div className="font-bold text-navy text-sm leading-tight">{t.name}</div>
              <div className="text-grey-4 text-xs leading-tight mt-0.5">{t.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
