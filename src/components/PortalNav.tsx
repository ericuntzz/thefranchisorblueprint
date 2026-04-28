import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";

interface PortalNavProps {
  displayName: string | null;
  email: string | null;
}

export function PortalNav({ displayName, email }: PortalNavProps) {
  // Prefer the customer's actual name; fall back to email if name isn't set yet
  // (shouldn't happen post-purchase since Stripe captures name, but safe).
  const label = displayName?.trim() || email || "";
  return (
    <nav className="bg-white border-b border-navy/10 sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 h-[72px] flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-3">
          <Image
            src="/logos/tfb-logo-color.png"
            alt="The Franchisor Blueprint"
            width={44}
            height={44}
            priority
          />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-navy font-bold text-sm">The Franchisor Blueprint</span>
            <span className="text-grey-4 text-[11px] uppercase tracking-[0.14em] font-semibold">
              Customer Portal
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {label && (
            <span className="hidden md:inline text-grey-3 text-sm font-medium">{label}</span>
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
