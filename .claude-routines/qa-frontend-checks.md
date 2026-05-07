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
