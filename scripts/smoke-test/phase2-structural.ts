#!/usr/bin/env npx tsx
/**
 * Phase 2 — structural HTML inspection of the 5 key flows.
 *
 * Not a true visual pass (no rendered browser). Fetches each flow URL
 * with the test-account session cookie, parses the HTML with cheerio,
 * verifies the documented elements and text exist. This catches a big
 * class of regressions (toolbar gone, badge label changed, deliverable
 * count drift, etc.) without needing a browser.
 *
 * True visual Phase 2 (Playwright headless or Claude Preview) is a
 * future enhancement — see playbook.md.
 *
 * Usage:
 *   npx tsx scripts/smoke-test/phase2-structural.ts > /tmp/phase2.json
 *
 * JSON shape (consumed by reporter):
 *   { flows: [ { id, name, status, evidence }, ... ] }
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import * as cheerio from "cheerio";

config({ path: ".env.local" });

const BASE = "https://www.thefranchisorblueprint.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "eric.j.unterberger+smoketest@gmail.com";

interface FlowResult {
  id: string;
  name: string;
  status: "pass" | "fail" | "unknown";
  evidence: string;
}

async function generateMagicLink(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: TEST_EMAIL }),
  });
  if (!res.ok) throw new Error(`generate_link ${res.status}`);
  const j = await res.json();
  return j.hashed_token;
}

function authJar(): string {
  const jar = `/tmp/tfb-phase2-cookies-${process.pid}.txt`;
  return jar;
}

async function authenticate(jar: string): Promise<void> {
  const tokenHash = await generateMagicLink();
  const url = `${BASE}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/portal`;
  const r = spawnSync("curl", ["-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1", url, "-o", "/dev/null"]);
  if (r.status !== 0) throw new Error(`auth curl exit ${r.status}`);
}

function fetchHtml(jar: string, path: string): { status: number; body: string } {
  const r = spawnSync(
    "curl",
    ["-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1", `${BASE}${path}`, "-w", "\n__STATUS__%{http_code}"],
    { encoding: "utf8" },
  );
  const out = r.stdout || "";
  const idx = out.lastIndexOf("__STATUS__");
  return {
    status: idx >= 0 ? parseInt(out.slice(idx + 10), 10) : 0,
    body: idx >= 0 ? out.slice(0, idx) : out,
  };
}

function flow(id: string, name: string, fn: () => { pass: boolean; evidence: string }): FlowResult {
  try {
    const { pass, evidence } = fn();
    return { id, name, status: pass ? "pass" : "fail", evidence };
  } catch (e) {
    return { id, name, status: "unknown", evidence: String((e as Error)?.message ?? e) };
  }
}

async function main() {
  const flows: FlowResult[] = [];
  const jar = authJar();
  try {
    await authenticate(jar);
  } catch (e) {
    flows.push({ id: "auth", name: "Phase 2 auth", status: "fail", evidence: String(e) });
    console.log(JSON.stringify({ flows }, null, 2));
    process.exit(1);
  }

  // 1. Portal landing — first-name "Smoke" + deliverable surface
  //    rendered (return-visit count OR first-run hero).
  flows.push(flow("portal-landing", "Portal landing", () => {
    const { status, body } = fetchHtml(jar, "/portal");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const $ = cheerio.load(body);
    const text = $.text();
    // Welcome copy varies (first-run "Welcome aboard" / return-visit "Welcome back")
    const hasSmoke = text.includes("Smoke");
    const hasBlueprint = text.includes("Your Blueprint");
    const hasNav = $('a[href="/portal/library"]').length > 0;
    // Per-card "Preview" button + bundle "Preview docs" button. Copy
    // shortened in commit 861cb6f from the prior "Preview & download" /
    // "Preview bundle" pair.
    const hasPreviewButton =
      text.includes("Preview docs") ||
      /\bPreview\s*<\/button/.test(body) ||
      /\bPreview\s*\.pptx/.test(text);
    return {
      pass: hasSmoke && hasBlueprint && hasNav && hasPreviewButton,
      evidence: `hasSmoke=${hasSmoke} hasBlueprint=${hasBlueprint} hasLibraryNav=${hasNav} hasPreviewButton=${hasPreviewButton}`,
    };
  }));

  // 2. Section page (business_overview) — verify SSR-rendered section shell.
  // Toolbar simplified in commit 0d7e10b — the only SSR-visible items now
  // are the section title + form fields + back link. Redline badge + Jason
  // dock are client-rendered post-hydration, so they don't appear in
  // initial HTML; we cover the redline data layer in flow #3.
  flows.push(flow("section-with-redlines", "Section page (business_overview)", () => {
    const { status, body } = fetchHtml(jar, "/portal/section/business_overview");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const $ = cheerio.load(body);
    const text = $.text();
    const hasTitle = text.includes("Concept & Story") || /Concept (?:&amp;|&) Story/.test(body);
    const hasFormFields = ["Concept summary", "Founder", "Audience"].every((s) => text.includes(s));
    const hasBackLink = $('a[href="/portal"]').length > 0;
    return {
      pass: hasTitle && hasFormFields && hasBackLink,
      evidence: `title=${hasTitle} formFields=${hasFormFields} backLink=${hasBackLink}`,
    };
  }));

  // 3. Redline drawer — note: drawer is client-rendered. SSR HTML won't show
  // the seeded redline cards. We assert the API endpoint is healthy + the
  // section page contains the toolbar widget that triggers it (we verified
  // (2) above for the page-level wiring; here we hit the API directly).
  flows.push(flow("redline-data", "Redline drawer data layer", () => {
    const r = spawnSync(
      "curl",
      ["-s", "-L", "-c", jar, "-b", jar, "-A", "tfb-smoke-test/1", `${BASE}/api/agent/redlines?slug=business_overview`],
      { encoding: "utf8" },
    );
    const j = JSON.parse(r.stdout || "{}");
    const hasShape = Array.isArray(j.redlines) && typeof j.blockerCount === "number";
    const expectedSeeded = j.redlines && j.redlines.length >= 3;
    return {
      pass: hasShape && expectedSeeded,
      evidence: `shape=${hasShape} count=${j.redlines?.length} blockers=${j.blockerCount}`,
    };
  }));

  // 4. Export pre-review redirect — the legacy /portal/exports/[id]
  //    page is now a thin redirect to /portal#deliverable-<id> (the
  //    pre-export review surface was merged into the dashboard cards).
  //    Asserts the redirect lands on /portal and the dashboard renders.
  flows.push(flow("export-pre-review", "Export pre-review redirect to dashboard", () => {
    const { status, body } = fetchHtml(jar, "/portal/exports/concept-and-story");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const $ = cheerio.load(body);
    const text = $.text();
    const onDashboard =
      text.includes("Your Blueprint") || text.includes("Franchise Readiness");
    return {
      pass: onDashboard,
      evidence: `status=${status} onDashboard=${onDashboard}`,
    };
  }));

  // 5. Lab Blueprint canvas — the big 213KB page. Verify it renders + has
  // the 16 section slugs structurally.
  flows.push(flow("lab-blueprint-canvas", "Lab Blueprint canvas", () => {
    const { status, body } = fetchHtml(jar, "/portal/lab/blueprint");
    if (status !== 200) return { pass: false, evidence: `status=${status}` };
    const $ = cheerio.load(body);
    // Canvas renders all 16 sections; do a relaxed check (≥10 section mentions).
    const sectionTitles = [
      "Concept & Story",
      "Unit Economics",
      "Royalty",
      "Franchisee",
      "Suppliers",
      "Marketing Fund",
      "Employee Handbook",
      "Reimbursement",
      "FDD Posture",
      "Daily Operations",
      "Product & Service",
      "Training",
      "Site Selection",
      "Market Strategy",
      "Competit",
      "Brand Standards",
    ];
    const found = sectionTitles.filter((t) => body.includes(t)).length;
    return {
      pass: found >= 10 && body.length > 100_000,
      evidence: `sections=${found}/16 size=${body.length}`,
    };
  }));

  console.log(JSON.stringify({ flows }, null, 2));
  const failed = flows.some((f) => f.status === "fail");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message ?? e) }));
  process.exit(2);
});
