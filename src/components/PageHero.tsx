type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

/**
 * Shared compact hero used at the top of inner pages.
 * Cream bg + dot grid accent so it visually distinguishes from the
 * homepage's image-driven hero, but stays in the brand system.
 */
export function PageHero({ eyebrow, title, subtitle }: Props) {
  return (
    <section className="bg-cream py-20 md:py-28 relative overflow-hidden">
      {/* Dot grid accent — top right */}
      <div
        className="absolute -top-20 -right-20 w-[520px] h-[520px] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
          backgroundSize: "30px 30px",
          maskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
          opacity: 0.22,
        }}
        aria-hidden
      />
      <div className="max-w-[1200px] mx-auto px-8 relative">
        <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
          {eyebrow}
        </span>
        <h1 className="text-navy text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight max-w-[900px] mb-6">
          {title}
        </h1>
        {subtitle && (
          <p className="text-grey-3 text-lg md:text-xl leading-relaxed max-w-[760px] font-light">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
