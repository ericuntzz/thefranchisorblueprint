#!/usr/bin/env npx tsx
/**
 * Morning summary email + run-report writer.
 *
 * Reads run JSON from stdin, writes runs/<date>.md, sends a one-screen
 * email summary to Eric via Resend.
 *
 * Usage:
 *   cat run-summary.json | npx tsx scripts/smoke-test/reporter.ts
 *
 * The orchestrating Claude calls this AFTER fixes are pushed and the
 * playbook reflection is appended.
 */
import { config } from "dotenv";
import { Resend } from "resend";
import fs from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local" });

interface RunPayload {
  date: string; // YYYY-MM-DD
  runAt: string;
  phase1: {
    results: Array<{ id: string; name: string; status: string; severity: string; evidence: string; ms: number }>;
    summary: { total: number; pass: number; fail: number; unknown: number; blockers: number; warns: number };
  };
  phase2: {
    flows: Array<{ id: string; name: string; status: string; evidence: string }>;
  };
  fixesApplied: Array<{ findingId: string; commitSha: string; oneliner: string }>;
  flagged: Array<{ findingId: string; severity: string; oneliner: string; proposal: string }>;
  reflection: string;
}

async function main() {
  const stdin = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c.toString()));
    process.stdin.on("end", () => resolve(data));
  });
  const payload: RunPayload = JSON.parse(stdin);

  // 1. Write the per-day report file.
  const runsDir = path.join(process.cwd(), "scripts/smoke-test/runs");
  await fs.mkdir(runsDir, { recursive: true });
  const reportPath = path.join(runsDir, `${payload.date}.md`);
  await fs.writeFile(reportPath, renderReport(payload), "utf8");

  // 2. Send the morning summary email.
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`No RESEND_API_KEY — skipping email. Report written to ${reportPath}`);
    return;
  }
  const resend = new Resend(resendKey);
  const subject = composeSubject(payload);
  const { data, error } = await resend.emails.send({
    from: "TFB Smoke Test <smoke-test@thefranchisorblueprint.com>",
    to: "eric.j.unterberger@gmail.com",
    subject,
    html: renderEmailHtml(payload),
    text: renderEmailText(payload),
  });
  if (error) {
    console.error("Email send failed:", error);
    process.exit(1);
  }
  console.log(`Email sent: ${data?.id}. Report: ${reportPath}`);
}

function composeSubject(p: RunPayload): string {
  const { blockers, warns } = p.phase1.summary;
  const fixes = p.fixesApplied.length;
  const flagged = p.flagged.length;

  if (blockers > 0) return `🔴 Smoke test ${p.date} — ${blockers} blocker${blockers > 1 ? "s" : ""}`;
  if (flagged > 0) return `🟡 Smoke test ${p.date} — ${flagged} to review${fixes > 0 ? `, ${fixes} auto-fixed` : ""}`;
  if (fixes > 0) return `✓ Smoke test ${p.date} — clean (${fixes} auto-fixed)`;
  return `✓ Smoke test ${p.date} — all clean`;
}

