import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  // Cream-on-navy footer (was navy-on-navy and blended with the dark final-CTA
  // section above it). Light footer creates a clear "marketing is done, this
  // is the practical/legal stuff" beat and lets the final CTA above it read
  // as the visual climax rather than competing with the footer for weight.
  return (
    <footer className="bg-cream text-navy/75 pt-16 pb-6 border-t-4 border-gold/60">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-x-8 gap-y-10 md:gap-12 pb-10 border-b border-navy/10">
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/logos/tfb-logo-color.png"
              alt="The Franchisor Blueprint"
              width={220}
              height={70}
              className="h-14 w-auto mb-3"
            />
            <p className="text-navy/65 text-sm leading-relaxed max-w-[320px]">
              The Smartest, Most Affordable Path to Becoming a Franchisor.
            </p>
          </div>
          <div>
            <h4 className="text-navy text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Explore
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li><Link href="/" className="hover:text-gold-warm transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-gold-warm transition-colors">About</Link></li>
              <li><Link href="/programs" className="hover:text-gold-warm transition-colors">Programs</Link></li>
              <li><Link href="/pricing" className="hover:text-gold-warm transition-colors">Pricing</Link></li>
              <li><Link href="/blog" className="hover:text-gold-warm transition-colors">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-navy text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Get Started
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li><Link href="/assessment" className="hover:text-gold-warm transition-colors">Assessment</Link></li>
              <li><Link href="/strategy-call" className="hover:text-gold-warm transition-colors">Book a Call</Link></li>
              <li><Link href="/contact" className="hover:text-gold-warm transition-colors">Contact</Link></li>
              <li>
                <Link href="/portal/login" className="hover:text-gold-warm transition-colors font-semibold">
                  Customer Portal →
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-navy text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Connect
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li>
                <a href="mailto:hello@thefranchisorblueprint.com" className="hover:text-gold-warm transition-colors break-words">
                  hello@thefranchisorblueprint.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/jason-stowe-a8093539"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold-warm transition-colors"
                >
                  LinkedIn →
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-navy text-xs font-extrabold tracking-widest uppercase mb-5 font-sans">
              Legal
            </h4>
            <ul className="space-y-2.5 list-none text-sm">
              <li><Link href="/privacy" className="hover:text-gold-warm transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-gold-warm transition-colors">Terms of Service</Link></li>
              <li><Link href="/earnings-disclaimer" className="hover:text-gold-warm transition-colors">Earnings Disclaimer</Link></li>
              <li><Link href="/franchise-disclaimer" className="hover:text-gold-warm transition-colors">Franchise Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-6 flex flex-col md:flex-row justify-between gap-4 text-xs text-navy/55">
          <div>© {new Date().getFullYear()} The Franchisor Blueprint. All Rights Reserved.</div>
          <div className="max-w-[700px] italic">
            The Franchisor Blueprint is a consulting firm, not a law firm. All legal work is performed by qualified franchise counsel. We provide business consulting services only.
          </div>
        </div>
      </div>
    </footer>
  );
}
