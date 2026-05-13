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

---

## Additions from 2026-05-08

### 10. Stale "coming in next commit / Wave N" inline comments

**Pattern:** JSDoc or inline comments that describe a future state that has since been implemented — e.g. "Email dispatch is wired in Wave 3" when the email is already being sent in the same file. These mislead future readers about what the route actually does.

**Grep:** `grep -rn "next commit\|Wave [0-9]\|coming in\|wired in\|we'll add\|will be added" src/app/api/portal src/app/api/assessment src/app/portal src/app/assessment` — for each hit, check whether the surrounding code already does the described thing. If yes, update the comment to reflect current state.

**Fixed (2026-05-08):** `src/app/api/assessment/complete/route.ts` lines 9-11 — said email dispatch was coming "in the next commit"; email was already being sent in the same file.

---

### 11. `void (async () => {...})()` in route handlers vs. server components

The check from baseline (fire-and-forget promises in server components) does NOT apply equally to `route.ts` files using `export const runtime = "nodejs"`. In the Node.js runtime, pending promises continue to execute after `return res` — the function stays alive until all microtasks complete or the Vercel timeout fires. In contrast, Edge runtime (`export const runtime = "edge"`) and streaming server components may cut off pending work early.

**When auditing fire-and-forget:**
1. Check the file's `runtime` export. `"nodejs"` → lower risk, continues post-response.
2. Check for `"edge"` or no `runtime` export in a server component → higher risk.
3. If Node.js runtime + `.catch()` error handling + intentional best-effort pattern (e.g. email send that shouldn't block the primary response) → REPORT-ONLY, don't flag as HIGH.

**Grep to catch genuinely problematic cases:** `grep -rn "^void " src/app/portal src/app/assessment` (line-start `void` in server component files, excluding `route.ts`).

---

### 12. Verify `accept` strings persist on file inputs across portal renders

Prior runs fixed `accept` attributes on four components. Check that none were reverted in refactors:

```bash
grep -A3 'type="file"' \
  src/components/agent/DraftWithJasonModal.tsx \
  src/components/agent/DocPromptCard.tsx \
  src/components/agent/ChapterAttachments.tsx \
  src/app/portal/lab/intake/IntakeClient.tsx \
  src/components/agent/JasonChatDock.tsx \
  | grep "accept="
```

Should return ≥5 matches (DraftWithJasonModal ×1, DocPromptCard ×2, ChapterAttachments ×1, IntakeClient ×1, JasonChatDock ×1). If fewer, flag the missing one.

---

## Additions from 2026-05-12

### 13. Dead component functions (defined but never rendered)

**Pattern:** TypeScript does NOT error on unused local `function Foo()` declarations in `.tsx` files — only on unused imports. A removed component whose JSX tag was deleted from the return statement leaves the function definition silently behind. These accumulate as dead code that misleads readers into thinking the surface renders more than it does.

**Grep:**
```bash
grep -n "^function [A-Z]" src/app/portal/page.tsx src/app/portal/layout.tsx src/app/portal/*/page.tsx src/app/portal/*/*/page.tsx 2>/dev/null
```

For each matched `function Foo`, confirm `<Foo` or `{Foo` appears in the same file's JSX. If it doesn't, check git blame to see when the function stopped being called. If the surrounding code has a comment saying "removed per Eric" or "chip removed" etc., the function itself is safe to delete.

**Fixed (2026-05-12):** `src/app/portal/page.tsx` — `CoachingCreditsChip` defined at line 899 (before fix), removed in commit `86e1ab8`. The chip was stripped from the welcome hero on 2026-05-09 but the function body survived.

**Boundary:** Only remove a component function if (a) it's not exported, (b) its call site has a comment explicitly saying it was removed, and (c) the git blame shows no recent changes to the function body that suggest active development.

---

### 14. Refine the `type="file"` / `accept=` multi-line grep false positive

The check in baseline Step 3 (`grep -rn 'type="file"' ... | grep -v "accept="`) fires false positives because `accept=` is almost always on a separate line from `type="file"` in multi-line JSX. The corrected check:

```bash
grep -A5 'type="file"' \
  src/app/portal/lab/intake/IntakeClient.tsx \
  src/components/agent/DraftWithJasonModal.tsx \
  src/components/agent/DocPromptCard.tsx \
  src/components/agent/ChapterAttachments.tsx \
  src/components/agent/JasonChatDock.tsx \
  | grep "accept="
```

This reads 5 lines after each `type="file"` match and checks those for `accept=`. A file input without an `accept=` within 5 lines is genuinely missing it. Do NOT use the single-line grep form from the baseline for these multi-line inputs.

---

## Additions from 2026-05-13

### 15. Progress bar ARIA scan must include `src/components/portal/`

Prior additions noted fixes in `src/app/portal/` and `src/components/AssessmentFlow.tsx`, but this run found three more progress bars missing the full ARIA triad in `src/components/portal/` (CommandCenter, DeliverableExplorer/ReadinessBar, RegulatoryMilestones). The baseline grep only targets `src/app/portal` and `src/app/assessment`. Extend it:

```bash
grep -rn "overflow-hidden" \
  src/app/portal src/app/assessment \
  src/components/portal src/components/AssessmentFlow.tsx \
  | grep "rounded-full" | grep -E "h-1[^0-9]|h-2[^0-9]|h-1\.5"
```

For each hit, check whether the outer container div has ALL of `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Missing any one of the three is a MEDIUM finding. The `aria-label` is additionally required when the surrounding heading doesn't already announce what the bar measures.

**Fixed 2026-05-13:** `CommandCenter.tsx:59`, `RegulatoryMilestones.tsx:63`, `DeliverableExplorer.tsx:584`.

---

### 16. List-rail "active item" buttons need `aria-pressed`

Any button inside a `<ul>/<li>` navigation rail (sidebar, tab-like selector) that visually marks one item as "currently selected" using a class toggle must carry `aria-pressed={isActive}`. The pattern `const isActive = X.id === activeId` followed by a `className={... isActive ? ... : ...}` with no ARIA attribute is the signature to grep for:

```bash
grep -rn "isActive\s*?" src/components/portal/ | grep "className" | grep -v "aria-"
```

For each match, check if the corresponding `<button` has `aria-pressed` or `aria-current`. If not, add `aria-pressed={isActive}`.

**Fixed 2026-05-13:** `DeliverablePreviewModal.tsx:166` — bundle sidebar deliverable-selector buttons.

---

### 17. `void notFound` in admin pages — ambiguous, leave alone

`src/app/portal/admin/redline/page.tsx:223` contains `void notFound;` with an explicit comment saying it's kept for future use. This is NOT a lying suppression — it's a genuine forward-compatibility placeholder. Do not flag or remove it on future runs unless the comment is gone and `notFound()` is now actively called in the same file.

**Pattern to distinguish:** If the `void X` has a comment saying "kept for future use" or "available for," treat it as ambiguous and skip. Only flag `void X` where X is called elsewhere in the same file (lying suppression) or where there is no comment at all.
