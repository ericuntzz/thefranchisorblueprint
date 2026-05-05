/**
 * POST /api/assessment/answer
 *
 * Records an answer to a single question (upsert on (session_id,
 * question_id) so re-answering during a back-navigation just overwrites
 * the prior score). Returns the per-answer insight copy so the UI can
 * play the mentor-voice beat between questions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentSession } from "@/lib/supabase/types";
import { QUESTION_BY_ID } from "@/lib/assessment/questions";
import { validateAnswer } from "@/lib/assessment/scoring";

export const runtime = "nodejs";

interface AnswerRequest {
  sessionId?: string;
  questionId?: string;
  answerValue?: string;
}

export async function POST(req: NextRequest) {
  let body: AnswerRequest;
  try {
    body = (await req.json()) as AnswerRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { sessionId, questionId, answerValue } = body;
  if (!sessionId || !questionId || !answerValue) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const validation = validateAnswer(questionId, answerValue);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }
  const { question, score, letter } = validation;

  const supabase = getSupabaseAdmin();

  // Look up the session by ID only. If it doesn't exist (e.g. the client
  // is holding a stale sessionId from a deploy that wiped the DB), tell
  // the client to restart — the AssessmentFlow component handles 404 by
  // starting a fresh session and re-submitting the answer transparently.
  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id,completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  const owned = session as Pick<AssessmentSession, "id" | "completed_at"> | null;
  if (!owned) {
    console.warn(`[assessment/answer] session not found id=${sessionId}`);
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (owned.completed_at) {
    return NextResponse.json({ error: "session already completed" }, { status: 409 });
  }

  // Upsert response.
  const { error } = await supabase.from("assessment_responses").upsert(
    {
      session_id: sessionId,
      question_id: questionId,
      answer_value: letter,
      answer_score: score,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "session_id,question_id" },
  );
  if (error) {
    console.error("[assessment/answer] upsert failed", error);
    return NextResponse.json({ error: "could not save answer" }, { status: 500 });
  }

  // The insight is per-letter; some questions don't define one for every
  // letter. Returning null is fine — the UI just skips the beat.
  const insight = QUESTION_BY_ID[questionId]?.insight?.[letter] ?? null;

  return NextResponse.json({
    ok: true,
    questionId: question.id,
    letter,
    score,
    insight,
  });
}
