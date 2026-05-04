/**
 * Per-chapter attachment endpoint.
 *
 * POST  /api/agent/chapter-attachment
 *   - multipart/form-data with `slug` + `file` → upload + record
 *   - application/json `{ slug, url, label? }` → link save (lightly
 *     scrapes the URL for an excerpt the agent can read)
 *
 * DELETE /api/agent/chapter-attachment
 *   - JSON `{ slug, attachmentId }` → remove the attachment row and
 *     (for files) the underlying storage object
 *
 * Auth: must be logged in + have at least one paid purchase.
 *
 * Storage convention: `customer-uploads/{user_id}/{slug}/{uuid}-{filename}`.
 * The user-id-prefix is enforced by the bucket's RLS policy (only
 * objects under the caller's own folder are readable/writeable).
 *
 * What the agent does with attachments: when `draftChapter()` runs, it
 * reads `customer_memory.attachments` and includes labels + excerpts
 * in Opus's prompt context so chapters drafted after the attachment is
 * added incorporate the new material.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  appendAttachment,
  deleteAttachment,
  isValidMemoryFileSlug,
} from "@/lib/memory";
import { fetchSiteArtifacts } from "@/lib/agent/scrape";
import { extractDocText } from "@/lib/agent/extract-doc-text";
import { classifyAttachmentToChapters } from "@/lib/agent/classify-attachment";
import type { ChapterAttachment, Purchase } from "@/lib/supabase/types";
import type { MemoryFileSlug } from "@/lib/memory/files";

export const runtime = "nodejs";
// File uploads can be a few MB; allow a longer window than the default 10s.
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB cap — arbitrary but generous
const TEXTLIKE_MIME = /^(text\/|application\/(json|xml|markdown|x-yaml|x-toml))/;

/**
 * Auth + paid-purchase gate. Returns the user id on success, or a
 * NextResponse to short-circuit the request with the right error.
 */
