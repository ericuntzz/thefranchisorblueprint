import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/programs", label: "Programs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#eee] py-4">
      <div className="max-w-[1200px] mx-auto px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logos/tfb-logo-color.png"
            alt="The Franchisor Blueprint"
            width={180}
            height={56}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <ul className="hidden md:flex items-center gap-7 list-none">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-navy text-sm font-semibold tracking-wide hover:text-gold transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/strategy-call"
              className="bg-gold text-navy font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded hover:bg-gold-dark transition-colors"
            >
              Book a Call
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
