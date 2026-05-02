import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { streamChat, type ChatTurn } from "@/lib/agent";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
// 60-second max duration on Vercel hobby tier; on pro this can go to 300.
// Streaming starts almost immediately — total wall-clock is bounded by
// max_tokens=4096 on the chat model, which finishes well inside this.
export const maxDuration = 60;

/**
 * POST /api/agent/chat
 *
 * Streams an in-portal chat response from the Jason agent. The request
 * body is the full conversation history (the client owns history; the
 * server is stateless per request — keeps everything cacheable).
 *
 * Auth: must be logged-in + have at least one paid purchase. The agent
 * is a paid feature, not a public surface.
 *
 * Response: text/plain stream of token deltas. Client reads with
 * `response.body.getReader()` and appends to the visible message.
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

  // Gate behind a paid purchase — the agent costs us money to run, and
  // the in-portal chat is a Tier 1+ feature.
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
  // Defensive size cap — chat dock should never send anything close to
  // this, but a misbehaving client (or attack) could push us into a
  // very expensive call otherwise.
  const totalChars = history.reduce((n, t) => n + (t.content?.length ?? 0), 0);
  if (totalChars > 50_000) {
    return NextResponse.json(
      { error: "history too large" },
      { status: 413 },
    );
  }

  // ---- Stream ----
  let stream;
  try {
    stream = await streamChat({
      userId: user.id,
      history,
      pageContext: body.pageContext,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/chat] streamChat failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // SDK MessageStream is async-iterable over RawMessageStreamEvent.
        // We forward only text deltas to the client — thinking blocks are
        // dropped (their content is omitted by default on Opus 4.7
        // anyway, and on Sonnet 4.6 they'd just be noise on the wire).
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        console.error("[agent/chat] stream loop failed:", msg);
        // Best effort: surface the error inline at the end of the
        // visible response so the client sees something.
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
