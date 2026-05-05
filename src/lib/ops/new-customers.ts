import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { NewCustomer } from "./types";

const TIER_NAMES: Record<number, string> = {
  1: "The Blueprint",
  2: "Navigator",
  3: "Builder",
};

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<NewCustomer[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: purchases } = await admin
    .from("purchases")
    .select("user_id, tier, amount_cents, created_at")
    .eq("status", "paid")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (!purchases || purchases.length === 0) return [];

  const userIds = [...new Set(purchases.map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  return purchases.map((p) => {
    const profile = profileMap.get(p.user_id);
    return {
      firstName: profile?.full_name?.split(/\s+/)[0]?.trim() ?? null,
      email: profile?.email ?? "unknown",
      tier: p.tier as 1 | 2 | 3,
      tierName: TIER_NAMES[p.tier] ?? `Tier ${p.tier}`,
      amountCents: p.amount_cents,
      purchasedAt: p.created_at,
    };
  });
}
