"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";

interface SignInFormProps {
  next?: string;
  /** Pre-fill the email input — used after an `?error=invalid_email`
   *  redirect so the customer doesn't have to retype the email they
   *  just got rejected on. */
  initialEmail?: string;
}

/**
 * Client form for /portal/login with a "securely signing you in" loading
 * overlay. Posts to /api/portal/request-link with native form submit so:
 *   1. No JSON-fetch / try-catch / state-management complexity
 *   2. Submission survives even if our JS misbehaves
 *   3. The browser's POST→303→GET round-trip lands the user on the
 *      success or error variant of /portal/login automatically.
 *
 * The overlay is purely UX: it appears the moment the user clicks submit
 * and persists until the navigation completes. Most magic-link round-trips
 * take <1s, but customers handing over an email feel reassured by a brief
 * "your data is moving securely" beat (banking-app pattern). The overlay
 * also blocks double-submits.
 */
export function SignInForm({ next, initialEmail }: SignInFormProps) {
  const [submitting, setSubmitting] = useState(false);

  // If user navigates back to a stale form (e.g., bfcache), clear the loading state.
  useEffect(() => {
    const onPageShow = () => setSubmitting(false);
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <>
      <form
        action="/api/portal/request-link"
        method="POST"
        className="space-y-5"
        onSubmit={(e) => {
          // basic client-side guard against invalid emails
          const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.value || "";
          if (!email.includes("@")) return; // let HTML required validation fire
          setSubmitting(true);
        }}
      >
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
            defaultValue={initialEmail ?? ""}
            placeholder="you@yourbusiness.com"
            disabled={submitting}
            className="w-full border border-navy/15 rounded-xl px-4 py-3 text-base text-navy placeholder:text-grey-4 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all disabled:bg-grey-1/40 disabled:text-grey-3"
          />
          <p className="mt-2 text-xs text-grey-4">
            Use the email address you used to purchase. We&apos;ll send you a one-click sign-in link.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-80 disabled:cursor-wait"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Securely signing you in
            </>
          ) : (
            <>
              Send sign-in link
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {submitting && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Securely signing you in"
          className="fixed inset-0 z-[100] bg-navy/40 backdrop-blur-sm flex items-center justify-center px-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(30,58,95,0.30)] p-8 md:p-10 max-w-[420px] w-full text-center">
            <div className="relative inline-flex w-16 h-16 items-center justify-center mb-5">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-navy to-navy-light" />
              <Lock size={26} className="relative text-gold" />
              <Loader2
                size={64}
                className="absolute inset-0 animate-spin text-gold/60"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="text-navy font-extrabold text-xl mb-2">
              Securely signing you in
            </h2>
            <p className="text-grey-3 text-sm leading-relaxed mb-4">
              We&apos;re sending a one-click access link to your inbox. This usually takes a few seconds.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-grey-4 text-xs">
              <ShieldCheck size={14} className="text-gold" />
              <span>Encrypted end-to-end · No password to remember</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
