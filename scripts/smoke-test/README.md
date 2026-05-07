# TFB Smoke Test

A daily Claude-driven smoke test for the customer journey. Reads the [`playbook.md`](./playbook.md) at the start of each run, walks the journey end-to-end, auto-fixes unambiguous regressions, flags ambiguous ones to Eric, and updates its own playbook based on what it learned.

## Quickstart

```bash
# Idempotently provision the test account state (1 paid Tier-1 purchase, 3 redlines).
npm run smoke-test:seed

# Phase 1 — deterministic API + SSR checks. JSON to stdout. Exits non-zero on blocker.
npm run smoke-test:phase1

# Render daily report + email summary. Reads orchestration JSON from stdin.
npm run smoke-test:phase1 | node -e "..." | npm run smoke-test:report
```

## Files

| File | Role | Mutable by |
|---|---|---|
| `playbook.md` | The mutable instruction set the orchestrating Claude reads each run | Eric + the routine |
| `seed.ts` | Idempotent test-account state setup | Engineers |
| `run-phase1.ts` | Pure deterministic API + SSR checks. JSON output. | Engineers |
| `reporter.ts` | Writes daily report + sends Resend email summary | Engineers |
| `baseline.json` | Last-known-good API + SSR shapes — used for diff-style anomaly detection | The routine (auto-updates on stable passes) |
| `runs/<date>.md` | Per-day full report | The routine writes one each day |

## Phase 2 — visual

Phase 2 uses the Claude Preview MCP tools (`mcp__Claude_Preview__*`). Not a CLI script — it's part of what the orchestrating Claude does in the daily routine. See `playbook.md` for the 5 flows it walks.

If you need to do a Phase 2 pass manually, in a Claude session:
1. Run `npm run smoke-test:seed` first
2. Ask Claude to "run scripts/smoke-test/playbook.md Phase 2 against production using the test account credentials in `reference_tfb_test_account.md`"

## How the daily routine works

The scheduled remote agent (set up via the `schedule` skill) wakes daily at 7am MT and:

1. Pulls latest from `main`
2. Runs `seed.ts` (idempotent — fixes drift)
3. Runs `run-phase1.ts`, captures the JSON
4. Runs Phase 2 by orchestrating Claude Preview MCP calls (per playbook)
5. Diffs results vs `baseline.json` + yesterday's `runs/<yesterday>.md`
6. **Auto-fixes** unambiguous bugs (commit + push, single-file diffs only — see `feedback_fix_issues_proactively.md`)
7. **Flags** ambiguous ones for the morning email
8. **Reflects** in 3–5 sentences on what was useful, what it missed, what to add/retire
9. **Updates `playbook.md`** based on the reflection (e.g., adds a check for a regression the routine missed yesterday but Eric reported)
10. **Writes** `runs/<date>.md` with the full transcript
11. **Emails** Eric a one-screen summary via Resend
12. **Commits + pushes** the report + playbook updates

## Extending

To add a new check, prefer editing `playbook.md` first (describe what should be checked + severity), then implement it in `run-phase1.ts`. The next morning's run will execute it.

The point of the playbook-first workflow: the routine itself is allowed to add checks during reflection. If you find a bug in production that the smoke test should have caught, add a row to the playbook table — the routine will pick it up next run.

## Why both phases

- **Phase 1** catches API contract drift, status-code regressions, and broken SSR very fast (~2 sec for ~20 checks). Doesn't need a browser. Runs reliably in the cloud routine.
- **Phase 2** catches visual regressions, broken interactive widgets, and post-hydration issues (the redline drawer's slide-in, the chapter toolbar's redline-count badge, layout breaks). Slower but indispensable for "does this LOOK right?" verification — which is the actual customer experience.
