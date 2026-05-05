import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AssessmentLead } from "./types";

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<AssessmentLead[]> {
  const { data: sessions } = await admin
    .from("assessment_sessions")
    .select("id, email, first_name, business_name, band, total_score, completed_at, user_id")
    .not("completed_at", "is", null)
    .not("email", "is", null)
    .order("completed_at", { ascending: false })
    .limit(200);

  if (!sessions || sessions.length === 0) return [];

  const userIds = sessions
    .map((s) => s.user_id)
    .filter((id): id is string => id !== null);

  let purchasedUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: purchases } = await admin
      .from("purchases")
      .select("user_id")
      .eq("status", "paid")
      .in("user_id", userIds);
    purchasedUserIds = new Set(
      (purchases ?? []).map((p) => p.user_id),
    );
  }

  const now = Date.now();
  const leads: AssessmentLead[] = [];

  for (const s of sessions) {
    if (s.user_id && purchasedUserIds.has(s.user_id)) continue;
    if (!s.email || !s.completed_at || s.total_score === null) continue;

    const daysSince = Math.floor(
      (now - new Date(s.completed_at).getTime()) / (24 * 3600 * 1000),
    );
    if (daysSince > 30) continue;

    leads.push({
      email: s.email,
      firstName: s.first_name,
      businessName: s.business_name,
      band: s.band ?? "unknown",
      score: s.total_score,
      completedAt: s.completed_at,
      daysSinceCompletion: daysSince,
    });
  }

  return leads;
}
