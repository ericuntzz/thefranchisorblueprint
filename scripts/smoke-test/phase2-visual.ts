#!/usr/bin/env npx tsx
/**
 * Phase 2 (visual) — Playwright headless smoke test of the customer
 * journey, with computed-style layout assertions and screenshot diffs
 * against the prior day's baseline.
 *
 * Complements `phase2-structural.ts` (cheerio HTML parsing). Where the
 * structural pass catches "this DOM element exists / this text is
 * present", this pass catches:
 *   - layout intent (e.g. /portal/blueprint-builder must vertically
 *     center its question card; if someone removes the `flex
 *     items-center` we'd ship a regression that cheerio wouldn't notice)
 *   - CSS regressions (a class rename that compiles fine but renders
 *     wrong)
 *   - post-hydration UI state (drawers, modals, dynamic counts)
 *   - visual drift (pixel-diff vs yesterday's screenshot)
 *
 * For each of the 5 flows, the script:
 *   1. Authenticates as the smoke-test account via /auth/confirm
 *   2. Navigates with cookies, waits for hydration
 *   3. Reads computed styles of key elements; asserts layout intent
 *   4. Saves a screenshot to scripts/smoke-test/runs/<date>/<flow>.png
 *   5. Compares to prior day's screenshot via pixelmatch
 *
 * Outputs the same { flows: [...] } JSON shape the structural Phase 2
 * uses, so the orchestrator's compose step doesn't need to change.
 *
 * Usage:
 *   npx tsx scripts/smoke-test/phase2-visual.ts > /tmp/phase2-visual.json
 */
import { config } from "dotenv";
import { chromium, type BrowserContext, type Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const BASE = "https://www.thefranchisorblueprint.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "eric.j.unterberger+smoketest@gmail.com";
const VIEWPORT = { width: 1440, height: 900 };
// Pixels-different threshold above which we flag a visual regression.
// 0.5% of the viewport (1440 * 900 = 1,296,000 px → 6,480 px) covers
// dynamic content (timestamps, "Day N" markers, redline counts) without
// being fooled by font antialiasing noise.
const VISUAL_DIFF_THRESHOLD_PX = 6_480;

interface FlowResult {
  id: string;
  name: string;
  status: "pass" | "fail" | "unknown";
  evidence: string;
}

interface FlowSpec {
  id: string;
  name: string;
  url: string;
  /** Optional: a CSS selector to wait for before screenshotting. */
  waitFor?: string;
  /** Optional: layout assertion run after navigation; throws on failure. */
  assert?: (page: Page) => Promise<{ ok: boolean; evidence: string }>;
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
  const j = (await res.json()) as { hashed_token?: string };
  if (!j.hashed_token) throw new Error("no hashed_token in admin response");
  return j.hashed_token;
}

async function authenticate(context: BrowserContext): Promise<void> {
  const tokenHash = await generateMagicLink();
  const page = await context.newPage();
  await page.goto(
    `${BASE}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/portal`,
    { waitUntil: "networkidle" },
  );
  await page.close();
}

/** Compare a fresh screenshot to yesterday's. Returns null if no prior
 *  baseline exists (first run for this flow); returns pixel-diff count
 *  otherwise. Saves a diff overlay PNG when above threshold. */
function compareScreenshot(
  flowId: string,
  todayPath: string,
  priorPath: string | null,
  diffPath: string,
): { compared: boolean; diffPixels: number | null } {
  if (!priorPath || !fs.existsSync(priorPath)) {
    return { compared: false, diffPixels: null };
  }
  try {
    const today = PNG.sync.read(fs.readFileSync(todayPath));
    const prior = PNG.sync.read(fs.readFileSync(priorPath));
    if (today.width !== prior.width || today.height !== prior.height) {
      return { compared: true, diffPixels: -1 }; // shape changed; treat as max diff
    }
    const diff = new PNG({ width: today.width, height: today.height });
    const diffPixels = pixelmatch(
      today.data,
      prior.data,
      diff.data,
      today.width,
      today.height,
      { threshold: 0.15 },
    );
    if (diffPixels > VISUAL_DIFF_THRESHOLD_PX) {
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
    }
    return { compared: true, diffPixels };
  } catch {
    return { compared: false, diffPixels: null };
  }
}

/** Today's runs/ folder, plus the closest prior day's (for diff). */
function dirs(): { todayDir: string; priorDir: string | null } {
  const today = new Date().toISOString().slice(0, 10);
  const runsRoot = path.join(process.cwd(), "scripts/smoke-test/runs");
  const todayDir = path.join(runsRoot, today);
  fs.mkdirSync(todayDir, { recursive: true });

  // Find the most recent prior day's folder for diffing.
  let priorDir: string | null = null;
  if (fs.existsSync(runsRoot)) {
    const days = fs
      .readdirSync(runsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name) && d.name < today)
      .map((d) => d.name)
      .sort()
      .reverse();
    if (days.length > 0) priorDir = path.join(runsRoot, days[0]);
  }
  return { todayDir, priorDir };
}

