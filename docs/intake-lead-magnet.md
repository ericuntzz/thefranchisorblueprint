# URL-prefill lead magnet — implementation summary

**Status:** shipped 2026-05-09. Live at `thefranchisorblueprint.com`.

## What it does

When a visitor drops their URL on the home-page hero, the server runs an
8-phase enrichment pipeline (scrape + Census ACS + Google Places +
Anthropic LLM) and produces a **Franchise Readiness Snapshot**:

1. **Prototype profile** — one-paragraph plain-English narrative of what
   makes their current trade area work.
2. **Top 3 expansion markets** — scored on a 4-pillar / 100-point rubric
   that mirrors real FDD Item 11 site-criteria sheets (Demographics &
   Market · Traffic & Access · Competition · Financial & Legal).
3. **Preliminary readiness score** — 0–100 with three named gaps.
4. **Suggested tier** — Blueprint, Navigator, Builder, or "not-yet".

The snapshot is shareable, screenshot-friendly, and free.

If the visitor saves their snapshot (email gate), we send a Resend email
with a resume link and persist the snapshot. When they later purchase
through Stripe checkout, the snapshot data **automatically merges into
their portal's `customer_memory`** so the portal opens at ~15-20% complete
instead of zero. A welcome banner on `/portal` surfaces the sunk-cost:
*"You're already X% Franchise Ready. When you dropped X.com on our home
page, we pre-filled your concept, brand voice, prototype trade area, and
N expansion markets…"*

## Architecture

```
[Hero URL input]
       │
       ▼
POST /api/intake/start  (NDJSON streaming)
       │
       ├─→ checkCapAndRateLimit($20/day, 5/hr/IP)
       ├─→ findCachedIntakeForDomain (7-day cache)
       ├─→ insert intake_sessions row (HttpOnly cookie set)
       │
       ▼
runIntake() async generator yields IntakeEvents:
  scrape       — fetchSiteArtifacts (Cheerio)
  business     — Anthropic LLM extracts name, concept, brand voice,
                 placesCategory, address
  geocode      — Places geocodeAddress → resolves source ZIP
  demographics — Census ACS + Places nearby (parallel)
  expansion    — fan-out Census against 60-ZIP candidate pool
  competitors  — refine top-5 with Places nearby
  score        — readiness % + named gaps + tier suggestion
  summary      — Anthropic LLM drafts prototype-profile narrative
       │
       ▼
[Inline FDD-style snapshot card on hero]
       │
       ▼
[Save form: email → POST /api/intake/save]
       │
       ▼
intake_sessions.email + saved_at stamped
Resend email "your snapshot is saved"
       │  (later, possibly weeks)
       ▼
Stripe checkout.session.completed webhook
       │
       ├─→ ensureUserAndPurchase (existing)
       ├─→ dispatchPostPurchaseLifecycle (existing)
       └─→ mergeIntakeForUser ← intake snapshot → customer_memory
       │
       ▼
[Portal opens with welcome banner + 15-20% pre-filled sections]
```

## Files added / changed

**Database**
- `supabase/migrations/0024_intake_sessions.sql` — `intake_sessions` +
  `intake_daily_spend` tables, RLS locked, cleanup function.

**Library (`src/lib/intake/`)**
- `candidate-zips.ts` — 60 high-potential ZIPs across 25 metros.
- `orchestrator.ts` — 8-phase async generator pipeline.
- `cap-guard.ts` — daily $20 cap, per-IP 5/hr limit, per-domain 7-day cache.
- `merge.ts` — snapshot → customer_memory merge for post-signup hand-off.

**API routes (`src/app/api/intake/`)**
- `start/route.ts` — POST URL → NDJSON streaming response.
- `snapshot/[id]/route.ts` — GET cached snapshot (cookie-protected).
- `save/route.ts` — POST email → persist + Resend confirmation.
- `cap-status/route.ts` — GET `{capped, spentCents, capCents}` (60s cache).

