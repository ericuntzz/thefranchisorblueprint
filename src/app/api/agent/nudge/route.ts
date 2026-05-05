/**
 * Proactive nudge endpoint for Jason AI.
 *
 *   GET /api/agent/nudge → { nudge: Nudge | null }
 *
 * Stage 4 of the Jason AI buildout: instead of sitting passively
 * in the corner, the dock asks the server "is there anything
 * worth surfacing right now?" on every mount. When yes, the
 * closed-state pill picks up a notification dot + teaser text,
 * and the dock greeting on next open uses the nudge prose
 * instead of a generic context greeting.
 *
 * Signals (deterministic, evaluated in priority order — first match
 * wins):
 *
 *   1. UNREAD_ATTACHMENT
 *      The customer uploaded a doc whose excerpt the model hasn't
 *      had a chance to discuss yet (no user message in the active
 *      chat since the attachment landed). High-leverage because
 *      uploads are the single biggest typing-skipper in the product.
 *
 *   2. STALE_RETURN
 *      The customer has attachments / Memory but hasn't sent a
 *      message in 7+ days. Pick-up nudge.
 *
 * Future v2 signals:
 *   - HIGH_READINESS_REVIEW — a chapter just hit 95%+ readiness
 *   - CRITICAL_GAP — a required field for an active chapter is empty
 *   - CHAPTER_MISMATCH — Sonnet-detected inconsistencies across chapters
 *
 * Client tracks dismissals in localStorage by `nudge.id` so a
 * customer who saw a nudge once doesn't see the same one on the
 * next page load. Server is stateless on dismissals — recomputes
 * from current Memory + chat-history every request.
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  ChapterAttachment,
  CustomerMemory,
  Purchase,
} from "@/lib/supabase/types";
import {
  isValidMemoryFileSlug,
  MEMORY_FILE_TITLES,
  type MemoryFileSlug,
} from "@/lib/memory/files";

export const runtime = "nodejs";

/** Stale-return threshold. Customers who haven't talked to Jason
 *  in this long get a "let's pick up" nudge. 7 days felt right —
 *  short enough that returning customers see something fresh,
 *  long enough that daily users don't get pestered. */
const STALE_DAYS = 7;

type Nudge = {
  /** Stable id used by the client for dismissal tracking. Format
   *  encodes the signal type and the contextual key (attachment
   *  id, chapter slug, etc.) so the same condition recurring on
   *  a different attachment fires a fresh nudge. */
  id: string;
  /** What Jason says when the dock opens with this nudge active.
   *  Markdown — bold the chapter / file name for scannability. */
  greeting: string;
  /** Optional one-click follow-up the customer can send to Jason
   *  without typing. Pre-filled into the textarea or rendered as
   *  a chip below the greeting. */
  starter?: string;
  /** Short text shown next to the closed-state pill icon. Tease
   *  enough that the customer wants to click; don't spoil. */
  pillTeaser: string;
};

