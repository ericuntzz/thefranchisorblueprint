import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Calendar, MessageSquare } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";
import type { Profile, Purchase, Tier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Schedule a Coaching Call | The Franchisor Blueprint Portal",
  description: "Book a 60-minute coaching call with Jason.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/coaching/schedule");

  const [{ data: profileData }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("purchases")
      .select("tier")
      .eq("user_id", user.id)
      .eq("status", "paid"),
  ]);
  const profile = profileData as Profile | null;
  const purchases = (purchasesData ?? []) as Pick<Purchase, "tier">[];
  if (purchases.length === 0) redirect("/portal");

  const tier = (Math.max(...purchases.map((p) => p.tier), 1) as Tier);
  const credits = profile?.coaching_credits ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  const calendlyUrl = process.env.CALENDLY_COACHING_URL ?? "";

  // Without credits, push them to /portal/coaching to buy more (tier 1) or
  // to upgrade (tier 2 considering more support). Tier 3 always has coaching.
  if (credits === 0 && tier < 3) {
    return <ZeroCreditsView firstName={firstName} tier={tier} />;
  }

  // Without a configured Calendly URL, show a soft fallback so the page
  // doesn't crash. (Eric configures CALENDLY_COACHING_URL once he sets up
  // the dedicated coaching event type.)
  if (!calendlyUrl) {
    return <SetupPendingView firstName={firstName} credits={credits} />;
  }

  // Pre-fill the embed with the customer's name + email so they don't re-type.
  const prefillUrl = new URL(calendlyUrl);
  if (user.email) prefillUrl.searchParams.set("email", user.email);
  if (profile?.full_name) prefillUrl.searchParams.set("name", profile.full_name);

  return (
    <>
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
                Schedule a coaching call
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy mb-3">
                {firstName ? `Pick a time, ${firstName}` : "Pick a time"}
              </h1>
              <p className="text-grey-3 text-base md:text-lg max-w-[820px]">
                60 minutes one-on-one with Jason. Booking deducts one credit; cancelling restores it. Your coaching session shows up in the portal under your account.
              </p>
            </div>
            <div className="bg-cream rounded-xl px-5 py-4 border border-gold/30">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm mb-1">
                Coaching credits available
              </div>
              <div className="text-navy font-bold text-2xl tabular-nums">{credits}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8">
          <div className="bg-white rounded-2xl border border-card-border p-3 md:p-4 shadow-[0_8px_24px_rgba(30,58,95,0.08)] overflow-hidden">
            <CalendlyEmbed url={prefillUrl.toString()} minHeight={760} />
          </div>
          <p className="text-center text-xs text-grey-3 italic mt-4">
            Trouble loading?{" "}
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy font-semibold underline"
            >
              Open scheduler in a new tab →
            </a>
          </p>
        </div>
      </section>
    </>
  );
}

function ZeroCreditsView({ firstName, tier }: { firstName: string | null; tier: Tier }) {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[640px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-card-border p-8 md:p-10 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-5">
            <MessageSquare size={22} />
          </div>
          <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
            {firstName ? `${firstName}, no coaching credits yet` : "No coaching credits yet"}
          </h1>
          <p className="text-grey-3 text-base mb-6">
            You don&apos;t have any coaching calls available to book right now. Add some to your account, or upgrade to a tier that includes coaching.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/portal/coaching"
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Add coaching <ArrowRight size={14} />
            </Link>
            {tier < 3 && (
              <Link
                href="/portal/upgrade"
                className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-navy hover:text-white transition-colors"
              >
                See upgrade options
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupPendingView({ firstName, credits }: { firstName: string | null; credits: number }) {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[640px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-card-border p-8 md:p-10 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-5">
            <Calendar size={22} />
          </div>
          <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
            {firstName ? `${firstName}, scheduling is being configured` : "Scheduling is being configured"}
          </h1>
          <p className="text-grey-3 text-base mb-6">
            Our team is finalizing the coaching scheduler. You have{" "}
            <strong className="text-navy">{credits}</strong> credit{credits === 1 ? "" : "s"}{" "}
            on file. In the meantime, email{" "}
            <a
              href="mailto:team@thefranchisorblueprint.com"
              className="text-navy font-semibold underline"
            >
              team@thefranchisorblueprint.com
            </a>{" "}
            and we&apos;ll book your first session manually.
          </p>
        </div>
      </div>
    </section>
  );
}
