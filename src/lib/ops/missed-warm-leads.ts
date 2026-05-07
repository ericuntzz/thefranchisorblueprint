/**
 * Missed warm leads collector — for the daily ops digest.
 *
 * Surfaces high-readiness assessment completers who:
 *   - Scored in the `franchise_ready` or `nearly_there` band
 *   - Completed the assessment 1-7 days ago (we leave the first 24h alone
 *     so the immediate internal-lead-notification has time to land before
 *     the lead shows up in this watchlist)
 *   - Have NOT booked a strategy call (any non-canceled coaching_session)
 *   - Have NOT purchased anything
 *
 * The collector runs a fresh join against current rows every time — there's
 * no cache or persisted state, so a lead that just booked at 11:58pm last
 * night is correctly excluded from the 6am digest.
 *
 * See `src/lib/leads/lead-status.ts` for the journey-status helper that
 * powers the booked/purchased filtering — it's the single source of truth
 * across all lead-tracking surfaces.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AssessmentBand } from "@/lib/supabase/types";
import { normalizeEmail } from "@/lib/utils/normalize-email";
import { getLeadJourneyStatuses } from "@/lib/leads/lead-status";
import type { MissedWarmLead } from "./types";

const WARM_BANDS: AssessmentBand[] = ["franchise_ready", "nearly_there"];
const MIN_HOURS_AGO = 24; // give the immediate alert 24h to land first
const MAX_DAYS_AGO = 7;

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<MissedWarmLead[]> {
  const now = Date.now();
  const minCutoff = new Date(now - MIN_HOURS_AGO * 3600 * 1000).toISOString();
  const maxCutoff = new Date(
    now - MAX_DAYS_AGO * 24 * 3600 * 1000,
  ).toISOString();

  // 1) Pull warm assessment completers from the right time window.
  const { data: sessions } = await admin
    .from("assessment_sessions")
    .select(
      "id, email, first_name, business_name, website_url, band, total_score, urgency, completed_at",
    )
    .in("band", WARM_BANDS)
    .not("email", "is", null)
    .lte("completed_at", minCutoff)
    .gte("completed_at", maxCutoff)
    .order("completed_at", { ascending: false })
    .limit(100);

  if (!sessions || sessions.length === 0) return [];

  // 2) Compute journey status for each lead — single source of truth.
  const emails = sessions
    .map((s) => normalizeEmail(s.email))
    .filter((e) => e.length > 0);

  const statuses = await getLeadJourneyStatuses(admin, emails);

  // 3) Filter to leads who haven't booked AND haven't purchased.
  const missed: MissedWarmLead[] = [];
  const seen = new Set<string>(); // dedupe across multiple sessions per email

  for (const s of sessions) {
    const email = normalizeEmail(s.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const status = statuses.get(email);
    if (!status) continue;
    if (status.booked || status.purchased) continue;

    const completedAt = s.completed_at ?? new Date().toISOString();
    const daysSince = Math.floor(
      (now - new Date(completedAt).getTime()) / (24 * 3600 * 1000),
    );

    missed.push({
      assessmentSessionId: s.id,
      email,
      firstName: s.first_name,
      businessName: s.business_name,
      websiteUrl: s.website_url,
      band: (s.band ?? "nearly_there") as "franchise_ready" | "nearly_there",
      score: s.total_score ?? 0,
      urgency: s.urgency,
      completedAt,
      daysSinceCompletion: daysSince,
    });
  }

  return missed;
}
