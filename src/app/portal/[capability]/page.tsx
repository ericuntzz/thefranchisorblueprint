import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCapability, capabilitiesForTier } from "@/lib/capabilities";
import type { Tier, Purchase } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ capability: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { capability: slug } = await params;
  const cap = getCapability(slug);
  return {
    title: cap ? `${cap.title} | Portal | The Franchisor Blueprint` : "Portal",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function CapabilityDetailPage({ params }: PageProps) {
  const { capability: slug } = await params;
  const cap = getCapability(slug);
  if (!cap) notFound();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid");

  const purchases = (purchasesData ?? []) as Purchase[];

  // No active purchases → bounce to /portal which renders the revoked-access view.
  if (purchases.length === 0) redirect("/portal");

  const tier = (Math.max(...purchases.map((p) => p.tier), 1) as Tier);

  if (cap.minTier > tier) redirect("/portal");

  const allowed = capabilitiesForTier(tier);
  const idx = allowed.findIndex((c) => c.slug === cap.slug);
  const prev = idx > 0 ? allowed[idx - 1] : null;
  const next = idx < allowed.length - 1 ? allowed[idx + 1] : null;

  return (
    <>
      {/* ===== Capability hero ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to portal
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-2 border-b-2 border-gold pb-1">
                Capability {String(cap.number).padStart(2, "0")} — {cap.verb}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy mb-3">{cap.title}</h1>
              <p className="text-grey-3 text-base md:text-lg max-w-[760px]">{cap.description}</p>
            </div>
            {cap.driveDownloadUrl && (
              <a
                href={cap.driveDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
              >
                <Download size={15} />
                Download
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ===== Embed / placeholder ===== */}
      <section className="py-10 md:py-14">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8">
          {cap.driveEmbedUrl ? (
            <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_18px_40px_rgba(30,58,95,0.10)] overflow-hidden">
              <iframe
                src={cap.driveEmbedUrl}
                className="w-full h-[80vh] min-h-[600px] block"
                title={cap.title}
                allow="autoplay"
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-navy/20 p-10 md:p-14 text-center">
              <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-4">
                <FileText size={22} />
              </div>
              <h2 className="text-navy font-bold text-xl mb-2">Document coming online soon</h2>
              <p className="text-grey-3 text-sm md:text-base max-w-[520px] mx-auto leading-relaxed">
                We&apos;re finalizing the embedded view for this capability. In the meantime, our team will share the file directly with you during your onboarding call.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===== Prev / next nav ===== */}
      {(prev || next) && (
        <section className="pb-16 md:pb-24">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 grid sm:grid-cols-2 gap-4">
            {prev ? (
              <Link
                href={`/portal/${prev.slug}`}
                className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors"
              >
                <div className="flex items-center gap-1 text-grey-4 text-[10px] font-bold tracking-[0.16em] uppercase mb-1">
                  <ArrowLeft size={11} />
                  Previous
                </div>
                <div className="text-navy font-bold text-base">{prev.title}</div>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                href={`/portal/${next.slug}`}
                className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors text-right"
              >
                <div className="text-grey-4 text-[10px] font-bold tracking-[0.16em] uppercase mb-1">
                  Next →
                </div>
                <div className="text-navy font-bold text-base">{next.title}</div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </section>
      )}
    </>
  );
}
