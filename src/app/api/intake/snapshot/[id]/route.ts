import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/intake/snapshot/[id]
 *
 * Returns the finished snapshot for a given session ID, but ONLY if
 * the requester's HttpOnly cookie matches the session's stored
 * cookie_token. Idempotent — used by the hero UI when the user
 * navigates away and comes back, and by the cached-response code
 * path in /api/intake/start.
 *
 * Auth: HttpOnly cookie equality check.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length !== 36) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const cookieToken = req.cookies.get("tfb_intake_session")?.value;
  if (!cookieToken) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("intake_sessions")
    .select("id, status, cookie_token, score_data, business_data, expansion_data, market_data")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (data.cookie_token !== cookieToken) {
    return NextResponse.json({ error: "Session token mismatch" }, { status: 403 });
  }
  if (data.status !== "complete") {
    return NextResponse.json({ status: data.status, error: "Session not complete" }, { status: 425 });
  }

  // The full snapshot is bundled into score_data.snapshot at completion.
  const scoreData = data.score_data as { snapshot?: unknown } | null;
  if (!scoreData?.snapshot) {
    return NextResponse.json({ error: "Snapshot data missing" }, { status: 500 });
  }
  return NextResponse.json({ snapshot: scoreData.snapshot, sessionId: data.id });
}