function renderEmailHtml(p: RunPayload): string {
  const { phase1, phase2, fixesApplied, flagged, reflection } = p;
  const flaggedSection = flagged.length === 0 ? "" : `
<h3 style="margin:24px 0 8px;color:#1e3a5f;">🟡 Flagged for your review (${flagged.length})</h3>
<ul style="line-height:1.6;color:#333;">
${flagged.map((f) => `<li><b>${escapeHtml(f.findingId)}</b> [${f.severity}] — ${escapeHtml(f.oneliner)}<br><span style="color:#666;font-size:13px;">Proposal: ${escapeHtml(f.proposal)}</span></li>`).join("")}
</ul>`;

  const fixesSection = fixesApplied.length === 0 ? "" : `
<h3 style="margin:24px 0 8px;color:#1e3a5f;">✓ Auto-fixed (${fixesApplied.length})</h3>
<ul style="line-height:1.6;color:#333;">
${fixesApplied.map((f) => `<li><a href="https://github.com/ericuntzz/thefranchisorblueprint/commit/${f.commitSha}" style="color:#1e3a5f;">${f.commitSha.slice(0, 7)}</a> — ${escapeHtml(f.oneliner)}</li>`).join("")}
</ul>`;

  const phase1Stats = `${phase1.summary.pass}/${phase1.summary.total} pass · ${phase1.summary.blockers} blocker · ${phase1.summary.warns} warn`;
  const phase2Stats = `${phase2.flows.filter((f) => f.status === "pass").length}/${phase2.flows.length} flows OK`;

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#faf7f2;margin:0;padding:32px 16px;">
<div style="max-width:560px;margin:0 auto;background:white;border:1px solid #e6dfd2;border-radius:12px;padding:32px;">
<h2 style="margin:0 0 4px;color:#1e3a5f;">TFB Smoke Test — ${p.date}</h2>
<div style="color:#666;font-size:14px;margin-bottom:24px;">
  Phase 1 (API): <b>${phase1Stats}</b><br>
  Phase 2 (visual): <b>${phase2Stats}</b><br>
  Total time: ${(phase1.summary.total > 0 ? Math.round(phase1.summary.total) : 0)} checks in ${(phase1.summary as { totalMs?: number }).totalMs ?? 0} ms
</div>
${flaggedSection}
${fixesSection}
${reflection ? `<h3 style="margin:24px 0 8px;color:#1e3a5f;">Today's reflection</h3><p style="line-height:1.6;color:#333;">${escapeHtml(reflection)}</p>` : ""}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e6dfd2;color:#999;font-size:13px;">
  Full report: <code>scripts/smoke-test/runs/${p.date}.md</code><br>
  Playbook: <code>scripts/smoke-test/playbook.md</code>
</div>
</div></body></html>`;
}

function renderEmailText(p: RunPayload): string {
  const lines: string[] = [];
  lines.push(`TFB Smoke Test — ${p.date}`);
  lines.push("");
  lines.push(`Phase 1 (API): ${p.phase1.summary.pass}/${p.phase1.summary.total} pass, ${p.phase1.summary.blockers} blocker, ${p.phase1.summary.warns} warn`);
  lines.push(`Phase 2 (visual): ${p.phase2.flows.filter((f) => f.status === "pass").length}/${p.phase2.flows.length} flows OK`);
  if (p.flagged.length > 0) {
    lines.push("");
    lines.push(`Flagged for review (${p.flagged.length}):`);
    p.flagged.forEach((f) => lines.push(`  - [${f.severity}] ${f.findingId}: ${f.oneliner}`));
  }
  if (p.fixesApplied.length > 0) {
    lines.push("");
    lines.push(`Auto-fixed (${p.fixesApplied.length}):`);
    p.fixesApplied.forEach((f) => lines.push(`  - ${f.commitSha.slice(0, 7)}: ${f.oneliner}`));
  }
  if (p.reflection) {
    lines.push("");
    lines.push("Reflection:");
    lines.push(p.reflection);
  }
  return lines.join("\n");
}

function renderReport(p: RunPayload): string {
  const lines: string[] = [];
  lines.push(`# Smoke test — ${p.date}`);
  lines.push("");
  lines.push(`> Run at ${p.runAt}`);
  lines.push("");
  lines.push(`## Phase 1 — API + SSR`);
  lines.push("");
  lines.push(`Summary: ${p.phase1.summary.pass}/${p.phase1.summary.total} pass · ${p.phase1.summary.blockers} blocker · ${p.phase1.summary.warns} warn · ${p.phase1.summary.unknown} unknown`);
  lines.push("");
  lines.push("| Status | Severity | Check | Evidence | ms |");
  lines.push("|---|---|---|---|---|");
  for (const r of p.phase1.results) {
    const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "?";
    lines.push(`| ${icon} | ${r.severity} | ${r.id} | ${r.evidence.replace(/\|/g, "\\|")} | ${r.ms} |`);
  }
  lines.push("");
  lines.push(`## Phase 2 — Visual / interactive`);
  lines.push("");
  if (p.phase2.flows.length === 0) {
    lines.push("(Phase 2 did not run this iteration.)");
  } else {
    for (const f of p.phase2.flows) {
      const icon = f.status === "pass" ? "✓" : "✗";
      lines.push(`- ${icon} **${f.name}** (${f.id}) — ${f.evidence}`);
    }
  }
  lines.push("");
  lines.push(`## Auto-fixes applied`);
  lines.push("");
  if (p.fixesApplied.length === 0) {
    lines.push("(none)");
  } else {
    for (const fx of p.fixesApplied) {
      lines.push(`- \`${fx.commitSha.slice(0, 7)}\` — ${fx.oneliner}`);
    }
  }
  lines.push("");
  lines.push(`## Flagged for Eric`);
  lines.push("");
  if (p.flagged.length === 0) {
    lines.push("(none)");
  } else {
    for (const fl of p.flagged) {
      lines.push(`- **${fl.findingId}** [${fl.severity}] — ${fl.oneliner}`);
      lines.push(`  - Proposal: ${fl.proposal}`);
    }
  }
  lines.push("");
  lines.push(`## Reflections`);
  lines.push("");
  lines.push(p.reflection || "(no reflection this run)");
  lines.push("");
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

main().catch((e) => {
  console.error("reporter failed:", e);
  process.exit(1);
});
