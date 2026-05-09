#!/usr/bin/env npx tsx
/**
 * Phase 1 — deterministic curl/API smoke checks.
 *
 * Pure script. Runs all checks against production. Outputs JSON to stdout.
 * Exit code: 0 if no blockers, 1 if any blocker fails. Warnings + info-level
 * fails do NOT cause a non-zero exit.
 *
 * Usage:
 *   npx tsx scripts/smoke-test/run-phase1.ts > /tmp/phase1.json
 *
 * The orchestrating Claude reads the JSON, runs Phase 2, applies fixes,
 * reflects, and updates the playbook + emails Eric.
 */
import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env.local" });

const BASE = "https://www.thefranchisorblueprint.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "eric.j.unterberger+smoketest@gmail.com";

type Severity = "blocker" | "warn" | "info";
type Status = "pass" | "fail" | "unknown";

interface CheckResult {
  id: string;
  name: string;
  status: Status;
  severity: Severity;
  evidence: string;
  ms: number;
}

const results: CheckResult[] = [];

async function runCheck(
  id: string,
  name: string,
  severity: Severity,
  fn: () => Promise<{ pass: boolean; evidence: string }>,
): Promise<void> {
  const start = Date.now();
  try {
    const { pass, evidence } = await fn();
    results.push({
      id,
      name,
      status: pass ? "pass" : "fail",
      severity,
      evidence,
      ms: Date.now() - start,
    });
  } catch (e) {
    results.push({
      id,
      name,
      status: "unknown",
      severity,
      evidence: String((e as Error)?.message ?? e),
      ms: Date.now() - start,
    });
  }
}

// ─── Auth helper ───────────────────────────────────────────────────────────

async function getAuthCookieJar(): Promise<string> {
  // 1. Generate magic link via admin API.
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: TEST_EMAIL }),
  });
  if (!linkRes.ok) throw new Error(`generate_link ${linkRes.status}`);
  const linkJson = await linkRes.json();
  const tokenHash = linkJson.hashed_token;
  if (!tokenHash) throw new Error("no hashed_token in admin response");

  // 2. Hit /auth/confirm via curl (Node fetch can't easily persist Set-Cookie
  // across redirects); use curl in a child process to capture the cookie jar.
  const jarPath = `/tmp/tfb-smoke-cookies-${process.pid}.txt`;
  await new Promise<void>((resolve, reject) => {
    const url = `${BASE}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/portal`;
    const proc = spawn(
      "curl",
      ["-s", "-L", "-c", jarPath, "-b", jarPath, "-A", "tfb-smoke-test/1", url, "-o", "/dev/null"],
      { stdio: "ignore" },
    );
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`curl /auth/confirm exit ${code}`)),
    );
  });
  return jarPath;
}

async function curlGet(jar: string, path: string): Promise<{ status: number; body: string; contentType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "curl",
      ["-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1", `${BASE}${path}`, "-w", "\n__STATUS__%{http_code}__%{content_type}__%{size_download}"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("exit", () => {
      const idx = out.lastIndexOf("__STATUS__");
      const meta = idx >= 0 ? out.slice(idx + 10) : "";
      const [status, contentType, sizeStr] = meta.split("__");
      resolve({
        status: parseInt(status ?? "0", 10),
        body: idx >= 0 ? out.slice(0, idx) : out,
        contentType: contentType ?? "",
        size: parseInt(sizeStr ?? "0", 10),
      });
    });
    proc.on("error", reject);
  });
}

async function curlPost(jar: string, path: string, body: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "curl",
      [
        "-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1",
        "-X", "POST", "-H", "Content-Type: application/json",
        "-d", JSON.stringify(body),
        `${BASE}${path}`,
        "-w", "\n__STATUS__%{http_code}",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("exit", () => {
      const idx = out.lastIndexOf("__STATUS__");
      resolve({
        status: idx >= 0 ? parseInt(out.slice(idx + 10), 10) : 0,
        body: idx >= 0 ? out.slice(0, idx) : out,
      });
    });
    proc.on("error", reject);
  });
}

