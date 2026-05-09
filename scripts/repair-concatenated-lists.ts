#!/usr/bin/env npx tsx
/**
 * One-shot repair for concatenated list_short / list_long values that
 * Jason AI produced before the prompt + parser hardening shipped on
 * 2026-05-09 (commit TBD).
 *
 * Symptom Eric flagged: the Competitor Landscape "Direct competitors"
 * field stored as `["StumptownCoffeeRoastersIntelligentsiaLocalReverieCoffee"]`
 * — a single concatenated string instead of three separate items. The
 * field renders the array joined by newlines in the textarea, so the
 * customer saw an unreadable mess.
 *
 * Fix strategy: walk every `customer_memory` row, look at every field
 * whose schema type is `list_short` or `list_long`, and for any value
 * that is a single-item array where the item is ≥24 chars, has no
 * whitespace, and contains ≥3 TitleCase boundaries → apply
 * unconcatenateTitleCase() (insert spaces at TitleCase boundaries).
 * Resulting single item is human-readable; the customer can split it
 * into separate rows manually.
 *
 * Usage:
 *   npx tsx scripts/repair-concatenated-lists.ts          # dry-run
 *   npx tsx scripts/repair-concatenated-lists.ts --apply  # actually update
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SECTION_SCHEMAS } from "../src/lib/memory/schemas";
import { unconcatenateTitleCase } from "../src/lib/agent/coerce-list";
import type { MemoryFileSlug } from "../src/lib/memory/files";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLY = process.argv.includes("--apply");

interface MemoryRow {
  user_id: string;
  file_slug: string;
  fields: Record<string, unknown> | null;
}

interface Repair {
  user_id: string;
  file_slug: string;
  field: string;
  before: string[];
  after: string[];
}

function isListField(slug: string, fieldName: string): boolean {
  const schema = SECTION_SCHEMAS[slug as MemoryFileSlug];
  if (!schema) return false;
  const fd = schema.fields.find((f) => f.name === fieldName);
  if (!fd) return false;
  return fd.type === "list_short" || fd.type === "list_long";
}

function repairListValue(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  let touched = false;
  const repaired = value.map((item) => {
    if (typeof item !== "string") return item;
    const fixed = unconcatenateTitleCase(item);
    if (fixed !== item) touched = true;
    return fixed;
  });
  return touched ? (repaired as string[]) : null;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SR, {
    auth: { persistSession: false },
  });

  console.log(
    `Mode: ${APPLY ? "🔧 APPLY (writes will happen)" : "🔍 DRY-RUN (no writes)"}\n`,
  );

  const { data, error } = await supabase
    .from("customer_memory")
    .select("user_id, file_slug, fields");
  if (error) throw new Error(`select failed: ${error.message}`);
  const rows = (data ?? []) as MemoryRow[];
  console.log(`Scanned ${rows.length} customer_memory rows.\n`);

  const repairs: Repair[] = [];
  for (const row of rows) {
    if (!row.fields) continue;
    for (const [fieldName, value] of Object.entries(row.fields)) {
      if (!isListField(row.file_slug, fieldName)) continue;
      const after = repairListValue(value);
      if (!after) continue;
      repairs.push({
        user_id: row.user_id,
        file_slug: row.file_slug,
        field: fieldName,
        before: value as string[],
        after,
      });
    }
  }

  if (repairs.length === 0) {
    console.log("✓ No concatenated list values found. Nothing to repair.");
    return;
  }

  console.log(`Found ${repairs.length} field(s) to repair:\n`);
  for (const r of repairs) {
    console.log(`  user=${r.user_id.slice(0, 8)}…  ${r.file_slug}.${r.field}`);
    console.log(`    before: ${JSON.stringify(r.before).slice(0, 140)}`);
    console.log(`    after:  ${JSON.stringify(r.after).slice(0, 140)}`);
    console.log();
  }

  if (!APPLY) {
    console.log(
      "Run with --apply to perform the updates. Each row gets a single UPDATE setting fields to the merged repaired version.",
    );
    return;
  }

  // Group repairs by (user_id, file_slug) so we issue one UPDATE per row,
  // not per field — avoids racing two fields on the same row.
  const grouped = new Map<string, Repair[]>();
  for (const r of repairs) {
    const key = `${r.user_id}|${r.file_slug}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  let succeeded = 0;
  let failed = 0;
  for (const [key, rs] of grouped) {
    const [user_id, file_slug] = key.split("|");
    // Re-fetch the current fields jsonb so we don't clobber unrelated
    // edits between scan and write.
    const { data: cur, error: getErr } = await supabase
      .from("customer_memory")
      .select("fields")
      .eq("user_id", user_id)
      .eq("file_slug", file_slug)
      .maybeSingle();
    if (getErr || !cur) {
      console.error(`✗ ${key}: refetch failed (${getErr?.message ?? "missing"})`);
      failed++;
      continue;
    }
    const merged: Record<string, unknown> = {
      ...((cur.fields as Record<string, unknown>) ?? {}),
    };
    for (const r of rs) merged[r.field] = r.after;

    const { error: updErr } = await supabase
      .from("customer_memory")
      .update({ fields: merged })
      .eq("user_id", user_id)
      .eq("file_slug", file_slug);
    if (updErr) {
      console.error(`✗ ${key}: update failed (${updErr.message})`);
      failed++;
    } else {
      console.log(
        `✓ ${user_id.slice(0, 8)}…/${file_slug} — repaired ${rs.length} field(s)`,
      );
      succeeded++;
    }
  }

  console.log(`\nDone. ${succeeded} row(s) updated, ${failed} failed.`);
}

main().catch((e) => {
  console.error("repair script crashed:", e);
  process.exit(1);
});
