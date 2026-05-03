---
name: tfb-designers-eye
description: >-
  Visual craft and design quality review tailored to The Franchisor Blueprint
  (TFB) — a premium B2B coaching product positioned at $3K–$30K. Run when a
  surface needs to be evaluated for whether it looks like a $30K-grade
  experience: every detail intentional, restrained, and confidence-projecting.
  Tailored to TFB's locked navy/gold/cream palette, Inter typography, and the
  product's "we'd rather tell you not to franchise than sell you something that
  won't work" voice. Auto-screenshots via Claude Preview when the dev server
  is running. Use when preparing for a Jason demo, a customer-facing release,
  or auditing whether a freshly-shipped surface (especially the new
  /portal/lab/* agentic flows) projects the premium standard the product
  charges for.

---

# TFB Designer's Eye

> Companion to `tfb-ux-qa`. Run *after* the UX QA skill when functional issues are clear and you're ready to evaluate visual craft. Run *before* a Jason demo or customer-facing release.

## How to invoke

```
/tfb-designers-eye [optional: surface or flow name]
```

Or in chat:
> "Run the TFB Designer's Eye on /portal/lab/blueprint."
> "Audit the assessment flow for premium feel."
> "Check the Jason chat dock against the dock standard."

If a single dimension is wanted:
> "Evaluate only the typography on the homepage."
> "Run the spacing module on the upgrade page."
> "Does the intake page feel premium?"

---

## What this skill is for

Functional QA asks: *can the user complete the task?*

This skill asks: **does this surface look like it cost the customer $3K–$30K?**

A founder considering paying $29,500 for Builder will spend longer evaluating whether the product *looks worth it* than they will deliberating the price. Premium feel is not optional — it is the price-defending instrument.

The gap between "it works" and "it's worth $30K" is almost entirely visual craft: space, weight, rhythm, hierarchy, restraint. This skill gives you the vocabulary and the critical frame to evaluate those decisions against TFB's specific brand standard.

---

## TFB-specific reference points (use these as the benchmark)

When evaluating, anchor every observation against the standard set by:

- **Linear** — for the navy + restraint-first product feel. The Blueprint canvas should read like a Linear doc.
- **Stripe Atlas** — for the high-trust setup-flow feel. The Day 1 intake page should feel as inevitable as Atlas onboarding.
- **Pilot.com** — for the "premium B2B service-as-software" voice. Concise, confident, never apologetic.
- **Carta Launch** — for the "founder gets a real artifact in 5 minutes" feedback loop. The /portal/lab/intake "PRE-FILL COMPLETE" moment is in this category.

If a surface doesn't meet the standard of the closest reference above, it's not done.

---

## TFB brand specification (locked — do not override)

These are not design preferences. They are committed brand decisions captured in `src/app/globals.css` and `docs/jason-agent-prompt.md`. Any deviation is a finding.

### Color palette

| Token | Hex | Use |
|---|---|---|
| `navy` | `#1e3a5f` | Primary text, headers, navigation, primary CTAs (with cream text) |
| `navy-deep` | `#0e1f3a` | Hero backgrounds, dark sections |
| `navy-dark` | `#152b47` | Heavy emphasis, footer accents |
| `navy-light` | `#2a4d7a` | Hover states, gradient stops |
| `gold` | `#d4af37` | Primary CTA fills, brand accents, "Jason" avatar |
| `gold-warm` | `#d8a936` | Eyebrow text labels, badges, secondary accent |
| `gold-dark` | `#b8962e` | CTA hover states |
| `cream` | `#ece9df` | Section backgrounds, dock body, calm surfaces |
| `cream-light` | `#f3f1ea` | Lighter cream sections |
| `grey-1` | `#f8f9fa` | Empty-state container backgrounds |
| `grey-2` | `#f2f2f2` | Hairline backgrounds |
| `grey-3` | `#595959` | Body copy, secondary text |
| `grey-4` | `#8c8c8c` | Captions, helper text, disabled |

**Premium-product palette principle**: every screen should be dominated by **one neutral** (white, cream, or navy), with **gold reserved for the primary action** and small accents. If you see four or more colors competing on a screen, it's a finding.

### Typography

- **Single typeface: Inter.** No serifs in product UI. (If a serif appears, it's a Phase-3-design-direction-leak and must be flagged.)
- **No font-weight under 400 in body copy.** Weight 600 for headings, 700 for hero/display, 800 for the strongest emphasis.
- **All-caps eyebrow labels**: `text-xs uppercase tracking-[0.18em] font-semibold text-gold-warm` with a `border-b-2 border-gold pb-1` underline. This is the canonical TFB section opener — found on every well-designed surface in the app.
- **Body text leading**: 1.6 (set in `body`). Cards/dense areas can drop to 1.55. Headings are 1.15.
- **Numbers**: tabular-nums on everything that is a count, percentage, or money. Off by default — flag absence on stats.

### Shadows

- `shadow-card`: `0 2px 12px rgba(30, 58, 95, 0.08)` — resting cards
- `shadow-card-hover`: `0 8px 24px rgba(30, 58, 95, 0.12)` — hover/elevated state
- `shadow-featured`: `0 12px 32px rgba(30, 58, 95, 0.18)` — featured elements (chat dock, hero CTAs)

All shadows are **navy-tinted** — never neutral grey. A grey shadow is a finding.

### The TFB voice (typography of words)

Even in static UI copy, voice rules apply. From `docs/jason-agent-prompt.md`:

- **Direct, never gushing.** No "Welcome to your amazing journey!" or "🎉 Awesome work!"
- **Operator-to-operator.** Founders are peers, not students.
- **Specific over generic.** "Most franchisors charge 5–7% royalty" beats "royalty rates vary."
- **No exclamation marks** in product UI. None.
- **No emoji decoration** in headings, CTAs, or body copy. (Lucide icons only — see icon vocabulary below.)
- **Single em-dash for emphasis** (`—`) — never a double-hyphen, never an ellipsis as substitute. Watch for em-dashes in HTTP headers though (Latin-1 only — bug we already shipped a fix for).
- **"Your Blueprint"** is capitalized; "your blueprint" lowercase is wrong.
- **The product noun is "the franchisor operating system"** — not "course," not "9 modules" anymore. (See `docs/agentic-portal-buildout.md`.)

### Icon vocabulary

- **Lucide-react only.** No Heroicons, Material Icons, or mixed sets.
- **Stroke 2px** (default). Sizes: 13/14/15/16 in dense UI, 18/20 in hero/feature areas.
- **Filled variants are forbidden.** Outline only.

### Alive UI patterns (defined in this codebase)

These are signature TFB moments — when present, they should appear *exactly* this way:

| Pattern | Where it lives | Spec |
|---|---|---|
| Welcome typing | `<TypedHeading>` component | Character-by-character, 28ms/char, blinking caret for 1.5s after, fades. Used on `/portal/lab/intake` and `/portal/lab/blueprint`. |
| Pulsing CTA | `.active-pulse` class on intake | 3.5s scale loop, 1.0 → 1.02 → 1.0. Reserved for the *single* most important next-action button. Never two on one page. |
| Breathing chat dock | Collapsed `JasonChatDock` | 2.6s opacity loop, 0.92 → 1.0 → 0.92. Stops when opened. |
| Streaming caret | Chat assistant bubble while streaming | 1.5px wide, navy/40 opacity, animate-pulse. Disappears when stream completes. |
| Eyebrow label | Section openers everywhere | `text-xs uppercase tracking-[0.18em] font-semibold text-gold-warm border-b-2 border-gold pb-1` |

If any of these patterns is *missing* from a moment that calls for it, that's a finding. If any is *applied incorrectly*, that's a finding.

---

## Screenshot protocol

You have access to:

- **Claude Preview MCP** — `mcp__Claude_Preview__preview_*` tools. Use `preview_start` (server name: `tfb-dev`), `preview_screenshot`, `preview_inspect`, `preview_resize`. **Always start the dev server here for live audits.**
- **Claude in Chrome MCP** — for production audits against the live thefranchisorblueprint.com.

Capture screenshots at:

- Desktop (`width:1280, height:900`) — the canonical TFB review width
- Mobile (`width:390, height:844`) — iPhone 14
- Hover states on every primary CTA
- Both first-load and post-interaction states (e.g., chat dock collapsed AND open)

For the agentic flows specifically:
- `/portal/lab/intake` — idle state, scraping state (mid-progress), done state
- `/portal/lab/blueprint` — full canvas with at least 2 chapters filled, sidebar TOC visible, one chapter scrolled into view
- `JasonChatDock` — collapsed (breathing), open with assistant greeting, mid-streaming, completed turn
- `/portal` dashboard — first-run state AND returning-customer state if testable

---

## Authentication for screenshots

If the test surface is behind `/portal/*` auth, mint a magic link for the test user (`eric.j.unterberger@gmail.com` is Eric's account; `eric@thefranchisorblueprint.com` is the Jason TEST account at Tier 2):

```bash
cd "/Users/fin/Documents/The Franchisor Blueprint Website" && set -a && source .env.local && set +a && node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'eric.j.unterberger@gmail.com' });
console.log('http://localhost:65520/auth/confirm?token_hash=' + data.properties.hashed_token + '&type=magiclink&next=%2Fportal%2Flab%2Fblueprint');
"
```

Navigate the preview to that URL to authenticate the session.

---

## Before you review: confirm the standard

Answer these in the report header:

1. **What surface is being reviewed?** (specific URL or component path)
2. **What benchmark is it being measured against?** (one of the four reference products above)
3. **Is this a customer-facing surface or admin-only?** Admin surfaces have lower premium-feel requirements.

---

## Module 1 — Visual Hierarchy

The question: **when a customer lands on this surface, where does their eye go? Is that the right place?**

For TFB specifically: the primary CTA (the gold-filled, navy-text rounded-pill button) should always be the strongest interactive element on screen. If the eye lands on a logo, an eyebrow label, or worse, an ad-fund ratio number before the CTA — that's a hierarchy failure.

### TFB-specific hierarchy rules

- **One pulsing CTA per screen.** If two cards both have `.active-pulse`, that's a finding — kill one.
- **The Jason avatar (gold-on-navy JS monogram) is a visual anchor.** It should be smaller than the eye-leading CTA but larger than secondary controls. If the dock avatar is competing with the hero CTA for attention, that's a finding.
- **Hero typography wins on first paint.** The h1 should be `text-3xl md:text-4xl` minimum (`md:text-5xl` for true hero pages). Below `text-3xl` on desktop is a hierarchy weakness.
- **Eyebrow labels lead headings.** If a heading appears without an eyebrow, ask why — most TFB sections use the eyebrow → heading → subhead → CTA stack.

### Output format

```
VISUAL HIERARCHY REVIEW
Surface: [URL or component]
Screenshot: [filename]

PRIMARY FOCAL POINT (what the eye lands on first):
CORRECT FOCAL POINT (what should win):
MATCH: YES / NO

HIERARCHY PATH (what the eye follows, in order):
  1.
  2.
  3.

TFB-SPECIFIC RULE CHECK:
  Pulsing CTA count:                [number] (target: 1)
  Eyebrow label present on sections: YES / NO
  Hero h1 size meets minimum:        YES / NO
  Jason dock not competing:          YES / NO

FAILURES:
  ELEMENT:
  PROBLEM:
  FIX:

STATUS: PASS | WARNING | FAIL
```

---

## Module 2 — Spacing and Rhythm

The question: **does the spacing feel considered, or accidental?**

TFB uses Tailwind's 4px grid (default). Every gap should be a multiple of 4: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80. A gap of 14px or 22px is a finding — it means someone hand-tweaked instead of using the system.

### TFB-specific spacing rules

- **Section vertical rhythm**: marketing sections use `py-16 md:py-24` (`py-20 md:py-28` for hero/feature). Portal sections lean tighter: `py-10 md:py-14`. Mixing these inconsistently within the same surface is a finding.
- **Card padding**: `p-6 md:p-8` for primary cards, `p-5 md:p-6` for compact. A card with `p-4` reads as "afterthought" and is a finding on a customer-facing surface.
- **Container widths**: `max-w-[1200px]` for marketing/portal, `max-w-[820px]` for forms and reading flow, `max-w-[680px]` for hero subheadings. A bare `max-w-7xl` is a finding — it's not the TFB system.
- **Eyebrow → heading gap**: `mb-3` (12px). `mb-2` reads as cramped, `mb-4` reads as floating.
- **CTA → microcopy gap**: `mt-3` (12px). The microcopy under CTAs is small grey-4 italic.
- **Chat dock**: `bottom-6 right-6` (24px each). Anything else and the dock feels misplaced.

### Output format

```
SPACING AND RHYTHM REVIEW
Surface: [URL or component]
Screenshot: [filename]

SPACING SYSTEM IN USE: Tailwind 4px grid (correct) | drift detected | none detectable

OFF-GRID GAPS DETECTED:
  [list any element pairs whose gap is not a 4-multiple]

TFB-SPECIFIC SPACING CHECK:
  Section padding consistent within surface:  YES / NO
  Card padding ≥ p-6:                         YES / NO
  Container width is a TFB standard:          YES / NO
  Eyebrow→heading gap = mb-3:                 YES / NO

FAILURES:
  LOCATION:
  PROBLEM (with px estimate):
  FIX:

OVERALL RHYTHM: INTENTIONAL | INCONSISTENT | ABSENT
STATUS: PASS | WARNING | FAIL
```

---

## Module 3 — Typography

The question: **is the typography doing work, or just sitting there?**

### TFB-specific typography rules

- **Inter only.** Any other typeface (system serif, Times, Arial, Roboto) is a finding. Verify in DevTools if unsure: `getComputedStyle(el).fontFamily` should start with `Inter`.
- **Type scale on this product**:
  - Display/Hero h1: `text-3xl md:text-4xl` to `text-3xl md:text-5xl`, `font-extrabold` (800), `tracking-tight`, `leading-tight`
  - Section h2: `text-2xl md:text-3xl`, `font-bold` (700)
  - Card h3 / chapter title: `text-lg` to `text-xl`, `font-bold` or `font-extrabold`
  - Body: `text-base` (16px) for marketing, `text-[15px]` for portal dense areas, `text-sm` for chat / dock
  - Eyebrow: `text-xs uppercase tracking-[0.18em] font-semibold` — this exact spec, not a variant
  - Microcopy / captions: `text-xs` or `text-[10px] uppercase tracking-[0.14em]`, in `text-grey-4`
- **Weight floor: 400.** No `font-light` (300), `font-thin` (200), or `font-extralight` (200). They erode confidence.
- **Tabular numerals on counts.** Stats like "2 / 16 chapters started · 13%" must be `tabular-nums`. Without it, digits jump as numbers change.
- **Body line-height**: 1.6 (set in `body` CSS). Cards can drop to 1.55. Below 1.5 in body copy is a finding.

### Common TFB typography failures

- **Eyebrow without underline border** — the `border-b-2 border-gold pb-1` is part of the spec. Missing border = wrong.
- **Heading without `tracking-tight`** — h1/h2 read floppy without it.
- **Em-dash spelled `--`** in copy — find/replace to `—`.
- **`prose` class without `prose-navy`** — color drifts to default neutral.
- **CTA text is `font-bold` not `font-extrabold`** — TFB CTAs use `font-bold text-xs uppercase tracking-[0.1em]`. Bold (700) here is correct, not a finding.

### Output format

```
TYPOGRAPHY REVIEW
Surface: [URL or component]
Screenshot: [filename]

TYPEFACE DETECTED: [should be "Inter" — flag anything else]

TYPE SCALE DETECTED:
  [List each visible type level with size/weight estimate, mapped to TFB scale]

TFB-SPECIFIC TYPOGRAPHY CHECK:
  Inter throughout:                              YES / NO
  No weights below 400:                          YES / NO
  Eyebrow has gold underline:                    YES / NO
  Stats use tabular-nums:                        YES / NO / N/A
  Em-dashes correct (— not --):                  YES / NO

FAILURES:
  ELEMENT:
  PROBLEM:
  FIX:

STATUS: PASS | WARNING | FAIL
```

---

## Module 4 — Color and Contrast

The question: **is color being used with intention and restraint, or is it decorating?**

### TFB-specific color rules

- **Color budget per screen**: navy + gold + cream + 1 status color (green-tint or red-tint) max. Any 5th color is a finding.
- **Backgrounds**: never `#fff` pure white in marketing — TFB uses `bg-cream` or `bg-cream-light` on alternate sections to break monotony. Pure white is OK for the *first* fold and for cards-on-cream.
- **Text colors**: navy for primary, grey-3 (#595959) for body/secondary, grey-4 (#8c8c8c) for tertiary/captions. Use of `text-black` is a finding (use `text-navy`). Use of arbitrary grays like `text-gray-500` is a finding (use TFB tokens).
- **Gold reservation**: gold is the *call to action* color. If gold is used decoratively (a non-clickable gold border, a gold separator that doesn't lead anywhere), that's a finding — it dilutes the action signal.
- **Status colors**: emerald-500 for success/online, red-700 for errors, amber for warnings (e.g., the INFERRED chapter pill). These are *only* for status — never decorative.
- **Shadow color**: all shadows are navy-tinted (`rgba(30, 58, 95, X)`). Pure-grey shadows (`rgba(0,0,0,X)`) are a finding.

### Contrast minimums

- Body copy on cream (`#595959` on `#ece9df`): 5.6:1 — passes AA, comfortable
- Body copy on white (`#595959` on `#ffffff`): 7.0:1 — passes AAA
- Cream on navy (`#ece9df` on `#1e3a5f`): 11.5:1 — strong
- Gold-warm on navy (`#d8a936` on `#1e3a5f`): 4.6:1 — passes AA, just barely; fine for non-body text

If text drops below 4.5:1, it's a finding. If it drops below 4.5:1 *on the navy hero section*, that's a critical finding — those sections are heavy traffic.

### Output format

```
COLOR AND CONTRAST REVIEW
Surface: [URL or component]
Screenshot: [filename]

COLORS IN USE: [list each distinct color and its purpose]
COLOR COUNT: [number] — TARGET: ≤4 (navy + gold + cream + 1 status)

TFB PALETTE COMPLIANCE:
  Only TFB tokens used (no rogue hex, no text-gray-500): YES / NO
  Gold used only for actions:                            YES / NO
  No pure-white background in marketing:                 YES / NO
  Shadows are navy-tinted:                               YES / NO

CONTRAST CHECK:
  [list any text/background combos under 4.5:1]

FAILURES:
  ELEMENT:
  PROBLEM:
  FIX:

STATUS: PASS | WARNING | FAIL
```

---

## Module 5 — Component Consistency

The question: **do all instances of the same TFB component look identical, or has the system drifted?**

### TFB component canon

These are the load-bearing components — verify every instance matches:

| Component | Canonical spec |
|---|---|
| Primary CTA button | `bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark` |
| Compact CTA | `... text-xs ... px-5 py-3 rounded-full` |
| Secondary CTA (outline) | `bg-transparent text-navy border-2 border-navy font-bold text-xs uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-navy hover:text-cream` |
| Eyebrow label | `inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1` |
| Card | `bg-white rounded-2xl border border-navy/10 p-6 md:p-8` (or `border-2 border-navy/10` for emphasis) |
| Stat pill | `rounded-full bg-navy text-cream px-5 py-2 text-sm font-bold tabular-nums` |
| Confidence pill (Inferred/Draft/Verified/Empty) | See `<ConfidencePill>` in `src/components/agent/ChapterCard.tsx` — exact amber/navy/grey/emerald spec |
| Jason chat dock collapsed | `bg-navy text-cream rounded-full px-4 py-3 fixed bottom-6 right-6 z-50` with breathing animation |
| Jason chat dock open | `bg-cream rounded-2xl w-[380px] border border-navy/10 shadow-[0_24px_48px_rgba(30,58,95,0.28)]` |

### What to check

For each repeated component on the audited surface, verify:

- Border radius matches (rounded-full vs rounded-2xl vs rounded-xl — never mix on same component type)
- Padding matches (`px-7 py-4` for primary CTAs everywhere)
- Font size + weight + tracking match
- Hover state behaves identically
- Disabled state shows `opacity-40 disabled:hover:bg-gold` (not `opacity-50` — that's used for textareas only)

### Output format

```
COMPONENT CONSISTENCY REVIEW
Surface: [URL or component]

[For each component type identified:]
  COMPONENT: [name]
  INSTANCES FOUND: [count]
  MATCHES TFB CANON: YES / NO
  DRIFTS DETECTED:
    [describe each variance with location]

OVERALL SYSTEM COHERENCE: HIGH | MEDIUM | LOW
STATUS: PASS | WARNING | FAIL
```

---

## Module 6 — Premium Feel

The question: **does this surface look like it costs $3K–$30K?**

### TFB premium checklist

```
RESTRAINT
□ Single primary CTA per surface (no two gold buttons fighting)
□ Single pulsing element per surface
□ No emoji decoration in headings or CTAs
□ No exclamation marks anywhere in product copy
□ No "AI" badge/sparkle iconography (the agent is named Jason; that IS the brand — no need to advertise the model)
□ The interface removes clutter rather than adding features

PRECISION
□ All gaps are Tailwind grid multiples (4/8/12/16/20/24/32/...)
□ All icon sizes are 13/14/15/16/18/20/24 (no arbitrary pixel sizes)
□ All borders are 1px (`border`) or 2px (`border-2`) — never 3px
□ All rounded corners use the TFB radii (full, 2xl, xl, lg, md)
□ No hand-tweaked colors with arbitrary opacity (`text-navy/45` is wrong; use /40 or /50)

CONFIDENCE
□ Hero typography is text-4xl or larger on desktop
□ Headings use font-bold or font-extrabold (never font-medium for headings)
□ Empty states are composed (use the dashed-border + CTA pattern from ChapterCard) — not "no items :(" apologies
□ Loading states show progress narration (like the IntakeClient 6-step list) — not just a spinner

MATERIAL QUALITY
□ Backgrounds are cream-warm, not pure white throughout
□ Body text is grey-3 (#595959), not pure black
□ Shadows are navy-tinted
□ The gold is the rich #d4af37 — not a yellow-shifted variant
```

### The 10-second test

Look at the surface for exactly 10 seconds. Then look away. Answer:

1. What do you remember seeing?
2. Did it feel like a product Jason would put his name on for $30K?
3. Did anything feel out of place, cheap, or unfinished?

If #3 is yes — find it, name it precisely.

### Most damaging TFB-specific anti-signals

These are the things that, if present, *immediately* kill the premium feel for this product:

- **Lorem ipsum or placeholder text** anywhere customer-visible
- **A flash of unstyled content** (FOUC) on first paint
- **A button that doesn't do anything** ("Coming soon" badge with no path forward)
- **The Jason chat dock NOT visible** on a portal page that's supposed to have it
- **Gray-on-gray text** (e.g., `text-grey-4` on `bg-grey-1`) — hard to read, signals carelessness
- **A plain `bg-white` card sitting on a `bg-white` page** — no visual separation, looks broken
- **A heading that wraps awkwardly** at desktop width (e.g., a hero h1 that breaks "Welcome, Eric" across two lines)
- **An image with no alt text or with the file name as alt** (`alt="hero-bg-final-v3.jpg"`)

### Output format

```
PREMIUM FEEL REVIEW
Surface: [URL or component]
Screenshots: [filenames]

10-SECOND TEST:
  Remembered:
  Trust signal: STRONG | MODERATE | WEAK
  Out-of-place elements:

PREMIUM CHECKLIST:
  Restraint:   PASS | WARNING | FAIL — [note]
  Precision:   PASS | WARNING | FAIL — [note]
  Confidence:  PASS | WARNING | FAIL — [note]
  Material:    PASS | WARNING | FAIL — [note]

ANTI-SIGNALS DETECTED:
  [list each, or "none"]

MOST DAMAGING FINDING:
  [The single thing most undermining the $30K feel, described precisely]

STATUS: PASS | WARNING | FAIL
```

---

## Module 7 — Motion and Transitions

Skip if no animations on the surface. If yes, audit.

### TFB motion canon

| Animation | Where | Spec |
|---|---|---|
| Welcome typing | TypedHeading | 28ms/char, blinking caret 1.5s, fades |
| CTA pulse | `.active-pulse` | 3.5s scale loop, 1.0 → 1.02 → 1.0 |
| Chat dock breathe | Collapsed dock | 2.6s opacity loop |
| Streaming caret | Chat bubble | `animate-pulse`, 1.5px wide |
| Stage transition | AssessmentFlow | `tfb-stage-in` 380ms ease-out cubic-bezier |
| Hover transitions | All buttons/cards | `transition-colors` (~150ms default) |
| Scale on hover | None — TFB doesn't scale-up on hover. Buttons get color shift, cards get shadow shift. |

### What to flag

- Any animation > 500ms (feels slow on this product)
- Any animation < 100ms (imperceptible)
- Linear easing on UI transitions (should be ease-out or cubic-bezier)
- Two animations competing for attention (e.g., dock breathing + CTA pulse + welcome typing all at once on the same fold — that's visual chaos; one alive moment per fold is the rule)
- Motion that doesn't communicate state change ("decorative" rotation/bounce on a static element)

`prefers-reduced-motion` must be respected. The `tfb-stage-in` already has the `@media` rule. If you find a new animation that doesn't, that's a finding.

### Output format

```
MOTION AND TRANSITIONS REVIEW

[For each animation:]
  ELEMENT:
  PURPOSE:
  DURATION (estimated):
  EASING:
  RESPECTS prefers-reduced-motion: YES / NO
  APPROPRIATE: YES / NO
  ISSUE:

OVERALL MOTION QUALITY: PURPOSEFUL | MIXED | DECORATIVE
STATUS: PASS | WARNING | FAIL | N/A
```

---

## Final report format

```
════════════════════════════════════════════════════════════
TFB DESIGNER'S EYE REPORT
Surface: [URL or component]
Date:
Benchmark: [Linear | Stripe Atlas | Pilot.com | Carta Launch]
Modules run: [list]
════════════════════════════════════════════════════════════

OVERALL VERDICT: $30K-WORTHY | NEEDS POLISH | PROTOTYPE QUALITY

[One paragraph. Does this surface look designed, or assembled? Is it
meeting the standard of [benchmark]? What is the single most important
visual quality issue to address before Jason demos this?]

────────────────────────────────────────────────────────────
RESULTS BY MODULE

  Visual Hierarchy          PASS | WARNING | FAIL
  Spacing and Rhythm        PASS | WARNING | FAIL
  Typography                PASS | WARNING | FAIL
  Color and Contrast        PASS | WARNING | FAIL
  Component Consistency     PASS | WARNING | FAIL
  Premium Feel              PASS | WARNING | FAIL
  Motion and Transitions    PASS | WARNING | FAIL | N/A

────────────────────────────────────────────────────────────
THE THREE MOST IMPORTANT FIXES (ranked by impact)

  1. [Finding — including the file path + line range to fix]
     Why it matters:
     Fix:

  2. [Finding]
     Why it matters:
     Fix:

  3. [Finding]
     Why it matters:
     Fix:

────────────────────────────────────────────────────────────
WHAT IS WORKING

[2-4 specific decisions that are correct and worth preserving — not
flattery, real observations of things that are doing their job.]

────────────────────────────────────────────────────────────
FULL MODULE FINDINGS

  [Paste each module's output]

════════════════════════════════════════════════════════════
END OF REPORT
════════════════════════════════════════════════════════════
```

---

## Tips for best results

- **Run `tfb-ux-qa` first.** Functional issues take priority. This skill is for after the surface works.
- **Always anchor against a TFB reference benchmark** — Linear, Stripe Atlas, Pilot.com, or Carta Launch. "Is this good?" is not a question; "Does this meet the standard of Stripe Atlas?" is.
- **Three fixes, not fifteen.** A long list won't get acted on. Three impactful, named, file-located fixes will.
- **Don't relitigate locked decisions.** The navy/gold/cream palette, Inter typography, the "Jason" agent persona — these are not preferences. They're committed brand decisions captured in `globals.css` and `docs/jason-agent-prompt.md`. If you're tempted to recommend a different palette, *stop* — that's outside this skill's scope and requires Jason's blessing.
- **Use the live dev server.** `mcp__Claude_Preview__preview_start` with name `tfb-dev`, then screenshot, inspect, resize. Real measurements beat estimates.
- **Test with real Memory data.** The Blueprint canvas only looks right when at least a couple chapters are populated. Trigger a website scrape against a real URL before evaluating.

---

*TFB Designer's Eye Skill v1.0*
*Run intentionally, not automatically. Companion to `tfb-ux-qa`.*
