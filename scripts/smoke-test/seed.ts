#!/usr/bin/env npx tsx
/**
 * Idempotent test-account state seeder.
 *
 * Re-runs cleanly: every operation is upsert-style or guarded by an
 * existence check. Use this if the test account state drifted (someone
 * deleted rows, a migration wiped redlines, etc.) and you want the
 * smoke test back to a known baseline.
 *
 * Steady-state goal:
 *   - 1 paid Tier-1 purchase
 *   - profiles row matching the auth user (Tier 1)
 *   - 3 redlines on business_overview (1 blocker, 1 warning, 1 info-resolved)
 *
 * Usage:
 *   npx tsx scripts/smoke-test/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_USER_ID = "f6c99e67-2bf0-4159-a486-b0e9fbeb8cd2";
const TEST_EMAIL = "eric.j.unterberger+smoketest@gmail.com";

const supabase = createClient(SUPABASE_URL, SR, {
  auth: { persistSession: false },
});

async function ensureUser() {
  const { data, error } = await supabase.auth.admin.getUserById(TEST_USER_ID);
  if (error || !data.user) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: "Smoke Test (TFB)", is_test_account: true },
    });
    if (createErr) throw new Error(`createUser: ${createErr.message}`);
    console.log("✓ created test auth user");
  } else {
    console.log("✓ test auth user exists");
  }
}

async function ensurePurchase() {
  const { data: existing } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", TEST_USER_ID)
    .eq("status", "paid")
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("✓ paid purchase exists");
    return;
  }
  const { error } = await supabase.from("purchases").insert({
    user_id: TEST_USER_ID,
    stripe_session_id: `cs_test_smoketest_blueprint_${Date.now()}`,
    stripe_payment_intent_id: `pi_test_smoketest_${Date.now()}`,
    product: "blueprint",
    tier: 1,
    amount_cents: 299700,
    currency: "usd",
    status: "paid",
  });
  if (error) throw new Error(`purchase insert: ${error.message}`);
  console.log("✓ created paid purchase");
}

async function ensureProfile() {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      full_name: "Smoke Test (TFB)",
      tier: 1,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`profile upsert: ${error.message}`);
  console.log("✓ profile upserted");
}

async function ensureRedlines() {
  const { data: existing } = await supabase
    .from("chapter_redlines")
    .select("id, severity, resolved_at")
    .eq("user_id", TEST_USER_ID)
    .eq("chapter_slug", "business_overview");
  const want = ["blocker", "warning", "info"];
  const have = (existing ?? []).map((r) => r.severity);
  const missing = want.filter((s) => !have.includes(s));
  if (missing.length === 0) {
    console.log(`✓ ${existing!.length} redlines already seeded`);
    return;
  }
  const seeds = [
    {
      severity: "blocker" as const,
      claim_id: null,
      comment:
        "Concept summary opens with industry buzzwords; replace with the one-sentence story you tell at the bar — that's the version franchisees fall in love with.",
    },
    {
      severity: "warning" as const,
      claim_id: "field-founder_background",
      comment:
        "Founder background is missing the operating-experience hook. Add the years-in-the-trade and the specific stake — investors and franchisees both look for it here.",
    },
    {
      severity: "info" as const,
      claim_id: null,
      comment:
        "Nice work pulling the audience profile from your About page — keep iterating, this paragraph is already 80% there.",
    },
  ].filter((s) => missing.includes(s.severity));
  const { data: inserted, error } = await supabase
    .from("chapter_redlines")
    .insert(
      seeds.map((s) => ({
        user_id: TEST_USER_ID,
        chapter_slug: "business_overview",
        claim_id: s.claim_id,
        comment: s.comment,
        severity: s.severity,
        reviewer_user_id: TEST_USER_ID,
        reviewer_name: "Jason Power",
      })),
    )
    .select("id, severity");
  if (error) throw new Error(`redline insert: ${error.message}`);
  console.log(`✓ inserted ${inserted!.length} missing redlines`);

  // Resolve the info-severity one to mimic steady state.
  const infoRow = inserted!.find((r) => r.severity === "info");
  if (infoRow) {
    const { error: resErr } = await supabase
      .from("chapter_redlines")
      .update({ resolved_at: new Date().toISOString(), resolved_by_user_id: TEST_USER_ID })
      .eq("id", infoRow.id);
    if (!resErr) console.log("✓ resolved the info-severity redline");
  }
}

async function main() {
  console.log(`Seeding ${TEST_EMAIL} (${TEST_USER_ID})...`);
  await ensureUser();
  await ensureProfile();
  await ensurePurchase();
  await ensureRedlines();
  console.log("\nSeed complete. Test account ready for smoke test.");
}

main().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
