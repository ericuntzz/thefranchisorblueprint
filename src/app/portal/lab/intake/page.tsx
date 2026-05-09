import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Purchase } from "@/lib/supabase/types";
import { IntakeClient } from "./IntakeClient";
// SiteFooter intentionally not rendered — see /portal/lab/next/page.tsx.

export const metadata: Metadata = {
  title: "Day 1 · Pre-fill your Blueprint | The Franchisor Blueprint",
  description: "Drop your website and the agent learns your brand and concept before voice intake.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /portal/lab/intake — Day 1 wow flow.
 *
 * Hidden under /lab so it's deployable without surfacing on the main
 * portal nav until verified end-to-end. Promote to /portal/intake or
 * fold into /portal once the v1 launch surface lands.
 */
export default async function IntakeLabPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=/portal/lab/intake");

  const [{ data: profileRow }, { data: purchasesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("purchases").select("*").eq("user_id", user.id).eq("status", "paid"),
  ]);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) redirect("/portal");

  const profile = (profileRow ?? null) as Profile | null;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  // If the customer hasn't filled in website_url yet, peek at their most
  // recent assessment row — we likely captured it pre-purchase.
  let initialUrl = profile?.website_url ?? null;
  if (!initialUrl) {
    const { data: rows } = await supabase
      .from("assessment_sessions")
      .select("website_url")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1);
    initialUrl =
      ((rows ?? [])[0] as { website_url: string | null } | undefined)
        ?.website_url ?? null;
  }

  return (
    <>
      {/* No SiteNav — this is a focused single-task page; SiteNav would
          dilute attention from the one CTA. */}
      <main className="min-h-[calc(100vh-200px)] bg-cream-soft">
        <IntakeClient firstName={firstName} initialWebsiteUrl={initialUrl} />
      </main>
    </>
  );
}
