import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/queue";

export const runtime = "nodejs";

const INTERNAL_NOTIFICATION_EMAIL =
  process.env.INTERNAL_NOTIFICATION_EMAIL ?? "team@thefranchisorblueprint.com";

/**
 * Receives the /blog newsletter signup POST. Stores the subscriber in
 * Supabase (idempotent on email — the unique constraint catches re-subs)
 * and enqueues a welcome email + a quiet internal notification.
 *
 * Re-subscribing with an existing email is a silent no-op — we still
 * 303 to /blog?subscribed=1 so the user sees the success banner.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL("/blog?error=email", req.url), 303);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const supabase = getSupabaseAdmin();

  // 1) Insert subscriber. If email already exists (unique constraint),
  // PostgREST returns 409 — we treat that as success ("already subscribed")
  // and skip the welcome email so we don't double-send.
  let isNewSubscriber = false;
  try {
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email,
      source: "blog",
      ip,
      user_agent: userAgent,
    });
    if (error) {
      // 23505 = unique violation (already subscribed). Anything else is real.
      if (error.code === "23505") {
        isNewSubscriber = false;
      } else {
        throw error;
      }
    } else {
      isNewSubscriber = true;
    }
  } catch (err) {
    console.error("[subscribe] supabase insert failed:", err);
  }

  // 2) Welcome email — only for genuinely new subscribers.
  if (isNewSubscriber) {
    try {
      await enqueueEmail({
        recipientEmail: email,
        template: "newsletter-welcome",
        payload: { email },
        dedupeKey: `newsletter-welcome:${email}`,
      });
    } catch (err) {
      console.error("[subscribe] enqueue welcome failed:", err);
    }

    // 3) Internal notification (quiet — keeps Jason aware of growth).
    try {
      await enqueueEmail({
        recipientEmail: INTERNAL_NOTIFICATION_EMAIL,
        template: "internal-lead-notification",
        payload: {
          source: "newsletter",
          email,
          submittedAt: new Date().toISOString(),
        },
        dedupeKey: `internal-newsletter:${email}`,
      });
    } catch (err) {
      console.error("[subscribe] enqueue internal notification failed:", err);
    }
  }

  return NextResponse.redirect(new URL("/blog?subscribed=1", req.url), 303);
}
