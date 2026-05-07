#!/bin/bash
# TFB daily smoke-test orchestrator.
#
# Invoked by launchd at 7am MT daily (~/Library/LaunchAgents/com.tfb.smoketest.plist).
# Also runnable manually: `bash scripts/smoke-test/run-daily.sh`.
#
# Workflow:
#   1. Pull latest from origin/main
#   2. seed test account (idempotent)
#   3. run Phase 1 (curl/API checks)
#   4. run Phase 2 (cheerio structural checks)
#   5. compose orchestration JSON
#   6. send email + write daily report via reporter.ts
#   7. commit + push playbook + the new runs/<date>.md (explicit paths only)
#
# All output goes to scripts/smoke-test/runs/<date>.log for later inspection.
set -uo pipefail

REPO="/Users/fin/Documents/The Franchisor Blueprint Website"
cd "$REPO" || { echo "[smoke-test] repo not found at $REPO"; exit 1; }

DATE=$(date -u +%Y-%m-%d)
RUN_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOG="scripts/smoke-test/runs/${DATE}.log"
mkdir -p scripts/smoke-test/runs

exec > >(tee -a "$LOG") 2>&1
echo "[smoke-test] === ${RUN_AT} ==="

# Make sure node + npm are on PATH (launchd runs with a minimal env).
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"

# 1. Refresh the repo so we run against the latest source. Skip if we're
# in a worktree that has uncommitted changes (don't blow away in-flight work).
if [[ -z "$(git status --porcelain | head -1)" ]]; then
  git pull --rebase --autostash origin main || echo "[smoke-test] git pull failed (continuing with current checkout)"
fi

# 2. Seed test account state (idempotent).
echo "[smoke-test] === seed ==="
npm run smoke-test:seed || { echo "[smoke-test] seed failed; aborting"; exit 1; }

# 3. Phase 1.
echo "[smoke-test] === phase 1 ==="
PHASE1_JSON="/tmp/tfb-phase1-${DATE}.json"
PHASE1_EXIT=0
npm run smoke-test:phase1 --silent > "$PHASE1_JSON" || PHASE1_EXIT=$?
echo "[smoke-test] phase1 exit=$PHASE1_EXIT"

# 4. Phase 2 (structural).
echo "[smoke-test] === phase 2 ==="
PHASE2_JSON="/tmp/tfb-phase2-${DATE}.json"
PHASE2_EXIT=0
npx tsx scripts/smoke-test/phase2-structural.ts > "$PHASE2_JSON" || PHASE2_EXIT=$?
echo "[smoke-test] phase2 exit=$PHASE2_EXIT"

# 5. Compose orchestration JSON for reporter.
PAYLOAD="/tmp/tfb-payload-${DATE}.json"
node -e "
const fs = require('fs');
const phase1 = JSON.parse(fs.readFileSync('$PHASE1_JSON', 'utf8'));
const phase2 = JSON.parse(fs.readFileSync('$PHASE2_JSON', 'utf8'));
const reflection = phase1.summary.blockers === 0 && (phase2.flows || []).every(f => f.status === 'pass')
  ? 'All checks green today. No new patterns observed; no checks added or retired.'
  : 'Findings present today — review the report file for specifics.';
const out = {
  date: '$DATE',
  runAt: '$RUN_AT',
  phase1: { results: phase1.results, summary: phase1.summary },
  phase2: { flows: phase2.flows || [] },
  fixesApplied: [],
  flagged: [],
  reflection,
};
fs.writeFileSync('$PAYLOAD', JSON.stringify(out, null, 2));
" || { echo "[smoke-test] compose failed"; exit 1; }

# 6. Send email + write report.
echo "[smoke-test] === reporter ==="
cat "$PAYLOAD" | npm run smoke-test:report --silent || echo "[smoke-test] reporter failed"

# 7. Commit + push report (explicit paths only — never git add . or -A).
echo "[smoke-test] === commit ==="
REPORT="scripts/smoke-test/runs/${DATE}.md"
if [[ -f "$REPORT" ]]; then
  git add "$REPORT" "$LOG"
  # Playbook may have been edited by Claude during reflection (future).
  if git status --porcelain scripts/smoke-test/playbook.md scripts/smoke-test/baseline.json | grep -q '^.M'; then
    git add scripts/smoke-test/playbook.md scripts/smoke-test/baseline.json
  fi
  PASS_N=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PAYLOAD')).phase1.summary.pass)")
  TOTAL_N=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PAYLOAD')).phase1.summary.total)")
  BLOCKER_N=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PAYLOAD')).phase1.summary.blockers)")
  git commit -m "smoke-test: ${DATE} · ${PASS_N}/${TOTAL_N} pass · ${BLOCKER_N} blocker(s)" || echo "[smoke-test] nothing to commit"
  git push || echo "[smoke-test] push failed"
fi

echo "[smoke-test] === done ${RUN_AT} ==="
