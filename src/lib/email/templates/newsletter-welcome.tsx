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

export type NewsletterWelcomePayload = {
  /** The recipient's email — used to render the unsubscribe link. */
  email: string;
};

export function newsletterWelcomeSubject(_p: NewsletterWelcomePayload): string {
  return "You're in — what to expect from The Franchisor Blueprint blog";
}

export function NewsletterWelcomeEmail({ email }: NewsletterWelcomePayload) {
  const unsubscribeUrl = `https://www.thefranchisorblueprint.com/blog/unsubscribe?email=${encodeURIComponent(email)}`;
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>Welcome to the list</Text>
      <Heading as="h1" style={headingStyle}>
        You&apos;re in
      </Heading>
      <Text style={paragraphStyle}>Hi there,</Text>
      <Text style={paragraphStyle}>
        Thanks for subscribing to The Franchisor Blueprint blog. You&apos;ll
        get one franchise-development insight per week — frameworks,
        walkthroughs, and case studies from someone who&apos;s spent 30+
        years inside this industry.
      </Text>

      <Section style={callOutStyle}>
        <Heading as="h2" style={subheadingStyle}>
          Worth reading first
        </Heading>
        <Text style={paragraphStyle}>
          Two posts you&apos;ll probably want straight away:
        </Text>
        <Text style={paragraphStyle}>
          <strong>
            <Link href="https://www.thefranchisorblueprint.com/blog/the-real-cost-of-franchising-your-business">
              The Real Cost of Franchising Your Business in 2026 →
            </Link>
          </strong>
          <br />
          The full pricing breakdown — including the line items most
          consultants don&apos;t want you to see.
        </Text>
        <Text style={paragraphStyle}>
          <strong>
            <Link href="https://www.thefranchisorblueprint.com/blog/is-my-business-ready-to-franchise">
              Is My Business Ready to Franchise? A 10-Point Checklist →
            </Link>
          </strong>
          <br />
          The non-negotiable signals that separate a franchise-ready business
          from a great single location.
        </Text>
      </Section>

      <Text style={paragraphStyle}>
        And if you&apos;d rather skip the reading and just talk:
      </Text>

      <Section style={buttonContainerStyle}>
        <Button
          href="https://www.thefranchisorblueprint.com/strategy-call"
          style={buttonStyle}
        >
          Book a free 30-min strategy call
        </Button>
      </Section>

      <Text style={paragraphStyle}>— The Franchisor Blueprint team</Text>

      <Text
        style={{
          ...paragraphStyle,
          fontSize: "12px",
          color: "#888B92",
          textAlign: "center",
          marginTop: "32px",
        }}
      >
        You&apos;re receiving this because you subscribed at
        thefranchisorblueprint.com.{" "}
        <Link href={unsubscribeUrl} style={{ color: "#888B92" }}>
          Unsubscribe
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export function newsletterWelcomeText(p: NewsletterWelcomePayload): string {
  return [
    `Welcome to The Franchisor Blueprint blog.`,
    ``,
    `Thanks for subscribing. You'll get one franchise-development insight per week - frameworks, walkthroughs, and case studies from someone who's spent 30+ years inside this industry.`,
    ``,
    `WORTH READING FIRST`,
    ``,
    `1. The Real Cost of Franchising Your Business in 2026:`,
    `https://www.thefranchisorblueprint.com/blog/the-real-cost-of-franchising-your-business`,
    ``,
    `2. Is My Business Ready to Franchise? A 10-Point Checklist:`,
    `https://www.thefranchisorblueprint.com/blog/is-my-business-ready-to-franchise`,
    ``,
    `If you'd rather skip the reading and just talk, book a free 30-min strategy call:`,
    `https://www.thefranchisorblueprint.com/strategy-call`,
    ``,
    `- The Franchisor Blueprint team`,
    ``,
    `---`,
    `You're receiving this because you subscribed at thefranchisorblueprint.com.`,
    `Unsubscribe: https://www.thefranchisorblueprint.com/blog/unsubscribe?email=${encodeURIComponent(p.email)}`,
  ].join("\n");
}
