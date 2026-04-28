"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { track } from "@/lib/analytics";

const links = [
  { href: "/programs", label: "Programs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function fireNav(label: string, destination: string, type: "primary" | "mobile") {
  track("nav_click", { nav_label: label, nav_destination: destination, nav_type: type });
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while menu open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <nav className="sticky top-0 z-50 border-b border-black/5" style={{ backgroundColor: "#ece9df" }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center"
          onClick={() => {
            fireNav("Logo (home)", "/", "primary");
            setOpen(false);
          }}
        >
          <Image
            src="/logos/tfb-logo-color.png"
            alt="The Franchisor Blueprint"
            width={220}
            height={88}
            priority
            className="h-12 md:h-16 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-10 list-none">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => fireNav(l.label, l.href, "primary")}
                className="text-navy text-[15px] font-semibold tracking-tight hover:text-gold transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/portal/login"
              onClick={() => fireNav("Sign in", "/portal/login", "primary")}
              className="text-navy text-[15px] font-semibold tracking-tight hover:text-gold transition-colors"
            >
              Sign in
            </Link>
          </li>
          <li>
            <Link
              href="/strategy-call"
              onClick={() => fireNav("Book a Call (nav CTA)", "/strategy-call", "primary")}
              className="bg-gold text-navy font-bold text-xs uppercase tracking-[0.12em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Book a Call
            </Link>
          </li>
        </ul>

        {/* Mobile hamburger trigger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-navy hover:bg-navy/5 transition-colors"
        >
          {open ? <X size={24} strokeWidth={2.25} /> : <Menu size={24} strokeWidth={2.25} />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-cream border-t border-black/5 shadow-[0_24px_40px_rgba(30,58,95,0.12)]">
          <ul className="flex flex-col px-6 py-4 list-none">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => fireNav(l.label, l.href, "mobile")}
                  className="block py-4 text-navy text-base font-semibold hover:text-gold transition-colors border-b border-navy/10"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/portal/login"
                onClick={() => fireNav("Sign in", "/portal/login", "mobile")}
                className="block py-4 text-navy text-base font-semibold hover:text-gold transition-colors border-b border-navy/10"
              >
                Sign in
              </Link>
            </li>
            <li className="pt-5">
              <Link
                href="/strategy-call"
                onClick={() => fireNav("Book a Call (nav CTA)", "/strategy-call", "mobile")}
                className="block w-full text-center bg-gold text-navy font-bold text-xs uppercase tracking-[0.12em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Book a Call
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
