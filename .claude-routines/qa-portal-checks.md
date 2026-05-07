# QA Portal Checks — Accumulated Additions

## Additions from 2026-05-06

### 1. Progress bars missing full ARIA triad

**Pattern:** Any `<div` that visually represents a progress bar (look for containers with classes matching `h-1 |h-1\.5|h-2\.5` + `rounded-full` + `overflow-hidden` + an inner div whose width is set via `style={{ width:`) should have ALL THREE of `role="progressbar"`, `aria-valuenow`, and `aria-valuemin`/`aria-valuemax`. Having only `aria-label` is insufficient — screen readers won't announce it as a progress indicator without the role.

**Grep:** `grep -rn "overflow-hidden" src/app/portal src/app/assessment src/components/ | grep "rounded-full" | grep "h-1\|h-2"` — then check each hit for the role.

**Files already fixed (2026-05-06):** CategoryBars.tsx, IntakeClient.tsx, QuestionQueueClient.tsx. Recheck whenever new progress bar surfaces ship.

---

### 2. `<input type="file">` without `accept` attribute

**Pattern:** Any hidden file input (`className="sr-only"` or `display:none`) whose surrounding label copy advertises specific file types (PDF, DOC, images, etc.) must carry a matching `accept` attribute. Without it, the OS file picker opens to "All Files" — confusing when the UI says otherwise and risks users uploading unsupported formats that cause server errors.

**Grep:** `grep -rn 'type="file"' src/app/portal src/app/assessment src/components/ | grep -v "accept="` — for each hit, check if the surrounding label specifies types. If yes and no `accept=`, flag.

**Files already fixed (2026-05-06):** IntakeClient.tsx. Also check DraftWithJasonModal.tsx, DocPromptCard.tsx, ChapterAttachments.tsx — these were NOT fixed because they're in component scope not covered by the current baseline (> 3 file limit), but should be reviewed in a future run.

---

### 3. `{expr === expr && null}` JSX unused-prop suppression

**Pattern:** The construct `{foo === foo && null}` is always true and renders nothing — it's a JSX-equivalent of `void foo;` used to silence "unused variable" linting without removing the prop. Grep for this pattern:

`grep -rn "=== [a-z].*&& null" src/app/portal src/app/assessment src/components/`

Each hit: check if the variable is actually used for rendering elsewhere in the component. If not, remove the prop from the interface and the call site (both often in the same file). If it appears to be a placeholder for future use, leave it and note it in the report.

**Found (2026-05-06):** `{tier === tier && null}` in `PromoBanner` in `src/app/portal/page.tsx`. Not fixed this run — `tier` is used in the parent guard (`tier < 3`) and may be a future-use placeholder. Ambiguous; reported only.

---

### 4. Copy inconsistency: marketing "N dimensions" vs. result page "M categories"

**Pattern:** The assessment marketing page (`src/app/assessment/page.tsx`) describes "Four Dimensions" (Financial, Operational, Brand, Founder), while the in-flow UI and result page use "7 readiness categories" (matching the actual scoring model). These are intentionally different framings (marketing simplification vs. technical accuracy), so do NOT align them — just note if either number changes without the other updating proportionally.

**Check:** `grep -rn "dimensions\|categories" src/app/assessment/ | grep -i "readiness\|franchise"` — confirm the marketing page always says "Four" and the result/flow always says "7".

---

### 5. Build using local next binary, not npx

**Pattern:** `npx next build` downloads a fresh `next` binary that may not match the project's installed version and doesn't have access to local devDependencies (e.g., `@next/mdx`). Always prefer the local binary:

```
./node_modules/.bin/next build
```

If `node_modules` is absent (environment without `npm install`), note the build as "untestable — no node_modules" and skip the build check rather than calling `npx next build` which will spuriously fail on `@next/mdx`.

---

## Additions from 2026-05-07

### 6. Upstream may beat this routine to accessibility fixes

The 2026-05-06 run recommended fixing CategoryBars.tsx and IntakeClient.tsx progress bar ARIA triads. The upstream commit `6a7961b` shipped those fixes before this run. When resolving conflicts between upstream and this routine on ARIA attributes, the upstream's percentage-scale pattern is TFB standard:

```tsx
aria-valuenow={Math.round(c.ratio * 100)}
aria-valuemin={0}
aria-valuemax={100}
```

This is preferred over the raw-score variant (`aria-valuenow={c.score}`, `aria-valuemax={c.max}`) because percentage scale (0–100) is the most broadly compatible screen-reader interpretation of progressbar. Both are spec-valid, but favour the upstream's choice when they conflict.

---

### 7. Stale product-framing phrases in portal Day-1 path

**Grep:** `grep -rn "Start with the Audit\|Audit Your Business\|9 capabilities\|9-capability\|capability_progress" src/app/portal src/app/assessment`

The 9-capability system and its entry point ("Audit Your Business") were retired May 2026. Any Day-1 copy still directing customers to "the Audit" is stale and contradicts the intake flow (`/portal/lab/intake`). Portal Day-1 welcome should reference the intake/question-queue flow, not the old audit.

**Boundary:** Do NOT change copy on marketing pages or any text that uses "audit" as a generic business term — only the product-specific "Start with the Audit" / "Audit Your Business" framing is stale.

**Fixed (2026-05-07):** `src/app/portal/page.tsx:221` — welcome sub-headline for `isFirstRun` path.

---

### 8. DraftWithJasonModal / DocPromptCard / ChapterAttachments file inputs now have `accept`

Prior run (2026-05-06) noted these three components as needing `accept` but deferred due to scope. Fixed in this run (2026-05-07). On future runs, verify the `accept` strings remain present and haven't been removed in refactors.

**Quick check:** `grep -A3 'type="file"' src/components/agent/DraftWithJasonModal.tsx src/components/agent/DocPromptCard.tsx src/components/agent/ChapterAttachments.tsx | grep "accept="` — should return 4 matches (DraftWithJasonModal ×1, DocPromptCard ×2, ChapterAttachments ×1).

---

### 9. PromoBanner `{tier === tier && null}` resolved as removable

Prior run flagged as ambiguous. Confirmed this run: `tier` was passed to `PromoBanner` but genuinely unused inside the component (target tier derived from `offer.target_tier`, not the caller's `tier`). Safe to remove. Removed in `784545a`.

**Pattern to watch:** Any JSX expression matching `{[a-z]+ === [a-z]+ && null}` is a dead suppression. Confirm unused → remove prop + call-site attribute in one file edit.
