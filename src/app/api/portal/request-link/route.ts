import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safe-redirect";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const emailRaw = form.get("email");
  const nextParam = form.get("next");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const next = safeNext(typeof nextParam === "string" ? nextParam : null);

  const loginUrl = new URL("/portal/login", req.nextUrl.origin);

  if (!email || !email.includes("@")) {
    loginUrl.searchParams.set("error", "invalid_email");
    // Echo the rejected email back so the form can re-populate.
    // Lets the customer see exactly what got rejected (most often a
    // typo) and edit it inline rather than retyping from scratch.
    if (email) loginUrl.searchParams.set("email", email);
    return NextResponse.redirect(loginUrl, 303);
  }

  const supabase = getSupabaseAdmin();

  // Only allow sign-in for emails that have an existing purchase (a profile row).
  // This stops random people from spamming our customers with sign-in emails.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    loginUrl.searchParams.set("error", "no_account");
    loginUrl.searchParams.set("email", email);
    return NextResponse.redirect(loginUrl, 303);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${req.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error(`[portal] signInWithOtp failed for ${email}: ${error.message}`);
    loginUrl.searchParams.set("error", "send_failed");
    return NextResponse.redirect(loginUrl, 303);
  }

  loginUrl.searchParams.set("sent", "1");
  return NextResponse.redirect(loginUrl, 303);
}
