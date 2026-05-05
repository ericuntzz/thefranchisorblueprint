import { Heading, Section, Text, Button } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  buttonContainerStyle,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  linkStyle,
} from "./_layout";

/**
 * Stuck-customer rescue email.
 *
 * Sent by the daily /api/cron/stuck-customer-rescue job when a paid
 * customer hasn't moved their Memory in N+ days. Tone is Jason's
 * voice: warm, concrete, no guilt. Offers a single forward action
 * (continue building) plus a low-friction "what's blocking you" reply
 * fallback for customers who are blocked, not just busy.
 *
 * Personalization is per-merge-field — no LLM call per customer. The
 * variation comes from `daysIdle`, `nextChapterTitle`, and the
 * `blockerHint` (mechanically derived from which chapter has the most
 * unanswered questions).
 */
export type StuckCustomerRescuePayload = {
  firstName: string | null;
  /** Days since the customer's last Memory update. */
  daysIdle: number;
  /** Title of the chapter the customer should pick up next. */
  nextChapterTitle: string;
  /** Slug for deep-linking into /portal/chapter/<slug>. */
  nextChapterSlug: string;
  /** Number of unanswered required questions remaining across all chapters. */
  questionsRemaining: number;
  /**
   * Optional blocker hint based on which chapter has the most unanswered
   * questions. Renders as a callout suggesting a specific area where
   * we can help if they're stuck. Null hides the callout.
   */
  blockerHint: string | null;
  /** Site origin for absolute links — e.g. https://www.thefranchisorblueprint.com */
  siteUrl: string;
};

export function stuckCustomerRescueSubject(
  p: StuckCustomerRescuePayload,
): string {
  const name = p.firstName ?? "Hey";
  // Subject lines are A/B-testable later. Keep it concrete (the next
  // chapter, not "your Blueprint") so the inbox preview reads like a
  // human follow-up, not an automated drip.
  return `${name} — picking up on ${p.nextChapterTitle}?`;
}

export function StuckCustomerRescueEmail({
  firstName,
  daysIdle,
  nextChapterTitle,
  nextChapterSlug,
  questionsRemaining,
  blockerHint,
  siteUrl,
}: StuckCustomerRescuePayload) {
  const continueUrl = `${siteUrl}/portal/chapter/${nextChapterSlug}`;
  const dashboardUrl = `${siteUrl}/portal`;
  const idleLabel =
    daysIdle === 1
      ? "yesterday"
      : daysIdle <= 7
        ? `${daysIdle} days ago`
        : daysIdle <= 14
          ? "about two weeks ago"
          : "a few weeks back";

  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>From Jason</Text>
      <Heading as="h1" style={headingStyle}>
        {firstName
          ? `${firstName}, where'd we leave off?`
          : "Where'd we leave off?"}
      </Heading>

      <Text style={paragraphStyle}>
        I noticed your Blueprint was last touched {idleLabel}. No pressure —
        building a franchise system the right way takes weeks, not hours,
        and life gets in the way. But I wanted to check in.
      </Text>

      <Text style={paragraphStyle}>
        Your next move is{" "}
        <strong style={{ color: "#1E3A5F" }}>{nextChapterTitle}</strong>.{" "}
        {questionsRemaining > 0 ? (
          <>
            You&apos;ve got {questionsRemaining} question
            {questionsRemaining === 1 ? "" : "s"} left across the document
            before it&apos;s ready for legal review.
          </>
        ) : (
          <>
            You&apos;re close — the structured fields are filled, this chapter
            just needs prose-level polish before legal review.
          </>
        )}
      </Text>

      <Section style={buttonContainerStyle}>
        <Button href={continueUrl} style={buttonStyle}>
          Continue building →
        </Button>
      </Section>

      {blockerHint && (
        <Section style={callOutStyle}>
          <Heading
            as="h2"
            style={{ ...headingStyle, fontSize: "17px", margin: "0 0 8px" }}
          >
            Stuck on something specific?
          </Heading>
          <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
            {blockerHint}
          </Text>
          <Text style={{ ...paragraphStyle, margin: 0 }}>
            Just hit reply and tell me where you&apos;re stuck — one sentence
            is enough. I&apos;ll point you at the right reference doc, draft
            the section for you, or pull up an example from another founder
            who&apos;s been there.
          </Text>
        </Section>
      )}

      <Text style={paragraphStyle}>
        If now isn&apos;t the right time, that&apos;s fine — your work is
        saved, and I&apos;ll be here when you&apos;re back. Or if you&apos;ve
        decided franchising isn&apos;t the right move after all, let me know
        and we&apos;ll talk about a refund. The 30-day guarantee is real.
      </Text>

      <Text style={paragraphStyle}>
        Either way — let&apos;s get you across the line. <br />
        <span style={linkStyle}>— Jason</span>
      </Text>

      <Text
        style={{
          ...paragraphStyle,
          fontSize: "13px",
          color: "#888B92",
          margin: "24px 0 0",
        }}
      >
        You can also pick up from the{" "}
        <a href={dashboardUrl} style={linkStyle}>
          dashboard
        </a>
        , which shows everything that needs your input across all 16
        chapters.
      </Text>
    </EmailLayout>
  );
}

export function stuckCustomerRescueText(
  p: StuckCustomerRescuePayload,
): string {
  const name = p.firstName ?? "Hey";
  return [
    `${name} — where'd we leave off?`,
    "",
    `I noticed your Blueprint was last touched ${p.daysIdle} day${p.daysIdle === 1 ? "" : "s"} ago. No pressure — life gets in the way. Your next move is ${p.nextChapterTitle}.`,
    "",
    `Continue: ${p.siteUrl}/portal/chapter/${p.nextChapterSlug}`,
    "",
    p.blockerHint
      ? `Stuck on something specific? ${p.blockerHint} Just hit reply and tell me where you're stuck.`
      : "Stuck on something specific? Just hit reply and tell me where you're stuck.",
    "",
    "If now isn't the right time, your work is saved. If you've decided franchising isn't right after all, the 30-day guarantee is real — let me know.",
    "",
    "— Jason",
    "",
    `Or pick up from the dashboard: ${p.siteUrl}/portal`,
  ].join("\n");
}
