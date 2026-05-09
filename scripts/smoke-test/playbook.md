# TFB Smoke Test Playbook

> **Last updated:** 2026-05-07 (v1 — initial)
> **Owner:** Eric (manual edits welcome). The routine itself also self-edits this file at the end of each run.

This file is the **mutable instruction set** for the daily smoke-test routine. Read it first when running. Update it at the end based on what you learned. Commit + push as part of the run.

---

## Mission

Every morning, walk the TFB customer journey end-to-end as the dedicated test account. Find regressions. Auto-fix the unambiguous ones. Flag the rest to Eric. Get measurably better at this over time.

The routine has more freedom than a normal CI check: it can think, judge, fix, re-test, and update its own playbook. Use that freedom — don't just run a static script.

## Test rig

- **Account:** `eric.j.unterberger+smoketest@gmail.com` (Supabase user_id `f6c99e67-2bf0-4159-a486-b0e9fbeb8cd2`)
- **Tier:** 1 (Blueprint), provisioned via direct REST insert (NOT a real Stripe checkout — see `seed.ts`)
- **Auth path:** admin-generated magic link → `/auth/confirm?token_hash=...&type=magiclink&next=/portal`
- **Steady-state seed data:** 1 paid purchase, 3 redlines on `business_overview` (1 blocker, 1 warning, 1 info-resolved)
- **Re-provision command:** `npx tsx scripts/smoke-test/seed.ts`

## Cadence

Daily 7:00 AM Mountain Time, via the scheduled remote agent. Phase 1 (deterministic) + Phase 2 (visual) both run.

A run takes ~5 min. Costs: ~$0.20 in Claude tokens, $0.001 in Resend, near-zero in Supabase/Vercel.

---

## Phase 1 — Deterministic checks (curl + API)

Run via: `npx tsx scripts/smoke-test/run-phase1.ts`

The script returns JSON:
```json
{ "results": [ { "id", "name", "status", "severity", "evidence", "ms" }, ... ], "summary": {...} }
```

Status ∈ `{pass, fail, unknown}`. Severity ∈ `{blocker, warn, info}`.

Current check set (the script encodes this — keep this table in sync):

