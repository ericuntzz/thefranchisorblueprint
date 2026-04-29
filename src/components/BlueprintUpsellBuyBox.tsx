"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Sparkles,
  ArrowLeft,
  Mail,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { track } from "@/lib/analytics";

type GateState =
  | { kind: "idle" }
  | { kind: "email-gate"; error?: string }
  | { kind: "checking" }
  | { kind: "existing-customer"; email: string }
  | { kind: "requesting-magic-link"; email: string }
  | { kind: "magic-link-sent"; email: string }
  | { kind: "magic-link-failed"; email: string };

/**
 * Buy box for The Blueprint with two combined responsibilities:
 *
 *   1. Inline upsell toggle — adds 4 coaching calls (turns Blueprint into
 *      Blueprint Plus) without sending the user to a different page.
 *
 *   2. Pre-purchase email collision gate — before redirecting to Stripe,
 *      asks for the email and pings /api/checkout/precheck. If the email
 *      already belongs to a paid customer, we surface friendly options
 *      instead of silently merging the new purchase into their account.
 *
 * State machine:
 *
 *     idle ─click Buy─→ email-gate ─submit─→ checking
 *                                              │
 *                              ┌───────────────┼─────────────────┐
 *                              ▼               ▼                 ▼
 *                          existing-       (ok or            (validation)
 *                          customer        incomplete)        → email-gate
 *                              │            ─→ POST            (with error)
 *                              │            /api/checkout
 *               ┌──────────────┼─────────────┐
 *               ▼              ▼             ▼
 *           Sign in      Different     (state stays
 *           magic-link   email →        existing-customer
 *           sent         email-gate     until user picks)
 *
 * If `signedInEmail` is provided (parent server component already knows
 * the user's email from auth), we pre-fill the email field — they
 * obviously know what they're doing, so we just streamline.
 */