**Components**
- `src/components/intake/IntakeHeroCTA.tsx` — 7-state client component
  (loading / capped / idle / streaming / snapshot / saved / error).
- `src/components/portal/IntakeWelcomeBanner.tsx` — server-rendered
  "you're already X% Franchise Ready" banner on /portal.

**Wired into**
- `src/app/page.tsx` — hero CTA replaces old assessment + strategy-call buttons.
- `src/app/portal/page.tsx` — fetches latest merged intake; renders banner.
- `src/app/api/webhooks/stripe/route.ts` — fires `mergeIntakeForUser` after `dispatchPostPurchaseLifecycle`.
- `src/lib/supabase/types.ts` — `IntakeSession` + `IntakeDailySpend` Row/Insert/Update types.

## Cost model

Per intake (rough, observed in production tests):
- Cheerio scrape: ~free
- Anthropic Sonnet (business extract + narrative): ~$0.05–0.10
- Places geocode (1 call): $0.005
- Places nearby (1 prototype + 5 candidates): ~$0.20
- Census ACS (60 candidate ZIPs + 1 prototype): free

**Total ≈ $0.25–0.35 per intake.** At the $20/day cap, that supports
~57–80 intakes/day before falling back to the assessment CTA.

## Operational dials

All in `src/lib/intake/cap-guard.ts`:
- `DAILY_CAP_CENTS` = 2000 (= $20). Raise as traffic / conversion warrants.
- `PER_DOMAIN_CACHE_DAYS` = 7. Same domain reuses cached snapshot for 7 days.
- `PER_IP_HOURLY_LIMIT` = 5. Bumps + ASN blocking can be added if scrapers appear.

## Three failure modes and how they're handled

1. **Scrape fails** (404, 403, JS-only SPA) → orchestrator emits
   `error` event → UI shows the "we hit a snag" state with assessment +
   strategy-call escape hatches. Session marked `failed`.

2. **No address found from URL** (chain HQ marketing site like Costa
   Vida) → geocode returns null → demographics + competitor density
   skipped → expansion ranking still works (uses neutral 50 similarity)
   but prototype profile narrative softens to "we couldn't fully map
   your trade area — sign up and add your address inside the portal."

3. **Daily cap hit** → `/api/intake/start` returns 429 → hero swaps to
   the existing assessment + strategy-call buttons with an italic
   "instant analyzer at capacity for today" note. Resets at midnight
   UTC. The cap-status endpoint is checked on mount so the swap is
   immediate.

## QA performed

- End-to-end production test on `costavida.com` — full pipeline ran in
  ~15s, returned valid scored expansion markets, named gaps, suggested
  tier. Surfaced two bugs (duplicate `complete` event; Places keyword
  too long), both fixed.
- Type-check clean across the entire repo.
- Smoke-test phase2-visual.ts compile error (unrelated, blocked the
  prior deploy) fixed during this work.
- Cap-status endpoint verified live (returns expected JSON, CDN-cached).

## What's still ahead (not blockers)

- **Real customer testimonials** — separate workflow, doc lives at
  `docs/testimonial-outreach.md`. Once collected, un-hide the
  `Testimonials` section on /home.
- **Stripe live-mode flip** — separate workflow, doc at
  `docs/stripe-live-mode-flip.md`. When bank account lands, follow
  that checklist.
- **More candidate ZIPs** — `src/lib/intake/candidate-zips.ts` has 60
  curated ZIPs across 25 metros. Easy to expand to ~200+ for finer
  expansion-market matching.
- **A/B test the hero copy** — current lead-in is "In 60 seconds, see if
  your business is ready to franchise — and your three best expansion
  markets." Worth testing alternates over 30 days.
- **Bumping the $20 cap** — once we see real intake volume and confirm
  cost-per-conversion is healthy, raise the cap to whatever fits the
  marketing budget. The infrastructure scales linearly.
