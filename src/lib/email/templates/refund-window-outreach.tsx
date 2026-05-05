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
 * Refund-window proactive outreach email.
 *
 * Sent by /api/cron/refund-window-outreach when a customer is
 * approaching the 30-day satisfaction-guarantee window with low
 * Memory engagement. Jason's voice: warm, no guilt, genuinely
 * offers help OR a refund. The goal is to save the customer before
 * they silently churn — or honor the guarantee gracefully.
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
  daysRemaining,
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
          helped hundreds of founders through exactly these chapters, and
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

      <Section style={callOutStyle}>
        <Heading
          as="h2"
          style={{ ...headingStyle, fontSize: "17px", margin: "0 0 12px" }}
        >
          If you&apos;ve changed your mind
        </Heading>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          The 30-day satisfaction guarantee is real — you have{" "}
          <strong style={{ color: "#1E3A5F" }}>{daysRemaining} day{daysRemaining === 1 ? "" : "s"}</strong>{" "}
          left. Reply to this email and say the word, and I&apos;ll
          process a full refund. No questions, no awkwardness. Franchising
          isn&apos;t for everyone, and I&apos;d rather you find that out
          now than feel stuck.
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
    `Your readiness is at ${p.readinessPct}%, and you have ${p.daysRemaining} day${p.daysRemaining === 1 ? "" : "s"} left on the 30-day satisfaction guarantee.`,
    "",
    "If you're stuck, hit reply and tell me where — one sentence is enough.",
    "If you're just busy, no worries — your work is saved.",
    "If you've changed your mind, reply and I'll process a full refund. No questions.",
    "",
    `Open your Blueprint: ${p.siteUrl}/portal`,
    "",
    "— Jason",
  ].join("\n");
}
