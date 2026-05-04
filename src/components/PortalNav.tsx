import Link from "next/link";
import Image from "next/image";
import { LogOut, Sparkles } from "lucide-react";
import type { Tier } from "@/lib/supabase/types";

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
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 h-[72px] flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-3">
          {/* Icon-only mark — the brand wordmark sat next to it AND
              was baked into the previous PNG, so customers saw "The
              Franchisor Blueprint" twice. The icon alone is enough
              identification inside the portal; the "Customer Portal"
              caption tells them where they are. */}
          <Image
            src="/icon-master.png"
            alt="The Franchisor Blueprint"
            width={52}
            height={52}
            priority
          />
          <span className="hidden md:inline text-grey-4 text-[11px] uppercase tracking-[0.14em] font-semibold leading-tight">
            Customer Portal
          </span>
        </Link>

        <div className="flex items-center gap-3 md:gap-5">
          {showUpgrade && (
            <Link
              href="/portal/upgrade"
              className="hidden sm:inline-flex items-center gap-1.5 text-gold-warm hover:text-gold-dark text-sm font-bold tracking-tight transition-colors"
            >
              <Sparkles size={14} />
              Upgrade
            </Link>
          )}
          {label && (
            <Link
              href="/portal/account"
              className="hidden md:inline text-grey-3 hover:text-navy text-sm font-medium transition-colors"
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
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
