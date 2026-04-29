/**
 * POST /api/assessment/start
 *
 * Either creates a fresh assessment_sessions row, or — if a valid
 * resume_token is provided — returns the existing in-progress session so
 * the UI can pick up where the user left off.
 *
 * Returns a freshly-rotated resume_token on every call so the cookie
 * stays valid even after a resume. The token is unguessable (32 bytes
 * url-safe base64) and acts as the access credential for /answer,
 * /complete, and the result page.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentResponse, AssessmentSession } from "@/lib/supabase/types";

export const runtime = "nodejs";

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

interface StartRequest {
  resumeToken?: string;
  source?: string;
}

export async function POST(req: NextRequest) {
  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    body = {};
  }

  const supabase = getSupabaseAdmin();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // Resume path: look up an existing in-progress session by token.
  if (body.resumeToken) {
    const { data: session } = await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("resume_token", body.resumeToken)
      .maybeSingle();
    const existing = session as AssessmentSession | null;
    if (existing && !existing.completed_at) {
      const { data: responses } = await supabase
        .from("assessment_responses")
        .select("*")
        .eq("session_id", existing.id);
      // Rotate the token to keep the cookie fresh.
      const rotated = newToken();
      await supabase
        .from("assessment_sessions")
        .update({ resume_token: rotated })
        .eq("id", existing.id);
      return NextResponse.json({
        sessionId: existing.id,
        resumeToken: rotated,
        answers: ((responses ?? []) as AssessmentResponse[]).map((r) => ({
          questionId: r.question_id,
          answerValue: r.answer_value,
          answerScore: r.answer_score,
        })),
      });
    }
    // Token didn't match an in-progress session — fall through to create new.
  }

  // Create fresh session.
  const resumeToken = newToken();
  const { data, error } = await supabase
    .from("assessment_sessions")
    .insert({
      resume_token: resumeToken,
      ip,
      user_agent: userAgent,
      source: body.source ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[assessment/start] insert failed", error);
    return NextResponse.json({ error: "could not start assessment" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: data.id,
    resumeToken,
    answers: [],
  });
}
