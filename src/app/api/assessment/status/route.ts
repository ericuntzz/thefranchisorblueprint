/**
 * GET /api/assessment/status
 *
 * Read-only lookup for the AssessmentResumeBanner. Reads the HttpOnly
 * tfb_assessment_resume cookie (set by /api/assessment/start) and
 * returns enough state for the banner to decide whether to render.
 *
 * Was previously taking the token via `?token=` query param read
 * client-side from a JS-readable cookie. Splitting the auth surface
 * to HttpOnly removed JS access; the banner now just calls this
 * endpoint and the cookie auto-attaches.
 *
 * Returns:
 *   { inProgress: true, answered, total } when the cookie maps to
 *   an unfinished session.
 *   { inProgress: false } in all other cases (no cookie, bad cookie,
 *   session completed) — the banner just hides.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentSession } from "@/lib/supabase/types";
import { QUESTIONS } from "@/lib/assessment/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESUME_COOKIE = "tfb_assessment_resume";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(RESUME_COOKIE)?.value;
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
