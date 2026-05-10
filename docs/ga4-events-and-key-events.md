# GA4 events & Key Events — TFB master reference

**Last updated:** 2026-05-10. Source of truth lives in `src/lib/analytics.ts` (the
`GA4Event` discriminated union). This doc explains what each event means in
business terms and which ones to mark as **Key Events** in the GA4 admin so
they appear in the Conversions report and can be used in Audiences /
Explorations.

> Mark Key Events in GA4 Admin → Data display → **Events** → toggle
> "Mark as key event" on each row in the table below.

## TL;DR — set these as Key Events

These are the events that count as a real business outcome and should drive
attribution / Audiences. Mark each as a Key Event in GA4 admin:

| Event | Why it's a Key Event |
|---|---|
| `purchase` | Money landed (server-side from Stripe webhook). |
| `begin_checkout` | Customer hit Stripe checkout — top of the buying funnel. |
| `generate_lead` | Calendly booking confirmed (Discovery Call, Builder Fit, Blueprint onboarding). |
| `intake_email_saved` | Visitor handed over email to save their snapshot — the actual conversion of the URL-prefill lead magnet. |
| `assessment_complete` | Visitor finished the 15-question quiz with score + tier recommendation. |
| `submit_lead_form` | Contact-form submission. |
| `portal_login` | Paying customer signed into the portal (already has tier on the event). |
| `portal_section_complete` | Customer crossed 100% on a blueprint section — strongest "still active" signal. |
| `portal_export_request` | Customer downloaded a deliverable — the reason they bought. |
| `portal_coaching_book` | Coaching call booked from inside the portal. |
| `portal_upgrade_select` | Tier upgrade purchase initiated. |

Everything else stays as a regular engagement event — useful in funnels and
explorations, but not a "conversion" in the strict sense.

## All events, grouped by surface

### Site / marketing pages (already live, working)

| Event | Fires when | Where |
|---|---|---|
| `view_item` | Pricing tier card scrolled into view | Homepage, /pricing, /programs |
| `select_item` | Pricing tier card clicked | Homepage, /pricing, /programs |
| `view_section` | Tracked content section scrolled into view | Various |
| `nav_click` | Top-nav link clicked | `SiteNav` |
| `cta_click` | Generic CTA click | Various |
| `video_play` | Hero video played | `VideoPlayer` |
| `submit_lead_form` | Contact form submitted | `/contact` |
| `generate_lead` | Calendly booking confirmed | `CalendlyEmbed` (any embed) |
| `begin_checkout` | Stripe checkout opened | `BlueprintBuyButton`, `BlueprintUpsellBuyBox` |
| `purchase` | Stripe `checkout.session.completed` | Server-side via Measurement Protocol from `/api/webhooks/stripe` |

### Intake URL-prefill lead magnet (NEW, 2026-05-10)

The 5-event funnel for the homepage URL drop-zone:

```
intake_start → intake_snapshot_view → intake_email_saved
                       │                       │
                       ├─→ intake_capped       └─ "lead" (Key Event)
                       └─→ intake_failed
```

| Event | Fires when | Notes |
|---|---|---|
| `intake_start` | Visitor submitted their URL | Engagement only — no PII yet |
| `intake_snapshot_view` | Snapshot rendered to the visitor | Carries `readiness_score`, `recommended_tier`, `expansion_markets` count |
| `intake_email_saved` | **Email captured to save snapshot** | **Mark as Key Event.** Carries `readiness_score`, `recommended_tier` |
| `intake_capped` | Daily $20 cap hit; alternate CTA shown | Watch this — if it spikes, we're under-budget |
| `intake_failed` | Pipeline error (scrape/geocode/etc) | Carries `failure_reason`, `failed_phase` |

Conversion rate to watch in GA4 Explorations:
`intake_start → intake_snapshot_view → intake_email_saved`

### Assessment quiz (NEW wiring, event types existed)

| Event | Fires when | Notes |
|---|---|---|
| `assessment_start` | Quiz initialized (fresh or resumed) | Carries `source`, `is_resume` |
| `assessment_complete` | Result page rendered | **Mark as Key Event.** Carries `score`, `recommended_tier` |

### Portal (NEW — the actual product)

These fire only for paying customers inside `/portal/*`. **All previously
zero — there was no usage tracking on the product itself.**

