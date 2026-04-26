import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-black/5" style={{ backgroundColor: "#ece9df" }}>
      <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/logos/tfb-logo-color.png"
            alt="The Franchisor Blueprint"
            width={220}
            height={88}
            priority
            className="h-16 w-auto"
          />
        </Link>
        <ul className="hidden md:flex items-center gap-10 list-none">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-navy text-[15px] font-semibold tracking-tight hover:text-gold transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/strategy-call"
              className="bg-gold text-navy font-bold text-xs uppercase tracking-[0.12em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Book a Call
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
