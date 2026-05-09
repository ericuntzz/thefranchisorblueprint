/**
 * Structured-field extraction.
 *
 * Given a chapter's content (prose draft, scrape output, or any other
 * source material), ask Claude Sonnet to populate the chapter's
 * structured-fields schema with values it can confidently derive.
 *
 * Why this exists: Eric flagged that clicking "Edit fields" on a
 * scraped chapter showed blank inputs — the prose paragraphs were
 * full of facts (founder name, locations, year founded, etc.) but
 * none of them had been extracted into the `fields` jsonb. This
 * module is the bridge: same facts, structured form.
 *
 * Design choices:
 *   - Sonnet (CHAT_MODEL), not Opus. Extraction is a cheap pattern-
 *     matching task; no need for the heavy model.
 *   - Effort `low`. Plenty for a JSON-shaped extraction.
 *   - Streamed parse — we ask for a single fenced JSON block. Anything
 *     that doesn't parse drops to "no extraction" (silent fail rather
 *     than a hard error in the pipeline; the customer can still type
 *     manually).
 *   - We DO NOT extract computed fields. Those are derived from other
 *     fields by the deterministic math lib; an extracted EBITDA margin
 *     would just get overwritten on the next render.
 *   - We DO NOT extract fields the model isn't confident about. The
 *     prompt explicitly tells it to omit any field where it would have
 *     to guess. False extractions are worse than missing ones.
 */

import "server-only";
import {
  CACHE_5M,
  CHAT_MODEL,
  getAnthropic,
} from "./anthropic";
import {
  getChapterSchema,
  type FieldDef,
} from "@/lib/memory/schemas";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { hasCalc } from "@/lib/calc";
import { coerceListValue, LIST_INSTRUCTIONS_BLOCK } from "./coerce-list";

type FieldValue = string | number | boolean | string[] | null;

/**
 * Extract structured field values for a chapter from arbitrary source
 * content. Returns only fields the model was confident enough to fill;
 * others are silently omitted (the customer fills them in).
 *
 * Returns an empty object when:
 *   - the chapter has no schema (Phase 1.5b chapters like brand_voice)
 *   - the source content is empty or trivially short
 *   - the model returns malformed JSON
 *   - the API call fails (logged, not thrown — extraction is best-effort)
 */
