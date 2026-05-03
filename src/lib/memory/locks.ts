/**
 * User-locked spans inside chapter prose.
 *
 * The Blueprint canvas is co-authored: Jason (Opus) drafts most prose,
 * but the customer can also type directly into a chapter via inline
 * editing. The locked-span pattern lets both coexist without the agent
 * ever overwriting words the customer hand-wrote.
 *
 * Mechanism: any user-typed text is wrapped in HTML-comment markers
 * inside `content_md`:
 *
 *   <!-- user-locked:abc123 -->
 *   The customer's exact words go here, possibly multi-line.
 *   <!-- /user-locked:abc123 -->
 *
 * The markers survive markdown round-trips (react-markdown drops them
 * with `skipHtml`). The Opus draft pipeline is told to preserve them
 * verbatim; we post-validate every redraft to be sure (belt + braces).
 *
 * IDs are short, monotonic, base36 timestamps. Uniqueness within one
 * chapter is enough — we never collide across chapters because the
 * markers are scoped to a single `content_md`.
 */

const OPEN_RE = /<!--\s*user-locked:([a-z0-9]+)\s*-->/gi;
const CLOSE_RE = /<!--\s*\/user-locked:([a-z0-9]+)\s*-->/gi;

/** A single locked span pulled out of `content_md`. */
export type LockedSpan = {
  id: string;
  /** The exact text inside the open/close markers, unmodified. */
  text: string;
  /** Character offset of the opening marker in the source string. */
  startOffset: number;
};

/**
 * Parse every `<!-- user-locked:ID -->...<!-- /user-locked:ID -->`
 * block out of a markdown string.
 *
 * Tolerates nested or unmatched markers by pairing greedily on ID:
 * we look for the first close that matches an open's ID. Stray opens
 * or closes without a partner are silently ignored — better than
 * throwing in the middle of a save.
 */
export function parseLockedSpans(md: string): LockedSpan[] {
  const opens: Array<{ id: string; index: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  OPEN_RE.lastIndex = 0;
  while ((m = OPEN_RE.exec(md)) !== null) {
    opens.push({ id: m[1], index: m.index, bodyStart: m.index + m[0].length });
  }
  const spans: LockedSpan[] = [];
  for (const open of opens) {
    // Find the first matching close after this open.
    const closeRe = new RegExp(
      `<!--\\s*/user-locked:${open.id}\\s*-->`,
      "i",
    );
    const tail = md.slice(open.bodyStart);
    const closeMatch = closeRe.exec(tail);
    if (!closeMatch) continue;
    const text = tail.slice(0, closeMatch.index);
    spans.push({ id: open.id, text, startOffset: open.index });
  }
  return spans;
}

/** True if the markdown string contains at least one user-locked span. */
export function hasLockedSpans(md: string): boolean {
  return /<!--\s*user-locked:[a-z0-9]+\s*-->/i.test(md);
}

/**
 * Wrap a string of customer-authored text as a single user-locked span
 * with a freshly-generated short ID. Used by the inline-prose-edit save
 * path the first time a customer hand-edits a chapter.
 */
export function wrapAsLocked(text: string, idHint?: string): string {
  const id = idHint ?? mintLockId();
  return `<!-- user-locked:${id} -->\n${text.trim()}\n<!-- /user-locked:${id} -->`;
}

/** Generate a short, mostly-unique base36 ID. ~10 chars. */
export function mintLockId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e6).toString(36);
  return `${ts}${rand}`;
}

/**
 * Validate that every locked span from `previous` is still present
 * verbatim in `next`. Returns the IDs that went missing (Opus dropped
 * them) — caller decides whether to splice them back in or refuse the
 * draft.
 */
export function lockedSpansMissing(
  previous: string,
  next: string,
): LockedSpan[] {
  const before = parseLockedSpans(previous);
  if (before.length === 0) return [];
  const after = parseLockedSpans(next);
  const afterById = new Map(after.map((s) => [s.id, s.text]));
  const missing: LockedSpan[] = [];
  for (const span of before) {
    const presentText = afterById.get(span.id);
    // Considered preserved iff the ID is present AND the text is
    // byte-identical (after trimming whitespace, since markdown
    // formatting can shift surrounding newlines).
    if (presentText == null || presentText.trim() !== span.text.trim()) {
      missing.push(span);
    }
  }
  return missing;
}

/**
 * Defensive splice: if a redraft dropped any locked spans, append them
 * to the end of the chapter under a small "Restored from prior edits"
 * heading rather than silently losing the customer's words. Better to
 * have them duplicated and visible than disappeared.
 */
export function spliceMissingLocksBack(
  next: string,
  missing: LockedSpan[],
): string {
  if (missing.length === 0) return next;
  const restored = missing
    .map(
      (s) =>
        `<!-- user-locked:${s.id} -->\n${s.text.trim()}\n<!-- /user-locked:${s.id} -->`,
    )
    .join("\n\n");
  return `${next.trim()}\n\n---\n\n_Restored from your prior edits — Jason dropped these on the redraft:_\n\n${restored}`;
}

/**
 * Strip user-locked markers (but keep the text inside) — used when
 * sending content to a renderer that doesn't understand the markers
 * and we want a plain reading view. The custom prose renderer in
 * `ChapterCard` does NOT use this; it splits on the markers so the
 * locked spans can be visually distinguished.
 */
export function stripLockMarkers(md: string): string {
  return md
    .replace(/<!--\s*user-locked:[a-z0-9]+\s*-->\n?/gi, "")
    .replace(/<!--\s*\/user-locked:[a-z0-9]+\s*-->\n?/gi, "");
}
