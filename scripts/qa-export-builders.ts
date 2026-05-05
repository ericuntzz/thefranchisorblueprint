/**
 * QA harness — runs every deliverable builder against an empty
 * BuildContext to catch shape-mismatches at compile-or-runtime.
 *
 * This is NOT a render pass — we don't actually emit DOCX/PPTX bytes
 * because that requires the docx + pptxgenjs runtime + filesystem.
 * We only call `def.build(ctx)` for each deliverable so any "field
 * doesn't exist" / "schema mismatch" / "undefined.split()" bug
 * surfaces immediately.
 *
 * Run with:  npx tsx scripts/qa-export-builders.ts
 */

import { DELIVERABLES, DELIVERABLE_DISPLAY_ORDER } from "../src/lib/export/deliverables";
import type { BuildContext } from "../src/lib/export/types";

const emptyCtx: BuildContext = {
  userId: "qa-test-user",
  memory: {},
  computed: {},
  profile: {
    fullName: "QA Test",
    email: "qa@thefranchisorblueprint.com",
    websiteUrl: null,
  },
  generatedAt: new Date().toISOString(),
  readinessPct: 0,
};

let failed = 0;
for (const id of DELIVERABLE_DISPLAY_ORDER) {
  const def = DELIVERABLES[id];
  if (!def) {
    console.error(`[qa] ${id} — MISSING from registry`);
    failed += 1;
    continue;
  }
  try {
    const out = def.build(emptyCtx);
    if (def.kind === "doc") {
      const sections = out && "sections" in out ? out.sections.length : 0;
      console.log(`[qa] ${id} — ok (${sections} sections)`);
    } else {
      const slides = out && "slides" in out ? out.slides.length : 0;
      console.log(`[qa] ${id} — ok (${slides} slides)`);
    }
  } catch (err) {
    failed += 1;
    console.error(`[qa] ${id} — FAILED:`, err instanceof Error ? err.message : err);
  }
}
console.log(`\n${failed === 0 ? "✓" : "✗"} ${DELIVERABLE_DISPLAY_ORDER.length - failed} / ${DELIVERABLE_DISPLAY_ORDER.length} builders pass`);
process.exit(failed === 0 ? 0 : 1);
