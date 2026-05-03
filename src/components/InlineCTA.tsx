import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Variant = "navy" | "ivory";

interface InlineCTAProps {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
  variant?: Variant;
}

/**
 * Mid-post conversion card for blog articles.
 *
 * Placed roughly 60% of the way through long-form content to capture
 * the engaged-but-undecided reader. Designed to read as a deliberate
 * pause from the prose — visually distinct from inline links — without
 * breaking the article's voice.
 */
export function InlineCTA({
  eyebrow,
  title,
  body,
  href,
  ctaLabel,
  variant = "navy",
}: InlineCTAProps) {
  const isNavy = variant === "navy";

  return (
    <div
      className={`my-12 rounded-2xl p-7 md:p-9 shadow-md relative overflow-hidden ${
        isNavy
          ? "bg-navy text-white"
          : "bg-gradient-to-br from-grey-1 to-white border border-navy/10 text-navy"
      }`}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
      <div
        className={`font-bold text-[11px] tracking-[0.2em] uppercase mb-3 ${
          isNavy ? "text-gold" : "text-gold-warm"
        }`}
      >
        {eyebrow}
      </div>
      <h3
        className={`text-xl md:text-2xl font-bold mb-3 leading-tight ${
          isNavy ? "text-white" : "text-navy"
        }`}
      >
        {title}
      </h3>
      <p
        className={`mb-6 leading-relaxed text-[15px] md:text-base ${
          isNavy ? "text-white/85" : "text-grey-3"
        }`}
      >
        {body}
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-gold text-navy font-bold px-6 py-3 rounded-lg hover:bg-gold-warm hover:shadow-lg transition-all no-underline"
      >
        {ctaLabel}
        <ArrowRight size={18} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
