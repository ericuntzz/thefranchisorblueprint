import Link from "next/link";
import Image from "next/image";
import { LogOut, Sparkles } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";
import { PortalNavMobileMenu } from "./PortalNavMobileMenu";

interface PortalNavProps {
  displayName: string | null;
  email: string | null;
  /** Hide the Upgrade link for tier 3 (no higher to go). */
  tier?: Tier;
}

export function PortalNav({ displayName, email, tier }: PortalNavProps) {
  const label = displayName?.trim() || email || "";
  const showUpgrade = tier !== undefined && tier < 3;
  return (
    <nav className="bg-white border-b border-navy/10 sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 h-[72px] flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-3">
          {/* Icon-only mark — switched away from the stacked
              icon+wordmark PNG so the brand name doesn't appear
              twice (the wordmark to the right of the icon is the
              typeset version). */}
          <Image
            src="/icon-master.png"
            alt="The Franchisor Blueprint"
            width={52}
            height={52}
            priority
          />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-navy font-bold text-sm">The Franchisor Blueprint</span>
            <span className="text-grey-4 text-[11px] uppercase tracking-[0.14em] font-semibold">
              Customer Portal
            </span>
          </div>
        </Link>

        {/* Desktop nav (md+). Mobile users get the hamburger menu
            below — the prior md-only "Account" + sm-only "Upgrade"
            left mobile users with logo + sign-out only. */}
        <div className="hidden md:flex items-center gap-5">
          {showUpgrade && (
            <Link
              href="/portal/upgrade"
              className="inline-flex items-center gap-1.5 text-gold-warm hover:text-gold-dark text-sm font-bold tracking-tight transition-colors"
            >
              <Sparkles size={14} />
              Upgrade
            </Link>
          )}
          {label && (
            <Link
              href="/portal/account"
              className="text-grey-3 hover:text-navy text-sm font-medium transition-colors"
              aria-label="Account settings"
            >
              {label}
            </Link>
          )}
          <form action="/api/portal/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold transition-colors cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </form>
        </div>

        {/* Mobile menu — hamburger below md. Renders as a dropdown
            panel with Account / Upgrade / Sign out. */}
        <PortalNavMobileMenu label={label} tier={tier} />
      </div>
    </nav>
  );
}
