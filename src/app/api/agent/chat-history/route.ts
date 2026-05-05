/**
 * Persistent chat-history endpoint for the Jason AI dock.
 *
 *   GET    /api/agent/chat-history → { transcript, savedThreads }
 *   POST   /api/agent/chat-history → { ok: true }
 *           body: { transcript?, savedThreads? }
 *           Either / both can be provided. The "+ New chat" flow
 *           sends both — current transcript cleared, archived
 *           thread prepended to savedThreads.
 *   DELETE /api/agent/chat-history → { ok: true } (clears everything)
 *
 * Auth: must be signed in. We don't gate on paid purchase here —
 * a customer who's been demoted can still SEE their old transcript
 * (read-only effect since the chat endpoint itself is paid-gated).
 *
 * Storage: `chat_history` table, one row per user_id, two jsonb cols.
 * RLS scopes reads/writes to auth.uid() so the user-session client
 * is sufficient — no admin client needed.
 *
 * Caps: writes are truncated to MAX_PERSISTED_ITEMS most-recent
 * transcript entries server-side; saved_threads is capped at
 * MAX_SAVED_THREADS most-recent archives. Even if the client tries
 * to push 10,000 items / 1,000 threads, we trim. This is the
 * single bloat-control.
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

/** How many archived chats we hold in the "history" dropdown.
 *  Older ones drop off. The customer can keep refreshing and
 *  starting fresh without us bloating the row indefinitely. */
const MAX_SAVED_THREADS = 10;

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

type SavedThread = {
  id: string;
  archivedAt: string;
  preview: string;
  transcript: TranscriptItem[];
};

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

function isSavedThread(value: unknown): value is SavedThread {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.archivedAt !== "string" ||
    typeof v.preview !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(v.transcript)) return false;
  return v.transcript.every(isTranscriptItem);
}

/** Sanitize + size-cap a transcript array on the way to / from
 *  storage. Drops poisonous items and "running" tool cards
 *  (mid-flight UI state, doesn't deserve to persist as a frozen
 *  spinner). */
function sanitizeTranscript(raw: unknown): TranscriptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isTranscriptItem)
    .filter((item) => !(item.kind === "tool" && item.status === "running"))
    .slice(-MAX_PERSISTED_ITEMS);
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
    .select("transcript, saved_threads")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    console.error("[chat-history] read failed:", error.message);
    // Return empty arrays on read failure so the dock still
    // works — better degraded than broken.
    return NextResponse.json({ transcript: [], savedThreads: [] });
  }
  const transcript = sanitizeTranscript(data?.transcript ?? []);
  const rawSaved = data?.saved_threads ?? [];
  const savedThreads = Array.isArray(rawSaved)
    ? rawSaved.filter(isSavedThread).slice(0, MAX_SAVED_THREADS)
    : [];
  return NextResponse.json({ transcript, savedThreads });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;

  let body: { transcript?: unknown; savedThreads?: unknown };
  try {
    body = (await req.json()) as {
      transcript?: unknown;
      savedThreads?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build the upsert payload from whichever fields the client
  // provided. The "+ New chat" flow posts both at once (transcript=[],
  // savedThreads=[archived, ...rest]); the streaming auto-save flow
  // posts just transcript.
  const upsert: {
    user_id: string;
    transcript?: TranscriptItem[];
    saved_threads?: SavedThread[];
  } = { user_id: auth.userId };

  if (body.transcript !== undefined) {
    if (!Array.isArray(body.transcript)) {
      return NextResponse.json(
        { error: "transcript must be an array" },
        { status: 400 },
      );
    }
    upsert.transcript = sanitizeTranscript(body.transcript);
  }
  if (body.savedThreads !== undefined) {
    if (!Array.isArray(body.savedThreads)) {
      return NextResponse.json(
        { error: "savedThreads must be an array" },
        { status: 400 },
      );
    }
    // Sanitize each thread's transcript at archive time too — same
    // bloat-control applies. Drop any thread that doesn't validate
    // rather than reject the whole save (better partial than nothing).
    upsert.saved_threads = body.savedThreads
      .filter(isSavedThread)
      .map((thread) => ({
        ...thread,
        transcript: sanitizeTranscript(thread.transcript),
      }))
      .slice(0, MAX_SAVED_THREADS);
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("chat_history")
    .upsert(upsert, { onConflict: "user_id" });
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