| ID | What it checks | Severity if fail |
|---|---|---|
| `auth-confirm` | `/auth/confirm` with token_hash → 307 to /portal, sets `sb-...-auth-token` cookie | blocker |
| `portal-landing` | `/portal` returns 200, includes "Welcome aboard, Smoke" + 17 deliverable rows | blocker |
| `ssr-pages` | 12 SSR pages return 200 (sections, lab/*, library, upgrade, account, coaching, exports/*) | blocker per page |
| `redlines-get` | `/api/agent/redlines?slug=business_overview` returns `{redlines:[], blockerCount, approved}` | blocker |
| `redlines-patch` | PATCH `/api/agent/redlines` resolves a redline; subsequent GET reflects it | warn |
| `snapshots-get` | `/api/agent/snapshots?slug=business_overview` returns `{snapshots:[]}` | warn |
| `draft-readiness` | `/api/agent/draft-readiness?slug=business_overview` has score + blockers shape | warn |
| `chat-history` | `/api/agent/chat-history` returns `{transcript:[], savedThreads:[]}` | info |
| `nudge` | `/api/agent/nudge` returns `{nudge: null|object}` | info |
| `single-docx` | GET `/api/agent/export/concept-and-story` returns valid DOCX (Word 2007+ magic) | warn |
| `single-pdf` | GET `/api/agent/export/concept-and-story?format=pdf&inline=1` returns valid PDF (`%PDF-` magic). Powers the preview-before-download modal added in commit 6897642. | warn |
| `bundle-zip` | POST `/api/agent/export/bundle` with 3 ids returns valid ZIP w/ `_README.md` + 3 DOCX | warn |
| `admin-gate` | `/api/admin/diagnostics` returns 403 for the test account (NOT in ADMIN_USER_IDS) | blocker |

## Phase 2 — Visual + interactive

Two layers:

### Phase 2a — Structural HTML (cheerio, fast)

Run via: `npx tsx scripts/smoke-test/phase2-structural.ts`

Fetches each flow URL with the test-account cookie, parses the HTML with cheerio, asserts documented elements/text exist. ~5s for 5 flows. Catches DOM-level regressions (page renders, key text present, expected structure).

### Phase 2b — Visual (Playwright headless, ~20s)

Run via: `npx tsx scripts/smoke-test/phase2-visual.ts` (npm script: `smoke-test:phase2-visual`).

Headless Chromium — same Playwright that powers the existing TFB QA routines. Each flow:

1. Authenticates the same way Phase 1 does (admin-issued magic link → `/auth/confirm`)
2. Navigates to the flow URL with viewport 1440×900
3. Waits for the documented `waitFor` selector + 400ms settle
4. Runs a layout-intent assertion (computed styles, computed positions, element existence post-hydration)
5. Takes a screenshot to `scripts/smoke-test/runs/<date>/<flow>.png`
6. Pixel-diffs against the most recent prior day's screenshot via pixelmatch (threshold: 0.5% of viewport pixels = 6480px)
7. Flags `fail` if assertion failed OR diff exceeds threshold

Flow IDs are `visual-*` so they don't collide with structural Phase 2 IDs in the merged report.

Current flows:

| ID | URL | Assertion |
|---|---|---|
| `visual-portal-landing` | `/portal` | First deliverable card renders; "Preview bundle" + "Preview & download" buttons present (catches regression on commit 6897642) |
| `visual-section-business-overview` | `/portal/section/business_overview` | "Concept summary" form label visible; back-to-/portal link present |
| `visual-lab-next-centering` | `/portal/lab/next` | `<main>` has `display:flex` + `align-items:center`; question card top/bottom space symmetric within 5% tolerance (catches regression on commit ced8a53) |
| `visual-preview-modal` | `/portal` (then click "Preview & download") | Modal `[role="dialog"]` opens, contains `<iframe>` for the PDF, footer has both Download buttons (catches regression on the morning-2026-05-08 feature ship) |
| `visual-lab-blueprint-canvas` | `/portal/lab/blueprint` | No horizontal overflow at 1440×900; multiple section cards visible |

Daily orchestrator runs both 2a and 2b; results merged into a single `phase2.flows` array in the morning report.

Screenshots are committed (~500KB/day across 5 flows) so the next morning's run can diff against them. After ~30 days that's ~15MB of binary blobs — acceptable for the test signal.

If Playwright crashes or Chromium isn't installed, Phase 2b returns an empty `flows` array; the orchestrator continues with whatever Phase 2a produced. The daily email always goes out.

---

## Auto-fix triggers

If a finding meets ALL three:
1. **Deterministic** — same input always produces the same fail
2. **Single root cause** — git blame + diff narrows it to one commit / one file
3. **Single-diff fix** — the correction is one Edit's worth of code

Then fix it autonomously: `git add` only the offending file, commit with a message that references the smoke-test finding ID, push. Per `feedback_autonomous_commits` + `feedback_fix_issues_proactively`.

If ANY of those three is unclear → flag the finding to Eric in the morning summary instead. Don't guess.

## Self-improvement rules

At the END of each run (after fixes are pushed but before the email goes out), do this:

1. **Reflect on the run.** Write 3–5 sentences in the day's `runs/<date>.md` under "Reflections":
   - What did I catch that mattered?
   - What did I run that was zero-signal (every day, always passes, costs >2s)?
   - What did I miss? (Cross-reference with Eric's chat history from the day — did he report a bug today that wasn't in my checks?)
   - What changed about the codebase that my checks should now cover? (Look at git log for new routes, new components.)
2. **Update this playbook** based on the reflection:
   - **Add** a check if you missed a real regression. Append to the appropriate Phase 1 / Phase 2 table with a severity guess.
   - **Retire** a check if it's been `pass` for >30 days AND covers a stable surface AND costs >2s. Move to the "Retired checks" appendix below; explain why.
   - **Adjust** severity if Eric has downgraded findings 3+ times in 30 days for the same check (look at run reports for downgrade patterns).
   - **Note** any change Eric made to the playbook manually — preserve his edits, don't revert.
3. **Commit + push** the playbook + the run report.

The reflection is the most important part of the routine. It's what turns this from a static check list into something that gets sharper over time.

---

## Reporting

After both phases finish:
- Write `runs/<date>.md` with: summary stats, full findings list, fixes applied, reflection
- Send a one-screen email summary to `eric.j.unterberger@gmail.com` via Resend (see `reporter.ts`)
- The email's job: tell Eric in 30 seconds whether anything needs his attention. Findings + verdicts only — no green-check parade.

## Retired checks

(none yet — populate as the routine matures)

## Reflections (last 30 days)

(none yet — first run will populate)
