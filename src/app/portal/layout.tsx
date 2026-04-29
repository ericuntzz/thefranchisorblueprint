import type { ReactNode } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PortalNav } from "@/components/PortalNav";
import type { Profile, Purchase, Tier } from "@/lib/supabase/types";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated routes (login page) bring their own chrome (SiteNav + SiteFooter).
  if (!user) {
    return <>{children}</>;
  }

  const [{ data: profileData }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("tier,status").eq("user_id", user.id).eq("status", "paid"),
  ]);

  const profile = profileData as Pick<Profile, "full_name"> | null;
  const purchases = (purchasesData ?? []) as Pick<Purchase, "tier" | "status">[];
  const tier = (purchases.length > 0
    ? Math.max(...purchases.map((p) => p.tier))
    : 1) as Tier;

  return (
    <div className="min-h-screen flex flex-col bg-grey-1/40">
      <PortalNav
        displayName={profile?.full_name ?? null}
        email={user.email ?? null}
        tier={tier}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
