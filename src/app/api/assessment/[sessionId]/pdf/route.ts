/**
 * GET /api/assessment/[sessionId]/pdf?token=...
 *
 * Streams the branded Franchise Readiness Report PDF for a completed
 * assessment session. Resume-token gated.
 *
 * Token can be passed via the query string (link from email) or via the
 * tfb_assessment_resume cookie (the user just finished the assessment in
 * the same browser).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentResponse, AssessmentSession } from "@/lib/supabase/types";
import { computeResult } from "@/lib/assessment/scoring";
import { renderResultPdf } from "@/lib/assessment/pdf-report";

export const runtime = "nodejs";

const RESUME_COOKIE = "tfb_assessment_resume";

interface Params {
  params: Promise<{ sessionId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;
  const queryToken = req.nextUrl.searchParams.get("token");
  const cookieToken = req.cookies.get(RESUME_COOKIE)?.value ?? null;
  const presented = queryToken ?? cookieToken;
  if (!presented) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: sessionData } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("resume_token", presented)
    .maybeSingle();
  const session = sessionData as AssessmentSession | null;
  if (!session || !session.completed_at) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: responsesData } = await supabase
    .from("assessment_responses")
    .select("*")
    .eq("session_id", sessionId);
  const responses = (responsesData ?? []) as AssessmentResponse[];
  const result = computeResult(
    responses.map((r) => ({
      question_id: r.question_id,
      answer_value: r.answer_value,
      answer_score: r.answer_score,
    })),
  );

  const pdfBuffer = await renderResultPdf({
    result,
    firstName: session.first_name ?? "Franchisor",
    businessName: session.business_name,
    generatedAt: session.completed_at
      ? new Date(session.completed_at)
      : new Date(),
  });

  const filename = `franchise-readiness-report-${(
    session.first_name ?? "report"
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.pdf`;

  // Convert Node Buffer to Uint8Array view for the Response body.
  const body = new Uint8Array(pdfBuffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBuffer.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
