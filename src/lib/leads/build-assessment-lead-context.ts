/**
 * Build the rich `AssessmentLeadContext` payload for the internal lead
 * notification email.
 *
 * Pure function — no DB calls. The /api/assessment/complete route already
 * has the computed `AssessmentResult` in hand and just needs to package
 * it for the email template, including:
 *
 *   - lead temperature (hot/warm/cool) by band
 *   - a band-specific recommended action that tells Jason what to do
 *   - a pre-built mailto link with subject + body draft
 *   - a LinkedIn people-search URL pre-filled with name + business
 */

import type { AssessmentResult } from "@/lib/assessment/scoring";
import type { AssessmentLeadContext } from "@/lib/email/templates/internal-lead-notification";

const RECOMMENDED_ACTION: Record<
  AssessmentResult["band"],
  (firstName: string) => string
> = {
  franchise_ready: (firstName) =>
    `Hot lead — call within the hour. They're ready and shopping. Open with: "Hi ${firstName}, I'm Jason — saw your readiness score and wanted to reach out personally. You're in the top tier of franchisors we see at this stage. What's pulling you toward franchising right now?"`,
  nearly_there: (firstName) =>
    `Hot lead — call within the hour. Their gaps are closeable in 60-90 days, and they know it. Anchor on the biggest-gap category as the conversation hook: "Hi ${firstName} — looked at your assessment. You're closer than most. Got 15 minutes to walk through what's left?"`,
  building_foundation: (firstName) =>
    `Warm — reach out today. They got the Blueprint recommendation, not the strategy call. Don't push the call yet — confirm the foundation work is right for them: "Hi ${firstName}, your assessment came back showing real franchise potential. The Blueprint is built for exactly the gaps you're sitting on right now. Want me to walk you through what's inside?"`,
  early_stage: () =>
    "Cool — auto-roadmap email is on its way. No personal outreach needed unless they reply. Revisit in 6 months.",
};

function leadTemperature(
  band: AssessmentResult["band"],
): AssessmentLeadContext["leadTemperature"] {
  if (band === "franchise_ready" || band === "nearly_there") return "hot";
  if (band === "building_foundation") return "warm";
  return "cool";
}

function buildMailtoUrl(
  email: string,
  firstName: string,
  band: AssessmentResult["band"],
  weakestCategory: string,
): string {
  const subject =
    band === "franchise_ready" || band === "nearly_there"
      ? "Quick follow-up on your Franchise Readiness Assessment"
      : "Following up on your assessment results";

  const body =
    band === "franchise_ready"
      ? `Hi ${firstName || "there"},\n\nJason here — saw your Franchise Readiness Assessment results came in and wanted to reach out personally. Your scores put you in the top band we see, which usually means the conversation is less about "should you franchise" and more about "what's the right path."\n\nGot 15 minutes this week to talk through next steps?\n\n— Jason`
      : band === "nearly_there"
        ? `Hi ${firstName || "there"},\n\nJason here — saw your assessment results. You're closer to franchise-ready than most founders I talk to. The ${weakestCategory} score caught my eye specifically — that's usually a 60-90 day fix when the rest is in place like yours is.\n\nWant to jump on a quick call to map out the gaps?\n\n— Jason`
        : `Hi ${firstName || "there"},\n\nJason here — your Franchise Readiness Assessment came in. I'd love to chat about where you are and what makes sense as a next step.\n\nReply to this email or grab a time on my calendar.\n\n— Jason`;

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildLinkedInSearchUrl(
  firstName: string | null,
  businessName: string | null,
): string | null {
  const parts = [firstName, businessName].filter(
    (s): s is string => !!s && s.trim().length > 0,
  );
  if (parts.length === 0) return null;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(parts.join(" "))}`;
}

export function buildAssessmentLeadContext(args: {
  result: AssessmentResult;
  email: string;
  firstName: string;
  businessName: string | null;
  websiteUrl: string | null;
}): AssessmentLeadContext {
  const { result, email, firstName, businessName, websiteUrl } = args;
  const recommendedActionFn = RECOMMENDED_ACTION[result.band];

  return {
    band: result.band,
    bandTitle: result.bandTitle,
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    websiteUrl,
    strongestCategory: result.strongest.title,
    weakestCategory: result.weakest.title,
    categoryBreakdown: result.categories.map((c) => ({
      title: c.title,
      score: c.score,
      max: c.max,
    })),
    leadTemperature: leadTemperature(result.band),
    recommendedAction: recommendedActionFn(firstName || ""),
    mailtoUrl: buildMailtoUrl(email, firstName, result.band, result.weakest.title),
    linkedInSearchUrl: buildLinkedInSearchUrl(firstName, businessName),
  };
}
