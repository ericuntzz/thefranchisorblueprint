# Stripe live-mode flip — checklist

When the bank account lands and you're ready to take real money,
work through this in order. ~30-45 minutes start to finish if no
surprises.

---

## 1 · Stripe account: connect bank + activate

In the Stripe Dashboard (`dashboard.stripe.com`):

- [ ] **Settings → Business → Payouts** — add bank account, verify
  routing/account numbers, complete identity verification
- [ ] **Settings → Public details** — confirm business name, support
  email (`info@thefranchisorblueprint.com`), support phone, statement
  descriptor (will appear on customer card statements — keep it short
  and recognizable, e.g. `THEFRANCHISORBP`)
- [ ] **Settings → Branding** — upload logo, set brand color (#d4af37
  gold / #1e3a5f navy), pick checkout style. Customer-facing.
- [ ] Confirm "Activate payments" prompt is gone from the dashboard
  top bar — that's the signal you can charge real cards

---

## 2 · Recreate test-mode products in live mode

Toggle the dashboard from **Test mode** → **Live mode** (top-right
switch). Everything below happens in **live** mode.

The test-mode catalogue I built on 2026-05-05 needs to be recreated
exactly. The price IDs will be different (they're scoped per mode);
products themselves don't carry over.

- [ ] **Coupon `PAYINFULL5`** — 5% off, duration: once, name "Save 5
  percent when you pay in full"
- [ ] **Product: The Blueprint** — already exists as Tier 1, just
  needs live equivalents:
  - one-time price `$2,997`
  - recurring price `$1,100/mo` (3-month installment)
- [ ] **Product: Navigator** — new in live mode
  - one-time price `$8,500` (pay-in-full)
  - recurring price `$3,200/mo` (3-month installment)
  - Description: "6-month coached franchise development program — 24
    weekly 1:1 calls, document review, milestone gates, Franchise
    Ready certification."
- [ ] **Product: Builder** — new in live mode
  - one-time price `$29,500` (pay-in-full)
  - one-time price `$13,000` (down payment)
  - recurring price `$3,000/mo` (6-month installment)
  - Description: "12-month done-with-you franchise development. Vendor
    + attorney coordination, first franchisee recruitment assist,
    priority access to Jason."
- [ ] **Product: Blueprint Plus** — `$4,997` one-time
- [ ] **Product: Coaching Sample Call** — `$97` one-time
- [ ] **Product: Phase Coaching Add-on** — `$1,500` one-time
- [ ] **Products: 3 Upgrade SKUs** — Tier 1→2 ($5,503), 1→3 ($26,503),
  2→3 ($21,000), all one-time

> **Tip:** the script that created these in test mode used
> `curl -u $STRIPE_SECRET_KEY: https://api.stripe.com/v1/products`
> and `.../v1/prices`. If you'd rather automate the live-mode setup,
> share the new live `sk_live_...` key with Claude and we'll script
> it. Just don't put a live key into the repo or .env.local — Claude
> can take it via chat and use it once.

---

## 3 · Webhook endpoint

- [ ] **Developers → Webhooks → + Add endpoint** in live mode
- [ ] Endpoint URL: `https://www.thefranchisorblueprint.com/api/webhooks/stripe`
- [ ] Events to listen for (same as test mode):
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Copy the **Signing secret** (starts with `whsec_...`) — you'll
  need it for the env var below

---

## 4 · Vercel environment variables

In Vercel: **Project Settings → Environment Variables → Production**.
Update **all** of these (delete the test-mode versions and re-add
with live values):

- [ ] `STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- [ ] `STRIPE_SECRET_KEY` → `sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET` → the `whsec_...` from step 3
- [ ] `STRIPE_PRICE_BLUEPRINT` → live Blueprint $2,997 price ID
- [ ] `STRIPE_PRICE_BLUEPRINT_INSTALLMENT` → live $1,100/mo recurring
- [ ] `STRIPE_PRICE_BLUEPRINT_PLUS` → live Blueprint Plus $4,997
- [ ] `STRIPE_PRICE_NAVIGATOR` → live Navigator $8,500
- [ ] `STRIPE_PRICE_NAVIGATOR_INSTALLMENT` → live $3,200/mo recurring
- [ ] `STRIPE_PRICE_BUILDER` → live Builder $29,500
- [ ] `STRIPE_PRICE_BUILDER_INSTALLMENT` → live $3,000/mo recurring
- [ ] `STRIPE_PRICE_BUILDER_DOWN` → live $13,000 one-time down
- [ ] `STRIPE_PRICE_SAMPLE_CALL` → live $97
- [ ] `STRIPE_PRICE_PHASE_COACHING` → live $1,500
- [ ] `STRIPE_PRICE_UPGRADE_1_2`, `STRIPE_PRICE_UPGRADE_1_3`,
  `STRIPE_PRICE_UPGRADE_2_3` → three live upgrade prices
- [ ] `STRIPE_COUPON_PAY_IN_FULL` → `PAYINFULL5` (the coupon ID is
  the same string in both modes, just the underlying coupon is
  recreated separately)
- [ ] `STRIPE_COUPON_UPGRADE10` → `UPGRADE10` (same)
- [ ] **`NEXT_PUBLIC_STRIPE_LIVE` → `true`** ← THIS is the flag that
  flips the Blueprint buy box from sales-call mode back to direct
  Stripe checkout. Without setting this, the buy box stays as
  "Book your kickoff call" forever.

---

## 5 · Domain verification (for Apple Pay / Google Pay)

If you want Apple Pay / Google Pay buttons in checkout:

- [ ] **Stripe Dashboard → Settings → Payment methods → Apple Pay →
  Add new domain** — paste `www.thefranchisorblueprint.com`
- [ ] Stripe will give you a verification file to host at
  `/.well-known/apple-developer-merchantid-domain-association`
- [ ] Place the file in `public/.well-known/` in the repo, commit, push
- [ ] Click "Verify" in Stripe — should pass within a minute

(Skip this step initially — Apple/Google Pay are nice-to-have, not
critical for launch.)

---

## 6 · Redeploy + smoke test

- [ ] Trigger a new Vercel deployment (the env-var changes alone don't
  redeploy — push any commit, or hit "Redeploy" on the latest)
- [ ] Visit `https://www.thefranchisorblueprint.com/programs/blueprint`
- [ ] Confirm the buy box now shows the Stripe form (not "Book your
  kickoff call") — this is the visible signal `NEXT_PUBLIC_STRIPE_LIVE`
  took effect
- [ ] Buy The Blueprint with a real card you control. Should:
  - Charge `$2,997` to the card (or apply `PAYINFULL5` for `$2,847.15`)
  - Send the confirmation email
  - Send the magic-link onboarding email
  - Create a row in Supabase `purchases` with `status = 'paid'`
  - Sign you in to `/portal` automatically
- [ ] Refund yourself in Stripe Dashboard → Payments → click the
  charge → Refund. Verify the refund flow doesn't break the portal
  (purchase row should flip to `status = 'refunded'`).
- [ ] Try one installment plan purchase too — confirm it creates a
  subscription with the right number of iterations.

---

## 7 · Update the locked-facts memory

When live, ping Claude to:

- Update `project_tfb_locked_facts.md` — drop the "30-day guarantee
  retired" note's freshness; keep the new payment terms; clarify
  that prices are now live
- Update `pending_stripe_go_live.md` (or archive it) — the pending
  flag in memory should clear once this checklist is done

---

## Common pitfalls

- **Forgetting `NEXT_PUBLIC_STRIPE_LIVE=true`** — the most likely
  miss. Symptom: live keys in env, but buy box still shows the
  "Book your onboarding call" CTA. Fix: add the env var, redeploy.
- **Webhook signature mismatch** — symptom: customer pays, no portal
  access granted, Vercel logs show
  `Webhook signature verification failed`. Cause: `STRIPE_WEBHOOK_SECRET`
  is the test-mode secret. Fix: copy the live `whsec_...` from the
  live-mode webhook endpoint.
- **Test-mode price IDs left in env** — symptom: Stripe checkout
  errors with `No such price`. Fix: every `STRIPE_PRICE_*` var must
  be a live `price_...` ID, not a test one.
- **Domain mismatch on Stripe checkout** — symptom: Stripe-hosted
  page reloads back to TFB but no payment processed. Cause: the
  success/cancel URLs in `src/app/api/checkout/[product]/route.ts`
  hardcode `SITE_URL`; make sure `NEXT_PUBLIC_SITE_URL` env var is
  `https://www.thefranchisorblueprint.com` (no trailing slash).
