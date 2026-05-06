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
