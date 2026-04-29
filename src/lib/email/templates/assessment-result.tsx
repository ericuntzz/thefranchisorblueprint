import { Heading, Section, Text, Button, Link, Hr } from "@react-email/components";
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

/**
 * Sent immediately after a user completes the Franchise Readiness
 * Assessment. Personalized score readout + band-specific CTA + per-category
 * breakdown bars + link back to the live result page (where they can also
 * download the branded PDF).
 *
 * The body intentionally MIRRORS the result page rather than being a
 * teaser — most prospects open the email later and we want them to be
 * able to act from the inbox. The branded PDF report is attached
 * separately by the dispatcher.
 */
export type AssessmentResultPayload = {
  firstName: string;
  totalScore: number;
  maxScore: number;
  bandTitle: string;
  bandHeadline: string;
  bandSummary: string;
  /** "/assessment/result/<sessionId>?token=..." absolute or relative. */
  resultUrl: string;
  /** Where the band wants the user to go next (strategy call, blueprint, etc). */
  primaryCtaLabel: string;
  /** Same href used on the result page; null = no actionable URL (early_stage band). */
  primaryCtaHref: string | null;
  /** One-sentence rationale shown above the CTA. */
  rationale: string;
  /** Per-category bars: title + score + max + ratio (0-1). */
  categories: Array<{
    title: string;
    score: number;
    max: number;
    ratio: number;
  }>;
  /** Strongest + biggest-gap so we can call them out by name. */
  strongest: { title: string };
  weakest: { title: string };
};

export function assessmentResultSubject(p: AssessmentResultPayload): string {
  return `${p.firstName}, your Franchise Readiness score is ${p.totalScore}/${p.maxScore} — ${p.bandTitle}`;
}

export function assessmentResultText(p: AssessmentResultPayload): string {
  const cta = p.primaryCtaHref
    ? `${p.primaryCtaLabel}: ${p.primaryCtaHref}`
    : p.primaryCtaLabel;
  return [
    `Hi ${p.firstName},`,
    ``,
    `Your Franchise Readiness Score: ${p.totalScore} of ${p.maxScore} (${p.bandTitle})`,
    ``,
    p.bandHeadline,
    ``,
    p.bandSummary,
    ``,
    `Your strongest area: ${p.strongest.title}`,
    `Biggest gap: ${p.weakest.title}`,
    ``,
    `Recommended next step: ${cta}`,
    p.rationale,
    ``,
    `View your full report online: ${p.resultUrl}`,
    ``,
    `— Jason and the team at The Franchisor Blueprint`,
  ].join("\n");
}

// ─── Visual styles (extend the shared _layout vocabulary) ──────────────
const scoreCardStyle: React.CSSProperties = {
  backgroundColor: "#1e3a5f",
  borderRadius: "16px",
  padding: "24px",
  margin: "20px 0",
  color: "#ffffff",
};
const scoreNumberStyle: React.CSSProperties = {
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "48px",
  fontWeight: 800,
  color: "#d4af37",
  lineHeight: 1,
  margin: "0 0 4px 0",
};
const scoreOutOfStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.7)",
  margin: "0 0 12px 0",
};
const bandLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  color: "#d4af37",
  margin: "0 0 4px 0",
};
const bandTitleStyle: React.CSSProperties = {
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "20px",
  fontWeight: 800,
  color: "#ffffff",
  margin: "0 0 6px 0",
};
const bandHeadlineStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "rgba(255,255,255,0.9)",
  margin: "0",
};
const categoryRowStyle: React.CSSProperties = {
  marginBottom: "12px",
};
const categoryNameStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#1e3a5f",
  margin: "0 0 4px 0",
};
const categoryBarTrackStyle: React.CSSProperties = {
  backgroundColor: "#e9eef3",
  height: "8px",
  borderRadius: "4px",
  overflow: "hidden" as const,
};
function categoryBarFillStyle(ratio: number): React.CSSProperties {
  return {
    backgroundColor: "#d4af37",
    height: "8px",
    width: `${Math.max(2, ratio * 100)}%`,
  };
}
const highlightCardStyle: React.CSSProperties = {
  backgroundColor: "#ece9df",
  borderRadius: "12px",
  padding: "14px 16px",
  margin: "8px 0",
};
const highlightLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  color: "#d8a936",
  margin: "0 0 4px 0",
};

export function AssessmentResultEmail(p: AssessmentResultPayload) {
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>Your Franchise Readiness score</Text>
      <Heading as="h1" style={headingStyle}>
        Hi {p.firstName} — here&apos;s your honest read.
      </Heading>

      {/* Score card */}
      <Section style={scoreCardStyle}>
        <Text style={scoreNumberStyle}>{p.totalScore}</Text>
        <Text style={scoreOutOfStyle}>of {p.maxScore} points</Text>
        <Text style={bandLabelStyle}>{p.bandTitle}</Text>
        <Text style={bandTitleStyle}>{p.bandHeadline}</Text>
        <Text style={bandHeadlineStyle}>{p.bandSummary}</Text>
      </Section>

      {/* Highlights */}
      <Section style={highlightCardStyle}>
        <Text style={highlightLabelStyle}>Strongest area</Text>
        <Text style={{ ...paragraphStyle, margin: "0", fontWeight: 700, color: "#1e3a5f" }}>
          {p.strongest.title}
        </Text>
      </Section>
      <Section style={highlightCardStyle}>
        <Text style={highlightLabelStyle}>Biggest gap</Text>
        <Text style={{ ...paragraphStyle, margin: "0", fontWeight: 700, color: "#1e3a5f" }}>
          {p.weakest.title}
        </Text>
      </Section>

      {/* Category bars */}
      <Heading as="h2" style={subheadingStyle}>
        Category breakdown
      </Heading>
      <Section style={{ marginBottom: "16px" }}>
        {p.categories.map((c) => (
          <Section key={c.title} style={categoryRowStyle}>
            <Text style={categoryNameStyle}>
              {c.title}{" "}
              <span style={{ color: "#888B92", fontWeight: 600 }}>
                · {c.score}/{c.max}
              </span>
            </Text>
            <div style={categoryBarTrackStyle}>
              <div style={categoryBarFillStyle(c.ratio)} />
            </div>
          </Section>
        ))}
      </Section>

      {/* Recommendation + CTA */}
      <Section style={callOutStyle}>
        <Text style={eyebrowStyle}>Your recommended next step</Text>
        <Heading as="h2" style={subheadingStyle}>
          {p.primaryCtaLabel}
        </Heading>
        <Text style={paragraphStyle}>{p.rationale}</Text>
        {p.primaryCtaHref && (
          <Section style={buttonContainerStyle}>
            <Button href={p.primaryCtaHref} style={buttonStyle}>
              {p.primaryCtaLabel}
            </Button>
          </Section>
        )}
      </Section>

      <Hr style={{ borderColor: "#ece9df", margin: "24px 0" }} />

      <Text style={{ ...paragraphStyle, fontSize: "13px", textAlign: "center" }}>
        Want to see this online or download the branded PDF?{" "}
        <Link href={p.resultUrl}>View your full report →</Link>
      </Text>
      <Text
        style={{
          ...paragraphStyle,
          fontSize: "12px",
          color: "#888B92",
          textAlign: "center",
          marginTop: "8px",
        }}
      >
        — Jason and the team at The Franchisor Blueprint
      </Text>
    </EmailLayout>
  );
}
