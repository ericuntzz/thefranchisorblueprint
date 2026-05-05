/**
 * Persistent chat-history endpoint for the Jason AI dock.
 *
 *   GET    /api/agent/chat-history → { transcript: TranscriptItem[] }
 *   POST   /api/agent/chat-history → { ok: true } (replaces transcript)
 *   DELETE /api/agent/chat-history → { ok: true } (clears it)
 *
 * Auth: must be signed in. We don't gate on paid purchase here —
 * a customer who's been demoted can still SEE their old transcript
 * (read-only effect since the chat endpoint itself is paid-gated).
 *
 * Storage: `chat_history` table, one row per user_id, jsonb column.
 * RLS scopes reads/writes to auth.uid() so the user-session client
 * is sufficient — no admin client needed.
 *
 * Caps: writes are truncated to MAX_PERSISTED_ITEMS most-recent
 * transcript entries server-side. Even if the client tries to push
 * a 10,000-turn history, we trim. This is the single bloat-control.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Hard cap on persisted transcript length. The chat dock only
 *  needs recent context to feel continuous; long-tail history
 *  doesn't earn its byte cost. ~30 items ≈ 15 turns of back-and-
 *  forth + a handful of tool cards, which is comfortably under
 *  Postgres jsonb practical limits even at heavy excerpt sizes. */
const MAX_PERSISTED_ITEMS = 30;

/** Shape of a transcript item — must mirror the client's
 *  TranscriptItem so we don't accept poisonous extra fields.
 *  `isGreeting` is allowed on bubbles but the client strips
 *  greetings before sending to us; this just means we won't
 *  reject a save if a stray one slips through. Dividers are
 *  pure UI markers and are also dropped client-side before save,
 *  but we accept them here for forward-compat. */
type TranscriptItem =
  | {
      kind: "bubble";
      role: "user" | "assistant";
      text: string;
      isGreeting?: boolean;
    }
  | {
      kind: "tool";
      id: string;
      status: "running" | "ok" | "error";
      summary: string;
    }
  | { kind: "divider"; label: string };

function isTranscriptItem(value: unknown): value is TranscriptItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "bubble") {
    return (
      (v.role === "user" || v.role === "assistant") &&
      typeof v.text === "string"
    );
  }
  if (v.kind === "tool") {
    return (
      typeof v.id === "string" &&
      (v.status === "running" || v.status === "ok" || v.status === "error") &&
      typeof v.summary === "string"
    );
  }
  if (v.kind === "divider") {
    return typeof v.label === "string";
  }
  return false;
}

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
  return { ok: true, userId: user.id };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("chat_history")
    .select("transcript")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    console.error("[chat-history] read failed:", error.message);
    // Return empty transcript on read failure so the dock still
    // works — better degraded than broken.
    return NextResponse.json({ transcript: [] });
  }
  // Defensive parse: if the DB ever holds something unexpected
  // (manual edit, schema migration mid-flight) we still return a
  // clean array.
  const raw = (data?.transcript ?? []) as unknown;
  const transcript = Array.isArray(raw)
    ? raw.filter(isTranscriptItem)
    : [];
  return NextResponse.json({ transcript });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  let body: { transcript?: unknown };
  try {
    body = (await req.json()) as { transcript?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.transcript)) {
    return NextResponse.json(
      { error: "transcript must be an array" },
      { status: 400 },
    );
  }

  // Sanitize + truncate. Drop any "running" tool cards — those
  // are mid-flight UI state and shouldn't survive a refresh as
  // permanent records (they'd display as a frozen spinner).
  const cleaned = body.transcript
    .filter(isTranscriptItem)
    .filter((item) => !(item.kind === "tool" && item.status === "running"));
  const trimmed = cleaned.slice(-MAX_PERSISTED_ITEMS);

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("chat_history")
    .upsert(
      {
        user_id: auth.userId,
        transcript: trimmed,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[chat-history] upsert failed:", error.message);
    return NextResponse.json(
      { error: "Could not save chat history" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("chat_history")
    .delete()
    .eq("user_id", auth.userId);
  if (error) {
    console.error("[chat-history] delete failed:", error.message);
    return NextResponse.json(
      { error: "Could not clear chat history" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
