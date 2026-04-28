import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") ? nextParam : "/portal";

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=invalid_link`);
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(`[auth/callback] exchange failed: ${error.message}`);
    return NextResponse.redirect(`${origin}/portal/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
