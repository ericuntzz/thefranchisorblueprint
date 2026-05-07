/**
 * /portal/library — vetted vendors, templates, and partner perks.
 *
 * Stripe-Atlas-style "more than you paid for" surface. Renders
 * three sections (Vendors / Templates / Perks). Tier-gated entries
 * show as locked cards with an upgrade CTA.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileText,
  Lock,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  entriesByCategory,
  entriesLockedAboveTier,
  type LibraryCategory,
  type LibraryEntry,
} from "@/lib/library/catalog";
import type { Purchase, Tier } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Library | The Franchisor Blueprint",
  description: "Vetted vendors, templates, and partner perks for emerging franchisors.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status, tier")
    .eq("user_id", user.id)
    .eq("status", "paid");
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status" | "tier">[];
  if (purchases.length === 0) redirect("/portal");
  const tier = (Math.max(...purchases.map((p) => p.tier)) as Tier);

  const vendors = entriesByCategory("vendor", tier);
  const templates = entriesByCategory("template", tier);
  const perks = entriesByCategory("perk", tier);
  const locked = entriesLockedAboveTier(tier);

  return (
    <main className="bg-cream min-h-screen pb-24">
      <div className="bg-white border-b border-navy/5">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-6">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-xs font-semibold uppercase tracking-[0.12em] transition-colors"
          >
            <ArrowLeft size={12} /> Back to portal
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10">
        <div className="mb-2 text-xs uppercase tracking-[0.14em] text-gold-text font-bold">
          Library
        </div>
        <h1 className="text-navy font-extrabold text-3xl md:text-4xl mb-3 leading-tight">
          Vendors, templates, and perks
        </h1>
        <p className="text-grey-3 text-base md:text-lg leading-relaxed mb-10 max-w-[700px]">
          The franchise-industry resources Jason has used on past engagements.
          Vetted, not paid placements — referral relationships are disclosed
          per entry where they exist.
        </p>

        <div className="space-y-12">
          <CategorySection
            title="Vendors"
            subtitle="Service providers Jason has worked with — attorneys, audit firms, training platforms, recruitment data."
            icon={<Users size={16} />}
            entries={vendors}
            tier={tier}
          />
          <CategorySection
            title="Templates"
            subtitle="Starter documents and reference outlines — use to compare against what your attorney drafts."
            icon={<FileText size={16} />}
            entries={templates}
            tier={tier}
          />
          <CategorySection
            title="Partner perks"
            subtitle="Discounts and benefits negotiated for TFB customers."
            icon={<Tag size={16} />}
            entries={perks}
            tier={tier}
          />

          {locked.length > 0 && (
            <LockedSection entries={locked} tier={tier} />
          )}
        </div>
      </div>
    </main>
  );
}

function CategorySection({
  title,
  subtitle,
  icon,
  entries,
  tier,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  entries: LibraryEntry[];
  tier: Tier;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-navy/5 text-navy">
          {icon}
        </span>
        <h2 className="text-navy font-bold text-xl">{title}</h2>
      </div>
      <p className="text-grey-3 text-sm leading-relaxed mb-4 max-w-[640px]">{subtitle}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function EntryCard({ entry, tier }: { entry: LibraryEntry; tier: Tier }) {
  const ctaLabel = entry.ctaLabel ?? "Learn more";
  const isExternal = entry.href?.startsWith("http");
  const isInternal = entry.href?.startsWith("/");
  return (
    <article className="bg-white rounded-xl border border-card-border p-5 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-navy font-bold text-base">{entry.name}</h3>
        {entry.region && (
          <span className="text-[10px] uppercase tracking-[0.1em] text-grey-3 font-semibold">
            {entry.region}
          </span>
        )}
      </div>
      <p className="text-gold-warm text-xs font-semibold mb-2">{entry.tagline}</p>
      <p className="text-grey-3 text-sm leading-relaxed mb-4 flex-1">{entry.description}</p>
      {entry.hasReferralRelationship && (
        <div className="text-[10px] text-amber-700 italic mb-2">
          TFB receives a referral fee from this vendor. Disclose in your FDD Item 8 if you engage.
        </div>
      )}
      <div className="mt-auto">
        {entry.href && isExternal && (
          <a
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-navy hover:text-navy-light text-xs font-bold uppercase tracking-[0.1em] transition-colors"
          >
            {ctaLabel} <ExternalLink size={11} />
          </a>
        )}
        {entry.href && isInternal && (
          <Link
            href={entry.href}
            className="inline-flex items-center gap-1.5 text-navy hover:text-navy-light text-xs font-bold uppercase tracking-[0.1em] transition-colors"
          >
            {ctaLabel} <ArrowRight size={11} />
          </Link>
        )}
        {!entry.href && (
          <span className="text-grey-3 text-xs italic">{ctaLabel}</span>
        )}
        {/* Tier marker for clarity */}
        {(entry.minTier ?? 1) > 1 && tier >= (entry.minTier ?? 1) && (
          <span className="ml-3 text-xs uppercase tracking-[0.1em] text-emerald-700 font-bold">
            · {entry.minTier === 3 ? "Builder" : "Navigator"} unlock
          </span>
        )}
      </div>
    </article>
  );
}

function LockedSection({ entries, tier }: { entries: LibraryEntry[]; tier: Tier }) {
  // Group locked entries by category for display.
  const byCategory: Record<LibraryCategory, LibraryEntry[]> = {
    vendor: entries.filter((e) => e.category === "vendor"),
    template: entries.filter((e) => e.category === "template"),
    perk: entries.filter((e) => e.category === "perk"),
  };
  return (
    <section className="border-t border-navy/10 pt-10">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-navy/5 text-grey-3">
          <Lock size={14} />
        </span>
        <h2 className="text-navy font-bold text-xl">Unlock with an upgrade</h2>
      </div>
      <p className="text-grey-3 text-sm leading-relaxed mb-4 max-w-[640px]">
        {entries.length} additional {entries.length === 1 ? "resource" : "resources"} available
        on higher tiers — including direct Jason coaching, Builder-only templates, and
        partner data services.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(byCategory).flatMap(([cat, items]) =>
          items.map((entry) => (
            <article
              key={`locked-${entry.id}`}
              className="bg-grey-1/40 rounded-xl border border-card-border p-5 flex flex-col opacity-80"
            >
              <div className="flex items-center gap-2 mb-1">
                <Lock size={12} className="text-grey-3" />
                <span className="text-xs uppercase tracking-[0.1em] text-grey-3 font-bold">
                  {entry.minTier === 3 ? "Builder" : "Navigator"} only · {cat}
                </span>
              </div>
              <h3 className="text-navy font-bold text-base mb-1">{entry.name}</h3>
              <p className="text-grey-3 text-sm leading-relaxed">{entry.tagline}</p>
            </article>
          )),
        )}
      </div>
      {tier < 3 && (
        <div className="mt-6">
          <Link
            href="/portal/upgrade"
            className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
          >
            <Sparkles size={14} />
            See upgrade options <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}

