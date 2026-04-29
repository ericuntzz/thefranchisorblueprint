import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Lets a logged-in customer update their full_name. RLS on profiles
 * permits the user to update their own row; the security_definer
 * trigger from migration 0004 blocks any non-name column from being
 * mutated, so this endpoint can't be used to escalate tier or change
 * email/stripe_customer_id.
 *
 * CSRF defense: SameSite cookie + explicit Origin header check.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin POST blocked" }, { status: 403 });
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${req.nextUrl.origin}/portal/login`, 303);
  }

  const form = await req.formData();
  const rawName = form.get("full_name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  // Sane bounds: empty allowed (customer can blank it out), max 100 chars
  // to keep the database tidy.
  if (name.length > 100) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/portal/account?err=name_too_long`,
      303,
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name || null })
    .eq("id", user.id);

  if (error) {
    console.error(`[portal/profile] update failed: ${error.message}`);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/portal/account?err=update_failed`,
      303,
    );
  }

  return NextResponse.redirect(
    `${req.nextUrl.origin}/portal/account?ok=name_updated`,
    303,
  );
}
