/**
 * Section-level slicing of chapter prose.
 *
 * The Blueprint canvas treats each `##` (h2) heading as a section
 * boundary so the inline-edit UX can edit one section at a time
 * instead of dumping the whole chapter into a single textarea (which,
 * per Eric's feedback, "feels like editing a codebase"). Sub-headings
 * (`###`+) stay nested inside their parent section.
 *
 * Section 0 (heading=null) holds any content that appears BEFORE the
 * first h2 — typically a short intro paragraph the agent wrote
 * un-headed. We treat it as a normal editable section so the customer
 * can rewrite the lede without it falling through.
 *
 * Section identity for save round-trips is the index, not the heading
 * text — that way the customer can rename a heading without breaking
 * the persistence link. Concurrent saves to the same chapter share an
 * inherent race window, but our UI is single-user-single-chapter so
 * the practical risk is nil.
 */

export type Section = {
  /** The h2 heading line including the `##` markup, or null for the
   *  pre-heading intro region. */
  heading: string | null;
  /** Body content between this heading and the next (excludes the
   *  heading line itself, includes any nested sub-headings, prose,
   *  callouts, locked spans, etc.). May be empty. */
  body: string;
};

/**
 * Split a markdown string at every `##` heading. Trailing/leading
 * whitespace per section is preserved as-is so a join produces the
 * same document modulo trivial whitespace normalization.
 */
export function parseSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: null, body: "" };
  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      // Commit the in-flight section if it has any content. Skip an
      // empty pre-heading section so chapters that start with a
      // heading don't carry a phantom section 0.
      if (current.heading !== null || current.body.trim().length > 0) {
        sections.push(current);
      }
      current = { heading: line, body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current.heading !== null || current.body.trim().length > 0) {
    sections.push(current);
  }
  // Trim trailing blank lines from each body for a tidier round-trip.
  return sections.map((s) => ({
    heading: s.heading,
    body: s.body.replace(/\n+$/, ""),
  }));
}

/**
 * Re-assemble parsed sections into a single markdown string. Inserts
 * a blank line between sections when the previous body doesn't already
 * end with one.
 */
export function joinSections(sections: Section[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    const piece = s.heading
      ? s.body
        ? `${s.heading}\n${s.body}`
        : s.heading
      : s.body;
    if (piece) parts.push(piece);
  }
  return parts.join("\n\n");
}

/**
 * Replace the body (and optionally heading) of one section by index,
 * returning the rebuilt markdown. Used by the section-save server
 * action — caller has already wrapped the new body in user-locked
 * markers if appropriate.
 *
 * Throws if `sectionIndex` is out of range so the caller surfaces a
 * clean 400 instead of silently corrupting the chapter.
 */
export function replaceSection(
  md: string,
  sectionIndex: number,
  next: { heading?: string | null; body: string },
): string {
  const sections = parseSections(md);
  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    throw new Error(
      `Section index ${sectionIndex} out of range (chapter has ${sections.length} sections).`,
    );
  }
  const updated: Section = {
    heading:
      next.heading !== undefined ? next.heading : sections[sectionIndex].heading,
    body: next.body,
  };
  const rebuilt = sections.slice();
  rebuilt[sectionIndex] = updated;
  return joinSections(rebuilt);
}
