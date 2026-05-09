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
| `ssr-pages` | 12 SSR pages return 200 (chapters, lab/*, library, upgrade, account, coaching, exports/*) | blocker per page |
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

## Phase 2 — Visual + interactive (Claude Preview)

Use the Claude Preview MCP tools (`mcp__Claude_Preview__*`). Never use the Chrome extension — it crashes chats with oversized screenshots (see `feedback_no_chrome_screenshots`).

Workflow each run:
1. `preview_start tfb-dev` — boots `npm run dev` on port 3000
2. Inject the test-account session cookie via `preview_eval` (cookie value comes from Phase 1's auth check)
3. Visit each of the 5 key flows below; for each:
   - `preview_snapshot` for DOM + content (text-first, no image)
   - `preview_screenshot` ONLY at the end of each flow, scoped to the relevant region
   - Save screenshot bytes to `scripts/smoke-test/runs/<date>/<flow>.jpg`
4. Compare against the prior day's screenshot (in `runs/<prior-date>/`); flag anything that visually drifted
5. `preview_stop` when done

The 5 flows:

| Flow | URL | What to verify |
|---|---|---|
| `portal-landing` | `/portal` | "Smoke" first name, 17 deliverables, "0% complete" progress, navy/gold/cream brand consistency, "Preview & download" / "Preview bundle" buttons present (added in commit 6897642) |
| `chapter-with-redlines` | `/portal/chapter/business_overview` | Chapter title "Concept & Story", form fields (Concept summary / Founder / Audience), back link to /portal. Toolbar was simplified in commit 0d7e10b — only status pills + back arrow remain in SSR; redline badge + Jason dock are client-rendered. |
| `redline-drawer` | (click the redline badge) | Drawer slides in, shows 3 cards (1 blocker, 1 warning, 1 info-resolved), severity pills correct color, "Mark resolved" button per open card |
| `export-pre-review` | `/portal/exports/concept-and-story` | "Download .docx now" button, readiness % rendered, [NEEDS ATTORNEY REVIEW] markers visible if applicable |
| `lab-blueprint-canvas` | `/portal/lab/blueprint` | The 213KB Blueprint canvas renders without overflow / clipping at 1280×800 |

If any flow fails Claude-Preview rendering, that's a `blocker`. If the visual diff vs yesterday is ambiguous, flag it as `warn` for Eric.

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
