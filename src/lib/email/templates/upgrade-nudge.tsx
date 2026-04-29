import { Heading, Section, Text, Button } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  buttonContainerStyle,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
} from "./_layout";

export type UpgradeNudgePayload = {
  firstName: string | null;
  currentTierName: string;       // e.g. "The Blueprint"
  upgradeUrl: string;            // e.g. https://www.thefranchisorblueprint.com/portal/upgrade
  hoursRemaining: number;        // for the 10% promo countdown line
  promoPriceFormatted: string;   // e.g. "$4,953"
  basePriceFormatted: string;    // e.g. "$5,503"
  targetTierName: string;        // e.g. "Navigator"
};

export function upgradeNudgeSubject(p: UpgradeNudgePayload): string {
  return `${p.firstName ?? "Quick note"}: get ${p.targetTierName} for ${p.promoPriceFormatted} (next ${p.hoursRemaining}h)`;
}

export function UpgradeNudgeEmail({
  firstName,
  currentTierName,
  upgradeUrl,
  hoursRemaining,
  promoPriceFormatted,
  basePriceFormatted,
  targetTierName,
}: UpgradeNudgePayload) {
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>Limited-time offer</Text>
      <Heading as="h1" style={headingStyle}>
        {firstName ? `${firstName}, want a coach for the hard parts?` : "Want a coach for the hard parts?"}
      </Heading>

      <Text style={paragraphStyle}>
        You just bought {currentTierName} — smart move. Most founders do great
        with the documents alone. But the next phase (Architect — Operations
        Manual, FDD breakdown, attorney coordination) is where 80% of the time
        gets spent, and it&apos;s where 1:1 coaching dramatically compresses the
        timeline.
      </Text>

      <Text style={paragraphStyle}>
        Here&apos;s what {targetTierName} adds on top of what you already have:
      </Text>

      <Section style={callOutStyle}>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          • <strong>24 weekly 1:1 coaching calls</strong> with Jason
        </Text>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          • <strong>Document review + feedback</strong> on every template you complete
        </Text>
        <Text style={{ ...paragraphStyle, margin: "0 0 8px" }}>
          • <strong>Monthly milestone gates</strong> so you don&apos;t drift
        </Text>
        <Text style={{ ...paragraphStyle, margin: "0" }}>
          • <strong>Slack support + attorney/CPA referrals</strong>
        </Text>
      </Section>

      <Heading as="h2" style={{ ...headingStyle, fontSize: "20px", margin: "24px 0 12px" }}>
        Your upgrade price
      </Heading>

      <Text style={paragraphStyle}>
        Because you already paid for {currentTierName}, that money carries
        forward as credit. You&apos;d normally pay {basePriceFormatted} to
        upgrade. For the next <strong>{hoursRemaining} hours</strong>, take
        another <strong>10% off</strong>:
      </Text>

      <Text
        style={{
          ...paragraphStyle,
          fontSize: "32px",
          fontWeight: 800,
          color: "#1E3A5F",
          textAlign: "center",
          margin: "16px 0",
        }}
      >
        {promoPriceFormatted}
        <span style={{ fontSize: "14px", color: "#888B92", fontWeight: 400, marginLeft: "8px", textDecoration: "line-through" }}>
          {basePriceFormatted}
        </span>
      </Text>

      <Section style={buttonContainerStyle}>
        <Button href={upgradeUrl} style={buttonStyle}>
          See upgrade details
        </Button>
      </Section>

      <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92", textAlign: "center" }}>
        After {hoursRemaining}h, the credit-forward base price stays in
        place — only the 10% promo expires. So you can still upgrade later
        at {basePriceFormatted}, no rush.
      </Text>
    </EmailLayout>
  );
}

export function upgradeNudgeText(p: UpgradeNudgePayload): string {
  return [
    `${p.firstName ?? "Hi there"}, want a coach for the hard parts?`,
    ``,
    `You just bought ${p.currentTierName} — smart move. Most founders do great with the documents alone. But the next phase (Architect — Operations Manual, FDD breakdown, attorney coordination) is where 80% of the time gets spent, and it's where 1:1 coaching dramatically compresses the timeline.`,
    ``,
    `Here's what ${p.targetTierName} adds:`,
    ``,
    `• 24 weekly 1:1 coaching calls with Jason`,
    `• Document review + feedback on every template`,
    `• Monthly milestone gates so you don't drift`,
    `• Slack support + attorney/CPA referrals`,
    ``,
    `YOUR UPGRADE PRICE`,
    ``,
    `Because you already paid for ${p.currentTierName}, that money carries forward as credit. You'd normally pay ${p.basePriceFormatted} to upgrade. For the next ${p.hoursRemaining} hours, take another 10% off:`,
    ``,
    `${p.promoPriceFormatted} (was ${p.basePriceFormatted})`,
    ``,
    `See upgrade details:`,
    p.upgradeUrl,
    ``,
    `After ${p.hoursRemaining}h, the credit-forward base price stays in place — only the 10% promo expires. So you can still upgrade later at ${p.basePriceFormatted}, no rush.`,
    ``,
    `— The Franchisor Blueprint team`,
  ].join("\n");
}
