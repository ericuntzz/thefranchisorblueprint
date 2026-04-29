import { Heading, Section, Text, Button, Link } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  buttonContainerStyle,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  subheadingStyle,
} from "./_layout";

export type WelcomePayload = {
  firstName: string | null;
  productName: string;
  amountFormatted: string; // e.g. "$2,997.00"
  magicLink: string;
};

export function welcomeSubject(p: WelcomePayload): string {
  return `Welcome to ${p.productName}, ${p.firstName ?? "friend"}`;
}

export function WelcomeEmail({
  firstName,
  productName,
  amountFormatted,
  magicLink,
}: WelcomePayload) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>You&apos;re in</Text>
      <Heading as="h1" style={headingStyle}>
        Welcome to {productName}
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Your purchase of {productName} is confirmed ({amountFormatted}). Click
        the button below for one-click access to your franchisor operating
        system. No password — just one secure link.
      </Text>

      <Section style={buttonContainerStyle}>
        <Button href={magicLink} style={buttonStyle}>
          Access your portal
        </Button>
      </Section>

      <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92", textAlign: "center" }}>
        This link expires in 1 hour. Need a new one any time? Visit{" "}
        <Link href="https://www.thefranchisorblueprint.com/portal/login">
          thefranchisorblueprint.com/portal/login
        </Link>
        .
      </Text>

      <Section style={callOutStyle}>
        <Heading as="h2" style={subheadingStyle}>
          What happens next
        </Heading>
        <Text style={paragraphStyle}>
          <strong>1. Open your portal.</strong> Your nine capabilities are
          grouped into four phases: Discover → Architect → Activate → Acquire.
          Start with Phase 1 (Audit + Model) — about 60–90 minutes of focused
          work, and you&apos;ll know whether your business is franchise-ready.
        </Text>
        <Text style={paragraphStyle}>
          <strong>2. Schedule your 60-minute onboarding call.</strong> Our team
          will reach out within one business day. Jason will walk you through
          your specific situation and map your first 30 days.
        </Text>
        <Text style={paragraphStyle}>
          <strong>3. Reply any time.</strong> You have 30 days of email support
          built in. Just reply to this email — it lands in our team inbox.
        </Text>
      </Section>

      <Text style={paragraphStyle}>
        We&apos;re excited to build this with you.
      </Text>
      <Text style={paragraphStyle}>— The Franchisor Blueprint team</Text>
    </EmailLayout>
  );
}

export function welcomeText(p: WelcomePayload): string {
  return [
    `Welcome to ${p.productName}, ${p.firstName ?? "friend"}!`,
    ``,
    `Your purchase of ${p.productName} is confirmed (${p.amountFormatted}).`,
    ``,
    `Access your portal:`,
    p.magicLink,
    ``,
    `(This link expires in 1 hour. Need a new one any time? Visit https://www.thefranchisorblueprint.com/portal/login)`,
    ``,
    `WHAT HAPPENS NEXT`,
    ``,
    `1. Open your portal. Your nine capabilities are grouped into four phases: Discover -> Architect -> Activate -> Acquire. Start with Phase 1 (Audit + Model) - about 60-90 minutes of focused work, and you'll know whether your business is franchise-ready.`,
    ``,
    `2. Schedule your 60-minute onboarding call. Our team will reach out within one business day.`,
    ``,
    `3. Reply any time. You have 30 days of email support built in.`,
    ``,
    `We're excited to build this with you.`,
    ``,
    `- The Franchisor Blueprint team`,
    ``,
    `---`,
    `thefranchisorblueprint.com`,
  ].join("\n");
}
