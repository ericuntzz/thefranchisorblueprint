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
  source: "contact-form" | "newsletter" | "assessment";
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  annualRevenue?: string | null;
  programInterest?: string | null;
  message?: string | null;
  /** Assessment-only: completed score readout, e.g. "32/45 — Nearly There". */
  assessmentScore?: string | null;
  /** Assessment-only: how urgent the prospect said this is. */
  urgency?: string | null;
  /** Direct link to the row in the Supabase dashboard or the result page. */
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
  if (p.source === "assessment") {
    const who = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
    return `[TFB Lead] Assessment completed — ${who} · ${p.assessmentScore ?? "score n/a"}`;
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
        New{" "}
        {p.source === "newsletter"
          ? "newsletter signup"
          : p.source === "assessment"
            ? "assessment lead"
            : "strategy-call lead"}
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
        {p.assessmentScore && (
          <Text style={paragraphStyle}>
            <strong>Assessment score:</strong> {p.assessmentScore}
          </Text>
        )}
        {p.urgency && (
          <Text style={paragraphStyle}>
            <strong>Urgency:</strong> {p.urgency}
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
  const sourceLabel =
    p.source === "newsletter"
      ? "NEWSLETTER SIGNUP"
      : p.source === "assessment"
        ? "ASSESSMENT LEAD"
        : "STRATEGY-CALL LEAD";
  const lines = [`NEW ${sourceLabel}`, ``, `Email: ${p.email}`];
  if (who) lines.push(`Name: ${who}`);
  if (p.businessName) lines.push(`Business: ${p.businessName}`);
  if (p.annualRevenue) lines.push(`Annual revenue: ${p.annualRevenue}`);
  if (p.programInterest) lines.push(`Program interest: ${p.programInterest}`);
  if (p.assessmentScore) lines.push(`Assessment score: ${p.assessmentScore}`);
  if (p.urgency) lines.push(`Urgency: ${p.urgency}`);
  if (p.message) {
    lines.push(``, `Message:`, `"${p.message}"`);
  }
  lines.push(``, `Submitted ${p.submittedAt}.`);
  return lines.join("\n");
}
