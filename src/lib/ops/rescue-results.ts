import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type { RescueResult } from "./types";

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<RescueResult[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: sends } = await admin
    .from("customer_rescue_sends")
    .select("user_id, chapter_slug, days_idle, sent_at")
    .gte("sent_at", since);

  if (!sends || sends.length === 0) return [];

  const userIds = [...new Set(sends.map((s) => s.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  return sends.map((s) => {
    const profile = profileMap.get(s.user_id);
    return {
      firstName: profile?.full_name?.split(/\s+/)[0]?.trim() ?? null,
      email: profile?.email ?? "unknown",
      daysIdle: s.days_idle,
      nextChapter:
        MEMORY_FILE_TITLES[
          s.chapter_slug as keyof typeof MEMORY_FILE_TITLES
        ] ?? s.chapter_slug,
      sent: true,
    };
  });
}
