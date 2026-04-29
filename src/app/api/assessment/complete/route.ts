/**
 * POST /api/assessment/complete
 *
 * Finalizes the assessment: validates that all 15 questions have answers,
 * computes the total score + band + category scores, persists those onto
 * the session row, captures lead-info (email/name/business/revenue/urgency),
 * links the session to an existing auth user if the email matches one, and
 * returns the result URL.
 *
 * Email + PDF dispatch is wired in Wave 3 — this route just persists state
 * and returns the URL. (We'll add the email queueing in the next commit.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AssessmentBand,
  AssessmentResponse,
  AssessmentSession,
} from "@/lib/supabase/types";
import { QUESTIONS } from "@/lib/assessment/questions";
import { computeResult, toCategoryScoresJson } from "@/lib/assessment/scoring";

export const runtime = "nodejs";

const VALID_REVENUE = new Set([
  "under_250k",
  "250k_500k",
  "500k_1m",
  "1m_5m",
  "5m_plus",
]);
const VALID_URGENCY = new Set([
  "ready_now",
  "3_months",
  "6_months",
  "exploring",
]);

interface CompleteRequest {
  sessionId?: string;
  resumeToken?: string;
  email?: string;
  firstName?: string;
  businessName?: string;
  annualRevenue?: string;
  urgency?: string;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: CompleteRequest;
  try {
    body = (await req.json()) as CompleteRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { sessionId, resumeToken } = body;
  if (!sessionId || !resumeToken) {
    return NextResponse.json({ error: "missing session credentials" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const firstName = (body.firstName ?? "").trim();
  const businessName = (body.businessName ?? "").trim() || null;
  const annualRevenue = (body.annualRevenue ?? "").trim();
  const urgency = (body.urgency ?? "").trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ error: "first name is required" }, { status: 400 });
  }
  if (annualRevenue && !VALID_REVENUE.has(annualRevenue)) {
    return NextResponse.json({ error: "invalid annual_revenue" }, { status: 400 });
  }
  if (urgency && !VALID_URGENCY.has(urgency)) {
    return NextResponse.json({ error: "invalid urgency" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Resume-token gate.
  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("resume_token", resumeToken)
    .maybeSingle();
  const owned = session as AssessmentSession | null;
  if (!owned) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (owned.completed_at) {
    return NextResponse.json({ error: "session already completed" }, { status: 409 });
  }

  // Pull all responses; require all 15 to be present before completion.
  const { data: respData } = await supabase
    .from("assessment_responses")
    .select("*")
    .eq("session_id", sessionId);
  const responses = (respData ?? []) as AssessmentResponse[];
  if (responses.length < QUESTIONS.length) {
    return NextResponse.json(
      {
        error: "incomplete",
        answered: responses.length,
        required: QUESTIONS.length,
      },
      { status: 400 },
    );
  }

  const result = computeResult(
    responses.map((r) => ({
      question_id: r.question_id,
      answer_value: r.answer_value,
      answer_score: r.answer_score,
    })),
  );
  const band: AssessmentBand = result.band;
  const categoryScoresJson = toCategoryScoresJson(result.categories);

  // Try to link to an existing auth.users row by email — just for the
  // user_id FK. We do NOT auto-create auth users from a free assessment;
  // that only happens on a paid Stripe purchase. So a null user_id here
  // is the normal case.
  let userId: string | null = null;
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    userId = existingProfile.id;
  }

  const { error: updateErr } = await supabase
    .from("assessment_sessions")
    .update({
      email,
      first_name: firstName,
      business_name: businessName,
      annual_revenue: annualRevenue || null,
      urgency: urgency || null,
      total_score: result.totalScore,
      band,
      category_scores: categoryScoresJson,
      completed_at: new Date().toISOString(),
      user_id: userId,
    })
    .eq("id", sessionId);
  if (updateErr) {
    console.error("[assessment/complete] update failed", updateErr);
    return NextResponse.json({ error: "could not finalize" }, { status: 500 });
  }

  // Wave 3: queue the result email + branded PDF here. For now, just
  // return the URL — the result page itself will trigger any deferred
  // notifications when it loads (idempotent).

  const resultUrl = `/assessment/result/${sessionId}?token=${encodeURIComponent(resumeToken)}`;
  return NextResponse.json({
    ok: true,
    resultUrl,
    band,
    totalScore: result.totalScore,
  });
}
