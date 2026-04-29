/**
 * Branded PDF version of the Franchise Readiness Assessment result.
 *
 * Rendered server-side via @react-pdf/renderer (no Chromium needed). The
 * same module exports both the React component (for layout) and a
 * `renderResultPdf()` helper that returns a Node Buffer suitable for
 * attaching to a Resend email or streaming from the /api/assessment
 * download route.
 *
 * Design vocabulary mirrors the rest of the site:
 *   navy   = #1e3a5f   (titles, primary text)
 *   gold   = #d4af37   (eyebrow accents, score chip background)
 *   cream  = #ece9df   (page background)
 *   navy/8 = #1e3a5f14 (card shadows / dividers)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { AssessmentResult } from "./scoring";

const NAVY = "#1e3a5f";
const NAVY_LIGHT = "#2a4d7a";
const GOLD = "#d4af37";
const GOLD_WARM = "#d8a936";
const CREAM = "#ece9df";
const TEXT = "#222222";
const GREY_3 = "#595959";
const GREY_4 = "#8c8c8c";

// ─── Styles (StyleSheet.create gives static type-checking) ─────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: TEXT,
    lineHeight: 1.55,
  },
  // Top brand bar
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: `1pt solid ${CREAM}`,
  },
  brandWord: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  brandSub: {
    color: GREY_4,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  // Hero
  eyebrow: {
    color: GOLD_WARM,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    marginBottom: 6,
    lineHeight: 1.25,
  },
  heroSummary: {
    color: GREY_3,
    fontSize: 11,
    marginBottom: 24,
  },
  // Score chip
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: NAVY,
    color: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
  },
  scoreNumber: {
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    fontSize: 56,
    lineHeight: 1,
    marginRight: 16,
    width: 110,
  },
  scoreOutOf: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    opacity: 0.7,
  },
  scoreBandLabel: {
    color: GOLD,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  scoreBandTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  scoreBandHeadline: {
    color: "#ffffff",
    fontSize: 11,
    opacity: 0.85,
  },
  // Section header
  sectionHeader: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  sectionSubhead: {
    color: GREY_3,
    fontSize: 10,
    marginBottom: 14,
  },
  // Category bars
  categoryRow: {
    marginBottom: 14,
  },
  categoryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  categoryName: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  categoryScore: {
    color: GREY_3,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  categoryBarTrack: {
    backgroundColor: "#e9eef3",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  categoryBarFill: {
    backgroundColor: GOLD,
    height: 8,
  },
  categoryDesc: {
    color: GREY_3,
    fontSize: 9.5,
  },
  // Recommendation card
  recoCard: {
    backgroundColor: CREAM,
    borderRadius: 12,
    padding: 18,
    marginTop: 6,
    marginBottom: 24,
  },
  recoEyebrow: {
    color: GOLD_WARM,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  recoTitle: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginBottom: 6,
  },
  recoBody: {
    color: GREY_3,
    fontSize: 10.5,
  },
  // Highlights row (strongest / weakest)
  highlightsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    border: `1pt solid ${CREAM}`,
    borderRadius: 10,
    padding: 14,
  },
  highlightLabel: {
    color: GOLD_WARM,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  highlightTitle: {
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 4,
  },
  highlightBody: {
    color: GREY_3,
    fontSize: 9.5,
  },
  // Footer
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    color: GREY_4,
    fontSize: 8,
    letterSpacing: 0.6,
    paddingTop: 10,
    borderTop: `1pt solid ${CREAM}`,
  },
});

interface ReportProps {
  result: AssessmentResult;
  firstName: string;
  businessName?: string | null;
  generatedAt: Date;
}

export function AssessmentReport({
  result,
  firstName,
  businessName,
  generatedAt,
}: ReportProps) {
  const formattedDate = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subject = businessName
    ? `${firstName} · ${businessName}`
    : firstName;

  return (
    <Document
      title={`Franchise Readiness Report — ${firstName}`}
      author="The Franchisor Blueprint"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Brand bar */}
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brandWord}>THE FRANCHISOR BLUEPRINT</Text>
            <Text style={styles.brandSub}>Franchise Readiness Report</Text>
          </View>
          <Text style={styles.brandSub}>{formattedDate}</Text>
        </View>

        {/* Hero */}
        <Text style={styles.eyebrow}>Prepared for {subject}</Text>
        <Text style={styles.heroTitle}>Your Franchise Readiness Score</Text>
        <Text style={styles.heroSummary}>{result.bandSummary}</Text>

        {/* Score card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreNumber}>{result.totalScore}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreBandLabel}>{result.bandTitle}</Text>
            <Text style={styles.scoreBandTitle}>{result.bandHeadline}</Text>
            <Text style={styles.scoreBandHeadline}>
              <Text style={styles.scoreOutOf}>
                {result.totalScore} of {result.maxScore} points
              </Text>
            </Text>
          </View>
        </View>

        {/* Strongest / weakest */}
        <View style={styles.highlightsRow}>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightLabel}>Strongest area</Text>
            <Text style={styles.highlightTitle}>{result.strongest.title}</Text>
            <Text style={styles.highlightBody}>{result.strongest.description}</Text>
          </View>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightLabel}>Biggest gap</Text>
            <Text style={styles.highlightTitle}>{result.weakest.title}</Text>
            <Text style={styles.highlightBody}>{result.weakest.description}</Text>
          </View>
        </View>

        {/* Category breakdown */}
        <Text style={styles.sectionHeader}>Category breakdown</Text>
        <Text style={styles.sectionSubhead}>
          Where you scored well — and where the work is.
        </Text>
        {result.categories.map((c) => (
          <View key={c.slug} style={styles.categoryRow} wrap={false}>
            <View style={styles.categoryHead}>
              <Text style={styles.categoryName}>{c.title}</Text>
              <Text style={styles.categoryScore}>
                {c.score} / {c.max}
              </Text>
            </View>
            <View style={styles.categoryBarTrack}>
              <View
                style={[
                  styles.categoryBarFill,
                  { width: `${Math.max(2, c.ratio * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.categoryDesc}>{c.description}</Text>
          </View>
        ))}

        {/* Recommendation */}
        <View wrap={false}>
          <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
            Your recommended next step
          </Text>
          <Text style={styles.sectionSubhead}>
            What we&apos;d do if we were in your seat.
          </Text>
          <View style={styles.recoCard}>
            <Text style={styles.recoEyebrow}>Recommendation</Text>
            <Text style={styles.recoTitle}>{result.recommendation.primary.label}</Text>
            <Text style={styles.recoBody}>{result.recommendation.rationale}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>The Franchisor Blueprint · thefranchisorblueprint.com</Text>
          <Text>
            This assessment is for educational purposes and does not constitute legal or financial advice.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Renders the report to a Node.js Buffer ready to attach to an email or
 * stream from an API route. The /Users/fin/.claude/...build pipeline
 * handles fonts via @react-pdf's bundled Helvetica family — no font
 * registration required.
 */
export async function renderResultPdf(props: ReportProps): Promise<Buffer> {
  const stream = await pdf(<AssessmentReport {...props} />).toBuffer();
  // toBuffer returns a NodeJS.ReadableStream in some versions; collect it.
  if (Buffer.isBuffer(stream)) return stream as Buffer;
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    (stream as NodeJS.ReadableStream).on("data", (c: Buffer) => chunks.push(c));
    (stream as NodeJS.ReadableStream).on("end", () => resolve(Buffer.concat(chunks)));
    (stream as NodeJS.ReadableStream).on("error", reject);
  });
}
