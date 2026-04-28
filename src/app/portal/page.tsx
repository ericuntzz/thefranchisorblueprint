import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Calendar, FileText, Sparkles } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { capabilitiesForTier, CAPABILITIES } from "@/lib/capabilities";
import type { Tier, Profile, Purchase } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Your Blueprint Portal | The Franchisor Blueprint",
  description: "Access the franchisor operating system.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<Tier, string> = {
  1: "The Blueprint",
  2: "Navigator",
  3: "Builder",
};

export default async function PortalDashboard() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const [{ data: profileData }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Purchase[];

  // Effective tier = highest tier across all paid purchases (or profile.tier as fallback)
  const tier = (Math.max(
    profile?.tier ?? 1,
    ...purchases.filter((p) => p.status === "paid").map((p) => p.tier),
    1,
  ) as Tier);

  const visibleCaps = capabilitiesForTier(tier);
  const lockedCaps = CAPABILITIES.filter((c) => c.minTier > tier);
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <>
      {/* ===== Welcome ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
                Welcome to your portal
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy">
                {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
              </h1>
              <p className="text-grey-3 text-base md:text-lg mt-2 max-w-[640px]">
                Your franchisor operating system — {visibleCaps.length} {visibleCaps.length === 1 ? "capability" : "capabilities"} ready to use.
              </p>
            </div>
            <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                Your access tier
              </div>
              <div className="text-navy font-bold text-base">{TIER_LABELS[tier]}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Capability cards ===== */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div className="flex items-center gap-2 mb-7">
            <Sparkles size={18} className="text-gold" />
            <h2 className="text-navy font-bold text-xl">Your capabilities</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleCaps.map((cap) => (
              <Link
                key={cap.slug}
                href={`/portal/${cap.slug}`}
                className="group bg-white rounded-2xl border border-navy/10 p-6 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,58,95,0.18)] hover:border-gold/40 transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">
                    Capability {String(cap.number).padStart(2, "0")}
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="text-grey-4 group-hover:text-gold transition-colors"
                  />
                </div>
                <h3 className="text-navy font-extrabold text-lg mb-2 leading-tight">
                  {cap.title}
                </h3>
                <p className="text-grey-3 text-sm leading-relaxed flex-1 mb-4">
                  {cap.description}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-grey-4 font-semibold uppercase tracking-wider">
                  <FileText size={12} />
                  <span>{cap.format}</span>
                </div>
              </Link>
            ))}
          </div>

          {lockedCaps.length > 0 && (
            <div className="mt-10 bg-white rounded-2xl border border-navy/10 p-6 md:p-8">
              <h3 className="text-navy font-bold text-base mb-2">Available with a higher tier</h3>
              <p className="text-grey-3 text-sm mb-4">
                The following capabilities unlock when you upgrade to Navigator or Builder. Want to talk through it?{" "}
                <Link href="/strategy-call" className="text-navy font-semibold underline">
                  Book a strategy call
                </Link>
                .
              </p>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-grey-3">
                {lockedCaps.map((cap) => (
                  <li key={cap.slug} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-grey-4" />
                    <span>{cap.title}</span>
                    <span className="text-[10px] text-grey-4 font-semibold uppercase">
                      Tier {cap.minTier}+
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ===== Support / next steps ===== */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-base mb-1">Onboarding call</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Our team will reach out within one business day to schedule your 60-minute white-glove kickoff call with Jason.
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-base mb-1">Need a hand?</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Email{" "}
                  <a
                    href="mailto:team@thefranchisorblueprint.com"
                    className="text-navy font-semibold underline"
                  >
                    team@thefranchisorblueprint.com
                  </a>{" "}
                  any time during your 30-day support window.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
