#!/usr/bin/env npx tsx
/**
 * QA pass on /portal/blueprint-builder card-loading + progress UI.
 *
 * Scenarios Eric flagged 2026-05-10:
 *   1. "Loading stat issues when I click between cards" — progress bar
 *      / phase header / ANSWERED counter not refreshing cleanly between
 *      Save&Next clicks.
 *   2. "Issues with the loading bars when I leave the page and come
 *      back" — same indicators stale after navigating away and back.
 *
 * Strategy: walk 6 cards as the smoke-test user, capture state at each
 * step, then leave + return and compare. Screenshots at every step go
 * under scripts/qa/<timestamp>/ for human review. The summary table at
 * the end flags any state discrepancies.
 *
 * Doesn't COMMIT — pure QA. Writes screenshots + a JSON state log.
 *
 * Usage: npx tsx scripts/qa-builder-cards.ts
 */
import { config } from "dotenv";
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const BASE = "https://www.thefranchisorblueprint.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "eric.j.unterberger+smoketest@gmail.com";

const RUN_DIR = path.join(
  process.cwd(),
  "scripts/qa",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
);
fs.mkdirSync(RUN_DIR, { recursive: true });

interface Snapshot {
  label: string;
  url: string;
  at: string | null;
  // What the customer SEES at the top of the page:
  phaseEyebrow: string | null; // "ECONOMICS PHASE"
  phaseTitle: string | null; // "Economics"
  phaseSummary: string | null; // "Unit economics + the franchisee's investment math."
  answeredCount: string | null; // "1 / 7"
  // Progress segments at top of the page (the small horizontal bars)
  segments: Array<{ filled: number; total: number }>;
  // Current question card:
  questionCategory: string | null; // "ROYALTY, AD FUND & FEES"
  questionLabel: string | null; // "What percentage of sales goes to..."
  inputValue: string | null;
  inputPlaceholder: string | null;
  // Buttons available:
  hasSaveAndNext: boolean;
  hasBack: boolean;
  hasSkip: boolean;
  // Whether a loading spinner is visible (in any form)
  hasLoadingIndicator: boolean;
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
  if (!j.hashed_token) throw new Error("no hashed_token");
  return j.hashed_token;
}

