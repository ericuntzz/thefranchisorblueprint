import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

export const runtime = "nodejs";

// Whitelist of OTP types we accept here. Other types (signup, recovery, etc.)
// have their own flows we don't support — block them so a crafted ?type=
// can't trigger an unintended verifyOtp branch.
const ALLOWED_TYPES = new Set<EmailOtpType>(["magiclink", "email"]);

/**
 * Verifies a server-issued magic link via the token_hash flow.
 *
 * URL shape: /auth/confirm?token_hash=XXX&type=magiclink&next=/portal
 *
 * This is the SSR-friendly auth path — it works for magic links generated
 * server-side (where PKCE isn't possible because there's no client-side
 * code_verifier). The PKCE-based /auth/callback route is unused for now
 * but kept in case we ever do client-side auth.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !typeParam || !ALLOWED_TYPES.has(typeParam as EmailOtpType)) {
    return NextResponse.redirect(`${origin}/portal/login?error=invalid_link`);
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeParam as EmailOtpType,
  });

  if (error) {
    console.error(`[auth/confirm] verifyOtp failed: ${error.message}`);
    return NextResponse.redirect(`${origin}/portal/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
