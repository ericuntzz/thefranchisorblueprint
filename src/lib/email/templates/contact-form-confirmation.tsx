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

export type ContactFormConfirmationPayload = {
  firstName: string | null;
  /** What they wrote in the message field — quoted back so they know we got it. */
  messagePreview: string | null;
  /** Calendly URL so they can self-serve a slot if they don't want to wait. */
  calendlyUrl: string;
};

export function contactFormConfirmationSubject(
  p: ContactFormConfirmationPayload,
): string {
  return p.firstName
    ? `Got it, ${p.firstName} — we'll be in touch within one business day`
    : "Got it — we'll be in touch within one business day";
}

export function ContactFormConfirmationEmail({
  firstName,
  messagePreview,
  calendlyUrl,
}: ContactFormConfirmationPayload) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>Submission received</Text>
      <Heading as="h1" style={headingStyle}>
        Got it — talk soon
      </Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Thanks for reaching out. Your strategy-call request is in the team
        inbox. Jason or someone on the team will reply within one business day
        with available times.
      </Text>

      {messagePreview && (
        <Section style={callOutStyle}>
          <Heading as="h2" style={subheadingStyle}>
            What you sent us
          </Heading>
          <Text style={{ ...paragraphStyle, fontStyle: "italic" }}>
            &ldquo;{messagePreview}&rdquo;
          </Text>
        </Section>
      )}

      <Text style={paragraphStyle}>
        <strong>Don&apos;t want to wait?</strong> Pick a time directly on our
        calendar — we&apos;ll skip the back-and-forth.
      </Text>

      <Section style={buttonContainerStyle}>
        <Button href={calendlyUrl} style={buttonStyle}>
          Book a 30-min call now
        </Button>
      </Section>

      <Text style={paragraphStyle}>
        While you wait, two things worth your time:
      </Text>
      <Text style={paragraphStyle}>
        <strong>1. Take the free Franchise Readiness Assessment.</strong>{" "}
        15 questions, ~5 minutes. You&apos;ll know exactly where your business
        stands — and we&apos;ll have your score on the call so we can skip the
        diagnostics.{" "}
        <Link href="https://www.thefranchisorblueprint.com/assessment">
          Take the assessment →
        </Link>
      </Text>
      <Text style={paragraphStyle}>
        <strong>2. Read the pricing breakdown.</strong> Walk into the call
        already knowing the cost landscape (and why ours is so different from
        the $40K–$80K firms).{" "}
        <Link href="https://www.thefranchisorblueprint.com/pricing">
          See the pricing →
        </Link>
      </Text>

      <Text style={paragraphStyle}>Talk soon.</Text>
      <Text style={paragraphStyle}>— The Franchisor Blueprint team</Text>
    </EmailLayout>
  );
}

export function contactFormConfirmationText(
  p: ContactFormConfirmationPayload,
): string {
  const greeting = p.firstName ? `Hi ${p.firstName},` : "Hi there,";
  return [
    greeting,
    ``,
    `Thanks for reaching out. Your strategy-call request is in our team inbox. Jason or someone on the team will reply within one business day with available times.`,
    ``,
    ...(p.messagePreview
      ? [`What you sent us:`, `"${p.messagePreview}"`, ``]
      : []),
    `Don't want to wait? Pick a time directly on our calendar:`,
    p.calendlyUrl,
    ``,
    `WHILE YOU WAIT`,
    ``,
    `1. Take the free Franchise Readiness Assessment (15 questions, ~5 minutes). You'll know exactly where your business stands - and we'll have your score on the call:`,
    `https://www.thefranchisorblueprint.com/assessment`,
    ``,
    `2. Read the pricing breakdown. Walk into the call already knowing the cost landscape (and why ours is so different from the $40K-$80K firms):`,
    `https://www.thefranchisorblueprint.com/pricing`,
    ``,
    `Talk soon.`,
    ``,
    `- The Franchisor Blueprint team`,
    ``,
    `---`,
    `thefranchisorblueprint.com`,
  ].join("\n");
}
