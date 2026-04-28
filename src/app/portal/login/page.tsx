import Link from "next/link";
import type { Metadata } from "next";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Portal Login | The Franchisor Blueprint",
  description: "Access your Blueprint operating system.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}

export default async function PortalLoginPage({ searchParams }: PageProps) {
  const { next, sent, error } = await searchParams;
  const sentEmail = typeof sent === "string" && sent !== "1" ? sent : null;
  const showSent = !!sent;

  return (
    <>
      <SiteNav />

      <section className="bg-cream py-24 md:py-32">
        <div className="max-w-[460px] mx-auto px-8">
          <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_24px_60px_rgba(30,58,95,0.18)] overflow-hidden">
            <div className="bg-gradient-to-br from-navy to-navy-light text-white p-7 md:p-8 text-center">
              <div className="inline-flex w-12 h-12 rounded-xl bg-white/10 items-center justify-center text-gold mb-3">
                <Lock size={20} />
              </div>
              <h1 className="text-white text-2xl font-bold mb-1">Portal Access</h1>
              <p className="text-white/70 text-sm">
                Sign in to your Blueprint operating system
              </p>
            </div>

            <div className="p-7 md:p-8">
              {showSent ? (
                <div className="text-center py-4">
                  <div className="inline-flex w-12 h-12 rounded-full bg-gold/15 items-center justify-center text-gold-warm mb-4">
                    <Mail size={20} />
                  </div>
                  <h2 className="text-navy font-bold text-lg mb-2">Check your email</h2>
                  <p className="text-grey-3 text-sm leading-relaxed mb-6">
                    {sentEmail ? (
                      <>We sent a sign-in link to <strong className="text-navy">{sentEmail}</strong>. Click the link in the email to access your portal. The link expires in 1 hour.</>
                    ) : (
                      <>We sent you a sign-in link. Click the link in the email to access your portal. The link expires in 1 hour.</>
                    )}
                  </p>
                  <p className="text-grey-4 text-xs">
                    Don&apos;t see it? Check spam, or{" "}
                    <Link href="/portal/login" className="text-navy font-semibold underline">
                      try a different email
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <form action="/api/portal/request-link" method="POST" className="space-y-5">
                  {next && <input type="hidden" name="next" value={next} />}
                  <div>
                    <label htmlFor="email" className="block text-navy text-sm font-semibold mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@yourbusiness.com"
                      className="w-full border border-navy/15 rounded-xl px-4 py-3 text-base text-navy placeholder:text-grey-4 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all"
                    />
                    <p className="mt-2 text-xs text-grey-4">
                      Use the email address you used to purchase. We&apos;ll send you a one-click sign-in link.
                    </p>
                  </div>

                  {error === "no_account" ? (
                    <div className="bg-cream border border-gold/40 rounded-xl px-5 py-4 text-sm">
                      <p className="text-navy font-bold mb-1">No purchase found for that email</p>
                      <p className="text-grey-3 leading-relaxed mb-3">
                        The portal is only available to customers who&apos;ve purchased The Blueprint. If you just bought, check your inbox for the welcome email — your access link is in there.
                      </p>
                      <Link
                        href="/programs/blueprint"
                        className="inline-flex items-center gap-1.5 text-navy font-semibold text-sm underline hover:text-gold-warm transition-colors"
                      >
                        Buy The Blueprint to get access →
                      </Link>
                    </div>
                  ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                      {error === "invalid_link"
                        ? "That sign-in link has expired or already been used. Please request a new one below."
                        : error === "invalid_email"
                          ? "Please enter a valid email address."
                          : error === "send_failed"
                            ? "We couldn't send the sign-in email just now. Please try again in a moment."
                            : "Something went wrong. Please try again."}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
                  >
                    Send sign-in link
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-grey-4 text-xs mt-6">
            Haven&apos;t purchased yet?{" "}
            <Link href="/programs/blueprint" className="text-navy font-semibold underline">
              Buy The Blueprint
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
