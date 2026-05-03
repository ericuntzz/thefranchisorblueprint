/**
 * Tools the Jason chat agent can call.
 *
 * v1 ships exactly one: `update_memory_field` — lets Jason write
 * customer-stated facts directly into the structured-fields layer of
 * Memory in the middle of a conversation. The TurboTax parallel: the
 * customer says "we have 3 locations now" and Jason updates
 * business_overview.locations_count = 3 immediately, without making
 * the customer find the right card and click into the field editor.
 *
 * Architecture:
 *   - The schema for each chapter (src/lib/memory/schemas.ts) is the
 *     single source of truth for what fields exist and what types
 *     they accept. The tool validates against it; type coercion lives
 *     in `coerceFieldValue` (lifted from extract-fields.ts intent).
 *   - Computed fields are rejected — they're derived by the calc lib;
 *     writing to them would just get overwritten on the next render.
 *   - Provenance: every tool write goes through writeMemoryFields with
 *     `source: "user_correction"` (the customer verbally corrected the
 *     value during chat — distinct from "user_typed" which is the
 *     form-edit path).
 *   - Every tool execution returns a human-readable confirmation
 *     string so the chat dock can render an inline "✓ Updated X = Y"
 *     card and Jason can include it in his prose response.
 */

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { writeMemoryFields } from "@/lib/memory";
import {
  isValidMemoryFileSlug,
  type MemoryFileSlug,
  MEMORY_FILE_TITLES,
  MEMORY_FILES,
} from "@/lib/memory/files";
import {
  type FieldDef,
  CHAPTER_SCHEMAS,
} from "@/lib/memory/schemas";
import { hasCalc } from "@/lib/calc";

type FieldValue = string | number | boolean | string[] | null;

/**
 * Tool spec we hand to the Anthropic SDK. Built dynamically because
 * the slug enum lives in `MEMORY_FILES` and we want changes there to
 * propagate without us editing this file.
 */
export const UPDATE_MEMORY_FIELD_TOOL: Anthropic.Tool = {
  name: "update_memory_field",
  description: `Update a single structured field on one chapter of the customer's Franchisor Blueprint.

Use this whenever the customer states a concrete, atomic fact that maps to a known field — e.g. "we have 3 locations" → business_overview.locations_count=3, "our royalty is 6%" → franchise_economics.royalty_pct=6, "founded in 2018" → business_overview.year_founded=2018.

CRITICAL RULES:
- Only call this when the customer's statement is unambiguous AND maps cleanly to one field. If you have to guess, ask first.
- Use the field's exact technical name (e.g. "locations_count", not "locations" or "stores"). The schemas in your context show the canonical names.
- Currency = plain dollar number (250000, not "$250k"). Percentage = number 0–100 (6 for "6%", not 0.06).
- For lists, pass an array of strings.
- Never call this on a "computed" field — those are calculated automatically and would overwrite themselves.
- After calling, briefly acknowledge what you updated in your text response (e.g. "Got it — set locations to 3.") so the customer sees the change reflected in your reply, not just in the chip below your message.

Available chapter slugs: ${MEMORY_FILES.join(", ")}.`,
  input_schema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        enum: [...MEMORY_FILES],
        description:
          "The chapter to update. Match exactly one of the listed slugs.",
      },
      field_name: {
        type: "string",
        description:
          "The technical name of the field to update (e.g. `locations_count`). Must exist on the chapter's schema.",
      },
      value: {
        // Anthropic's tool schema accepts a single JSON Schema; we
        // type this loosely and validate server-side. The model is
        // told above to match the field's expected type.
        description:
          "The new value. String, number, boolean, or array of strings depending on the field type.",
      },
      note: {
        type: "string",
        description:
          "Optional one-line rationale shown in the audit log (e.g. 'customer said they just opened a third location').",
      },
    },
    required: ["slug", "field_name", "value"],
  },
};

/** Result of a tool execution — surfaced to both the model (as
 *  tool_result) and the client (as a typed event). */
export type ToolResult = {
  ok: boolean;
  /** Short human-readable summary, e.g. "Updated Brand Standards: locations_count = 3". */
  summary: string;
  /** Full structured detail for the client UI. */
  detail?: {
    slug: MemoryFileSlug;
    chapterTitle: string;
    fieldName: string;
    fieldLabel: string;
    value: FieldValue;
  };
};

/**
 * Execute the update_memory_field tool. Validates the input against
 * the chapter's schema, coerces the value, writes through
 * writeMemoryFields, and returns a human-readable confirmation.
 *
 * Errors are returned as `{ ok: false, summary: "..." }` rather than
 * thrown — the model handles them as tool_result content and can
 * recover (e.g. "I had the wrong slug, let me try again"). Throwing
 * would crash the whole chat turn, which is much worse UX.
 */