async function curlPatch(jar: string, path: string, body: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "curl",
      [
        "-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1",
        "-X", "PATCH", "-H", "Content-Type: application/json",
        "-d", JSON.stringify(body),
        `${BASE}${path}`,
        "-w", "\n__STATUS__%{http_code}",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("exit", () => {
      const idx = out.lastIndexOf("__STATUS__");
      resolve({
        status: idx >= 0 ? parseInt(out.slice(idx + 10), 10) : 0,
        body: idx >= 0 ? out.slice(0, idx) : out,
      });
    });
    proc.on("error", reject);
  });
}

// ─── Checks ─────────────────────────────────────────────────────────────────

async function main() {
  let jar: string;
  try {
    jar = await getAuthCookieJar();
  } catch (e) {
    console.error(JSON.stringify({
      results: [{ id: "auth-confirm", name: "Auth + cookie jar", status: "fail", severity: "blocker", evidence: String(e), ms: 0 }],
      summary: { total: 1, pass: 0, fail: 1, blockers: 1 },
    }, null, 2));
    process.exit(1);
  }

  await runCheck("auth-confirm", "Auth + cookie jar via /auth/confirm", "blocker", async () => {
    // Already verified by getAuthCookieJar succeeding; just sanity-check /portal status.
    const { status, body } = await curlGet(jar, "/portal");
    return {
      pass: status === 200 && body.includes("Welcome aboard"),
      evidence: `status=${status} hasWelcome=${body.includes("Welcome aboard")}`,
    };
  });

  await runCheck("portal-landing", "Portal landing renders entitled state", "blocker", async () => {
    const { status, body } = await curlGet(jar, "/portal");
    const hasFirstName = body.includes("Smoke");
    const hasDeliverables = body.includes("17 ready to assemble") || body.includes("17 deliverables");
    return {
      pass: status === 200 && hasFirstName && hasDeliverables,
      evidence: `status=${status} hasSmoke=${hasFirstName} has17deliv=${hasDeliverables}`,
    };
  });

  const ssrPages = [
    "/portal/chapter/business_overview",
    "/portal/chapter/training_program",
    "/portal/chapter/compliance_legal",
    "/portal/lab/intake",
    "/portal/lab/blueprint",
    "/portal/lab/next",
    "/portal/library",
    "/portal/upgrade",
    "/portal/account",
    "/portal/coaching",
    "/portal/exports/concept-and-story",
    "/portal/exports/operations-manual",
  ];
  for (const path of ssrPages) {
    await runCheck(`ssr:${path}`, `SSR page: ${path}`, "blocker", async () => {
      const { status, size } = await curlGet(jar, path);
      return { pass: status === 200 && size > 5000, evidence: `status=${status} size=${size}` };
    });
  }

  await runCheck("redlines-get", "/api/agent/redlines GET shape", "blocker", async () => {
    const { status, body } = await curlGet(jar, "/api/agent/redlines?slug=business_overview");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const j = JSON.parse(body);
    const ok =
      Array.isArray(j.redlines) &&
      typeof j.blockerCount === "number" &&
      typeof j.approved === "boolean";
    return { pass: ok, evidence: `keys=${Object.keys(j).join(",")} blockerCount=${j.blockerCount}` };
  });

  await runCheck("redlines-patch", "/api/agent/redlines PATCH resolves", "warn", async () => {
    const get1 = await curlGet(jar, "/api/agent/redlines?slug=business_overview");
    const r1 = JSON.parse(get1.body);
    const open = (r1.redlines as Array<{id: string; severity: string; resolved_at: string | null}>)
      .find((r) => r.severity === "info" && !r.resolved_at);
    if (!open) {
      // Steady-state expects info to be already-resolved; that's fine.
      return { pass: true, evidence: `no open info redline (steady state)` };
    }
    const patch = await curlPatch(jar, "/api/agent/redlines", { id: open.id, resolved: true });
    return { pass: patch.status === 200, evidence: `patch=${patch.status}` };
  });

  await runCheck("snapshots-get", "/api/agent/snapshots GET shape", "warn", async () => {
    const { status, body } = await curlGet(jar, "/api/agent/snapshots?slug=business_overview");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const j = JSON.parse(body);
    return { pass: Array.isArray(j.snapshots), evidence: `snapshots.length=${j.snapshots?.length}` };
  });

  await runCheck("draft-readiness", "/api/agent/draft-readiness shape", "warn", async () => {
    const { status, body } = await curlGet(jar, "/api/agent/draft-readiness?slug=business_overview");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const j = JSON.parse(body);
    const ok = j.slug === "business_overview" && typeof j.score === "number" && Array.isArray(j.blockers);
    return { pass: ok, evidence: `score=${j.score} blockers=${j.blockers?.length}` };
  });

  await runCheck("chat-history", "/api/agent/chat-history shape", "info", async () => {
    const { status, body } = await curlGet(jar, "/api/agent/chat-history");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const j = JSON.parse(body);
    return { pass: Array.isArray(j.transcript) && Array.isArray(j.savedThreads), evidence: `keys=${Object.keys(j).join(",")}` };
  });

  await runCheck("nudge", "/api/agent/nudge shape", "info", async () => {
    const { status, body } = await curlGet(jar, "/api/agent/nudge");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const j = JSON.parse(body);
    return { pass: "nudge" in j, evidence: `keys=${Object.keys(j).join(",")}` };
  });

  await runCheck("single-docx", "/api/agent/export/concept-and-story DOCX", "warn", async () => {
    const { status, contentType, size } = await curlGet(jar, "/api/agent/export/concept-and-story");
    const isDocx = contentType.includes("openxmlformats-officedocument.wordprocessingml");
    return { pass: status === 200 && isDocx && size > 1000, evidence: `status=${status} size=${size} ct=${contentType}` };
  });

  await runCheck("single-pdf", "/api/agent/export/concept-and-story PDF (preview)", "warn", async () => {
    const { status, contentType, size, body } = await curlGet(
      jar,
      "/api/agent/export/concept-and-story?format=pdf&inline=1",
    );
    const isPdf = contentType.includes("application/pdf");
    const hasPdfMagic = body.startsWith("%PDF-");
    return {
      pass: status === 200 && isPdf && hasPdfMagic && size > 1000,
      evidence: `status=${status} size=${size} ct=${contentType} pdfMagic=${hasPdfMagic}`,
    };
  });

  await runCheck("bundle-zip", "/api/agent/export/bundle ZIP", "warn", async () => {
    const { status, body } = await curlPost(jar, "/api/agent/export/bundle", {
      deliverableIds: ["concept-and-story", "operations-manual", "fdd-draft"],
    });
    // body is binary; inspect first 4 bytes for ZIP magic 0x504b0304.
    const buf = Buffer.from(body, "binary");
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
    return { pass: status === 200 && isZip && buf.length > 5000, evidence: `status=${status} size=${buf.length} isZip=${isZip}` };
  });

  await runCheck("admin-gate", "/api/admin/diagnostics 403 for test account", "blocker", async () => {
    const { status } = await curlGet(jar, "/api/admin/diagnostics");
    return { pass: status === 403, evidence: `status=${status}` };
  });

  // ─── Summary ────────────────────────────────────────────────────────────
  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    unknown: results.filter((r) => r.status === "unknown").length,
    blockers: results.filter((r) => r.status === "fail" && r.severity === "blocker").length,
    warns: results.filter((r) => r.status === "fail" && r.severity === "warn").length,
    totalMs: results.reduce((a, r) => a + r.ms, 0),
  };

  console.log(JSON.stringify({ runAt: new Date().toISOString(), results, summary }, null, 2));
  process.exit(summary.blockers > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message ?? e) }));
  process.exit(2);
});
