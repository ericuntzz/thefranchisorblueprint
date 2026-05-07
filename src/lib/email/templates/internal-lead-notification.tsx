import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import {
  EmailLayout,
  buttonStyle,
  callOutStyle,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  subheadingStyle,
} from "./_layout";
import type { AssessmentBand } from "@/lib/supabase/types";

/**
 * Optional assessment-specific enrichment passed alongside the base lead
 * payload. Built server-side in /api/assessment/complete so the template
 * stays a dumb renderer — no scoring or recommendation logic in the email.
 */
export type AssessmentLeadContext = {
  band: AssessmentBand;
  bandTitle: string;
  totalScore: number;
  maxScore: number;
  websiteUrl: string | null;
  strongestCategory: string;
  weakestCategory: string;
  categoryBreakdown: Array<{ title: string; score: number; max: number }>;
  /**
   * Lead heat from a sales-priority standpoint. franchise_ready and
   * nearly_there are "hot" — call within the hour. building_foundation
   * is "warm" — same-day. early_stage is "cool" — auto-roadmap, no chase.
   */
  leadTemperature: "hot" | "warm" | "cool";
  /** What Jason should actually do, in plain English. */
  recommendedAction: string;
  /** Pre-built mailto link with subject + body draft. */
  mailtoUrl: string;
  /** LinkedIn people-search URL with name + business pre-filled. Null when no name. */
  linkedInSearchUrl: string | null;
};

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
  /** Assessment-only: rich context for fast follow-up. When present, the
   *  template renders the temperature banner, recommended action, and
   *  one-click mailto/LinkedIn buttons. */
  assessment?: AssessmentLeadContext | null;
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
    const heatPrefix =
      p.assessment?.leadTemperature === "hot"
        ? "🔥 HOT LEAD"
        : p.assessment?.leadTemperature === "warm"
          ? "Warm lead"
          : "[TFB Lead]";
    return `${heatPrefix} — ${who} · ${p.assessmentScore ?? "score n/a"}`;
  }
  const who = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
  const what = p.businessName ? ` (${p.businessName})` : "";
  return `[TFB Lead] Strategy call request — ${who}${what}`;
}

const tempBannerStyle = (temp: AssessmentLeadContext["leadTemperature"]): React.CSSProperties => ({
  backgroundColor:
    temp === "hot" ? "#fee2e2" : temp === "warm" ? "#fef3c7" : "#f3f4f6",
  color:
    temp === "hot" ? "#991b1b" : temp === "warm" ? "#92400e" : "#4f5562",
  padding: "12px 16px",
  borderRadius: "6px",
  margin: "0 0 16px",
  fontSize: "14px",
  fontWeight: 600,
});

const ctaButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  display: "inline-block",
  marginRight: "8px",
  marginBottom: "8px",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
  backgroundColor: "#f3f4f6",
  color: "#1E3A5F",
  border: "1px solid rgba(30, 58, 95, 0.12)",
  marginRight: "8px",
  marginBottom: "8px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
  margin: "8px 0 0",
};

const tdStyle: React.CSSProperties = {
  color: "#4F5562",
  padding: "4px 8px 4px 0",
  borderBottom: "1px solid rgba(30, 58, 95, 0.04)",
  verticalAlign: "top" as const,
};

export function InternalLeadNotificationEmail(p: InternalLeadNotificationPayload) {
  const who = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const a = p.assessment;

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

      {/* ─── Lead temperature + recommended action (assessment only) ─── */}
      {a && (
        <>
          <div style={tempBannerStyle(a.leadTemperature)}>
            {a.leadTemperature === "hot"
              ? "🔥 HOT LEAD — call within the hour while they're still warm."
              : a.leadTemperature === "warm"
                ? "Warm lead — reach out today."
                : "Cool lead — auto-roadmap email handles this. No personal outreach needed."}
          </div>
          <Section style={callOutStyle}>
            <Heading as="h2" style={subheadingStyle}>
              Recommended next move
            </Heading>
            <Text style={paragraphStyle}>{a.recommendedAction}</Text>
          </Section>
          {(a.leadTemperature === "hot" || a.leadTemperature === "warm") && (
            <Section style={{ margin: "0 0 16px" }}>
              <Button href={a.mailtoUrl} style={ctaButtonStyle}>
                Email {p.firstName ?? "lead"} now
              </Button>
              {a.linkedInSearchUrl && (
                <Button
                  href={a.linkedInSearchUrl}
                  style={secondaryButtonStyle}
                >
                  Find on LinkedIn
                </Button>
              )}
              {a.websiteUrl && (
                <Button href={a.websiteUrl} style={secondaryButtonStyle}>
                  Visit their site
                </Button>
              )}
            </Section>
          )}
        </>
      )}

      {/* ─── Contact details ─── */}
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
        {a?.websiteUrl && (
          <Text style={paragraphStyle}>
            <strong>Website:</strong>{" "}
            <a
              href={a.websiteUrl}
              style={{ color: "#1E3A5F", fontWeight: 600 }}
            >
              {a.websiteUrl}
            </a>
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

      {/* ─── Category breakdown (assessment only) ─── */}
      {a && a.categoryBreakdown.length > 0 && (
        <Section style={callOutStyle}>
          <Heading as="h2" style={subheadingStyle}>
            Category breakdown
          </Heading>
          <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92" }}>
            Strongest: <strong>{a.strongestCategory}</strong> · Biggest gap:{" "}
            <strong>{a.weakestCategory}</strong>
          </Text>
          <table style={tableStyle}>
            <tbody>
              {a.categoryBreakdown.map((c, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{c.title}</td>
                  <td style={{ ...tdStyle, textAlign: "right" as const }}>
                    {c.score}/{c.max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

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
          ? p.source === "assessment"
            ? "View their full result page (link above)."
            : "Full record in Supabase contact_submissions table."
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
        ? p.assessment?.leadTemperature === "hot"
          ? "🔥 HOT ASSESSMENT LEAD"
          : "ASSESSMENT LEAD"
        : "STRATEGY-CALL LEAD";
  const lines = [`NEW ${sourceLabel}`, ``];

  if (p.assessment) {
    lines.push(`>> ${p.assessment.recommendedAction}`, ``);
  }

  lines.push(`Email: ${p.email}`);
  if (who) lines.push(`Name: ${who}`);
  if (p.businessName) lines.push(`Business: ${p.businessName}`);
  if (p.assessment?.websiteUrl) lines.push(`Website: ${p.assessment.websiteUrl}`);
  if (p.annualRevenue) lines.push(`Annual revenue: ${p.annualRevenue}`);
  if (p.programInterest) lines.push(`Program interest: ${p.programInterest}`);
  if (p.assessmentScore) lines.push(`Assessment score: ${p.assessmentScore}`);
  if (p.urgency) lines.push(`Urgency: ${p.urgency}`);

  if (p.assessment) {
    lines.push(
      ``,
      `Strongest: ${p.assessment.strongestCategory}`,
      `Biggest gap: ${p.assessment.weakestCategory}`,
      ``,
      `One-click follow-up:`,
      `  Email draft: ${p.assessment.mailtoUrl}`,
    );
    if (p.assessment.linkedInSearchUrl) {
      lines.push(`  LinkedIn:    ${p.assessment.linkedInSearchUrl}`);
    }
  }

  if (p.message) {
    lines.push(``, `Message:`, `"${p.message}"`);
  }
  lines.push(``, `Submitted ${p.submittedAt}.`);
  return lines.join("\n");
}