async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; res: NextResponse }
> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return {
      ok: false,
      res: NextResponse.json({ error: "No active purchase" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.id };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const userId = auth.userId;

  const contentType = req.headers.get("content-type") ?? "";

  // ---- File upload branch ----------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const slug = form.get("slug");
    const file = form.get("file");
    // `autoClassify=true` opts into Sonnet-driven multi-chapter
    // routing. The intake flow sends this flag so a doc dropped on
    // the Operations step can also fan out to recipes_and_menu /
    // training_program / etc. when relevant. The per-chapter
    // attachment composer leaves this off so a file dropped on a
    // specific chapter stays scoped there.
    const autoClassifyRaw = form.get("autoClassify");
    const autoClassify =
      autoClassifyRaw === "true" || autoClassifyRaw === "1";
    if (typeof slug !== "string" || !isValidMemoryFileSlug(slug)) {
      return NextResponse.json(
        { error: `Invalid or missing slug` },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }

    // Generate a stable id + a safe storage path. Keep the original
    // filename in the path (after a uuid prefix) so the customer can
    // recognize their own uploads in the bucket if they ever look.
    const id = mintAttachmentId();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const path = `${userId}/${slug}/${id}-${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const admin = getSupabaseAdmin();
    const { error: uploadErr } = await admin.storage
      .from("customer-uploads")
      .upload(path, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      console.error("[chapter-attachment] storage upload failed:", uploadErr);
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 },
      );
    }

    // Best-effort excerpt extraction.
    //   - Text-like files (.txt, .md, .json, .csv): read buffer
    //     directly. Cap at 2K chars; small docs land entirely in
    //     the prompt.
    //   - PDF/DOCX: run through pdf-parse / mammoth. ~12K char cap.
    //     Failure → placeholder.
    //   - Everything else (images, opaque binaries, etc.): placeholder.
    let excerpt: string | null = null;
    if (TEXTLIKE_MIME.test(file.type) || /\.(txt|md|markdown|csv|json)$/i.test(file.name)) {
      const text = buf.toString("utf-8");
      excerpt = text.slice(0, 2000);
    } else {
      const extracted = await extractDocText({
        buffer: buf,
        mimeType: file.type || null,
        fileName: file.name,
      });
      if (extracted) {
        excerpt = extracted;
      } else {
        excerpt = `(${file.type || "binary file"} attached — content not yet ingested by the agent.)`;
      }
    }

    const attachment: ChapterAttachment = {
      id,
      kind: "file",
      ref: path,
      label: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      excerpt,
      created_at: new Date().toISOString(),
    };

    await appendAttachment({ userId, slug, attachment });

    // Auto-classification fan-out — only when explicitly opted-in.
    // The Sonnet call is best-effort; failure here is not surfaced
    // to the customer (the primary attachment already landed). We
    // attach the SAME ChapterAttachment object to each additional
    // slug — one logical document, multiple chapter pointers, all
    // referencing the same underlying storage object.
    let alsoAttachedTo: MemoryFileSlug[] = [];
    if (autoClassify) {
      try {
        const additional = await classifyAttachmentToChapters({
          primarySlug: slug,
          fileName: file.name,
          excerpt,
        });
        for (const otherSlug of additional) {
          // Mint a distinct id per chapter row so deletes from one
          // chapter don't ripple into others. The shared `ref`
          // (storage path) is what makes it the same logical doc.
          const fanOut: ChapterAttachment = {
            ...attachment,
            id: mintAttachmentId(),
            // Excerpt + size carry through unchanged so each
            // chapter's draft pipeline reads the same content.
          };
          await appendAttachment({
            userId,
            slug: otherSlug,
            attachment: fanOut,
          });
          alsoAttachedTo.push(otherSlug);
        }
      } catch (err) {
        // Non-fatal — primary attachment already saved.
        console.warn(
          "[chapter-attachment] auto-classify fan-out failed:",
          err instanceof Error ? err.message : err,
        );
        alsoAttachedTo = [];
      }
    }

    revalidatePath("/portal/lab/blueprint");
    if (alsoAttachedTo.length > 0) {
      for (const s of alsoAttachedTo)
        revalidatePath(`/portal/chapter/${s}`);
    }
    return NextResponse.json({
      ok: true,
      attachment,
      alsoAttachedTo,
    });
  }

  // ---- Link save branch ------------------------------------------------
  let body: { slug?: string; url?: string; label?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug = body.slug;
  const rawUrl = body.url?.trim();
  if (!slug || typeof slug !== "string" || !isValidMemoryFileSlug(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(
      /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
    ).toString();
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Try to scrape the page for a label + excerpt the agent can read.
  // If scraping fails (paywall, JS-only, blocked bot) we still save the
  // link with the user-provided label and a placeholder excerpt — the
  // customer can fix it up later.
  let scrapedTitle: string | null = null;
  let excerpt: string | null = null;
  try {
    const artifacts = await fetchSiteArtifacts(normalizedUrl);
    scrapedTitle = artifacts.title;
    excerpt = artifacts.homeExcerpt.slice(0, 2000);
  } catch (err) {
    console.warn(
      `[chapter-attachment] link scrape failed for ${normalizedUrl} (non-fatal):`,
      err instanceof Error ? err.message : err,
    );
    excerpt = "(Link saved — page could not be auto-fetched. Jason will reference the URL only.)";
  }

  const attachment: ChapterAttachment = {
    id: mintAttachmentId(),
    kind: "link",
    ref: normalizedUrl,
    label: body.label?.trim() || scrapedTitle || normalizedUrl,
    mime_type: null,
    size_bytes: null,
    excerpt,
    created_at: new Date().toISOString(),
  };

  await appendAttachment({ userId, slug, attachment });
  revalidatePath("/portal/lab/blueprint");
  return NextResponse.json({ ok: true, attachment });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const userId = auth.userId;

  let body: { slug?: string; attachmentId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { slug, attachmentId } = body;
  if (!slug || typeof slug !== "string" || !isValidMemoryFileSlug(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }
  if (!attachmentId || typeof attachmentId !== "string") {
    return NextResponse.json(
      { error: "attachmentId is required" },
      { status: 400 },
    );
  }

  const removed = await deleteAttachment({ userId, slug, attachmentId });
  if (removed?.kind === "file") {
    // Delete the underlying storage object too — orphans cost money
    // and confuse the audit trail.
    const admin = getSupabaseAdmin();
    const { error } = await admin.storage
      .from("customer-uploads")
      .remove([removed.ref]);
    if (error) {
      // Non-fatal: the row is gone, the storage object will be cleaned
      // up by a periodic sweep. Log so we know to look.
      console.error(
        `[chapter-attachment] storage remove failed for ${removed.ref}:`,
        error.message,
      );
    }
  }
  revalidatePath("/portal/lab/blueprint");
  return NextResponse.json({ ok: true, removed: !!removed });
}

function mintAttachmentId(): string {
  // Short, URL-safe, monotonic-ish. Time-prefix sorts naturally.
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${ts}${rand}`;
}
