import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Sparkles,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PRODUCTS, upgradeProductFor } from "@/lib/products";
import {
  getActiveOffersForUser,
  isPromoActive,
  effectivePriceCents,
  PROMO_DISCOUNT_PERCENT,
} from "@/lib/upgrade-offers";
import { OfferCountdown } from "@/components/OfferCountdown";
import type { Tier, Purchase, UpgradeOffer } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Upgrade Your Tier | The Franchisor Blueprint Portal",
  description: "Move from Blueprint to Navigator or Builder. Credit-forward pricing — what you already paid carries forward.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function UpgradePage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/upgrade");

  const [{ data: profileData }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("*").eq("user_id", user.id).eq("status", "paid"),
  ]);

  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");

  const currentTier = (Math.max(...purchases.map((p) => p.tier), 1) as Tier);
  const offers = await getActiveOffersForUser(user.id);
  const offerMap = new Map<string, UpgradeOffer>();
  for (const o of offers) offerMap.set(`${o.source_tier}->${o.target_tier}`, o);

  const firstName = profileData?.full_name?.split(" ")[0] ?? null;

  // Possible upgrade paths from this user's current tier
  const upgradePaths: Array<{ targetTier: Tier; offer: UpgradeOffer | null }> = [];
  if (currentTier === 1) {
    upgradePaths.push({ targetTier: 2, offer: offerMap.get("1->2") ?? null });
    upgradePaths.push({ targetTier: 3, offer: offerMap.get("1->3") ?? null });
  } else if (currentTier === 2) {
    upgradePaths.push({ targetTier: 3, offer: offerMap.get("2->3") ?? null });
  }

  if (upgradePaths.length === 0) {
    return <TopTierView firstName={firstName} />;
  }

  return (
    <>
      {/* ===== Hero ===== */}
      <section className="bg-white border-b border-navy/5">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-10 md:py-14">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold mb-6 transition-colors w-fit"
          >
            <ArrowLeft size={14} />
            Back to portal
          </Link>
          <div>
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Upgrade your tier
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy mb-3">
            {firstName ? `Move further, ${firstName}` : "Move further"}
          </h1>
          <p className="text-grey-3 text-base md:text-lg max-w-[820px]">
            Already invested in {currentTier === 1 ? "Blueprint" : "Navigator"}? That money carries forward as credit. You only pay the difference.
          </p>
        </div>
      </section>

      {/* ===== Active offers ===== */}
      {upgradePaths.some(({ offer }) => isPromoActive(offer)) && (
        <section className="bg-gradient-to-br from-navy to-navy-light text-white py-7 md:py-9 border-b border-gold/30">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <div className="flex flex-wrap items-center gap-4">
              <Clock size={20} className="text-gold" />
              <div className="flex-1">
                <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-gold mb-0.5">
                  Limited-time promo active
                </div>
                <div className="text-white text-lg font-bold">
                  Take an extra <strong>{PROMO_DISCOUNT_PERCENT}% off</strong> any upgrade below
                </div>
              </div>
              {(() => {
                const activePromo = upgradePaths
                  .map((p) => p.offer)
                  .filter((o): o is UpgradeOffer => o !== null && isPromoActive(o))
                  .sort((a, b) => new Date(a.promo_expires_at).getTime() - new Date(b.promo_expires_at).getTime())[0];
                if (!activePromo) return null;
                return (
                  <div className="bg-white/10 rounded-xl px-5 py-3 backdrop-blur-sm">
                    <div className="text-[10px] font-semibold tracking-wider uppercase text-white/60 mb-0.5">
                      Promo ends in
                    </div>
                    <div className="text-2xl font-extrabold tabular-nums text-gold">
                      <OfferCountdown expiresAt={activePromo.promo_expires_at} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* ===== Upgrade cards ===== */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div className={`grid gap-6 md:gap-8 ${upgradePaths.length === 1 ? "max-w-[680px] mx-auto" : "md:grid-cols-2"}`}>
            {upgradePaths.map(({ targetTier, offer }) => {
              const product = upgradeProductFor(currentTier, targetTier);
              if (!product) return null;
              const promoActive = isPromoActive(offer);
              const priceCents = offer ? effectivePriceCents(offer, product.priceCents) : product.priceCents;
              const targetTierName = targetTier === 2 ? "Navigator" : "Builder";
              const TierIcon = targetTier === 2 ? MessageSquare : Briefcase;
              return (
                <UpgradeCard
                  key={product.slug}
                  productSlug={product.slug}
                  targetTierName={targetTierName}
                  TierIcon={TierIcon}
                  priceCents={priceCents}
                  baseCents={product.priceCents}
                  promoActive={promoActive}
                  description={product.description}
                  includes={product.includes}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== FAQ / fairness explainer ===== */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-[820px] mx-auto px-6 md:px-8">
          <div className="bg-white rounded-2xl border border-navy/10 p-7 md:p-9">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-gold" />
              <h2 className="text-navy font-bold text-lg">How upgrade pricing works</h2>
            </div>
            <div className="space-y-4 text-grey-3 text-[15px] leading-relaxed">
              <p>
                <strong className="text-navy">Credit-forward, always.</strong> Whatever you already paid carries forward as credit toward any higher tier. You never re-pay for what you already own.
              </p>
              <p>
                <strong className="text-navy">10% promo lasts 48 hours.</strong> The extra discount is a one-time welcome to upgrade — applies if you act in the first 48h after your purchase. After that, the credit-forward base price is still valid forever (no expiration).
              </p>
              <p>
                <strong className="text-navy">Risk-free upgrade.</strong> The 30-day money-back guarantee covers your upgrade fee, separately from your original purchase. If coaching isn&apos;t the missing piece for you, we refund.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function UpgradeCard({
  productSlug,
  targetTierName,
  TierIcon,
  priceCents,
  baseCents,
  promoActive,
  description,
  includes,
}: {
  productSlug: string;
  targetTierName: string;
  TierIcon: React.ComponentType<{ size?: number; className?: string }>;
  priceCents: number;
  baseCents: number;
  promoActive: boolean;
  description: string;
  includes: string[];
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-navy/10 shadow-[0_8px_28px_rgba(30,58,95,0.08)] overflow-hidden flex flex-col">
      <div className="h-1.5 bg-gradient-to-r from-gold via-gold-warm to-gold" />
      <div className="p-7 md:p-9 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy to-navy-light text-gold flex items-center justify-center ring-4 ring-gold/15">
            <TierIcon size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold-warm">Upgrade to</div>
            <h2 className="text-navy font-extrabold text-2xl leading-tight">{targetTierName}</h2>
          </div>
        </div>

        <p className="text-grey-3 text-[15px] leading-relaxed mb-5">{description}</p>

        <ul className="space-y-2.5 mb-6 flex-1">
          {includes.map((it) => (
            <li key={it} className="flex items-start gap-2.5 text-sm text-grey-3 leading-relaxed">
              <Check size={16} className="text-gold-warm flex-shrink-0 mt-0.5" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-navy/10 pt-5">
          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-navy font-extrabold text-4xl tabular-nums">
              {formatCents(priceCents)}
            </div>
            {promoActive && priceCents !== baseCents && (
              <div className="text-grey-4 text-base line-through">{formatCents(baseCents)}</div>
            )}
          </div>
          <div className="text-grey-4 text-xs mb-5">
            {promoActive ? (
              <>10% promo applied · credit-forward from your prior purchase</>
            ) : (
              <>Credit-forward pricing · no expiration</>
            )}
          </div>

          <form action={`/api/checkout/${productSlug}`} method="POST">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
            >
              Upgrade to {targetTierName}
              <ArrowRight size={15} />
            </button>
          </form>
          <p className="text-center text-xs text-grey-4 italic mt-3">
            Secure checkout via Stripe · 30-day satisfaction guarantee
          </p>
        </div>
      </div>
    </div>
  );
}

function TopTierView({ firstName }: { firstName: string | null }) {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[640px] mx-auto px-6 md:px-8">
        <div className="bg-white rounded-2xl border border-navy/10 p-8 md:p-10 text-center">
          <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
            {firstName ? `${firstName}, you're already at the top tier` : "You're already at the top tier"}
          </h1>
          <p className="text-grey-3 text-base mb-6">
            You&apos;ve got Builder access — every capability, all coaching, the full done-with-you build. Add-on coaching credits are still available if you want more session time.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/portal/coaching"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Add coaching credits
            </Link>
            <Link
              href="/portal"
              className="bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-navy hover:text-white transition-colors"
            >
              Back to portal
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

void PRODUCTS;