export async function extractFieldsFromContent(args: {
  slug: MemoryFileSlug;
  /** Source material — typically the chapter's just-drafted content_md
   *  or the raw scrape output. */
  content: string;
  /** Optional extra context the model should consider (raw scrape text,
   *  cross-chapter facts, customer notes). */
  contextNotes?: string;
}): Promise<Record<string, FieldValue>> {
  const schema = getChapterSchema(args.slug);
  if (!schema) return {};
  if (!args.content || args.content.trim().length < 30) return {};

  // Filter out computed fields — extracting them is wasted effort and
  // would create stale values that the calc lib then overwrites.
  const extractable = schema.fields.filter(
    (f) => !hasCalc(args.slug, f.name) && !f.computed,
  );
  if (extractable.length === 0) return {};

  const fieldDescriptions = extractable
    .map((f) => describeFieldForPrompt(f))
    .join("\n");

  const prompt = `You are extracting structured field values from source content for the "${schema.title}" chapter of a customer's Franchisor Blueprint. Output ONLY a JSON object mapping field names to values.

GROUND RULES:
- Only fill fields you can derive with HIGH confidence from the source content. If you'd have to guess, OMIT the field.
- Match the field's type exactly: numbers as JSON numbers (no "$" or commas), booleans as true/false, dates as ISO "YYYY-MM-DD".
- ${LIST_INSTRUCTIONS_BLOCK}
- For "select" fields, the value MUST be one of the listed option values (not the labels).
- For currency fields, use the dollar amount as a plain number (e.g. 250000, not "$250,000").
- For percentage fields, use the percentage as a number (e.g. 18 for "18%", not 0.18).
- Do NOT invent facts. If the source doesn't say it, don't extract it.

FIELDS:
${fieldDescriptions}

SOURCE CONTENT:
${args.content}
${args.contextNotes ? `\nADDITIONAL CONTEXT:\n${args.contextNotes}` : ""}

Output a single JSON object on its own — no prose, no markdown fence, no commentary. Example shape: {"field_name_1": "value", "field_name_2": 1234}`;

  const client = getAnthropic();
  let response;
  try {
    response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
              cache_control: CACHE_5M,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error(
      `[extract-fields] API call failed for ${args.slug}:`,
      err instanceof Error ? err.message : err,
    );
    return {};
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Find the JSON object. The model is told not to wrap in fences but
  // sometimes does anyway — extract the first {...} we can find.
  const parsed = parseJsonLoose(text);
  if (!parsed || typeof parsed !== "object") {
    console.warn(
      `[extract-fields] No parseable JSON for ${args.slug}; raw response:`,
      text.slice(0, 200),
    );
    return {};
  }

  // Filter against the schema: only keep fields that exist, are
  // extractable, and pass type sanity checks.
  const cleaned: Record<string, FieldValue> = {};
  const byName = new Map(extractable.map((f) => [f.name, f]));
  for (const [name, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const fd = byName.get(name);
    if (!fd) continue;
    const v = coerceFieldValue(fd, raw);
    if (v === undefined) continue; // failed type check
    if (v === null) continue; // model returned null — treat as omitted
    cleaned[name] = v;
  }

  return cleaned;
}

/**
 * Build a one-line-per-field description for the extraction prompt.
 * Includes name, type, label, helpText, and any options/min/max so the
 * model has enough to extract correctly without us reproducing the
 * whole schema definition.
 */
function describeFieldForPrompt(f: FieldDef): string {
  const bits = [`- ${f.name} (${f.type})`];
  bits.push(`label="${f.label}"`);
  if (f.helpText) bits.push(`help="${f.helpText}"`);
  if (f.options) {
    const opts = f.options.map((o) => o.value).join("|");
    bits.push(`options=[${opts}]`);
  }
  if (f.min != null) bits.push(`min=${f.min}`);
  if (f.max != null) bits.push(`max=${f.max}`);
  return bits.join(" — ");
}

/**
 * Coerce a model-returned value against the expected field type.
 * Returns `undefined` for type mismatches (so caller can drop them)
 * or a clean FieldValue on success.
 */
function coerceFieldValue(
  fd: FieldDef,
  raw: unknown,
): FieldValue | undefined {
  if (raw == null) return null;
  switch (fd.type) {
    case "text":
    case "textarea":
    case "markdown":
    case "email":
    case "url":
    case "color":
    case "date":
    case "select": {
      if (typeof raw !== "string") return undefined;
      const t = raw.trim();
      if (!t) return null;
      if (fd.type === "select" && fd.options) {
        const valid = new Set(fd.options.map((o) => o.value));
        if (!valid.has(t)) return undefined;
      }
      return t;
    }
    case "number":
    case "currency":
    case "percentage":
    case "year":
    case "integer": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return undefined;
      if (fd.type === "integer" || fd.type === "year") {
        return Math.round(n);
      }
      return n;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (typeof raw === "string") {
        const t = raw.trim().toLowerCase();
        if (t === "true" || t === "yes") return true;
        if (t === "false" || t === "no") return false;
      }
      return undefined;
    case "list_short":
    case "list_long":
      // Centralized list parsing — see coerce-list.ts. Handles arrays,
      // separator-having strings, and the concatenated-TitleCase
      // regression Eric hit 2026-05-09.
      return coerceListValue(raw);
  }
}

/**
 * Find the first balanced `{...}` JSON object in a string and parse it.
 * Tolerant of code-fence wrappers and stray prose around the JSON.
 */
function parseJsonLoose(text: string): unknown | null {
  // Try a direct parse first (the happy path).
  try {
    return JSON.parse(text);
  } catch {
    // fall through to extraction
  }
  // Extract the first balanced object.
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
