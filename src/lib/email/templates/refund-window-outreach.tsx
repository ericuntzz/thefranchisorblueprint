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
 * Early-customer outreach email.
 *
 * Sent by /api/cron/refund-window-outreach when a customer is in
 * their first 30 days with low Memory engagement. Jason's voice:
 * warm, no guilt, genuinely offers help. The goal is to save the
 * customer before they silently churn.
 *
 * NOTE: previously included a 30-day refund-guarantee escape valve,
 * removed when that policy was retired (2026-05-05).
 */
export type RefundWindowOutreachPayload = {
  firstName: string | null;
  daysRemaining: number;
  readinessPct: number;
  siteUrl: string;
};

export function refundWindowOutreachSubject(
  p: RefundWindowOutreachPayload,
): string {
  const name = p.firstName ?? "Hey";
  return `${name} — quick check-in on your Blueprint`;
}

export function RefundWindowOutreachEmail({
  firstName,
  readinessPct,
  siteUrl,
}: RefundWindowOutreachPayload) {
  const portalUrl = `${siteUrl}/portal`;
  const greeting = firstName ? `${firstName}, quick` : "Quick";

  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>From Jason</Text>
      <Heading as="h1" style={headingStyle}>
        {greeting} check-in
      </Heading>

      <Text style={paragraphStyle}>
        I wanted to reach out because you signed up for The Blueprint a
        few weeks ago, and it looks like you haven&apos;t had a chance to
        dig in yet. Your readiness is at {readinessPct}%, which tells me
        you might be stuck, busy, or maybe wondering if this is the
        right move.
      </Text>

      <Text style={paragraphStyle}>All three are fine. Here&apos;s what I&apos;d suggest:</Text>

      <Section style={callOutStyle}>
        <Heading
          as="h2"
          style={{ ...headingStyle, fontSize: "17px", margin: "0 0 12px" }}
        >
          If you&apos;re stuck
        </Heading>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          Hit reply and tell me where. One sentence is enough. I&apos;ve
          helped hundreds of founders through exactly these sections, and
          I can usually unblock you in one email or a 15-minute call.
        </Text>
      </Section>

      <Section style={callOutStyle}>
        <Heading
          as="h2"
          style={{ ...headingStyle, fontSize: "17px", margin: "0 0 12px" }}
        >
          If you&apos;re just busy
        </Heading>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          No worries — your work is saved and I&apos;ll be here when
          you&apos;re ready. You can pick up right where you left off.
        </Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <Button href={portalUrl} style={buttonStyle}>
          Open your Blueprint
        </Button>
      </Section>

      <Text style={paragraphStyle}>
        Either way, I&apos;m rooting for you.
        <br />
        <span style={linkStyle}>— Jason</span>
      </Text>
    </EmailLayout>
  );
}

export function refundWindowOutreachText(
  p: RefundWindowOutreachPayload,
): string {
  const name = p.firstName ?? "Hey";
  return [
    `${name} — quick check-in on your Blueprint`,
    "",
    `Your readiness is at ${p.readinessPct}%. Looks like you might be stuck or busy — both fine.`,
    "",
    "If you're stuck, hit reply and tell me where — one sentence is enough.",
    "If you're just busy, no worries — your work is saved.",
    "",
    `Open your Blueprint: ${p.siteUrl}/portal`,
    "",
    "— Jason",
  ].join("\n");
}
