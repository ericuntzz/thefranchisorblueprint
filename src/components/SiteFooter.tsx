import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-[#0f1f33] text-[#c0c7d4] pt-16 pb-6">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 pb-10 border-b border-white/10">
          <div>
            <Image
              src="/logos/tfb-logo-white.png"
              alt="The Franchisor Blueprint"
              width={220}
              height={70}
              className="h-14 w-auto mb-3"
            />
            <p className="text-white/60 text-sm leading-relaxed max-w-[320px]">
              The Smartest, Most Affordable Path to Becoming a Franchisor.
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Navigate
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li><Link href="/" className="hover:text-gold">Home</Link></li>
              <li><Link href="/about" className="hover:text-gold">About</Link></li>
              <li><Link href="/programs" className="hover:text-gold">Programs</Link></li>
              <li><Link href="/pricing" className="hover:text-gold">Pricing</Link></li>
              <li><Link href="/assessment" className="hover:text-gold">Assessment</Link></li>
              <li><Link href="/strategy-call" className="hover:text-gold">Book a Call</Link></li>
              <li><Link href="/blog" className="hover:text-gold">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-gold">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Connect
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li>
                <a href="mailto:hello@thefranchisorblueprint.com" className="hover:text-gold">
                  hello@thefranchisorblueprint.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/jason-stowe-a8093539"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold"
                >
                  LinkedIn →
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Legal
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li><Link href="/privacy" className="hover:text-gold">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-gold">Terms of Service</Link></li>
              <li><Link href="/earnings-disclaimer" className="hover:text-gold">Earnings Disclaimer</Link></li>
              <li><Link href="/franchise-disclaimer" className="hover:text-gold">Franchise Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-6 flex flex-col md:flex-row justify-between gap-4 text-xs text-white/50">
          <div>© {new Date().getFullYear()} The Franchisor Blueprint. All Rights Reserved.</div>
          <div className="max-w-[700px] italic">
            The Franchisor Blueprint is a consulting firm, not a law firm. All legal work is performed by qualified franchise counsel. We provide business consulting services only.
          </div>
        </div>
      </div>
    </footer>
  );
}
