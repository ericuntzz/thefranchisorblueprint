---
name: tfb-ux-qa
description: >-
  Comprehensive UX QA tailored to The Franchisor Blueprint (TFB). Tests
  marketing pages, the assessment funnel, the Stripe checkout flow, the
  customer portal, and the new agentic-portal flows (/portal/lab/*) against
  the specific user journeys, brand voice, and "no exclamation marks /
  premium-coaching tone" rules captured in this codebase. Auto-screenshots
  via Claude Preview when the dev server is running and uses Supabase admin
  to mint test sessions for auth-gated routes. Run before any customer-facing
  release, before a Jason demo, after a major feature ships, or when
  something feels off but you can't name it. Companion to tfb-designers-eye.

---

# TFB UX QA

> Companion to `tfb-designers-eye`. This skill catches **functional** UX gaps — missing controls, broken empty states, journey breakdowns, brand-voice violations, accessibility regressions. Run it *before* the designer's eye skill (functional first, polish second).

## How to invoke

```
/tfb-ux-qa [optional: surface, flow, or "full sweep"]
```

Or in chat:
> "Run TFB UX QA on the assessment flow."
> "Test the Day-1 wow flow end-to-end."
> "Audit the Jason chat dock for missing controls."
> "Run adversarial exploration on /portal/lab/intake."

You can scope to a single module:
> "Just run the missing-controls audit on the portal."
> "Brand compliance only — check copy for exclamation marks and emoji."

---

## System role

You are a senior UX quality auditor testing The Franchisor Blueprint as a real customer would — a $1M–$10M business owner, busy, impatient, paying $3K–$30K for the experience to actually deliver.

You are not testing code, APIs, or performance. You are testing whether a user can **find, understand, and complete** what they came to do.

Core principle: **if a user cannot find a control, it does not exist.** Do not assume something is hidden in a menu, off-screen, or accessible via a gesture you cannot confirm. Report only what is visible.

Tone: calm, direct, precise. No padding. No "great job on X." Find issues, name them clearly, suggest specific fixes referencing actual file paths in this codebase.

---

## TFB-specific surfaces to know

The product has these primary surface buckets. Knowing what's on each is half the QA job.

### Marketing & lead-gen (public)
- `/` (homepage)
- `/programs` (tier comparison)
- `/pricing`
- `/about`
- `/contact` (just-redesigned for support intent)
- `/strategy-call` (Calendly embed)
- `/assessment` (15-question funnel; lead-capture step at the end now includes the optional Website field — Phase 1 addition)
- `/blog` and `/blog/[slug]`

### Auth & checkout
- `/portal/login` (magic-link request form)
- `/auth/confirm?token_hash=...` (server-issued magic link verifier — the working auth path)
- `/auth/callback?code=...` (legacy PKCE handler, currently unused)
- `/api/checkout/[product]` (Stripe Checkout creation)

### Portal (paid, auth-gated)
- `/portal` (dashboard — has phase cards, progress meter, day-X marker, LabDiscovery card)
- `/portal/account` (profile, purchase history, coaching sessions, Stripe billing portal link)
- `/portal/[capability]` (Office Online iframe view of the master deliverable)
- `/portal/coaching` (Calendly + credit balance)
- `/portal/upgrade` (credit-forward upgrade paths)

### Agentic portal (Phase 1 — currently behind /portal/lab/*)
- `/portal/lab/intake` (Day 1 wow flow — website URL → scrape → Brand Standards + Concept & Story drafts)
- `/portal/lab/blueprint` (16-chapter living-document canvas with provenance hover and per-chapter Draft buttons)
- `JasonChatDock` component, mounted on `/portal`, `/portal/lab/intake`, `/portal/lab/blueprint`

### API surfaces (worth testing for proper auth gates + error responses)
- `/api/agent/chat` — Sonnet 4.6 streaming chat
- `/api/agent/scrape-website` — Cheerio + Sonnet synthesis
- `/api/agent/draft` — Opus 4.7 chapter drafts
- `/api/portal/progress/[slug]` — mark/unmark capability complete
- `/api/portal/file/[slug]` — signed URL generator for deliverables

---

## Screenshot protocol

You have access to Claude Preview MCP for the local dev server and Claude in Chrome MCP for production. Use Claude Preview by default during dev work; use Claude in Chrome when verifying a production deploy.

**Take screenshots yourself. Do not wait to be handed them.**

```
mcp__Claude_Preview__preview_start { name: "tfb-dev" }
mcp__Claude_Preview__preview_resize { width: 1280, height: 900 }   # desktop canonical
mcp__Claude_Preview__preview_screenshot
mcp__Claude_Preview__preview_resize { preset: "mobile" }            # iPhone 14
mcp__Claude_Preview__preview_screenshot
```

Capture at every state without exception:

- First load of every primary screen (clean session)
- After every navigation
- During every loading state (the spinner is a state — document it)
- After every form submission, success, or error
- On every empty state
- After triggering any error condition
- Before AND after any state change (chat dock collapsed, then open; URL field empty, then filled)
- At each viewport (1280, 768, 390)

Naming convention: `[surface]-[state]-[viewport].png` — e.g. `intake-scraping-progress-1280.png`, `blueprint-canvas-2-chapters-filled-390.png`.

### When live access is unavailable

If the user provides screenshots only, analyze each before responding. Do not describe what you assume is on screen — describe only what is visible. If a screenshot is too small, low-res, or cropped to evaluate, say so and ask for a fresh one.

When DOM access is also available, use `preview_inspect` for computed styles and `preview_snapshot` for the accessibility tree — these catch issues invisible in screenshots (off-screen elements, overflow clipping, z-index stacking, elements at wrong positions).

### Screenshot log format

Maintain a running log:

```
SCREENSHOT LOG

  [#] [filename] [surface/state] [viewport]
  ...

Total captured: [number]
```

Reference filenames in every finding so issues are traceable.

---

## Authenticating for portal-gated routes

`/portal/*` requires both a logged-in user AND a paid purchase. Use Supabase admin to mint a magic link for a test user and visit it via the preview.

Test users available in the live DB:
- `eric.j.unterberger@gmail.com` — Eric's account, Tier 1 (blueprint-plus)
- `eric@thefranchisorblueprint.com` — "Jason TEST Account", Tier 2

```bash
cd "/Users/fin/Documents/The Franchisor Blueprint Website" && set -a && source .env.local && set +a && node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'eric.j.unterberger@gmail.com' });
console.log('http://localhost:65520/auth/confirm?token_hash=' + data.properties.hashed_token + '&type=magiclink&next=%2Fportal%2Flab%2Fblueprint');
"
```

Then `mcp__Claude_Preview__preview_eval` → `window.location.href = '<that URL>'`.

---

## Module 0: Adversarial Human Exploration

**Run this module first, before any structured testing.**

Spend 5–10 minutes using the app with zero intention of doing the right thing. The structured modules cover the happy path. This module covers everything else — and it's where the highest-severity bugs live.

### TFB-specific adversarial scenarios

```
ASSESSMENT FUNNEL ABUSE
□ Start the assessment, answer 14 questions, then refresh. Does it resume?
□ Submit the lead-capture step with no email. With an invalid email. With email containing emoji.
□ Type 1000 characters into the business-name field.
□ Hit "Back" multiple times during the assessment. Does state survive?
□ Open the assessment in two tabs simultaneously. Submit different answers. What happens?

CHECKOUT ABUSE
□ Hit a Stripe checkout button twice in rapid succession. Two checkout sessions or one?
□ Open /api/checkout/blueprint-plus directly in the browser without an existing user. What's the error UX?
□ Try to hit /api/checkout/upgrade-2-3 as a Tier 1 user (you should NOT get to that flow).
□ Force a Stripe webhook with an unknown product slug — does the fulfillment fail safely?

PORTAL ABUSE
□ Sign out via /api/portal/logout, then try to navigate back to /portal/lab/blueprint. Auth gate works?
□ Mark a capability complete, then mark it incomplete, then refresh. Does it persist correctly?
□ As a Tier 1 user, try to navigate to a Tier 2-only capability page directly via URL.
□ Hit /api/agent/chat as an unauthenticated user. Should be 401.
□ Hit /api/agent/scrape-website with no body. With an invalid URL. With a 200MB site.

AGENTIC FLOW ABUSE (Phase 1)
□ On /portal/lab/intake, click "Pre-fill my Blueprint" twice in 500ms. Two scrape jobs?
□ Submit an obviously bad URL ("not a website", "http://localhost:1234/", "ftp://foo").
□ Open the chat dock, type a 10,000-character message. Does the 50K-char cap kick in?
□ Send a chat message, then close the dock mid-stream. Stream cancels cleanly?
□ Refresh /portal/lab/blueprint while a draft is in flight. What does the user see when they return?
□ Click "Draft with Jason" on a chapter, immediately click it again. Two drafts queued?

NAVIGATION CHAOS
□ Use the browser back button at every state.
□ Force-refresh during the Day-1 wow flow's mid-progress state.
□ Open an old assessment URL with a stale resume_token after the cookie expired.
□ Manually edit a URL slug to a chapter that doesn't exist (e.g., /portal/lab/blueprint/typo).
```

### What to capture

Screenshot every unexpected result. Pay specific attention to:

- Anything that crashes, freezes, or shows a blank screen
- Error messages with raw stack traces or technical jargon (esp. Supabase or Anthropic SDK error strings leaking to the UI)
- States where the app sits silent with no progress signal
- Any data that looks like it might belong to a different user
- Any action that succeeds when it should have been rejected (auth bypass)
- Any action that fails when it should have succeeded (false rejection)

### Output

```
ADVERSARIAL EXPLORATION SUMMARY

Duration: [minutes]
Screenshots captured: [number, with filenames]

UNEXPECTED BEHAVIORS:

[For each:]
  ACTION:
  EXPECTED:
  ACTUAL:
  SCREENSHOT:
  SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
  AFFECTED FILES (best guess): [paths]

GRACEFUL FAILURES (worth knowing about):
  [behaviors that handled abuse correctly]

ADVERSARIAL STATUS: PASS | WARNING | FAIL
```

---

## Module 1: User Journey Testing

For each TFB journey, walk through step-by-step. Capture a screenshot at every step, and answer:

1. **What is visible on screen?** List buttons, forms, labels, navigation, status indicators.
2. **What is missing?** Based on the task, what should be there but isn't?
3. **Can the user complete this step?** YES / PARTIALLY / NO — with reason.
4. **What would confuse a first-time user?**

### Standard TFB journeys (test these in order if no specific scope)

| Journey | Verify |
|---|---|
| **Marketing → Strategy Call** | Can a visitor land on /, navigate to /strategy-call, and book a call without confusion? |
| **Marketing → Assessment** | Can a visitor take the 15-question assessment, hit lead capture, and land on the result page? Does the new Website field appear and accept input? |
| **Assessment → Purchase** | After completing the assessment, can the user navigate to pricing and trigger a Stripe Checkout session? |
| **Post-purchase first run** | After Stripe success, does the user land on /portal with the "Day 1" first-run hero? Does the LabDiscovery card show? |
| **Day 1 wow** | From `/portal`, click into `/portal/lab/intake`, drop a website URL, see scrape narration, see drafted chapters, click into Blueprint canvas. Does each step feel inevitable? |
| **Blueprint canvas exploration** | On `/portal/lab/blueprint`, can the user navigate via sidebar TOC? Can they expand provenance? Can they trigger a Draft on an empty chapter? |
| **Chat dock first interaction** | On any portal page, open the dock, send a message, see streaming response. Does the dock auto-scroll? Can the user send via ⌘↵? |
| **Coaching booking** | On `/portal/coaching`, view credit balance, navigate to Calendly, complete a booking. Does the webhook update credits? |
| **Tier upgrade** | On `/portal/upgrade`, view available paths, click an upgrade, complete checkout. Does the customer's tier flip after success? |
| **Capability download** | Open a capability, click "Download", verify the .docx/.pptx downloads with correct filename. |
| **Sign out + sign back in** | Sign out via `/api/portal/logout`, request a fresh magic link via `/portal/login`, complete the loop. |

### Output format per journey

```
JOURNEY: [name]
STEP: [step number — short description]
SCREENSHOT: [filename]

VISIBLE ELEMENTS:
  - ...

MISSING ELEMENTS:
  - ...

FIRST-TIME USER ISSUES:
  - ...

STEP STATUS: PASS | WARNING | FAIL
REASON: [one sentence]
```

---

## Module 2: TFB Brand & Copy Compliance

This module is **always run** for TFB (unlike the generic version where it's optional). The product's voice rules are committed brand decisions — every customer-visible string is in scope.

### TFB voice rules (from `docs/jason-agent-prompt.md`)

These are the rules. A violation is a finding.

- **No exclamation marks** in product copy. None. Not even one. (Customer email signups via Resend templates are also in scope.)
- **No emoji decoration** in headings, CTAs, microcopy, or body. (Lucide-react icons OK, emoji NOT OK.)
- **No "AI" branding** as a feature. The agent is named Jason. Don't say "AI assistant" or use sparkle iconography to mean "AI" — when it appears, the lucide `Sparkles` icon is for "premium" or "next-step", not "AI".
- **No hype language**: "Amazing!", "Awesome!", "🎉 Welcome to your journey!" — all forbidden.
- **No "Welcome to..." with exclamation.** "Welcome, Eric." is correct. "Welcome to The Franchisor Blueprint!" is wrong.
- **Em-dash for emphasis is correct** (`—`); double-hyphen (`--`) is wrong; ellipsis as substitute for em-dash is wrong.
- **Single em-dash inside HTTP headers is a bug** (Latin-1 only — we caught this in Phase 1 with the User-Agent header). Watch for any code that ships em-dashes to a fetch header.
- **"Your Blueprint"** — capitalized. "your blueprint" lowercase is wrong.
- **"the franchisor operating system"** is the product noun — not "course," not "9 modules anymore." Old surfaces may still call it "course" — flag those.
- **Pricing**: $2,997, $8,500, $29,500. Always with the comma. "$3,000" or "$3K" is OK in casual marketing copy but never in checkout/legal/disclaimer surfaces.
- **"Tell you not to franchise"** — the trust line ("we'd rather tell you not to franchise than sell you something that won't work") should appear at least once per major marketing surface. If a marketing page is missing it, flag.
- **"Jason" in product copy is always Jason** — never "your coach" or "your AI". The persona is the brand.
- **"Mastery" not "Capability"** — we renamed the customer-facing noun. If you see "Capability NN" in customer UI, flag — it should be "Mastery NN".

### How to scan

Navigate to each surface, screenshot it, and scan all visible text against the rules. Don't rely on memory — the screenshot is the evidence.

For surfaces where DOM access is available, you can extract all text in one pass:

```js
// preview_eval expression
[...document.querySelectorAll('h1, h2, h3, h4, p, button, a, label, span')]
  .map(el => el.innerText.trim())
  .filter(Boolean)
  .filter(t => /[!]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(t))
  // Returns any text containing exclamation marks or emoji
```

### Output format

```
BRAND COMPLIANCE REPORT
Surface: [URL]
Screenshot: [filename]

VIOLATIONS FOUND: [number]

[For each violation:]
  LOCATION: [where on the page]
  RULE BROKEN: [which rule]
  CURRENT TEXT: "[exact text]"
  SUGGESTED FIX: "[rewritten version]"
  FILE TO EDIT (best guess): [path]

PAGES SCANNED: [number]
TOTAL VIOLATIONS: [number]
STATUS: PASS | WARNING | FAIL
```

---

## Module 3: Missing Controls Audit

The most common UX gap in early-stage products is missing CRUD controls. This module specifically hunts for them on TFB surfaces.

### TFB-specific controls to verify

| Surface | Required controls |
|---|---|
| Capability progress | Mark complete + Mark incomplete (toggle) — must be visible per capability, requires confirmation? (currently single-click, no confirm — verify still desired) |
| Memory chapter (Blueprint canvas) | Draft / Redraft (always present) + Show provenance (when entries exist) |
| Memory chapter editing | NOT in v1 — customer cannot edit a chapter directly yet. If you see an edit field, flag it as an unintentional surface. |
| Chat dock | Open + Close (X) + Send + Cancel mid-stream (currently absent — may be wanted) |
| Assessment | Resume from cookie + restart from scratch + back/forward between questions |
| /portal/account | Sign out + open Stripe billing portal + (cancel coaching session — present?) |
| Coaching session row | Reschedule (via Calendly link) — should be present per scheduled session |
| Empty states | A clear CTA on every empty list (no items? show "create first" or "schedule first") |

### Output

```
MISSING CONTROLS AUDIT

[For each surface:]
  SURFACE: [URL]
  SCREENSHOT: [filename]

  EXPECTED CONTROL:           PRESENT | MISSING | UNCLEAR | LOCATION
  ...

CRITICAL GAPS:
  [list any missing control that blocks a primary task]
```

---

## Module 4: Empty States & Error States

### Empty states to verify

| Surface | Trigger empty state how |
|---|---|
| Blueprint canvas | Brand-new customer with no scrape, no drafts. Every chapter shows the empty-state CTA. |
| Coaching sessions list | Customer with 0 booked sessions |
| Coaching credits | Customer with 0 credits remaining |
| Capability list (locked tier) | Tier 1 viewing Tier 2 surfaces |
| Search / filter on any list | No matching results |

A good TFB empty state has these three elements:

1. **A clear explanation** of why it's empty (not just "No items.")
2. **A specific CTA** with TFB voice ("Take your first audit" not "Get started!")
3. **No apologetic language** ("Looks like nothing here yet, sorry!" is wrong)

The empty-state-card pattern from `<ChapterCard>` (dashed border on grey-1 background, centered explanatory text + gold CTA) is the canonical TFB empty state. Other empty states should look related, not identical.

### Error states to verify

Trigger each, screenshot the result.

| Error type | How to trigger | Pass criteria |
|---|---|---|
| 404 | Navigate to `/portal/typo-doesnt-exist` | Branded 404 with a way home (currently default Next.js — flag if so) |
| Server error | Hit `/api/agent/chat` while server is restarting | Inline error in the chat bubble, not a stack trace |
| Auth expiry mid-action | Wait for session cookie to expire, then click an action | Re-prompt to sign in, preserve the user's intent |
| Stripe checkout fail | Use Stripe test card `4000 0000 0000 0002` (declined) | User sees clear "card declined" message, can retry |
| Anthropic API failure | Set ANTHROPIC_API_KEY to a bad value temporarily | UX should degrade gracefully; chat should say "I hit an error: ..." with retry guidance |
| Network drop mid-scrape | Use Chrome DevTools to drop network during /api/agent/scrape-website | Clear error state on /portal/lab/intake with retry CTA |
| Magic link expired | Use a token_hash that's already been consumed | Redirect to /portal/login?error=invalid_link |

### Output

```
EMPTY & ERROR STATE AUDIT

[For each empty state:]
  SURFACE:
  TRIGGER:
  SCREENSHOT:
  EXPLAINS WHY EMPTY: YES / NO
  HAS CLEAR CTA: YES / NO
  COPY IS NON-APOLOGETIC: YES / NO
  STATUS: PASS | WARNING | FAIL

[For each error state:]
  ERROR TYPE:
  TRIGGER:
  SCREENSHOT:
  INLINE OR PAGE-LEVEL: [where]
  PRESERVES USER INPUT: YES / NO
  EXPLAINS HOW TO FIX: YES / NO
  STATUS: PASS | WARNING | FAIL
```

---

## Module 5: Visual Component Audit (data edge cases)

Test the UI with realistic and extreme TFB data, then screenshot.

### TFB-specific data edge cases

| Field | Scenarios |
|---|---|
| Customer first name | "X", "Bartholomew Christopher Wellington", names with apostrophe ("O'Brien"), unicode ("Léonie") |
| Business name | 1 char, 100+ chars, all-caps, all-lowercase, with `&` and `<` |
| Website URL field (intake) | `not a url`, `https://`, `ftp://x.com`, very long subdomain string |
| Memory chapter content | Empty (all 16 chapters empty), 1 chapter at 50K+ chars, chapter with embedded HTML/script attempts |
| Coaching credit balance | 0, 1, 24, 48, 999 |
| Assessment score | 0%, 100%, edge bands |
| Capability counts | 0/9, 9/9, mid-flux during phase transitions |
| Stat pill | "0 / 16 chapters started · 0%", "16 / 16 chapters started · 100%" |
| Chat history | 0 turns, 1 user turn, 50+ turn conversation, message of 50K chars (should hit defensive cap) |

### CSS overflow checks

- Flex containers with dynamic text children should have `min-w-0` or `overflow-hidden`
- Cards with long titles should `truncate` with ellipsis, not push siblings off-screen
- Sidebar TOC items should `truncate` long chapter titles (already implemented)
- The chat dock should not push past `max-w-[calc(100vw-2rem)]` on mobile

### Output

```
VISUAL COMPONENT AUDIT

[For each issue:]
  ELEMENT: [what]
  DATA SCENARIO: [what triggered]
  SCREENSHOT: [filename]
  ISSUE: [what went wrong visually]
  SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
  FILE TO EDIT: [path]
  SUGGESTED FIX: [CSS or layout change]

SUMMARY:
  Elements tested: [number]
  Issues found: [number]
  Critical overflow issues: [number]
```

---

## Module 6: Accessibility Quick Check

### TFB-specific accessibility checks

- **Contrast**: every text/background combination must hit 4.5:1 minimum (4.6:1 for the gold-warm-on-navy is the tight one — verify any new heading on navy doesn't dip below).
- **Focus indicators**: every interactive element needs a visible focus ring. Tailwind's `focus:ring-2 focus:ring-gold/20` is the TFB pattern. If a custom element omits it, that's a finding.
- **Label association**: every input must have a real `<label>` (not just placeholder text). The TFB `<Field>` helper enforces this — flag any rogue `<input>` not wrapped in `<Field>`.
- **Alt text**: every image must have meaningful alt. The TFB logo is `alt="The Franchisor Blueprint"`. Decorative SVGs should be `aria-hidden="true"`. Lucide icons in buttons need `aria-label` on the button if there's no visible text (already done on the chat dock send/close buttons — check new ones).
- **Color-only signaling**: status colors must be paired with icon or text. The chapter-completion green dot in the sidebar TOC is paired with the chapter title, not the only signal — good. If you find a status indicated only by color, that's a finding.
- **Tap target size**: ≥44px equivalent. The TFB CTA buttons (`px-7 py-4`) are well over. The chat dock send button (40px square) is just under — flag if any other tap target is below 40px.
- **prefers-reduced-motion**: `tfb-stage-in` already respects it. The new `TypedHeading`, `active-pulse`, `jason-dock-breathe` animations do NOT yet — that's a finding to flag.

### Output

```
ACCESSIBILITY CHECK
Surface:
Screenshot:

[For each issue:]
  ISSUE TYPE: Contrast | Size | Color-only | Missing label | Focus | Motion | Other
  LOCATION: [where on the page]
  DESCRIPTION:
  WCAG REFERENCE: [e.g. 1.4.3 Contrast, 2.5.5 Target Size, 2.3.3 Animation from Interactions]
  FILE TO EDIT: [path]

STATUS: PASS | WARNING | FAIL
```

---

## Module 7: Responsive Layout Check

| Viewport | Width × Height | Represents |
|---|---|---|
| Desktop | 1280 × 900 | Standard MacBook |
| Tablet | 768 × 1024 | iPad portrait |
| Mobile | 390 × 844 | iPhone 14 |

Resize, screenshot, evaluate. Don't estimate — actually capture.

### TFB-specific responsive flags

- **Marketing nav**: at desktop, full nav; at mobile, hamburger. Check the transition.
- **Pricing tier cards**: 3-column at desktop, stacked at mobile. Check no card overflows.
- **Assessment**: 1-question-at-a-time format works at all sizes; check the nav buttons stay within viewport.
- **Portal dashboard**: phase cards stack on mobile. Check the LabDiscovery card responds.
- **Blueprint canvas**: sidebar TOC hides at mobile (`hidden md:block`); ensure mobile users have a way to navigate between chapters (currently no mobile TOC — this is a finding to flag).
- **Chat dock**: max-width clamps at mobile (`max-w-[calc(100vw-2rem)]`); on mobile open dock should not eat the entire screen.
- **Footer**: 5-col on desktop, 2-col on mobile (Phase 0 split). Verify no layout break at narrow widths.

### Output

```
RESPONSIVE LAYOUT REVIEW

[For each viewport:]
  VIEWPORT: [width × height]
  SCREENSHOTS: [filenames per surface]

  ISSUES:
    SURFACE: [URL]
    PROBLEM: [text cut off / button too small / overlap / horizontal scroll / other]
    SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
    FILE TO EDIT: [path]

STATUS: PASS | WARNING | FAIL
```

---

## Priority classification

| Priority | Definition | TFB examples |
|---|---|---|
| **CRITICAL** | User cannot complete a core task. Blocking. | Stripe checkout button not appearing, magic link 500ing, /portal returning 404, chat dock not loading on a paid customer's portal |
| **HIGH** | User can complete the task with significant friction or confusion. | Missing edit/delete controls, stack trace leaking to UI, exclamation marks in product copy, confidence pill missing on chapters |
| **MEDIUM** | Noticeable UX issue, doesn't block. | Poor empty state copy, sub-44px tap target, em-dash spelled `--`, animation that doesn't respect prefers-reduced-motion |
| **LOW** | Polish issue. Cosmetic or minor. | 4-pixel alignment off, gold-warm pill on navy at 4.5:1 (technically passing), text truncation with marginal data |

---

## Fix verification protocol

After fixes are implemented, re-test using this checklist:

1. **Navigate to the exact surface where the issue was found.** Screenshot.
2. **Re-run the specific module** that originally caught the issue.
3. **Test the fix at all three viewports** — responsive bugs often emerge from fixes.
4. **Test with the same edge-case data** — confirm the original trigger no longer fails.
5. **Verify no regressions** — screenshot adjacent elements to confirm nothing else shifted.

The QA cycle is: **Explore → Screenshot → Report → Fix → Screenshot again → Verify**. A fix is not verified until it has been re-screenshotted in its fixed state.

---

## Final report format

```
══════════════════════════════════════════════════════
TFB UX QA REPORT
Surface(s): [URL or scope]
Date:
Modules run: [list]
Total screenshots captured: [number]

──────────────────────────────────────────────────────
OVERALL STATUS: PASS | WARNING | FAIL
──────────────────────────────────────────────────────

SUMMARY
[2-3 sentences. What is the overall state? What is the most
important thing to fix first?]

RESULTS BY MODULE

  Adversarial Exploration   PASS | WARNING | FAIL
  User Journey Testing      PASS | WARNING | FAIL
  Brand & Copy Compliance   PASS | WARNING | FAIL
  Missing Controls Audit    PASS | WARNING | FAIL
  Empty & Error States      PASS | WARNING | FAIL
  Visual Component Audit    PASS | WARNING | FAIL
  Accessibility             PASS | WARNING | FAIL
  Responsive Layout         PASS | WARNING | FAIL

TOP ISSUES TO FIX (by priority)

  [CRITICAL]
  1. [Issue] — [Screenshot] — [File] — [Why it matters] — [Fix]

  [HIGH]
  2. [Issue] — [Screenshot] — [File] — [Why it matters] — [Fix]

  [MEDIUM]
  3. [Issue] — [Screenshot] — [File] — [Fix]

FULL FINDINGS

  [Paste each module's output]

──────────────────────────────────────────────────────
END OF REPORT
──────────────────────────────────────────────────────
```

---

## Tips for best results

- **Screenshot first, analyze second.** Capture the state, then evaluate. Never describe a screen from memory.
- **Adversarial exploration is not optional.** Structured modules test intended flows. Adversarial exploration tests everything else. Both are required.
- **One flow at a time.** Walk through one journey step-by-step. Cleaner findings than scattershot testing.
- **Test with real data.** The most common visual bugs only appear with realistic content — long names, addresses with `&`, lists with 20+ items.
- **Use DOM access when available.** `preview_inspect` for computed styles, `preview_snapshot` for accessibility tree. Catches issues screenshots miss.
- **Re-run after fixes.** This skill works best as a loop: explore → screenshot → report → fix → screenshot again → verify. Each cycle the product gets tighter.
- **Run `tfb-designers-eye` after this skill, not before.** Functional issues take priority. Visual craft review comes after functional issues are clear.

---

*TFB UX QA Skill v1.0*
*Companion to `tfb-designers-eye` (visual craft review).*
