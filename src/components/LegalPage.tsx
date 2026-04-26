import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { AlertTriangle } from "lucide-react";

type Props = {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

/**
 * Shared layout for legal pages. Includes a prominent placeholder banner
 * because all four pages need an attorney review before going live.
 */
export function LegalPage({ eyebrow, title, effectiveDate, children }: Props) {
  return (
    <>
      <SiteNav />
      <PageHero eyebrow={eyebrow} title={title} subtitle={`Effective: ${effectiveDate}`} />

      {/* Lawyer-review banner */}
      <section className="bg-white pt-12 pb-4">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 flex gap-4 items-start">
            <AlertTriangle className="flex-shrink-0 text-amber-600 mt-0.5" size={20} />
            <div className="text-amber-900 text-sm leading-relaxed">
              <strong className="block mb-1">Placeholder text — pending attorney review.</strong>
              This document is a starting draft. Before launch, Eric must have a qualified business or franchise attorney review and finalize all language, tailored to The Franchisor Blueprint&apos;s specific business structure and the jurisdictions in which it operates.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-24 md:pb-28 pt-8">
        <div className="max-w-[760px] mx-auto px-8 prose-legal">
          {children}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
