/**
 * Extract text from uploaded documents.
 *
 * The chapter-attachment endpoint stores files in customer-uploads
 * AND saves an `excerpt` string on the attachment record. The
 * draft pipeline includes that excerpt in Opus's prompt context so
 * the agent can pull facts from uploaded docs at draft time.
 *
 * Until now, only text-like files (.txt, .md, .json, .csv) had
 * real excerpts; PDF/DOCX got a placeholder string. This module
 * fills that gap so the most common formats — operations manuals,
 * franchise agreements, P&Ls, training PDFs — are actually
 * readable by Jason.
 *
 * Extraction is best-effort. If a particular file fails to parse
 * (encrypted PDF, malformed DOCX, oversized), we fall back to the
 * placeholder rather than failing the upload itself. The customer
 * still gets the file attached + visible in the References panel;
 * Opus just doesn't have its content in the prompt.
 */

import "server-only";
import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";

// pdf-parse ships both CJS (default export) and ESM (named).
// Reach into either shape so the type-checker stays happy and the
// runtime works under both bundling modes.
const pdfParse: (
  data: Buffer | Uint8Array,
) => Promise<{ text: string; numpages: number }> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfParseModule as any).default ?? (pdfParseModule as any).pdfParse ??
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfParseModule as any);

/** Truncate excerpts to bound prompt size. Opus 4.7's 1M context
 *  is roomy, but we still want to keep individual attachment
 *  excerpts manageable so a chapter's combined context doesn't
 *  blow out cache breakpoints. ~12K chars ≈ 3K tokens, tight
 *  enough that 5 attachments still fit comfortably. */
const MAX_EXCERPT_CHARS = 12_000;

/**
 * Try to extract human-readable text from a buffer based on its
 * MIME type and filename. Returns the trimmed text on success or
 * null on failure (caller falls back to the placeholder).
 */
export async function extractDocText(args: {
  buffer: Buffer;
  mimeType: string | null;
  fileName: string;
}): Promise<string | null> {
  const { buffer, mimeType, fileName } = args;
  const lowerName = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");

  if (isPdf) {
    return extractPdf(buffer);
  }
  if (isDocx) {
    return extractDocx(buffer);
  }
  return null;
}

async function extractPdf(buffer: Buffer): Promise<string | null> {
  try {
    const result = await pdfParse(buffer);
    const text = (result.text ?? "").trim();
    if (!text) return null;
    return truncate(text);
  } catch (err) {
    console.warn(
      "[extract-doc-text] PDF parse failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function extractDocx(buffer: Buffer): Promise<string | null> {
  try {
    // mammoth's `extractRawText` is the right choice for prompt
    // context — it strips formatting noise (footnotes, headers)
    // that Opus doesn't need to see.
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? "").trim();
    if (!text) return null;
    return truncate(text);
  } catch (err) {
    console.warn(
      "[extract-doc-text] DOCX parse failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Cap the excerpt length and add a marker so Opus knows it was
 *  truncated (it can ask the customer for a focused snippet if it
 *  hits the cap). */
function truncate(text: string): string {
  if (text.length <= MAX_EXCERPT_CHARS) return text;
  return (
    text.slice(0, MAX_EXCERPT_CHARS) +
    `\n\n[…truncated at ${MAX_EXCERPT_CHARS.toLocaleString()} characters; full file in storage]`
  );
}
