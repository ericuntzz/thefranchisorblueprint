import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailHealthSummary } from "./types";

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<EmailHealthSummary> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ count: sentCount }, { data: failures }] = await Promise.all([
    admin
      .from("scheduled_emails")
      .select("*", { count: "exact", head: true })
      .not("sent_at", "is", null)
      .gte("sent_at", since),
    admin
      .from("scheduled_emails")
      .select("recipient_email, template, failure_reason, failed_at")
      .not("failed_at", "is", null)
      .gte("failed_at", since)
      .order("failed_at", { ascending: false }),
  ]);

  return {
    sent24h: sentCount ?? 0,
    failed24h: failures?.length ?? 0,
    failures: (failures ?? []).map((f) => ({
      recipient: f.recipient_email,
      template: f.template,
      reason: f.failure_reason,
      failedAt: f.failed_at!,
    })),
  };
}