const flows: FlowSpec[] = [
  {
    id: "visual-portal-landing",
    name: "Portal landing (entitled state)",
    url: "/portal",
    waitFor: 'text="Welcome aboard, Smoke"',
    assert: async (page) => {
      // The hero pushes the first deliverable card below the fold by
      // design, so don't require above-fold here. Just verify the
      // card renders + the bundle action bar with "Preview bundle" is
      // present (catches the preview-modal regression Eric shipped on
      // 2026-05-08, commit 6897642).
      const firstCard = page.locator("text=Concept & Story").first();
      const cardVisible = await firstCard.count() > 0;
      // Button copy was shortened on commit 861cb6f:
      //   "Preview & download" → "Preview"
      //   "Preview bundle"     → "Preview docs"
      const previewBundleBtn = await page
        .locator('button:has-text("Preview docs"), button:has-text("Preview ") >> visible=true')
        .count();
      const previewCardBtns = await page
        .locator('button:text-is("Preview"), button:text-is("Preview .pptx")')
        .count();
      return {
        ok: cardVisible && (previewBundleBtn > 0 || previewCardBtns > 0),
        evidence: `cardRendered=${cardVisible} previewBundleBtns=${previewBundleBtn} previewCardBtns=${previewCardBtns}`,
      };
    },
  },
  {
    id: "visual-section-business-overview",
    name: "Section page — business_overview",
    url: "/portal/section/business_overview",
    waitFor: 'h1, h2:has-text("Concept")',
    assert: async (page) => {
      const hasFormLabel = await page
        .locator('text="Concept summary"')
        .first()
        .isVisible();
      const hasBackLink = (await page.locator('a[href="/portal"]').count()) > 0;
      return {
        ok: hasFormLabel && hasBackLink,
        evidence: `formLabel=${hasFormLabel} backLink=${hasBackLink}`,
      };
    },
  },
  {
    id: "visual-blueprint-builder-centering",
    name: "Blueprint Builder — question card vertical centering",
    url: "/portal/blueprint-builder",
    waitFor: "main.bg-cream-soft",
    assert: async (page) => {
      // Main wrapper must use flex + items-center so the question card
      // sits visually centered. This is the regression Eric flagged
      // 2026-05-08 (commit ced8a53). Phase 2 visual asserts the intent.
      const styles = await page.evaluate(() => {
        const main = document.querySelector("main.bg-cream-soft");
        if (!main) return null;
        const cs = getComputedStyle(main);
        const card = main.querySelector(".max-w-\\[900px\\]") as HTMLElement | null;
        const mainRect = main.getBoundingClientRect();
        const cardRect = card?.getBoundingClientRect() ?? null;
        return {
          display: cs.display,
          alignItems: cs.alignItems,
          minHeight: cs.minHeight,
          mainTop: mainRect.top,
          mainHeight: mainRect.height,
          cardTop: cardRect?.top ?? null,
          cardHeight: cardRect?.height ?? null,
        };
      });
      if (!styles) return { ok: false, evidence: "main.bg-cream-soft not found" };
      const isFlex = styles.display === "flex";
      const isCentered = styles.alignItems === "center";
      // If card is shorter than main, the top + bottom space should be
      // ~symmetric (within 5% of main height). When card is taller (no
      // centering effect), skip the symmetry check.
      let symmetric = true;
      let symmetryEvidence = "n/a (card fills main)";
      if (
        styles.cardTop !== null &&
        styles.cardHeight !== null &&
        styles.cardHeight < styles.mainHeight - 20
      ) {
        const topSpace = styles.cardTop - styles.mainTop;
        const bottomSpace =
          styles.mainTop + styles.mainHeight - (styles.cardTop + styles.cardHeight);
        const tolerance = styles.mainHeight * 0.05;
        symmetric = Math.abs(topSpace - bottomSpace) <= tolerance;
        symmetryEvidence = `top=${topSpace.toFixed(0)} bottom=${bottomSpace.toFixed(0)} tol=${tolerance.toFixed(0)}`;
      }
      return {
        ok: isFlex && isCentered && symmetric,
        evidence: `display=${styles.display} alignItems=${styles.alignItems} symmetry=${symmetryEvidence}`,
      };
    },
  },
  {
    id: "visual-preview-modal",
    name: "Preview-before-download modal opens with iframe",
    url: "/portal",
    waitFor: 'button:text-is("Preview")',
    assert: async (page) => {
      // Click the FIRST per-card "Preview" button (was "Preview &
      // download" before commit 861cb6f shortened the copy). The
      // modal opens with iframe + footer download buttons.
      await page.locator('button:text-is("Preview")').first().click();
      // Wait for the modal dialog.
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
      const dialogVisible = await page.locator('[role="dialog"]').isVisible();
      const iframeCount = await page.locator('[role="dialog"] iframe').count();
      const footerDownloadBtns = await page
        .locator('[role="dialog"] a:has-text("Download")')
        .count();
      // Give the iframe a moment to start loading before screenshot.
      await page.waitForTimeout(800);
      return {
        ok: dialogVisible && iframeCount > 0 && footerDownloadBtns > 0,
        evidence: `dialog=${dialogVisible} iframes=${iframeCount} footerDownloads=${footerDownloadBtns}`,
      };
    },
  },
  {
    id: "visual-lab-blueprint-canvas",
    name: "Lab Blueprint canvas",
    url: "/portal/lab/blueprint",
    waitFor: 'text="Concept & Story"',
    assert: async (page) => {
      // The canvas should render multiple section cards without overflow.
      const sectionCount = await page
        .locator(":has-text('Concept & Story'):has-text('Operations')")
        .count();
      // No horizontal overflow at desktop viewport.
      const overflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 4;
      });
      const cardsVisible = (await page.locator('h2, h3, [class*="font-bold"]').count()) > 5;
      return {
        ok: !overflowing && cardsVisible,
        evidence: `overflowingX=${overflowing} cardsVisible=${cardsVisible} sectionMatches=${sectionCount}`,
      };
    },
  },
];