| Event | Fires when | Notes |
|---|---|---|
| `portal_login` | Portal landing page loaded (deduped per browser session) | **Mark as Key Event.** Carries `tier`, `first_login` |
| `portal_section_open` | A `/portal/section/[slug]` page rendered | Carries `section_slug`. Per-render — counts revisits |
| `portal_section_save` | Customer saved a field in the blueprint builder | Carries `section_slug`, `field_key`, `source` (`human` / `jason_ai` / `intake_prefill`) |
| `portal_section_complete` | Section reached 100% complete | **Mark as Key Event.** Wire-up TODO: needs server-side fire from completion calc |
| `portal_export_request` | Customer downloaded a deliverable | **Mark as Key Event.** Carries `deliverable`, `format` (`pdf` / `docx` / `pptx` / `zip`) |
| `portal_jason_ai_message` | Customer sent a message to the in-portal Jason AI | Carries `surface`, `agent_wrote` |
| `portal_coaching_book` | Coaching call confirmed in `/portal/coaching/schedule` | **Mark as Key Event.** Carries `tier`. Fires alongside the standard `generate_lead` |
| `portal_upgrade_view` | `/portal/upgrade` page loaded | Carries `from_tier` |
| `portal_upgrade_select` | Customer initiated an upgrade purchase | **Mark as Key Event.** Wire-up TODO: needs to fire from the upgrade BuyButton onClick |

### Wire-up TODOs (intentional second-pass items)

Two events are in the catalog but not yet firing — explicit follow-ups:

1. **`portal_section_complete`** — needs a server-side fire when a section
   crosses the completion threshold. Currently we fire `portal_section_save`
   per write; the "is this the save that crossed 100%" logic lives in the
   readiness calc and isn't yet exposed to the client. Easiest path:
   read the response from the save action and fire client-side when it
   reports `sectionPctAfter === 100 && sectionPctBefore < 100`.
2. **`portal_upgrade_select`** — needs to be wired to the upgrade purchase
   button on `/portal/upgrade` similar to how `BlueprintBuyButton` fires
   `begin_checkout`. The upgrade BuyButton is server-rendered; will need
   a client wrapper similar to `CoachingCalendlyEmbed`.

## Recommended GA4 admin work (one-time setup)

1. **Mark Key Events** — toggle the Key Event switch on every event in the
   "TL;DR — set these as Key Events" table. Until you do this, they don't
   appear in the Conversions report and can't be used for Audience triggers.

2. **Custom dimensions** — register these so they're queryable in
   Explorations:
   - `recommended_tier` (event-scoped) — used by `intake_email_saved`,
     `intake_snapshot_view`, `assessment_complete`, `select_item`
   - `tier` (user-scoped if possible, event-scoped otherwise) — used by
     `portal_login`, `portal_coaching_book`, `from_tier` for upgrades
   - `section_slug` (event-scoped) — used by all `portal_section_*` events
   - `failure_reason` and `failed_phase` (event-scoped) — for `intake_failed`
     diagnostics
   - `readiness_score` (event-scoped, numeric metric) — for `intake_*`
     funnel segmentation

3. **Audiences worth building**:
   - "High-intent intake leads" — `intake_email_saved` with
     `recommended_tier in (navigator, builder)` and `readiness_score >= 60`
   - "Stalled in portal" — `portal_login` in last 14 days but no
     `portal_section_save` in last 7 days
   - "Power users" — 5+ `portal_section_save` events in the last 30 days
   - "Upgrade-ready" — `portal_upgrade_view` fired but no
     `portal_upgrade_select`

4. **Funnel Explorations to build first**:
   - **Intake funnel**: `intake_start` → `intake_snapshot_view`
     → `intake_email_saved` → `purchase`
   - **Assessment funnel**: `assessment_start` → `assessment_complete`
     → `generate_lead` (Calendly) → `purchase`
   - **Portal activation**: `portal_login` → first `portal_section_save`
     → first `portal_section_complete` → first `portal_export_request`
   - **Upgrade funnel**: `portal_upgrade_view` → `portal_upgrade_select`
     → `purchase`

## Why some events live server-side

`purchase` fires from the Stripe webhook via the Measurement Protocol
(`src/lib/ga-measurement-protocol.ts`) — never client-side — so an
ad-blocker can't lose a real revenue event. Setup checklist (already
done): `GA4_MP_API_SECRET` env var on Vercel.

We could mirror more events to MP later (especially `portal_export_request`
and `portal_section_complete` for paying-customer reliability) but the
tradeoff is added webhook complexity. Current stance: client-side is
fine for engagement, server-side only for irrecoverable revenue events.
