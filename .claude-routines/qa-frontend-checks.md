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
- REPORT-ONLY: same constraint as glossary shortDefs above.

### Check: dynamic page title/description templates from data files
- For `src/app/franchise-your/[industry]/business/page.tsx` and `src/app/franchise-your-business-in/[state]/page.tsx`, the title and description are built from industry/state data. After 2026-05-08 fix, templates are now within bounds for all entries.
- On any future additions to `src/lib/franchise-industries.ts` or `src/lib/franchise-states.ts`, verify the template outputs stay within bounds by running:
  `python3 -c "from src.lib.franchise_industries import allIndustries; [print(len(f'{i.shortName} Franchise | The Franchisor Blueprint'), i.shortName) for i in allIndustries if len(f'{i.shortName} Franchise | The Franchisor Blueprint') > 60]"` (adapt to TS as needed).

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
