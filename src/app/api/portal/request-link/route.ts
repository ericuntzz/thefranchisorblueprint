import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safe-redirect";

export const runtime = "nodejs";

/**
 * Normalize an email submitted via the login form. Customers paste
 * from a wide variety of sources — Outlook ("Eric Unterberger
 * <eric@...>"), password managers (sometimes adds a trailing space),
 * iOS autocomplete (smart quotes), screenshot OCR (no-break spaces).
 * We try to recover the actual email rather than reject the
 * submission outright.
 */
function normalizeEmail(raw: string): string {
  let s = raw;
  // Replace no-break spaces, zero-width spaces, etc. with regular spaces.
  s = s.replace(/[ ​‌‍﻿]/g, " ");
  // Strip surrounding quotes (smart or straight).
  s = s.replace(/^["'“‘]+|["'”’]+$/g, "");
  s = s.trim();
  // Outlook / mailto format: "Display Name <user@example.com>".
  // Extract the part inside the angle brackets if present.
  const bracketMatch = /<([^>]+)>/.exec(s);
  if (bracketMatch) s = bracketMatch[1];
  // Strip mailto: prefix.
  s = s.replace(/^mailto:/i, "");
  // Final trim + lowercase.
  return s.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const emailRaw = form.get("email");
  const nextParam = form.get("next");
  const email =
    typeof emailRaw === "string" ? normalizeEmail(emailRaw) : "";
  const next = safeNext(typeof nextParam === "string" ? nextParam : null);

  const loginUrl = new URL("/portal/login", req.nextUrl.origin);

  // Loose email regex — matches anything that looks like
  // local@domain.tld. Stricter than `includes("@")` so a typo like
  // "eric@thefranchisorblueprintcom" or "ericgmail.com" gets caught
  // server-side instead of silently failing on a Supabase OTP send.
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!email || !looksLikeEmail) {
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
