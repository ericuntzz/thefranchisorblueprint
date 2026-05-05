/**
 * Export endpoint.
 *
 * GET /api/agent/export/[deliverable]?format=docx|md
 *
 * Auth: must be logged in + have at least one paid purchase. Tier
 * gating is intentionally NOT applied right now — every paid customer
 * can export every deliverable. We can layer a Tier 2/3 gate here
 * later if the product moves that direction; for V1, "you paid, you
 * download" keeps the experience simple.
 *
 * Format default: docx (the customer-friendly path). md is exposed for
 * the in-portal preview screen and for power users who want to copy/
 * paste sections elsewhere.
 *
 * Filename: `{filenameStem}-{businessName}-{YYYY-MM-DD}.{ext}` so
 * customers can keep multiple exports straight in Downloads.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getDeliverable,
  isValidDeliverableId,
} from "@/lib/export/deliverables";
import { loadBuildContext } from "@/lib/export/load";
import { renderDocx } from "@/lib/export/render-docx";
import { renderMarkdown } from "@/lib/export/render-md";
import { renderPptx } from "@/lib/export/render-pptx";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deliverable: string }> },
) {
  const { deliverable: deliverableId } = await params;

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

  // Validate deliverable id + format.
  if (!isValidDeliverableId(deliverableId)) {
    return NextResponse.json({ error: "Unknown deliverable" }, { status: 404 });
  }
  const def = getDeliverable(deliverableId);
  if (!def) {
    return NextResponse.json({ error: "Unknown deliverable" }, { status: 404 });
  }

  const url = new URL(req.url);
  // Default format: pptx for slide deliverables, docx for everything else.
  const defaultFormat = def.kind === "slides" ? "pptx" : "docx";
  const formatRaw = url.searchParams.get("format") ?? defaultFormat;
  if (formatRaw !== "docx" && formatRaw !== "md" && formatRaw !== "pptx") {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }
  if (!(def.formats as readonly string[]).includes(formatRaw)) {
    return NextResponse.json(
      { error: `Format ${formatRaw} not available for this deliverable` },
      { status: 400 },
    );
  }

  // Build the deliverable.
  let buffer: Buffer;
  let contentType: string;
  let extension: string;
  try {
    const ctx = await loadBuildContext(user.id);
    if (def.kind === "slides") {
      const deck = def.build(ctx);
      buffer = await renderPptx(deck);
      contentType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      extension = "pptx";
    } else {
      const doc = def.build(ctx);
      if (formatRaw === "docx") {
        buffer = await renderDocx(doc);
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        extension = "docx";
      } else {
        const md = renderMarkdown(doc);
        buffer = Buffer.from(md, "utf-8");
        contentType = "text/markdown; charset=utf-8";
        extension = "md";
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[export] build failed for ${deliverableId}:`,
      message,
      err instanceof Error ? `\n${err.stack}` : "",
    );
    return NextResponse.json(
      { error: "Export failed", detail: message },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `${def.filenameStem}-${today}.${extension}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
