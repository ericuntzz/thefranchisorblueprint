## Additions from 2026-05-06

### Check: onboarding call duration consistency
- grep: `grep -rn "30-minute.*onboarding\|onboarding.*30-minute" src/app/ src/components/ --include="*.tsx"`
- Cross-reference any duration mentions against `src/lib/products.ts` and the Calendly URL in `src/app/programs/blueprint/page.tsx` (currently `60-minute-blueprint-onboarding`).

### Check: placeholder bracket content in visible components
- grep: `grep -rn "\[.*\]\|\[PLACEHOLDER\]" src/components/ src/app/ --include="*.tsx" --include="*.mdx"` — flag any bracket-wrapped names like `[Name]`, `[Restaurant Concept]`, `[City, ST]` that would render literally on visitor-facing pages.
- Known existing: `src/components/Testimonials.tsx` — all three testimonials use bracketed placeholder names. REPORT-ONLY until real client data is available.

### Check: attorney-review banners on live legal pages
- `src/components/LegalPage.tsx` renders a visible amber "Placeholder text — pending attorney review." banner on all four legal pages (privacy, terms, earnings-disclaimer, franchise-disclaimer). Verify whether this banner should be removed before launch. REPORT-ONLY — Eric must confirm with counsel.

### Check: dangerouslySetInnerHTML in page/component JSX
- grep: `grep -rn "dangerouslySetInnerHTML" src/app/ src/components/ --include="*.tsx" | grep -vE "/(portal|assessment)/|agent/"`
- For any hit outside portal/assessment: verify whether the content is static (fix: convert to JSX children) or genuinely dynamic HTML (document the risk).

### Check: metadata title length
- After any new page is added, verify: `grep -rn "title:" src/app/ --include="*.tsx" | grep "metadata\|export" | awk -F'"' '{print length($2), $2}' | awk '$1 > 60'`
- Known pattern: blog post titles use `${post.title} | The Franchisor Blueprint` — several hit 77-83 chars. Multi-file to fix; log as MEDIUM/REPORT.

### Check: build environment
- `npx next build` fails with `Cannot find module '@next/mdx'` — pre-existing environment issue (module not installed in the CI context). Do not attempt to fix. Note in report as pre-existing.

### Check: LegalPage noindex
- Legal pages (privacy, terms, earnings-disclaimer, franchise-disclaimer) currently inherit `robots: { index: true }` from the layout default. Consider whether `robots: { index: false }` should be added to each. REPORT-ONLY — strategic SEO decision for Eric.

## Additions from 2026-05-07

### Check: page-specific openGraph URL drift
- After any new marketing page is added, verify it has its own `openGraph` block with a `url` field. Without it, Next.js inherits the layout's `openGraph.url` (the root URL) — so social link previews for every page without OG show the homepage URL instead of the page's own URL.
- grep: `grep -rL "openGraph" src/app/*/page.tsx src/app/page.tsx 2>/dev/null | grep -vE "portal|assessment|thank-you|services|opengraph"` — any hit on a public marketing page is a MEDIUM issue.
- Fixed 2026-05-07: homepage, pricing, programs, programs/blueprint, about, contact, strategy-call, strategy-call/builder, strategy-call/blueprint, blog.

### Check: layout.tsx fallback title length
- `layout.tsx` default title should stay under 60 chars. It is only shown for pages without their own `title` metadata, but a truncated fallback still looks bad in browser tab strips and any route that accidentally loses its metadata.
- Current: "Franchise Your Business | The Franchisor Blueprint" (51 chars) — OK as of 2026-05-07.

### Check: strategy-call/blueprint stale "founding member" copy
- `src/app/strategy-call/blueprint/page.tsx` contains copy referencing "founding-member pricing" and "self-serve checkout opens shortly." As of 2026-05-07 the product has been live for some time. REPORT-ONLY — copy/positioning change for Eric to decide.

### Check: legal page description length
- `src/app/privacy/page.tsx` description was 50 chars (below 70-char minimum). Fixed 2026-05-07.
- On each QA run: `python3 -c "desc='<description>'; print(len(desc))"` — descriptions under 70 chars on legal pages should be extended.

## Additions from 2026-05-08

