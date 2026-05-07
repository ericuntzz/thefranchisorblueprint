import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, MessageSquare, Layers, Check } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PRODUCTS } from "@/lib/products";
import { WhatIfCoach } from "@/components/portal/WhatIfCoach";
import type { Profile, Purchase } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Add Coaching | The Franchisor Blueprint Portal",
  description: "Try a single coaching call or buy a phase-specific add-on.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/coaching");

  const [{ data: profileData }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("*").eq("user_id", user.id).eq("status", "paid"),
  ]);
  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");

  const credits = profile?.coaching_credits ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  const sample = PRODUCTS["sample-call"];
  const phase = PRODUCTS["phase-coaching"];

  return (
    <>
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
                Add coaching
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy mb-3">
                {firstName ? `${firstName}, want a coach for the hard parts?` : "Want a coach for the hard parts?"}
              </h1>
              <p className="text-grey-3 text-base md:text-lg max-w-[820px]">
                Add coaching credits without a full tier upgrade. Each call is 60 minutes with Jason, scheduled when you&apos;re ready.
              </p>
            </div>
            <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                Your coaching credits
              </div>
              <div className="text-navy font-bold text-2xl tabular-nums">{credits}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Jason's Playbook — moved here from the dashboard. Browseable
          franchise edge cases, sits above the booking CTAs because
          it informs whether a customer needs to book a call. */}
      <section className="py-10 md:py-14">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <WhatIfCoach />
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 grid md:grid-cols-2 gap-6 md:gap-8">
          <CoachingCard
            slug={sample.slug}
            name={sample.name}
            priceCents={sample.priceCents}
            tagline="Try the format risk-free. Credit applies toward any future upgrade."
            includes={sample.includes}
            Icon={MessageSquare}
          />
          <CoachingCard
            slug={phase.slug}
            name={phase.name}
            priceCents={phase.priceCents}
            tagline="Pair coaching with the phase you most need help with."
            includes={phase.includes}
            Icon={Layers}
          />
        </div>
      </section>

      <section className="pb-16 md:pb-24">
        <div className="max-w-[820px] mx-auto px-6 md:px-8">
          <div className="bg-white rounded-2xl border border-card-border p-7 md:p-9">
            <h2 className="text-navy font-bold text-lg mb-2">Want full coaching?</h2>
            <p className="text-grey-3 text-[15px] leading-relaxed mb-4">
              Navigator includes 24 weekly 1:1 coaching calls plus document review and milestone gates. If you&apos;re going to need more than 6 calls, the upgrade is the better economics.
            </p>
            <Link
              href="/portal/upgrade"
              className="inline-flex items-center gap-2 text-navy font-semibold text-sm hover:text-gold-warm transition-colors"
            >
              See full upgrade options
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function CoachingCard({
  slug,
  name,
  priceCents,
  tagline,
  includes,
  Icon,
}: {
  slug: string;
  name: string;
  priceCents: number;
  tagline: string;
  includes: string[];
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-card-border shadow-[0_8px_28px_rgba(30,58,95,0.08)] overflow-hidden flex flex-col">
      <div className="h-1.5 bg-gradient-to-r from-gold via-gold-warm to-gold" />
      <div className="p-7 md:p-9 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy to-navy-light text-gold flex items-center justify-center ring-4 ring-gold/15">
            <Icon size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">Coaching add-on</div>
            <h2 className="text-navy font-extrabold text-2xl leading-tight">{name}</h2>
          </div>
        </div>
        <p className="text-grey-3 text-[15px] leading-relaxed mb-5">{tagline}</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {includes.map((it) => (
            <li key={it} className="flex items-start gap-2.5 text-sm text-grey-3 leading-relaxed">
              <Check size={16} className="text-gold-warm flex-shrink-0 mt-0.5" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-navy/10 pt-5">
          <div className="text-navy font-extrabold text-4xl tabular-nums mb-5">
            ${(priceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <form action={`/api/checkout/${slug}`} method="POST">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
            >
              Buy {name}
              <ArrowRight size={15} />
            </button>
          </form>
          <p className="text-center text-xs text-grey-3 italic mt-3">
            Secure checkout via Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