export async function GET() {
  // ---- Auth + paid gate ----
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ nudge: null });
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) {
    return NextResponse.json({ nudge: null });
  }

  // ---- Read state ----
  // Use admin client for the cross-table read; we already
  // verified the user owns this data above.
  const admin = getSupabaseAdmin();
  const [memoryRes, chatRes] = await Promise.all([
    admin
      .from("customer_memory")
      .select("file_slug, attachments")
      .eq("user_id", user.id),
    admin
      .from("chat_history")
      .select("transcript, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const memoryRows =
    (memoryRes.data ?? []) as Pick<CustomerMemory, "file_slug" | "attachments">[];

  // Last user-message timestamp from the live transcript. We use
  // this to decide if an attachment is "unread" (uploaded after
  // the customer's most recent message in the chat) and as the
  // staleness signal.
  const transcript = (chatRes.data?.transcript ?? []) as unknown[];
  const lastUserMsgAt = lastUserMessageTimestamp(
    transcript,
    chatRes.data?.updated_at ?? null,
  );

  // ---- Signal 1: UNREAD_ATTACHMENT ----
  // Walk every chapter's attachments, find the most recent one
  // that has a non-placeholder excerpt and was uploaded after
  // the customer's last user message (or any time if they've
  // never sent a message).
  let candidate: {
    attachment: ChapterAttachment;
    slug: MemoryFileSlug;
  } | null = null;
  for (const row of memoryRows) {
    if (!isValidMemoryFileSlug(row.file_slug)) continue;
    const attachments = (row.attachments ?? []) as ChapterAttachment[];
    for (const att of attachments) {
      if (!att.created_at || !att.excerpt) continue;
      // Skip placeholder excerpts — those are the "(file attached
      // — content not yet ingested)" rows where Jason genuinely
      // can't say anything useful yet.
      if (att.excerpt.startsWith("(") && att.excerpt.endsWith(")")) continue;
      // Already discussed?
      if (lastUserMsgAt && att.created_at <= lastUserMsgAt) continue;
      // Take the most recent unread attachment.
      if (
        !candidate ||
        att.created_at > candidate.attachment.created_at
      ) {
        candidate = { attachment: att, slug: row.file_slug };
      }
    }
  }

  if (candidate) {
    const fileLabel = candidate.attachment.label || "your last upload";
    const chapterTitle = MEMORY_FILE_TITLES[candidate.slug];
    const nudge: Nudge = {
      id: `unread-attachment:${candidate.attachment.id}`,
      greeting: `I read **${fileLabel}** — pulled it into your **${chapterTitle}** chapter. Want me to walk you through what I found, or just call out the highest-leverage stuff?`,
      starter: "Walk me through what you found",
      pillTeaser: "I read your doc — got notes",
    };
    return NextResponse.json({ nudge });
  }

  // ---- Signal 2: STALE_RETURN ----
  // No recent message + at least some Memory state means there's
  // a conversation worth resuming. (If they have neither attachments
  // nor any chat history, they're a fresh customer — no nudge.)
  const hasAnyAttachments = memoryRows.some(
    (r) => Array.isArray(r.attachments) && (r.attachments as unknown[]).length > 0,
  );
  if (lastUserMsgAt && hasAnyAttachments) {
    const lastMs = new Date(lastUserMsgAt).getTime();
    const daysSince = (Date.now() - lastMs) / (24 * 3600 * 1000);
    if (daysSince >= STALE_DAYS) {
      const nudge: Nudge = {
        // Bucket the id by week so a returning customer who keeps
        // dismissing it doesn't get spammed with the same nudge
        // every page reload.
        id: `stale-return:${Math.floor(lastMs / (7 * 24 * 3600 * 1000))}`,
        greeting: `Been a minute — about ${Math.floor(
          daysSince,
        )} days since we last talked. Want me to recap where we are on your Blueprint, or jump straight into something specific?`,
        starter: "Recap where I am",
        pillTeaser: "Been a minute — pick up?",
      };
      return NextResponse.json({ nudge });
    }
  }

  // ---- No nudge ----
  return NextResponse.json({ nudge: null });
}

/**
 * Inspect the persisted chat-history transcript to find the
 * timestamp of the most recent user message. We don't store
 * timestamps on individual transcript items today, so as a
 * proxy we use `chat_history.updated_at` IF the transcript ends
 * with a user message (i.e., the most recent change to the row
 * was the customer typing). Otherwise null.
 *
 * This is a deliberate simplification — we'd need to extend the
 * TranscriptItem schema to carry per-item timestamps for a
 * tighter check, and the marginal accuracy isn't worth the
 * migration today. The proxy errs on the side of "treat
 * recently-written rows as fresh user activity," which is fine
 * for the unread-attachment signal.
 */
function lastUserMessageTimestamp(
  transcript: unknown[],
  rowUpdatedAt: string | null,
): string | null {
  if (!Array.isArray(transcript) || transcript.length === 0) return null;
  // Walk from the end backwards looking for a user bubble.
  for (let i = transcript.length - 1; i >= 0; i--) {
    const item = transcript[i] as Record<string, unknown> | undefined;
    if (!item) continue;
    if (item.kind === "bubble" && item.role === "user") {
      // Found a user bubble — assume it landed at row updated_at.
      // (Imperfect but adequate for nudge scoring.)
      return rowUpdatedAt;
    }
  }
  return null;
}
