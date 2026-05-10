import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeMemoryFields } from "@/lib/memory";
import type { IntakeSnapshot } from "./orchestrator";

/**
 * After Stripe checkout completes (or any other signup path that
 * creates a Supabase auth user), look up the most recent completed,
 * unmerged intake snapshot for that user's email and copy the data
 * into customer_memory so the portal opens pre-filled.
 *
 * The merge is one-shot per intake row: once merged, the row gets
 * stamped with user_id + merged_at so re-runs are no-ops.
 *
 * Idempotent: safe to call multiple times. Will only merge an
 * intake row once.
 *
 * Returns:
 *   { merged: true, snapshot, businessName, readinessPct }  on success
 *   { merged: false }                                       if nothing to do
 */
export type MergeIntakeResult =
  | {
      merged: true;
      snapshot: IntakeSnapshot;
      businessName: string | null;
      readinessPct: number;
      intakeSessionId: string;
    }
  | { merged: false };

export async function mergeIntakeForUser(args: {
  userId: string;
  email: string;
}): Promise<MergeIntakeResult> {
  const supabase = getSupabaseAdmin();

  // Find the most recent completed, unmerged intake session for this
  // email. If they happened to drop multiple URLs, take the most recent.
  const { data: rows } = await supabase
    .from("intake_sessions")
    .select("id, score_data, business_data, market_data, expansion_data, merged_at")
    .eq("email", args.email.toLowerCase())
    .eq("status", "complete")
    .is("merged_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { merged: false };

  const scoreData = row.score_data as { snapshot?: IntakeSnapshot } | null;
  const snapshot = scoreData?.snapshot;
  if (!snapshot) {
    // Defensive: an intake row claims status=complete but has no snapshot.
    // Mark it merged anyway so we don't re-check on future signups.
    await supabase
      .from("intake_sessions")
      .update({ user_id: args.userId, merged_at: new Date().toISOString() })
      .eq("id", row.id as string);
    return { merged: false };
  }

  // ─── Map snapshot → customer_memory sections ─────────────────────
  // We only write fields where the snapshot has high-confidence data.
  // The agent / portal flows can verify and overwrite later.

  // business_overview section
  const businessFields: Record<string, string | null> = {};
  if (snapshot.business.name) businessFields.business_name = snapshot.business.name;
  if (snapshot.business.oneLineConcept) businessFields.concept_summary = snapshot.business.oneLineConcept;
  if (snapshot.business.address) businessFields.headquarters_address = snapshot.business.address;
  if (snapshot.business.city) businessFields.headquarters_city = snapshot.business.city;
  if (snapshot.business.state) businessFields.headquarters_state = snapshot.business.state;
  if (snapshot.business.zip) businessFields.headquarters_zip = snapshot.business.zip;

  if (Object.keys(businessFields).length > 0) {
    await writeMemoryFields({
      userId: args.userId,
      slug: "business_overview",
      changes: businessFields,
      source: "scraper",
      note: `Pre-filled from URL intake — verify before publishing`,
    });
  }

  // brand_voice section
  if (snapshot.business.brandVoice) {
    await writeMemoryFields({
      userId: args.userId,
      slug: "brand_voice",
      changes: { voice_characterization: snapshot.business.brandVoice },
      source: "scraper",
      note: `Pre-filled from URL intake`,
    });
  }

  // territory_real_estate section — home-market profile + expansion markets.
  // The snapshot key was renamed prototype → homeMarket on 2026-05-10 to
  // remove lab-science jargon; we still read both shapes so old cached
  // rows that may pre-date the rename don't break the merge. The DB
  // field names (prototype_*) live on customer_memory and would require
  // a schema migration to rename — left alone for now.
  const homeMarket =
    snapshot.homeMarket ??
    (snapshot as unknown as { prototype?: typeof snapshot.homeMarket }).prototype;
  const territoryFields: Record<string, string | number | string[] | null> = {};
  if (homeMarket?.zip) {
    territoryFields.prototype_zip = homeMarket.zip;
  }
  if (homeMarket?.demographics) {
    territoryFields.prototype_median_household_income =
      homeMarket.demographics.medianHouseholdIncome;
    territoryFields.prototype_median_age = homeMarket.demographics.medianAge;
    territoryFields.prototype_population = homeMarket.demographics.population;
  }
  if (homeMarket?.competitorCount != null) {
    territoryFields.prototype_competitor_count_1mi = homeMarket.competitorCount;
  }
  if (homeMarket?.narrative) {
    territoryFields.prototype_narrative = homeMarket.narrative;
  }
  if (snapshot.expansion.length > 0) {
    territoryFields.expansion_market_candidates = snapshot.expansion.map(
      (m) => `${m.label} (${m.zip}, ${m.state}) — score ${m.score}/100 — ${m.why}`,
    );
  }
  if (Object.keys(territoryFields).length > 0) {
    await writeMemoryFields({
      userId: args.userId,
      slug: "territory_real_estate",
      changes: territoryFields,
      source: "scraper",
      note: `Pre-filled from URL intake — Census + Places enrichment`,
    });
  }

  // ─── Stamp the intake row as merged ──────────────────────────────
  await supabase
    .from("intake_sessions")
    .update({
      user_id: args.userId,
      merged_at: new Date().toISOString(),
    })
    .eq("id", row.id as string);

  return {
    merged: true,
    snapshot,
    businessName: snapshot.business.name,
    readinessPct: snapshot.readiness.overall,
    intakeSessionId: row.id as string,
  };
}