export function BlueprintUpsellBuyBox({
  signedInEmail,
}: {
  signedInEmail?: string | null;
}) {
  const [withCoaching, setWithCoaching] = useState(false);
  const [state, setState] = useState<GateState>({ kind: "idle" });
  const [emailInput, setEmailInput] = useState(signedInEmail ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const productSlug = withCoaching ? "blueprint-plus" : "blueprint";
  const productPrice = withCoaching ? 4997 : 2997;
  const buttonLabel = withCoaching
    ? "Buy Blueprint Plus — $4,997"
    : "Buy The Blueprint — $2,997";

  // Auto-focus the email input the moment we enter the gate so keyboard users
  // can just start typing. Tiny delay so focus doesn't race the slide-in.
  useEffect(() => {
    if (state.kind === "email-gate") {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [state.kind]);

  function fireBeginCheckoutEvent() {
    track("begin_checkout", {
      currency: "USD",
      value: productPrice,
      items: [
        withCoaching
          ? {
              item_id: "blueprint-plus",
              item_name: "Blueprint Plus",
              price: 4997,
              quantity: 1,
              item_category: "Tier 1 + Coaching",
            }
          : {
              item_id: "the-blueprint",
              item_name: "The Blueprint",
              price: 2997,
              quantity: 1,
              item_category: "Tier 1",
            },
      ],
      cta_location: "blueprint_product_buy_box",
    });
  }

  // Submit the actual checkout form programmatically. The form lives in the
  // DOM as a hidden child of this component; we set the email field, retarget
  // the action to the right product slug, and call submit() so the browser
  // performs a normal POST + 303-redirect cycle to Stripe.
  function submitToCheckout(email: string) {
    fireBeginCheckoutEvent();
    if (!formRef.current) return;
    const emailField = formRef.current.querySelector<HTMLInputElement>(
      'input[name="email"]',
    );
    if (emailField) emailField.value = email;
    formRef.current.action = `/api/checkout/${productSlug}`;
    formRef.current.submit();
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@") || email.length < 4) {
      setState({ kind: "email-gate", error: "Please enter a valid email." });
      return;
    }

    setState({ kind: "checking" });

    try {
      const res = await fetch("/api/checkout/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { status: string };

      if (data.status === "ok" || data.status === "incomplete-account") {
        // Proceed to Stripe — the webhook will idempotently link to any
        // existing un-paid profile.
        submitToCheckout(email);
        return;
      }
      if (data.status === "existing-customer") {
        setState({ kind: "existing-customer", email });
        return;
      }
      if (data.status === "invalid-email") {
        setState({ kind: "email-gate", error: "Please enter a valid email." });
        return;
      }
      // Unknown status — fail open (let them through to Stripe).
      console.warn("[buy-box] unexpected precheck status:", data.status);
      submitToCheckout(email);
    } catch (err) {
      // Network / server error — fail open. Better to risk a duplicate
      // (rare edge case caught by the webhook) than to block a paying
      // customer because precheck flaked.
      console.error("[buy-box] precheck failed:", err);
      submitToCheckout(email);
    }
  }

  async function handleSendMagicLink(email: string) {
    setState({ kind: "requesting-magic-link", email });
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("next", "/portal");
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        body: formData,
        // /api/portal/request-link uses 303 redirects for the form-post
        // path. With redirect:manual, success surfaces as opaqueredirect
        // (status 0). We treat that as success unless something explicitly
        // returned an error response.
        redirect: "manual",
      });
      if (res.type === "opaqueredirect" || res.status === 0 || res.ok) {
        setState({ kind: "magic-link-sent", email });
      } else {
        setState({ kind: "magic-link-failed", email });
      }
    } catch (err) {
      console.error("[buy-box] magic-link request failed:", err);
      setState({ kind: "magic-link-failed", email });
    }
  }

  // ─── Render branches ────────────────────────────────────────────────

  // Existing-customer flow takes over the entire panel — hide upsell toggle.
  if (
    state.kind === "existing-customer" ||
    state.kind === "requesting-magic-link" ||
    state.kind === "magic-link-sent" ||
    state.kind === "magic-link-failed"
  ) {
    return (
      <ExistingCustomerPanel
        email={state.email}
        state={state.kind}
        onSignIn={() => handleSendMagicLink(state.email)}
        onUseDifferentEmail={() => {
          setEmailInput("");
          setState({ kind: "email-gate" });
        }}
      />
    );
  }

  return (
    <>
      {/* ===== Add-coaching upsell toggle (always visible during purchase flow) ===== */}
      <button
        type="button"
        onClick={() => setWithCoaching((v) => !v)}
        className={`w-full text-left rounded-2xl border-2 p-4 mb-5 transition-all ${
          withCoaching
            ? "border-gold bg-gradient-to-br from-cream to-white shadow-[0_4px_14px_rgba(212,162,76,0.18)]"
            : "border-navy/15 bg-white hover:border-navy/30"
        }`}
        aria-pressed={withCoaching}
        aria-label="Toggle Blueprint Plus — adds 4 coaching calls for $2,000 more"
      >
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 transition-colors ${
              withCoaching ? "bg-gold border-gold" : "bg-white border-navy/30"
            }`}
            aria-hidden
          >
            {withCoaching && <Check size={13} className="text-navy" strokeWidth={3} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-navy font-bold text-sm">
                <Sparkles size={13} className="text-gold-warm" />
                Add 4 coaching calls
              </div>
              <div className="text-navy font-extrabold text-sm tabular-nums whitespace-nowrap">
                +$2,000
              </div>
            </div>
            <p className="text-grey-3 text-xs leading-relaxed">
              Get personal guidance through the hardest phases — Codify Your Operations and Decode the FDD. Becomes <span className="text-navy font-semibold">Blueprint Plus</span>.
            </p>
          </div>
        </div>
      </button>

      {/* ===== Hidden form that the gate ultimately submits to Stripe ===== */}
      <form
        ref={formRef}
        action={`/api/checkout/${productSlug}`}
        method="POST"
        className="hidden"
      >
        <input type="hidden" name="email" />
      </form>

      {/* ===== State-driven panel: idle button, email gate, or checking spinner ===== */}
      {state.kind === "idle" && (
        <button
          type="button"
          onClick={() => setState({ kind: "email-gate" })}
          className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
        >
          {buttonLabel}
        </button>
      )}

      {state.kind === "email-gate" && (
        <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
          <label className="block">
            <span className="block text-navy font-semibold text-xs uppercase tracking-[0.12em] mb-2">
              Your email
            </span>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-grey-4"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@yourcompany.com"
                className="w-full rounded-xl border border-navy/15 bg-white pl-10 pr-3 py-3 text-[15px] text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
              />
            </div>
            <p className="text-xs text-grey-4 mt-2 leading-relaxed">
              This is where we&apos;ll send your portal sign-in link and onboarding details.
            </p>
            {state.error && (
              <p className="flex items-start gap-1.5 text-red-600 text-xs font-semibold mt-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                {state.error}
              </p>
            )}
          </label>

          <button
            type="submit"
            className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
          >
            Continue to checkout →
          </button>

          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="flex items-center gap-1 text-grey-3 hover:text-navy text-xs font-semibold w-full justify-center pt-1"
          >
            <ArrowLeft size={13} /> Back
          </button>
        </form>
      )}

      {state.kind === "checking" && (
        <div className="flex flex-col items-center gap-3 py-6 text-grey-3">
          <Loader2 size={24} className="animate-spin text-gold" />
          <span className="text-sm font-semibold">Setting up your checkout…</span>
        </div>
      )}
    </>
  );
}

// ─── Existing-customer panel (sub-component for clarity) ────────────────

function ExistingCustomerPanel({
  email,
  state,
  onSignIn,
  onUseDifferentEmail,
}: {
  email: string;
  state:
    | "existing-customer"
    | "requesting-magic-link"
    | "magic-link-sent"
    | "magic-link-failed";
  onSignIn: () => void;
  onUseDifferentEmail: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Friendly heads-up banner */}
      <div className="rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-cream to-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-base">
            👋
          </div>
          <div className="min-w-0">
            <div className="text-navy font-extrabold text-base mb-1">
              Welcome back!
            </div>
            <p className="text-grey-3 text-sm leading-relaxed">
              An account using{" "}
              <span className="font-semibold text-navy break-all">{email}</span>{" "}
              already exists. Did you mean to sign in?
            </p>
          </div>
        </div>
      </div>

      {state === "existing-customer" && (
        <>
          <button
            type="button"
            onClick={onSignIn}
            className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
          >
            Sign me in instead
          </button>
          <button
            type="button"
            onClick={onUseDifferentEmail}
            className="block w-full text-center bg-white text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:border-navy hover:bg-navy/5 transition-colors cursor-pointer"
          >
            Use a different email
          </button>
          <p className="text-xs text-grey-4 leading-relaxed text-center pt-1">
            Buying for a spouse running their own business, or a client?{" "}
            <span className="text-navy font-semibold">
              Use a different email so they get their own portal.
            </span>
          </p>
        </>
      )}

      {state === "requesting-magic-link" && (
        <div className="flex flex-col items-center gap-3 py-4 text-grey-3">
          <Loader2 size={22} className="animate-spin text-gold" />
          <span className="text-sm font-semibold">Sending sign-in link…</span>
        </div>
      )}

      {state === "magic-link-sent" && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="flex-shrink-0 text-emerald-600 mt-0.5"
              size={20}
            />
            <div className="min-w-0">
              <div className="text-emerald-900 font-bold text-sm mb-1">
                Sign-in link sent
              </div>
              <p className="text-emerald-800/85 text-sm leading-relaxed">
                Check{" "}
                <span className="font-semibold break-all">{email}</span> — you should see it within 30 seconds. The link signs you straight into your portal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onUseDifferentEmail}
            className="block w-full text-center bg-white text-navy border-2 border-navy/15 font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:border-navy hover:bg-navy/5 transition-colors cursor-pointer mt-4"
          >
            Use a different email instead
          </button>
        </div>
      )}

      {state === "magic-link-failed" && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="flex-shrink-0 text-red-600 mt-0.5"
              size={20}
            />
            <div className="min-w-0">
              <div className="text-red-900 font-bold text-sm mb-1">
                Couldn&apos;t send the link
              </div>
              <p className="text-red-800/85 text-sm leading-relaxed">
                Try again, or email{" "}
                <a
                  href="mailto:team@thefranchisorblueprint.com"
                  className="font-semibold underline"
                >
                  team@thefranchisorblueprint.com
                </a>{" "}
                and we&apos;ll sort it out manually.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onSignIn}
              className="flex-1 text-center bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-4 py-3 rounded-full hover:bg-gold-dark transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onUseDifferentEmail}
              className="flex-1 text-center bg-white text-navy border-2 border-navy/15 font-bold text-xs uppercase tracking-[0.1em] px-4 py-3 rounded-full hover:border-navy hover:bg-navy/5 transition-colors"
            >
              Different email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
