import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircle, Home } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Page not found | The Franchisor Blueprint",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="bg-cream-soft min-h-[calc(100vh-4rem)] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-xs uppercase tracking-[0.18em] text-gold-text font-bold mb-3">
            Page not found
          </div>
          <h1 className="text-navy font-extrabold text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight mb-5">
            That chapter isn&apos;t in the Blueprint.
          </h1>
          <p className="text-grey-3 text-lg leading-relaxed max-w-[560px] mb-10">
            The link you followed points to a page that doesn&apos;t
            exist anymore. No drama — just pick where you want to go
            from here.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mb-10">
            <Link
              href="/"
              className="group flex flex-col gap-2 rounded-2xl border border-card-border bg-white p-5 hover:border-gold hover:shadow-[0_8px_24px_rgba(30,58,95,0.08)] transition-all"
            >
              <Home size={18} className="text-gold-warm" />
              <div className="text-navy font-bold text-sm">Home</div>
              <div className="text-grey-3 text-xs leading-relaxed">
                What the Blueprint is and who it&apos;s for.
              </div>
            </Link>
            <Link
              href="/portal"
              className="group flex flex-col gap-2 rounded-2xl border border-card-border bg-white p-5 hover:border-gold hover:shadow-[0_8px_24px_rgba(30,58,95,0.08)] transition-all"
            >
              <BookOpen size={18} className="text-gold-warm" />
              <div className="text-navy font-bold text-sm">Your Portal</div>
              <div className="text-grey-3 text-xs leading-relaxed">
                Pick up where you left off in your Blueprint.
              </div>
            </Link>
            <Link
              href="/contact"
              className="group flex flex-col gap-2 rounded-2xl border border-card-border bg-white p-5 hover:border-gold hover:shadow-[0_8px_24px_rgba(30,58,95,0.08)] transition-all"
            >
              <MessageCircle size={18} className="text-gold-warm" />
              <div className="text-navy font-bold text-sm">Contact us</div>
              <div className="text-grey-3 text-xs leading-relaxed">
                Tell us what you were trying to find.
              </div>
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-navy text-cream font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy-dark transition-colors"
          >
            Back to the homepage
            <ArrowRight size={13} />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
