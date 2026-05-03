import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { streamChatEvents, type ChatTurn } from "@/lib/agent";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
// 60-second max duration on Vercel hobby tier; on pro this can go to
// 300. Tool-use loop adds round-trips but each one is also fast Sonnet
// with adaptive thinking — a 6-tool-call ceiling stays well inside.
export const maxDuration = 60;

/**
 * POST /api/agent/chat
 *
 * Streams a tool-aware in-portal chat response from the Jason agent.
 * The request body is the full conversation history (the client owns
 * history; the server is stateless per request — keeps everything
 * cacheable).
 *
 * Auth: must be logged-in + have at least one paid purchase. The agent
 * is a paid feature, not a public surface.
 *
 * Response: NDJSON. Each line is a single JSON object (one ChatEvent —
 * see `lib/agent/chat.ts`). Client splits on `\n` and parses each line
 * to interleave text deltas with tool_call / tool_result cards.
 */
export async function POST(req: NextRequest) {
  // ---- Auth ----
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return NextResponse.json(
      { error: "No active purchase" },
      { status: 403 },
    );
  }

  // ---- Parse body ----
  let body: { history?: ChatTurn[]; pageContext?: string };
  try {
    body = (await req.json()) as { history?: ChatTurn[]; pageContext?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  if (history.length === 0) {
    return NextResponse.json(
      { error: "history must be a non-empty array" },
      { status: 400 },
    );
  }
  if (history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "last history entry must be from 'user'" },
      { status: 400 },
    );
  }
  // Defensive size cap.
  const totalChars = history.reduce((n, t) => n + (t.content?.length ?? 0), 0);
  if (totalChars > 50_000) {
    return NextResponse.json(
      { error: "history too large" },
      { status: 413 },
    );
  }

  // ---- Stream ----
  const encoder = new TextEncoder();
  const userId = user.id;
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamChatEvents({
          userId,
          history,
          pageContext: body.pageContext,
        })) {
          // NDJSON wire format — one JSON object per line. Trailing
          // newline closes the line so the client's split-on-`\n`
          // parse picks it up immediately rather than buffering.
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        console.error("[agent/chat] stream loop failed:", msg);
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", message: msg }) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      // application/x-ndjson is the right MIME for newline-delimited
      // JSON. Keep no-store so intermediate caches never collapse the
      // event stream.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
