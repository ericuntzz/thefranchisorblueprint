/**
 * GET /api/assessment/status?token=...
 *
 * Read-only lookup for the AssessmentResumeBanner. Given a resume_token,
 * returns enough state for the banner to decide whether to render and
 * what copy to use. Does NOT rotate the token (that's what /start does)
 * so it's safe to poll from a banner component without invalidating the
 * actual assessment page's in-flight session.
 *
 * Returns:
 *   { inProgress: true, answered, total } when the cookie's token maps
 *   to an unfinished session.
 *   { inProgress: false } in all other cases (no token, bad token,
 *   session completed, etc) — the banner just hides.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentSession } from "@/lib/supabase/types";
import { QUESTIONS } from "@/lib/assessment/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { inProgress: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: sessionRow } = await supabase
    .from("assessment_sessions")
    .select("id,completed_at")
    .eq("resume_token", token)
    .maybeSingle();
  const session = sessionRow as Pick<AssessmentSession, "id" | "completed_at"> | null;
  if (!session || session.completed_at) {
    return NextResponse.json(
      { inProgress: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Count answered questions cheaply.
  const { count } = await supabase
    .from("assessment_responses")
    .select("session_id", { count: "exact", head: true })
    .eq("session_id", session.id);

  return NextResponse.json(
    {
      inProgress: true,
      answered: count ?? 0,
      total: QUESTIONS.length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