async function captureSnapshot(page: Page, label: string): Promise<Snapshot> {
  // Read DOM into a structured snapshot. All locators wrapped so a
  // missing element produces null instead of crashing the QA run.
  // Pass a stringified script to evaluate so tsx's __name decorators
  // don't leak into the browser context. Pure inline DOM queries, no
  // arrow-function helpers, no TS-isms.
  const data = (await page.evaluate(`(function() {
    var navyHeader = null;
    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      if (d.className && d.className.indexOf('bg-navy') >= 0 && d.textContent && /PHASE/i.test(d.textContent)) {
        navyHeader = d; break;
      }
    }
    var phaseEyebrow = null, phaseTitle = null, phaseSummary = null, answeredCount = null;
    if (navyHeader) {
      var eyebrowEl = navyHeader.querySelector('[class*="uppercase"]');
      phaseEyebrow = eyebrowEl && eyebrowEl.textContent ? eyebrowEl.textContent.trim() : null;
      var titleEl = navyHeader.querySelector('h1, h2');
      phaseTitle = titleEl && titleEl.textContent ? titleEl.textContent.trim() : null;
      var pEl = navyHeader.querySelector('p');
      phaseSummary = pEl && pEl.textContent ? pEl.textContent.trim() : null;
      var m = /(\\d+)\\s*\\/\\s*(\\d+)/.exec(navyHeader.textContent || '');
      answeredCount = m ? (m[1] + ' / ' + m[2]) : null;
    }

    // Progress segments — find first flex row whose kids all look like bars.
    var segments = [];
    var flexEls = document.querySelectorAll('[class*="flex"]');
    for (var f = 0; f < flexEls.length; f++) {
      var el = flexEls[f];
      var kids = el.children;
      if (kids.length < 4) continue;
      var allBarLike = true;
      for (var k = 0; k < kids.length; k++) {
        var cn = kids[k].className || '';
        if (!/h-[0-9]|rounded|w-full/.test(cn)) { allBarLike = false; break; }
      }
      if (!allBarLike) continue;
      var filled = 0;
      for (var k2 = 0; k2 < kids.length; k2++) {
        if (kids[k2].querySelector('[class*="bg-gold"], [class*="bg-emerald"]')) filled++;
      }
      segments.push({ filled: filled, total: kids.length });
      break;
    }

    // Question card category eyebrow (e.g. "ROYALTY, AD FUND & FEES").
    var cardCategory = null;
    var ucEls = document.querySelectorAll('[class*="uppercase"]');
    for (var u = 0; u < ucEls.length; u++) {
      var t = (ucEls[u].textContent || '').trim();
      if (t.length > 3 && !/PHASE|ANSWERED|BACK|SKIP|SAVE|UPLOAD|DROP|PDF|DOC/i.test(t)) {
        cardCategory = t; break;
      }
    }
    var cardTitleEl = document.querySelector('h2, h3');
    var cardTitle = cardTitleEl && cardTitleEl.textContent ? cardTitleEl.textContent.trim() : null;

    var inputEl = document.querySelector('textarea, input[type=text], input[type=number], input:not([type])');
    var inputValue = inputEl ? inputEl.value : null;
    var inputPlaceholder = inputEl ? inputEl.placeholder : null;

    var hasSaveAndNext = false, hasBack = false, hasSkip = false;
    var btns = document.querySelectorAll('button, a');
    for (var b = 0; b < btns.length; b++) {
      var bt = (btns[b].textContent || '').trim().toLowerCase();
      if (bt.indexOf('save & next') >= 0 || bt.indexOf('save and next') >= 0) hasSaveAndNext = true;
      if (bt === 'back' || bt.indexOf('back ') === 0) hasBack = true;
      if (bt.indexOf('skip for now') >= 0 || bt === 'skip') hasSkip = true;
    }
    var hasLoadingIndicator = document.querySelectorAll('[class*="animate-spin"]').length > 0;
    var atParam = new URL(window.location.href).searchParams.get('at');
    return {
      url: window.location.href,
      at: atParam,
      phaseEyebrow: phaseEyebrow,
      phaseTitle: phaseTitle,
      phaseSummary: phaseSummary,
      answeredCount: answeredCount,
      segments: segments,
      questionCategory: cardCategory,
      questionLabel: cardTitle,
      inputValue: inputValue,
      inputPlaceholder: inputPlaceholder,
      hasSaveAndNext: hasSaveAndNext,
      hasBack: hasBack,
      hasSkip: hasSkip,
      hasLoadingIndicator: hasLoadingIndicator
    };
  })()`)) as Omit<Snapshot, "label">;

  const snap: Snapshot = { label, ...data };

  // Screenshot scoped to viewport (not full page) for size economy.
  const shotPath = path.join(RUN_DIR, `${label}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  return snap;
}

async function authenticate(page: Page): Promise<void> {
  const t = await generateMagicLink();
  await page.goto(`${BASE}/auth/confirm?token_hash=${t}&type=magiclink&next=/portal`, {
    waitUntil: "networkidle",
  });
}

async function clickSaveAndNext(page: Page): Promise<void> {
  // The button label has uppercase styling but the textContent is mixed.
  // Match either case.
  const btn = page
    .locator("button:has-text('Save & Next'), button:has-text('SAVE & NEXT')")
    .first();
  await btn.click();
}

async function fillCurrent(page: Page, value: string): Promise<void> {
  const input = page
    .locator("textarea, input[type=text], input[type=number], input:not([type])")
    .first();
  await input.click();
  await input.fill(value);
  // Brief settle so any debounced sync (URL, localStorage) catches up.
  await page.waitForTimeout(200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const snaps: Snapshot[] = [];
  const runStart = Date.now();

  try {
    console.log(`QA run dir: ${RUN_DIR}`);
    console.log("Authenticating...");
    await authenticate(page);

    console.log("\n=== STEP 1: Land on /portal/blueprint-builder fresh ===");
    await page.goto(`${BASE}/portal/blueprint-builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    snaps.push(await captureSnapshot(page, "01-initial-landing"));

    console.log("\n=== STEPS 2–7: Save & Next through 6 cards ===");
    for (let i = 0; i < 6; i++) {
      const label = `0${i + 2}-card-${i + 1}`;
      console.log(`  card ${i + 1}: typing + clicking Save & Next`);
      try {
        // Type a sane value depending on input type.
        const inputType = await page.evaluate(() => {
          const el = document.querySelector(
            "textarea, input[type=text], input[type=number], input:not([type])",
          ) as HTMLInputElement | null;
          return el?.type ?? "text";
        });
        const value = inputType === "number" ? `${i + 1}` : `QA card ${i + 1} answer`;
        await fillCurrent(page, value);
        // Snapshot BEFORE clicking Save&Next so we capture the typed-but-
        // not-saved state.
        snaps.push(await captureSnapshot(page, `${label}-before-save`));
        await clickSaveAndNext(page);
        // Wait for the URL ?at= to change OR for a new card to render.
        await page.waitForTimeout(1500);
        snaps.push(await captureSnapshot(page, `${label}-after-save`));
      } catch (e) {
        console.error(`    ✗ card ${i + 1} failed: ${(e as Error).message?.slice(0, 100)}`);
        snaps.push(await captureSnapshot(page, `${label}-error`));
        break;
      }
    }

    console.log("\n=== STEP 8: Leave the page (navigate to /portal) ===");
    await page.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    snaps.push(await captureSnapshot(page, "08-on-dashboard"));

    console.log("\n=== STEP 9: Return via bare /portal/blueprint-builder URL ===");
    await page.goto(`${BASE}/portal/blueprint-builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    snaps.push(await captureSnapshot(page, "09-after-return"));

    console.log("\n=== STEP 10: Click Back, then return again ===");
    try {
      const backBtn = page.locator("button:has-text('Back')").first();
      if ((await backBtn.count()) > 0) {
        await backBtn.click();
        await page.waitForTimeout(800);
        snaps.push(await captureSnapshot(page, "10-after-back"));
      } else {
        console.log("  (no Back button visible — skipping)");
      }
    } catch (e) {
      console.error(`  Back failed: ${(e as Error).message?.slice(0, 100)}`);
    }
  } finally {
    await ctx.close();
    await browser.close();
  }

  // Write the snapshot log.
  const logPath = path.join(RUN_DIR, "snapshots.json");
  fs.writeFileSync(logPath, JSON.stringify(snaps, null, 2));

  // Compact summary.
  console.log("\n\n=== SUMMARY (each step's key state) ===");
  for (const s of snaps) {
    const seg = s.segments[0]
      ? `seg=${s.segments[0].filled}/${s.segments[0].total}`
      : "seg=?";
    console.log(
      `  ${s.label.padEnd(28)}  ${(s.phaseEyebrow ?? "?").padEnd(20)}  ${(s.answeredCount ?? "?").padEnd(8)}  ${seg.padEnd(12)}  q="${(s.questionLabel ?? "?").slice(0, 50)}"  at=${s.at ?? "?"}`,
    );
  }
  console.log(`\nFull JSON + screenshots: ${RUN_DIR}`);
  console.log(`Total time: ${((Date.now() - runStart) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("QA run crashed:", e?.message ?? e);
  process.exit(1);
});
