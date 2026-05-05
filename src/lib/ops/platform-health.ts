import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PlatformHealthSummary } from "./types";

/**
 * Reads the last 24 hours of health-check incidents from the
 * `health_check_incidents` table. The health-check cron
 * (/api/cron/health-check) populates that table every 5 minutes
 * when something crosses a threshold. This collector summarizes
 * it for the daily ops digest.
 */
export async function collect(
  admin: SupabaseClient<Database>,
): Promise<PlatformHealthSummary> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count, error } = await admin
    .from("health_check_incidents")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  if (error) {
    // Table might not exist yet — treat as not configured.
    return { status: "not_configured" };
  }

  const incidentCount = count ?? 0;
  return incidentCount === 0
    ? { status: "all_clear", incidentCount: 0 }
    : { status: "incidents", incidentCount };
}
