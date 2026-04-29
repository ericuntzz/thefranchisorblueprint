import { Heading, Section, Text, Hr } from "@react-email/components";
import {
  EmailLayout,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  subheadingStyle,
} from "./_layout";

export type InternalLeadNotificationPayload = {
  source: "contact-form" | "newsletter";
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  annualRevenue?: string | null;
  programInterest?: string | null;
  message?: string | null;
  /** Direct link to the row in the Supabase dashboard. */
  supabaseRowUrl?: string | null;
  /** ISO timestamp of submission for context. */
  submittedAt: string;
};

export function internalLeadNotificationSubject(
  p: InternalLeadNotificationPayload,
): string {
  if (p.source === "newsletter") {
    return `[TFB Lead] Newsletter signup — ${p.email}`;
  }
  const who = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
  const what = p.businessName ? ` (${p.businessName})` : "";
  return `[TFB Lead] Strategy call request — ${who}${what}`;
}

export function InternalLeadNotificationEmail(p: InternalLeadNotificationPayload) {
  const who = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>
        New {p.source === "newsletter" ? "newsletter signup" : "strategy-call lead"}
      </Text>
      <Heading as="h1" style={headingStyle}>
        {who || p.email}
        {p.businessName ? ` · ${p.businessName}` : ""}
      </Heading>

      <Section style={callOutStyle}>
        <Heading as="h2" style={subheadingStyle}>
          Contact details
        </Heading>
        <Text style={paragraphStyle}>
          <strong>Email:</strong> {p.email}
        </Text>
        {who && (
          <Text style={paragraphStyle}>
            <strong>Name:</strong> {who}
          </Text>
        )}
        {p.businessName && (
          <Text style={paragraphStyle}>
            <strong>Business:</strong> {p.businessName}
          </Text>
        )}
        {p.annualRevenue && (
          <Text style={paragraphStyle}>
            <strong>Annual revenue:</strong> {p.annualRevenue}
          </Text>
        )}
        {p.programInterest && (
          <Text style={paragraphStyle}>
            <strong>Program interest:</strong> {p.programInterest}
          </Text>
        )}
      </Section>

      {p.message && (
        <Section style={callOutStyle}>
          <Heading as="h2" style={subheadingStyle}>
            What they wrote
          </Heading>
          <Text style={{ ...paragraphStyle, fontStyle: "italic" }}>
            &ldquo;{p.message}&rdquo;
          </Text>
        </Section>
      )}

      <Hr />
      <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92" }}>
        Submitted {p.submittedAt}.{" "}
        {p.supabaseRowUrl
          ? "Full record in Supabase contact_submissions table."
          : "Stored in Supabase contact_submissions / newsletter_subscribers."}
      </Text>
    </EmailLayout>
  );
}

export function internalLeadNotificationText(
  p: InternalLeadNotificationPayload,
): string {
  const who = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const lines = [
    `NEW ${p.source === "newsletter" ? "NEWSLETTER SIGNUP" : "STRATEGY-CALL LEAD"}`,
    ``,
    `Email: ${p.email}`,
  ];
  if (who) lines.push(`Name: ${who}`);
  if (p.businessName) lines.push(`Business: ${p.businessName}`);
  if (p.annualRevenue) lines.push(`Annual revenue: ${p.annualRevenue}`);
  if (p.programInterest) lines.push(`Program interest: ${p.programInterest}`);
  if (p.message) {
    lines.push(``, `Message:`, `"${p.message}"`);
  }
  lines.push(``, `Submitted ${p.submittedAt}.`);
  return lines.join("\n");
}
