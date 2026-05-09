/**
 * Shared list-value coercion for agent write paths.
 *
 * Both `extract-fields.ts` (one-shot extraction prompt) and `tools.ts`
 * (`save_field` tool) feed list_short / list_long values from the model
 * into Memory. Anthropic models almost always honor the prompt's "JSON
 * arrays of strings" instruction, but occasionally regress and return:
 *
 *   - a comma-separated string  →  fine, we split
 *   - a newline-separated string  →  fine, we split
 *   - a single concatenated string with NO separators  →  the bug Eric
 *     hit on 2026-05-09 in the Competitor Landscape field, where
 *     "StumptownCoffeeRoastersIntelligentsiaLocalReverieCoffee"
 *     stored as `["Stumptown...Coffee"]` and rendered as a single
 *     unreadable mess.
 *
 * This helper is the last-resort fallback for that case. We can't
 * reliably split "StumptownCoffeeRoastersIntelligentsia" into the
 * three items that originally produced it (the model would need
 * domain context). What we CAN do is insert spaces at TitleCase
 * boundaries so it at least reads as
 * "Stumptown Coffee Roasters Intelligentsia Local Reverie Coffee" —
 * a single item but human-readable. The customer can then split it
 * into multiple list rows manually in the editor.
 *
 * The structural fix (preventing the regression in the first place)
 * is in the prompts in extract-fields.ts and tools.ts — see
 * `LIST_INSTRUCTIONS_BLOCK` for the canonical wording shared between
 * both call sites.
 */

const TITLECASE_BOUNDARY = /([a-z])([A-Z])/g;

/**
 * Coerce a model-returned value to a clean string array for a
 * `list_short` / `list_long` field.
 *
 * Returns:
 *   - `string[]`  on a successful parse (possibly with the camelCase
 *                 fallback applied to a single concatenated item)
 *   - `null`      when the input was empty after trimming
 *   - `undefined` when the input shape was unrecognizable (caller
 *                 typically drops/rejects)
 */
export function coerceListValue(raw: unknown): string[] | null | undefined {
  if (raw === null) return null;

  if (Array.isArray(raw)) {
    const items = raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => unconcatenateTitleCase(s.trim()))
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // First try the standard separators.
    const split = trimmed
      .split(/\n|,|;/)
      .map((s) => unconcatenateTitleCase(s.trim()))
      .filter(Boolean);
    return split.length > 0 ? split : null;
  }

  return undefined;
}

/**
 * Detect concatenated TitleCase ("StumptownCoffeeRoasters") and
 * insert spaces at the boundaries. Cheap, defensive — applied
 * AFTER any explicit separators have been split on, so a normal
 * user-typed item like "Coffee Roasters" passes through untouched
 * (it already has a space).
 *
 * Heuristic guards to avoid mangling normal input:
 *   - Only fires if the item is ≥ 24 chars (short items are unlikely
 *     to be concatenations)
 *   - Only fires if there are ≥ 3 TitleCase boundaries inside
 *     (single boundaries like "iPhone" or "MacBook" pass through)
 *   - Skips if the item already contains whitespace (it's not the
 *     concatenated case)
 */
export function unconcatenateTitleCase(item: string): string {
  if (item.length < 24) return item;
  if (/\s/.test(item)) return item;
  const boundaries = (item.match(TITLECASE_BOUNDARY) || []).length;
  if (boundaries < 3) return item;
  return item.replace(TITLECASE_BOUNDARY, "$1 $2");
}

/**
 * Canonical block of instructions about list-typed fields, embedded
 * in both the extraction prompt and the save_field tool description.
 * Reuse keeps the wording consistent and makes drift visible in code
 * review when one site updates without the other.
 */
export const LIST_INSTRUCTIONS_BLOCK = `For LIST-TYPED fields (list_short / list_long), the value MUST be a JSON array of strings — one item per array entry.
  ✓ CORRECT:   {"direct_competitors": ["Stumptown Coffee Roasters", "Intelligentsia", "Local Reverie Coffee"]}
  ✗ WRONG:     {"direct_competitors": "StumptownCoffeeRoastersIntelligentsiaLocalReverieCoffee"}
  ✗ WRONG:     {"direct_competitors": "Stumptown, Intelligentsia, Local Reverie"}
NEVER concatenate items into a single string. NEVER comma-join into one string. ALWAYS use a JSON array, even for a single item.`;