### Check: glossary shortDef description length
- All 31 glossary term `shortDef` values in `src/lib/franchise-glossary.ts` are used verbatim as the `description` in `generateMetadata` for `/glossary/[term]` pages. Currently all 31 exceed 160 chars (range: 161–261 chars).
- grep: `python3 -c "import re; content=open('src/lib/franchise-glossary.ts').read(); matches=re.findall(r'shortDef:\\s*\"([^\"]+)\"', content); [print(len(m), m[:60]) for m in matches if len(m) > 160]"`
- REPORT-ONLY: requires substantive content editing of 31 technical definitions to stay under 160 chars while preserving keyword density. Not auto-fixable without risk of mid-sentence truncation or keyword loss.

### Check: comparison metaDescription length
- All 5 `metaDescription` values in `src/lib/franchise-comparisons.ts` are used as meta descriptions for `/compare/[topic]` pages. Currently all 5 exceed 160 chars (range: 185–219 chars).
- grep: `python3 -c "import re; content=open('src/lib/franchise-comparisons.ts').read(); matches=re.findall(r'metaDescription:\\s*\"([^\"]+)\"', content); [print(len(m), m[:60]) for m in matches if len(m) > 160]"`
- REPORT-ONLY: REPORT-ONLY: same constraint as glossary shortDefs above.

### Check: dynamic page title/description templates from data files
- For `src/app/franchise-your/[industry]/business/page.tsx` and `src/app/franchise-your-business-in/[state]/page.tsx`, the title and description are built from industry/state data. After 2026-05-08 fix, templates are now within bounds for all entries.
- On any future additions to `src/lib/franchise-industries.ts` or `src/lib/franchise-states.ts`, verify the template outputs stay within bounds.

### Check: programs/pricing/homepage description length after price changes
- `pricing/page.tsx`, `page.tsx`, and `programs/page.tsx` descriptions were fixed 2026-05-08 (173→150, 191→145, 254→155 chars respectively). On any future price or tier update, re-verify these don't drift back over 160 chars.

## Additions from 2026-05-09

### Check: heading hierarchy — h3 before h2 in non-content pages
- grep: For each marketing page, check that no h3 appears before the first h2 (after the h1 from PageHero).
- Pattern: `grep -n '<h[1-6]' src/app/<page>/page.tsx | head -20` — any h3 line number that precedes the first h2 line number is a violation.
- Fixed 2026-05-09: `pricing/page.tsx` had h3 tier names before any h2. Added `<h2 className="sr-only">Pricing Tiers</h2>` before the pricing cards grid.
- Known safe: programs/page.tsx (h3 tier names are under an explicit h2 "What you can expect at each tier"). pricing/page.tsx had no such parent h2 wrapper.

