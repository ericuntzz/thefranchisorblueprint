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
import { sendTemplate } from "@/lib/email/dispatch";
import { renderResultPdf } from "@/lib/assessment/pdf-report";
import { SITE_URL } from "@/lib/site";

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
  /**
   * Accepted but no longer enforced as a security gate. See /answer route
   * for rationale — sessionId UUIDs are sufficient credentials here, and
   * the token gate stays on the result page + PDF where personal info is
   * exposed.
   */
  resumeToken?: string;
  email?: string;
  firstName?: string;
  businessName?: string;
  /**
   * Optional. Captured for the agentic-portal pre-fill scrape (Phase 1
   * of the agentic-portal buildout). The lead-capture UI doesn't ask for
   * this yet — the field is here so adding it later is a UI-only change.
   */
  websiteUrl?: string;
  annualRevenue?: string;
  urgency?: string;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Light-touch normalization for an optional website field. We accept what
 * the customer types (`thefranchisorblueprint.com`, `www.x.com`,
 * `https://x.com/foo`), strip whitespace, prepend `https://` when no scheme
 * is given, and validate it parses as a URL. Returns null if the input is
 * empty or unparseable — we'd rather drop a malformed value than let it
 * poison the scrape pipeline downstream.
 */
function normalizeWebsiteUrl(input: string | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    // Reject the trivial `https://` no-host case.
    if (!u.hostname || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: CompleteRequest;
  try {
    body = (await req.json()) as CompleteRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "missing session id" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const firstName = (body.firstName ?? "").trim();
  const businessName = (body.businessName ?? "").trim() || null;
  const websiteUrl = normalizeWebsiteUrl(body.websiteUrl);
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

  // Session lookup by ID only — see /answer route for rationale.
  // The result-page URL we generate below STILL embeds the resume_token
  // so the result page itself remains token-gated for personal-info
  // protection.
  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  const owned = session as AssessmentSession | null;
  if (!owned) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (owned.completed_at) {
    return NextResponse.json({ error: "session already completed" }, { status: 409 });
  }
  // Use the existing token from the row for the result-page URL so the
  // link remains valid even if the client has lost its in-memory copy.
  const resumeToken = owned.resume_token ?? "";

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
      website_url: websiteUrl,
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

  const relativeResultUrl = `/assessment/result/${sessionId}?token=${encodeURIComponent(resumeToken)}`;
  const absoluteResultUrl = `${SITE_URL}${relativeResultUrl}`;

  // ─── Customer-facing result email + branded PDF attachment ────────────
  // Defensive: render + send is wrapped in try/catch so a transient
  // email failure doesn't 500 the assessment submission. The result
  // page is the primary delivery — email is the convenience copy.
  void (async () => {
    try {
      const pdfBuffer = await renderResultPdf({
        result,
        firstName,
        businessName,
        generatedAt: new Date(),
      });
      const pdfBase64 = pdfBuffer.toString("base64");
      const filename = `franchise-readiness-report-${firstName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.pdf`;
      await sendTemplate(
        "assessment-result",
        email,
        {
          firstName,
          totalScore: result.totalScore,
          maxScore: result.maxScore,
          bandTitle: result.bandTitle,
          bandHeadline: result.bandHeadline,
          bandSummary: result.bandSummary,
          resultUrl: absoluteResultUrl,
          primaryCtaLabel: result.recommendation.primary.label,
          primaryCtaHref: result.recommendation.primary.href
            ? `${SITE_URL}${result.recommendation.primary.href}`
            : null,
          rationale: result.recommendation.rationale,
          categories: result.categories.map((c) => ({
            title: c.title,
            score: c.score,
            max: c.max,
            ratio: c.ratio,
          })),
          strongest: { title: result.strongest.title },
          weakest: { title: result.weakest.title },
        },
        {
          idempotencyKey: `assessment-result:${sessionId}`,
          attachments: [
            {
              filename,
              content: pdfBase64,
              contentType: "application/pdf",
            },
          ],
        },
      );
    } catch (err) {
      console.error("[assessment/complete] result email failed", err);
    }
  })();

  // ─── Internal lead notification (Jason's inbox) ───────────────────────
  // Reuses the existing "internal-lead-notification" template the contact
  // form + newsletter use, so all inbound leads aggregate in one place.
  const internalEmail = process.env.INTERNAL_NOTIFICATION_EMAIL;
  if (internalEmail) {
    void sendTemplate(
      "internal-lead-notification",
      internalEmail,
      {
        source: "assessment",
        email,
        firstName,
        businessName,
        annualRevenue: annualRevenue || null,
        urgency: urgency || null,
        assessmentScore: `${result.totalScore} / ${result.maxScore} — ${result.bandTitle}`,
        message: `Recommendation: ${result.recommendation.primary.label}. Strongest: ${result.strongest.title}. Biggest gap: ${result.weakest.title}.`,
        supabaseRowUrl: absoluteResultUrl,
        submittedAt: new Date().toISOString(),
      },
      { idempotencyKey: `assessment-internal:${sessionId}` },
    ).catch((err) => {
      console.error("[assessment/complete] internal notify failed", err);
    });
  }

  return NextResponse.json({
    ok: true,
    resultUrl: relativeResultUrl,
    band,
    totalScore: result.totalScore,
  });
}
