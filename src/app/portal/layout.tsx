import type { ReactNode } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PortalNav } from "@/components/PortalNav";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated routes (login page) bring their own chrome (SiteNav + SiteFooter).
  // Skip the portal nav so we don't double-render and so users don't see a
  // misleading "Sign out" button before they're signed in.
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-grey-1/40">
      <PortalNav email={user.email ?? null} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