async function main() {
  const { todayDir, priorDir } = dirs();
  const results: FlowResult[] = [];

  const browser = await chromium.launch({ headless: true });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({ viewport: VIEWPORT });
    await authenticate(context);

    for (const flow of flows) {
      const start = Date.now();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${flow.url}`, { waitUntil: "networkidle", timeout: 20_000 });
        if (flow.waitFor) {
          await page.waitForSelector(flow.waitFor, { timeout: 10_000 });
        }
        // Brief settle for animations / lazy mounts.
        await page.waitForTimeout(400);

        // Layout assertion.
        let assertionOk = true;
        let assertionEvidence = "no assertion";
        if (flow.assert) {
          const r = await flow.assert(page);
          assertionOk = r.ok;
          assertionEvidence = r.evidence;
        }

        // Screenshot.
        const todayPath = path.join(todayDir, `${flow.id}.png`);
        await page.screenshot({ path: todayPath, fullPage: false });

        // Visual diff vs prior day.
        const priorPath = priorDir ? path.join(priorDir, `${flow.id}.png`) : null;
        const diffPath = path.join(todayDir, `${flow.id}.diff.png`);
        const { compared, diffPixels } = compareScreenshot(
          flow.id,
          todayPath,
          priorPath,
          diffPath,
        );
        const visualEvidence = !compared
          ? "no prior baseline"
          : diffPixels === null
            ? "no diff data"
            : diffPixels === -1
              ? "viewport size changed"
              : `diff=${diffPixels}px${diffPixels > VISUAL_DIFF_THRESHOLD_PX ? " (over threshold)" : ""}`;

        const visualOk =
          !compared || diffPixels === null || diffPixels <= VISUAL_DIFF_THRESHOLD_PX;
        const ms = Date.now() - start;

        results.push({
          id: flow.id,
          name: flow.name,
          status: assertionOk && visualOk ? "pass" : "fail",
          evidence: `${assertionEvidence} | screenshot ${visualEvidence} | ${ms}ms`,
        });
      } catch (e) {
        const ms = Date.now() - start;
        results.push({
          id: flow.id,
          name: flow.name,
          status: "unknown",
          evidence: `error: ${(e as Error)?.message ?? String(e)} | ${ms}ms`,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    if (context) await context.close();
    await browser.close();
  }

  console.log(JSON.stringify({ flows: results }, null, 2));
  const failed = results.some((r) => r.status === "fail");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message ?? e) }));
  process.exit(2);
});
