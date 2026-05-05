/**
 * POST /api/assessment/start
 *
 * Either creates a fresh assessment_sessions row, or — if a valid
 * tfb_assessment_resume HttpOnly cookie is present — returns the
 * existing in-progress session so the UI can pick up where the user
 * left off.
 *
 * The resume token is set as an HttpOnly Secure SameSite=Lax cookie
 * directly by this route. The client never sees the token in JS land,
 * so an XSS in any non-HttpOnly script can't read it. (The cookie is
 * still the auth credential for the result page + PDF route — same as
 * before — those routes read it server-side too.)
 *
 * The token rotates on every successful start/resume to keep the
 * cookie fresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentResponse, AssessmentSession } from "@/lib/supabase/types";

export const runtime = "nodejs";

const RESUME_COOKIE = "tfb_assessment_resume";
const RESUME_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function setResumeCookie(res: NextResponse, token: string) {
  res.cookies.set(RESUME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESUME_MAX_AGE_SECONDS,
  });
}

interface StartRequest {
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

  // Resume path: look up an existing in-progress session by the
  // HttpOnly cookie token. The token used to be passed back via JSON
  // body and stored client-side in JS — that left it readable to any
  // XSS-capable script. The HttpOnly cookie path keeps the credential
  // off the JS heap entirely.
  const cookieToken = req.cookies.get(RESUME_COOKIE)?.value;
  if (cookieToken) {
    const { data: session } = await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("resume_token", cookieToken)
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
      const res = NextResponse.json({
        sessionId: existing.id,
        answers: ((responses ?? []) as AssessmentResponse[]).map((r) => ({
          questionId: r.question_id,
          answerValue: r.answer_value,
          answerScore: r.answer_score,
        })),
      });
      setResumeCookie(res, rotated);
      return res;
    }
    // Cookie didn't match an in-progress session — fall through to create new.
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

  const res = NextResponse.json({
    sessionId: data.id,
    answers: [],
  });
  setResumeCookie(res, resumeToken);
  return res;
}