### Check: alternates.canonical coverage on core marketing pages
- Pages that derive their content from the layout's `alternates: { canonical: "/" }` and do NOT override it will emit "/" as their canonical — a potential duplicate-content signal in Google Search Console.
- grep: `grep -rL "alternates" src/app/about/page.tsx src/app/pricing/page.tsx src/app/programs/page.tsx src/app/programs/blueprint/page.tsx src/app/contact/page.tsx src/app/strategy-call/page.tsx src/app/strategy-call/builder/page.tsx src/app/strategy-call/blueprint/page.tsx src/app/page.tsx`
- Pages without explicit `alternates.canonical`: about, pricing, programs, programs/blueprint, contact, strategy-call, strategy-call/builder, strategy-call/blueprint (as of 2026-05-09).
- REPORT-ONLY: touches >3 files; also depends on verifying Next.js App Router metadata inheritance behavior in production (can't verify without a running build in this environment).

### Check: email address routing consistency
- The site uses two support email addresses: `info@thefranchisorblueprint.com` (general contact, legal, footer) and `team@thefranchisorblueprint.com` (post-purchase support in thank-you/page.tsx and BlueprintUpsellBuyBox.tsx).
- This may be intentional (different routing), but verify both inboxes are active and routed correctly.
- grep: `grep -rn "@thefranchisorblueprint.com" src/app/ src/components/ --include="*.tsx" | grep -vE "portal|assessment" | grep -v "PORTAL_SUPPORT_EMAIL"`
- REPORT-ONLY: could be intentional (pre-purchase vs post-purchase routing). Eric should confirm both addresses are active.

## Additions from 2026-05-10

### Check: IntakeHeroCTA multi-state link validity
- The `src/components/intake/IntakeHeroCTA.tsx` component has 8 distinct view states (loading, capped, idle, streaming, snapshot, saving, saved, error). Each state renders different CTAs.
- Verified 2026-05-10: all hrefs in IntakeHeroCTA point to valid routes (/assessment, /strategy-call, /programs/blueprint, /strategy-call/blueprint). Re-check after new states or CTA changes:
  `grep -n 'href=' src/components/intake/IntakeHeroCTA.tsx | grep -v 'className\|//'`
- Special attention: the `capped` state (daily spend cap hit) falls back to `/assessment` — confirm that assessment route stays live.

### Check: hero subtitle non-breaking space intentionality
- `src/app/page.tsx` "Now What?" heading uses `&nbsp;` between "Now" and "What?" to prevent awkward line break. This is intentional and should not be "fixed" by future runs.
- Similarly `src/app/pricing/page.tsx` subtitle uses Unicode curly quotes (U+201C/201D) inside a straight-quoted JSX attribute for "call for pricing" — this is safe (not ASCII double quotes) and intentional.
- Pattern: `grep -n 'nbsp' src/app/page.tsx` — any hits are known-intentional.

### Check: LegalPage attorney-review banner persistence
- As of 2026-05-10 the amber "Placeholder text — pending attorney review." banner in `src/components/LegalPage.tsx` has been REPORT-ONLY for 5 consecutive runs (since 2026-05-06). The banner is visible on all 4 public legal pages (privacy, terms, earnings-disclaimer, franchise-disclaimer).
- Each run: verify the banner is still in `src/components/LegalPage.tsx` lines 22–33. If Eric removes it, also remove this check.
- `grep -n "Placeholder text — pending attorney review" src/components/LegalPage.tsx`

## Additions from 2026-05-11

### Check: openGraph description on SEO index pages (franchise-by-industry, franchise-by-state, glossary, compare)
- These pages have two description fields: the canonical `description` (used in HTML <meta>) and the `openGraph.description` (used in social link previews). Both need to stay under 160 chars independently.
- The canonical `description` may be within bounds while the OG description silently drifts over — the two are sometimes written with slightly different wording. Check both on every run.
- Also check the canonical `title` — it must stay under 60 chars. Pages with keyword-expanded titles drift over (e.g. franchise-by-industry hit 105 chars on 2026-05-11). Fixed same run.
- grep pattern: `python3 -c "import re; files=['src/app/franchise-by-industry/page.tsx','src/app/franchise-by-state/page.tsx','src/app/glossary/page.tsx','src/app/compare/page.tsx']; [print(f, len(m)) for f in files for m in re.findall(r'openGraph.*?description:\\s*\"([^\"]+)\"', open(f).read(), re.DOTALL) if len(m)>160]"`
- Fixed 2026-05-11: franchise-by-industry title 105→48 chars, description 254→157 chars, OG description 164→156 chars.

### Check: misleading JSX comment labels
- JSX section comments that say "placeholder" when the section is actually rendering live content confuse future contributors and can mask real placeholder detection greps.
- Pattern: `grep -rn "placeholder" src/app/ src/components/ --include="*.tsx" | grep "<!-\|{/\*" | grep -vE "portal|assessment|input placeholder|className"` — any hit with "placeholder" in a JSX comment near a live component (Calendly, Stripe, forms) should be checked.
- Fixed 2026-05-11: strategy-call/page.tsx comment was `{/* ===== Calendly placeholder ===== */}` → `{/* ===== Calendly embed ===== */}`.
- Known intentional "placeholder" comments: none remaining after this fix.

### Check: dangerouslySetInnerHTML safety outside portal/assessment
- Verified 2026-05-11: `glossary/[term]/page.tsx` uses `formatPara()` which escapes `&`, `<`, `>` before inserting content, and the content source is static server-side data (`src/lib/franchise-glossary.ts`). Safe — no user-controlled input reaches the HTML.
- `JsonLd.tsx` is for structured JSON-LD injection, standard Next.js pattern. Safe.
- Re-check if new `dangerouslySetInnerHTML` usages appear outside these two files.

### Check: metadata description regex false positive (apostrophe in strings)
- The regex pattern `r'description:\s*[\"\'](.*)[\'\"']'` stops at the first apostrophe in the content when matching single-quoted strings — e.g. "We'll" causes a 50-char false positive for a 162-char description.
- Use a more robust pattern: read the raw file and look for the string manually, or use a multi-line regex that avoids stopping at apostrophes in double-quoted strings.
- Safer pattern: `python3 -c "d = open(f).read(); import re; [print(len(m), m[:80]) for m in re.findall(r'description:\n\s*\"(.*?)\"', d, re.DOTALL)]"` — use double-quote delimiters only.

## Additions from 2026-05-12

### Check: base64-encoded source files causing TS1109/TS1005 at EOF
- Detection: `npx tsc --noEmit -p .` emits errors like `file.tsx(1,N): error TS1109: Expression expected.` where N matches the file's byte size exactly.
- Verify with: `wc -l src/app/<page>/page.tsx` — if line count is 0 (no newlines), the file is likely a base64 blob.
- Confirm with: `tail -c 50 <file> | cat -A` — base64 ends with `=` padding or URL-safe characters, not `}\n`.
- Fix: `base64 -d <file> > /tmp/decoded.tsx && cp /tmp/decoded.tsx <file>`
- Known occurrences fixed 2026-05-12: `src/app/franchise-by-industry/page.tsx`, `src/app/strategy-call/page.tsx`
- Also check: `.claude-routines/qa-frontend-checks.md` itself — if it appears base64-encoded, decode before reading and write back as plain text after appending.

### Check: blog.ts excerpt title/content drift
- When a blog post title is updated (e.g. "17-Section" → "17-Chapter"), check if the `excerpt` field references the old terminology.
- grep: `python3 -c "import re; c=open('src/lib/blog.ts').read(); posts=re.findall(r'slug:.*?tags:.*?\\]', c, re.DOTALL); [print(p[:200]) for p in posts if '17-Section' in p and '17-Chapter' in c.split(p)[0].count('17-Chapter') == 0]"` — adapt pattern for whichever keyword changed.
- Auto-fixable: update the excerpt to match the current title's terminology while keeping the excerpt under 160 chars.

### Check: NEXT_PUBLIC_STRIPE_LIVE gated stale copy in BlueprintUpsellBuyBox
- `src/components/BlueprintUpsellBuyBox.tsx` lines 205-265: when `NEXT_PUBLIC_STRIPE_LIVE !== "true"`, renders "Self-serve checkout coming soon. Until then, every customer starts with a quick call."
- This copy becomes stale once Stripe goes live (env var flipped). Each run: `grep -n "NEXT_PUBLIC_STRIPE_LIVE" .env* 2>/dev/null || grep -rn "NEXT_PUBLIC_STRIPE_LIVE" src/ --include="*.tsx" | grep -v "components/BlueprintUpsellBuyBox"` — if the env var is set to "true" in production, the "coming soon" branch is unreachable and the copy is moot. REPORT-ONLY until env var status confirmed.
- Fix when Stripe is live: remove lines 258-262 (the `<p>` with "Self-serve checkout coming soon") from the `!STRIPE_LIVE` render branch in BlueprintUpsellBuyBox.tsx.

## Additions from 2026-05-13

### Check: blog post content terminology vs. blog.ts metadata
- When a blog post article consistently uses a specific term (e.g. "17-chapter"), verify that blog.ts `title` and `excerpt` use the same term — not an older synonym ("17-section"). This drift happens when the MDX is written or edited independently of blog.ts.
- grep: `grep -n '17-section\|17-chapter' src/lib/blog.ts src/app/blog/\(posts\)/how-to-write-franchise-operations-manual/page.mdx 2>/dev/null` — any mismatch between the two files flags a content drift.
- Auto-fixable: update blog.ts title/excerpt to match the article content's terminology.
- Fixed 2026-05-13: "17-Section Framework" → "17-Chapter Framework" in title; "17-section framework" → "17-chapter framework" in excerpt.

### Check: cross-asset terminology consistency (marketing pages vs. blog posts)
- Marketing pages (page.tsx, programs/page.tsx, programs/blueprint/page.tsx, ComparisonTable.tsx, DeviceMockups.tsx) use "17-section" when describing the Operations Manual template as a product feature. The blog post uses "17-chapter". These may be intentionally different (product terminology vs. educational framework) or may be a legacy mismatch.
- grep: `grep -rn '17-section\|17-chapter' src/app/page.tsx src/app/programs/page.tsx src/app/programs/blueprint/page.tsx src/components/ComparisonTable.tsx src/components/DeviceMockups.tsx src/lib/blog.ts --include="*.tsx" --include="*.ts"` — if any inconsistency, REPORT-ONLY. This is a positioning/voice decision for Eric.
- REPORT-ONLY: as of 2026-05-13 the marketing pages say "17-section" (product copy) and the blog post says "17-chapter" (framework terminology). Eric should decide which is canonical across the site.

### Check: git detached HEAD during QA routine
- If the working directory is in detached HEAD state at the start of a QA run (e.g., due to a worktree or prior session state), commits will not land on `main`. After every commit, verify `git branch --show-current` is not empty. If detached, cherry-pick the commit(s) onto `main` before pushing.
- Pattern: `git branch --show-current | grep -q '^$' && echo "DETACHED HEAD — commits will not land on main"`
