/**
 * DeliverableDoc → PDF Buffer renderer.
 *
 * Walks the same DeliverableDoc tree the docx/md renderers walk, but
 * emits a PDF using `@react-pdf/renderer`. Used primarily for the
 * preview-before-download modal in the customer portal — customers see
 * what they're getting before it lands in their Downloads folder.
 *
 * Style choices intentionally mirror render-docx so a customer who
 * previews PDF then downloads DOCX gets a near-identical document:
 *   - Navy primary (#1E3A5F) for headings.
 *   - Times-style serif body so the document reads as a legal artifact,
 *     not a web-app export.
 *   - Cover page first, then page-broken sections.
 *   - Grey-bordered tables, italic disclaimer, page numbers in the
 *     footer.
 *
 * `react-pdf` doesn't use the DOM — its `<Page>`/`<View>`/`<Text>` are
 * its own primitives. Stylesheet API mirrors RN's. Keep that in mind
 * when extending; reaching for DOM-style markup or CSS will silently
 * not render.
 */

import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { DeliverableDoc, DocBlock, DocSection } from "./types";
import React from "react";

const NAVY = "#1E3A5F";
const GOLD = "#C29D52";
const GREY_BORDER = "#D9D9D9";
const GREY_BG = "#F4F4F2";
const BODY_TEXT = "#333333";
const SUBTLE_TEXT = "#666666";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.5,
    color: BODY_TEXT,
  },
  coverPage: {
    paddingTop: 140,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontFamily: "Times-Roman",
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Times-Bold",
    color: NAVY,
    textAlign: "center",
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: "Times-Italic",
    color: SUBTLE_TEXT,
    textAlign: "center",
    marginBottom: 36,
  },
  coverFieldRow: {
    flexDirection: "row",
    justifyContent: "center",
    fontSize: 11,
    marginBottom: 4,
  },
  coverFieldLabel: {
    fontFamily: "Times-Bold",
    color: NAVY,
  },
  coverFieldValue: {
    color: BODY_TEXT,
  },
  disclaimer: {
    marginTop: 64,
    fontSize: 9,
    fontFamily: "Times-Italic",
    color: SUBTLE_TEXT,
    textAlign: "center",
    lineHeight: 1.4,
  },
  sectionHeading1: {
    fontSize: 18,
    fontFamily: "Times-Bold",
    color: NAVY,
    marginTop: 8,
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
  },
  sectionHeading2: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    color: NAVY,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
  },
  paragraphBold: {
    marginBottom: 8,
    fontFamily: "Times-Bold",
  },
  paragraphItalic: {
    marginBottom: 8,
    fontFamily: "Times-Italic",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletMarker: {
    width: 14,
    color: NAVY,
  },
  bulletText: {
    flex: 1,
  },
  table: {
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: GREY_BORDER,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: GREY_BORDER,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableCellHeader: {
    flex: 1,
    padding: 6,
    backgroundColor: GREY_BG,
    fontFamily: "Times-Bold",
    fontSize: 10,
    color: NAVY,
    borderRightWidth: 1,
    borderRightColor: GREY_BORDER,
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: GREY_BORDER,
  },
  kvTableLabel: {
    flex: 1,
    padding: 6,
    backgroundColor: GREY_BG,
    fontFamily: "Times-Bold",
    fontSize: 10,
    color: NAVY,
    borderRightWidth: 1,
    borderRightColor: GREY_BORDER,
  },
  kvTableValue: {
    flex: 2,
    padding: 6,
    fontSize: 10,
  },
  callout: {
    marginVertical: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    backgroundColor: GREY_BG,
    fontSize: 10,
  },
  calloutWarning: {
    marginVertical: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#B45309",
    backgroundColor: "#FEF3C7",
    fontSize: 10,
  },
  spacer: {
    height: 8,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 64,
    right: 64,
    fontSize: 8,
    color: SUBTLE_TEXT,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "paragraph": {
      const style = block.bold
        ? styles.paragraphBold
        : block.italic
          ? styles.paragraphItalic
          : styles.paragraph;
      return <Text style={style}>{block.text}</Text>;
    }
    case "bullets":
      return (
        <View style={{ marginBottom: 8 }}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarker}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "numbered":
      return (
        <View style={{ marginBottom: 8 }}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarker}>{`${i + 1}.`}</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "kvtable":
      return (
        <View style={styles.table}>
          {block.rows.map((row, i) => (
            <View
              key={i}
              style={i === block.rows.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.kvTableLabel}>{row.label}</Text>
              <Text style={styles.kvTableValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            {block.headers.map((h, i) => (
              <Text key={i} style={styles.tableCellHeader}>
                {h}
              </Text>
            ))}
          </View>
          {block.rows.map((row, i) => (
            <View
              key={i}
              style={i === block.rows.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              {row.map((cell, j) => (
                <Text key={j} style={styles.tableCell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "callout":
      return (
        <View style={block.tone === "warning" ? styles.calloutWarning : styles.callout}>
          <Text>{block.text}</Text>
        </View>
      );
    case "spacer":
      return <View style={styles.spacer} />;
    case "pagebreak":
      // Page breaks are handled by wrapping the next section in a new <Page>
      // — see Section component below for how this is consumed.
      return null;
  }
}

function Section({ section }: { section: DocSection }) {
  return (
    <View>
      <Text style={section.level === 1 ? styles.sectionHeading1 : styles.sectionHeading2}>
        {section.title}
      </Text>
      {section.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      {section.subsections?.map((sub, i) => <Section key={i} section={sub} />)}
    </View>
  );
}

function DeliverablePdfDocument({ doc }: { doc: DeliverableDoc }) {
  return (
    <Document title={doc.title} author="The Franchisor Blueprint">
      {/* Cover page */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverTitle}>{doc.title}</Text>
        {doc.subtitle && <Text style={styles.coverSubtitle}>{doc.subtitle}</Text>}
        {doc.coverFields && doc.coverFields.length > 0 && (
          <View style={{ marginTop: 24 }}>
            {doc.coverFields.map((cf, i) => (
              <View key={i} style={styles.coverFieldRow}>
                <Text style={styles.coverFieldLabel}>{cf.label}: </Text>
                <Text style={styles.coverFieldValue}>{cf.value}</Text>
              </View>
            ))}
          </View>
        )}
        {doc.disclaimer && <Text style={styles.disclaimer}>{doc.disclaimer}</Text>}
      </Page>

      {/* Body. Each top-level (level-1) section starts on a fresh page so
          chapter-style content reads cleanly. */}
      {doc.sections.map((section, i) => (
        <Page key={i} size="LETTER" style={styles.page}>
          <Section section={section} />
          <View style={styles.footer} fixed>
            <Text>{doc.title}</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}

/**
 * Render a DeliverableDoc tree to a PDF Buffer.
 *
 * Returns a Node Buffer ready to send via NextResponse with
 * Content-Type: application/pdf.
 */
export async function renderPdf(doc: DeliverableDoc): Promise<Buffer> {
  const instance = pdf(<DeliverablePdfDocument doc={doc} />);
  const stream = await instance.toBuffer();
  // toBuffer() returns a NodeJS.ReadableStream in older versions and a
  // Buffer in newer versions of @react-pdf/renderer. Handle both.
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as NodeJS.ReadableStream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
