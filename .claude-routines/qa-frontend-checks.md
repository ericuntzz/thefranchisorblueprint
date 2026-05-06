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
