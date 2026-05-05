/**
 * Bundle export endpoint.
 *
 * POST /api/agent/export/bundle
 *   body: { deliverableIds: DeliverableId[] }
 *   returns: ZIP file containing one file per requested deliverable
 *
 * The customer picks N deliverables via checkboxes in the exports UI;
 * this endpoint builds each one in its native format (DOCX for docs,
 * PPTX for slides) and zips them together. The ZIP also includes a
 * `_README.md` cover page enumerating each deliverable's readiness %
 * so the recipient (typically an attorney) can scan readiness at a
 * glance before opening any individual file.
 *
 * Auth: must be logged in + paid. Tier gating is intentionally absent
 * for v1 — every paid customer can bundle every deliverable.
 *
 * Why POST not GET: the request body carries an array of selected
 * deliverable ids; query strings get unwieldy at 14+ items, and
 * browsers handle POST → ZIP attachments natively.
 */

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  DELIVERABLES,
  isValidDeliverableId,
} from "@/lib/export/deliverables";
import { loadBuildContext } from "@/lib/export/load";
import { renderDocx } from "@/lib/export/render-docx";
import { renderPptx } from "@/lib/export/render-pptx";
import { reviewDeliverable } from "@/lib/export/deliverable-readiness";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
// Bundling 17 deliverables can take a beat; bump above the default 10s
// generous to handle worst-case (every deliverable selected).
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Auth + paid-purchase gate.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }

  // Parse + validate body.
  let body: { deliverableIds?: unknown };
  try {
    body = (await req.json()) as { deliverableIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.deliverableIds) || body.deliverableIds.length === 0) {
    return NextResponse.json(
      { error: "deliverableIds must be a non-empty array" },
      { status: 400 },
    );
  }
  const requestedIds = body.deliverableIds.filter(
    (x): x is string => typeof x === "string",
  );
  const validIds = requestedIds.filter(isValidDeliverableId);
  if (validIds.length === 0) {
    return NextResponse.json(
      { error: "No valid deliverable ids in request" },
      { status: 400 },
    );
  }

  // Build the bundle.
  let zipBuffer: Buffer;
  try {
    const ctx = await loadBuildContext(user.id);
    const zip = new JSZip();

    // Build each requested deliverable in parallel — they're pure
    // functions over the same context, so no race risk.
    const builds = await Promise.all(
      validIds.map(async (id) => {
        const def = DELIVERABLES[id];
        if (!def) return null;
        const review = reviewDeliverable(def, ctx);
        if (def.kind === "slides") {
          const deck = def.build(ctx);
          const buf = await renderPptx(deck);
          return {
            id,
            filename: `${def.filenameStem}.pptx`,
            content: buf,
            review,
            name: def.name,
          };
        }
        const doc = def.build(ctx);
        const buf = await renderDocx(doc);
        return {
          id,
          filename: `${def.filenameStem}.docx`,
          content: buf,
          review,
          name: def.name,
        };
      }),
    );

    // Cover README listing every file + readiness pct.
    const readme = buildBundleReadme({
      builds: builds.filter((b): b is NonNullable<typeof b> => b !== null),
      ctx,
    });
    zip.file("_README.md", readme);

    for (const b of builds) {
      if (!b) continue;
      zip.file(b.filename, b.content);
    }

    zipBuffer = (await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })) as Buffer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[export-bundle] build failed for user ${user.id}:`,
      message,
      err instanceof Error ? `\n${err.stack}` : "",
    );
    return NextResponse.json(
      { error: "Bundle export failed", detail: message },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `Franchisor-Blueprint-Bundle-${today}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Render the bundle's _README.md cover. Plain markdown — opens cleanly
 * in any editor / viewer the recipient might use, including GitHub /
 * Notion / VS Code / Obsidian.
 */
function buildBundleReadme(args: {
  builds: Array<{
    id: string;
    filename: string;
    name: string;
    review: ReturnType<typeof reviewDeliverable>;
  }>;
  ctx: Awaited<ReturnType<typeof loadBuildContext>>;
}): string {
  const { builds, ctx } = args;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [];
  lines.push(`# The Franchisor Blueprint — Bundle Export`);
  lines.push("");
  lines.push(`**Generated:** ${today}`);
  if (ctx.profile.fullName) {
    lines.push(`**Customer:** ${ctx.profile.fullName} (${ctx.profile.email})`);
  } else {
    lines.push(`**Customer:** ${ctx.profile.email}`);
  }
  lines.push(`**Overall Blueprint readiness:** ${ctx.readinessPct}%`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "This bundle contains the deliverables selected by the customer at export time. Each file's cover page restates its individual readiness percentage; weak chapters are flagged inside.",
  );
  lines.push("");
  lines.push("## Files in this bundle");
  lines.push("");
  lines.push("| File | Deliverable | Readiness |");
  lines.push("| --- | --- | --- |");
  for (const b of builds) {
    lines.push(
      `| \`${b.filename}\` | ${b.name} | ${b.review.overallPct}% |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## How to use this bundle");
  lines.push("");
  lines.push(
    "Most files are Word documents (`.docx`). The Discovery Day deck (if included) is a PowerPoint file (`.pptx`). All files were generated from the customer's structured Blueprint Memory — re-running the export after the customer makes changes will regenerate updated files.",
  );
  lines.push("");
  lines.push(
    "Sections marked `[NEEDS ATTORNEY REVIEW]` (especially in the Franchise Agreement template) require finalization by franchise counsel before use.",
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "_Generated by [The Franchisor Blueprint](https://thefranchisorblueprint.com). This document is not legal advice._",
  );
  return lines.join("\n");
}