export async function executeUpdateMemoryField(args: {
  userId: string;
  input: unknown;
}): Promise<ToolResult> {
  // Defensive parse — the model usually obeys the schema, but a
  // hallucinated tool call could still be missing fields.
  if (!args.input || typeof args.input !== "object") {
    return { ok: false, summary: "Tool input was missing or not an object." };
  }
  const raw = args.input as Record<string, unknown>;
  const slug = raw.slug;
  const fieldName = raw.field_name;
  const note = typeof raw.note === "string" ? raw.note : undefined;

  if (typeof slug !== "string" || !isValidMemoryFileSlug(slug)) {
    return {
      ok: false,
      summary: `Unknown chapter slug: ${JSON.stringify(slug)}. Use one of: ${MEMORY_FILES.join(", ")}.`,
    };
  }
  if (typeof fieldName !== "string" || !fieldName) {
    return {
      ok: false,
      summary: `Missing field_name. Pass the exact technical name from the schema.`,
    };
  }

  const schema = CHAPTER_SCHEMAS[slug];
  if (!schema) {
    // Phase 1.5b chapters (e.g. brand_voice) don't have a schema yet.
    // Tell the model so it can route the customer elsewhere.
    return {
      ok: false,
      summary: `The "${slug}" chapter doesn't have a structured-fields schema yet — its content is freeform prose only. Note the fact in your reply and ask the customer to type it into the chapter directly.`,
    };
  }

  const fieldDef = schema.fields.find((f) => f.name === fieldName);
  if (!fieldDef) {
    // Help Jason self-correct: list every editable field on this
    // chapter with its technical name and human label. He can re-emit
    // the tool call with the right name on the next round of the
    // tool-use loop without bothering the customer.
    const editable = schema.fields
      .filter((f) => !hasCalc(slug, f.name) && !f.computed)
      .map((f) => `${f.name} ("${f.label}", ${f.type})`)
      .join(", ");
    return {
      ok: false,
      summary: `Field "${fieldName}" doesn't exist on chapter "${slug}". Valid editable fields: ${editable}. Pick the closest match and retry.`,
    };
  }
  if (hasCalc(slug, fieldName) || fieldDef.computed) {
    return {
      ok: false,
      summary: `Field "${fieldName}" on "${slug}" is computed — it's derived from other fields automatically. Update the underlying inputs instead.`,
    };
  }

  const coerced = coerceFieldValue(fieldDef, raw.value);
  if (coerced === undefined) {
    return {
      ok: false,
      summary: `Couldn't coerce value ${JSON.stringify(raw.value)} to the expected ${fieldDef.type} type for "${fieldName}". Re-emit with the correct shape (e.g. number for currency/percentage, ISO string for date, string from the option list for select, array of strings for lists).`,
    };
  }

  try {
    await writeMemoryFields({
      userId: args.userId,
      slug,
      changes: { [fieldName]: coerced },
      source: "user_correction",
      note,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "write failed";
    return {
      ok: false,
      summary: `Write failed: ${msg}`,
    };
  }

  const valueDisplay = formatValueForLog(fieldDef, coerced);
  return {
    ok: true,
    summary: `Updated ${MEMORY_FILE_TITLES[slug]} — ${fieldDef.label}: ${valueDisplay}`,
    detail: {
      slug,
      chapterTitle: MEMORY_FILE_TITLES[slug],
      fieldName,
      fieldLabel: fieldDef.label,
      value: coerced,
    },
  };
}

/**
 * Coerce a model-supplied tool input to the expected field type.
 * Returns `undefined` on type mismatch (so caller surfaces a typed
 * error to the model, which can retry).
 *
 * Mirrors the coercion in `extract-fields.ts` but kept independent
 * because the two paths have slightly different "what counts as
 * empty" semantics — extraction can drop empties silently, tool
 * use rejects them so the model gets feedback.
 */
function coerceFieldValue(
  fd: FieldDef,
  raw: unknown,
): FieldValue | undefined {
  if (raw === null) return null; // explicit clear is allowed
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
      if (fd.type === "integer" || fd.type === "year") return Math.round(n);
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
    case "list_long": {
      if (Array.isArray(raw)) {
        const items = raw
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
        return items.length > 0 ? items : null;
      }
      if (typeof raw === "string") {
        const items = raw
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
        return items.length > 0 ? items : null;
      }
      return undefined;
    }
  }
}

/**
 * Format a coerced value for the `summary` string in tool results
 * and the audit-log "note" the chat dock shows. Currency renders
 * with a "$" + thousands separators; percentage with a "%"; lists
 * with comma-joined items. Plain text passes through.
 */
function formatValueForLog(fd: FieldDef, v: FieldValue): string {
  if (v === null) return "(cleared)";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    switch (fd.type) {
      case "currency":
        return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
      case "percentage":
        return `${v}%`;
      default:
        return v.toLocaleString("en-US");
    }
  }
  return String(v);
}
