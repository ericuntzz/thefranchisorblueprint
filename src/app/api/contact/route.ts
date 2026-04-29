import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/queue";

export const runtime = "nodejs";

const CALENDLY_DISCOVERY_URL =
  "https://calendly.com/team-thefranchisorblueprint/30-minute-discovery-call";

const INTERNAL_NOTIFICATION_EMAIL =
  process.env.INTERNAL_NOTIFICATION_EMAIL ?? "team@thefranchisorblueprint.com";

/**
 * Receives the /contact form POST. Stores the submission in Supabase, fires
 * two emails via the internal Resend queue:
 *   1. autoresponder confirmation to the submitter
 *   2. internal notification to the team inbox so Jason sees the lead
 *
 * Soft-fails on any individual step so the user always lands on the
 * thank-you page — server logs surface anything that broke.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const firstName = String(form.get("firstName") ?? "").trim() || null;
  const lastName = String(form.get("lastName") ?? "").trim() || null;
  // /contact is now support/admin-flavored: business + revenue dropped from
  // the form (sales-intent visitors are routed to /strategy-call instead).
  // The new "topic" field replaces "program" — we still persist into the
  // existing program_interest column so we don't need a schema migration.
  const businessName = String(form.get("business") ?? "").trim() || null;
  const annualRevenue = String(form.get("revenue") ?? "").trim() || null;
  const topic = String(form.get("topic") ?? form.get("program") ?? "").trim() || null;
  const message = String(form.get("message") ?? "").trim() || null;

  // Basic validation: real-looking email + name + something to act on. We
  // dropped the business-name requirement when /contact pivoted to support.
  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL("/contact?error=email", req.url), 303);
  }
  if (!firstName || !lastName || !message) {
    return NextResponse.redirect(new URL("/contact?error=missing", req.url), 303);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // 1) Persist the submission. If this fails we still continue to email
  // dispatch so we don't drop the lead entirely — Eric's inbox is the
  // safety net.
  const supabase = getSupabaseAdmin();
  let submissionId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("contact_submissions")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        annual_revenue: annualRevenue,
        program_interest: topic,
        message,
        ip,
        user_agent: userAgent,
        user_id: null,
      })
      .select("id")
      .single();
    if (error) throw error;
    submissionId = data.id;
  } catch (err) {
    console.error("[contact] supabase insert failed:", err);
  }

  // 2) Autoresponder to the submitter (immediate via dedupeKey; cron picks
  // up + sends within 1 minute).
  try {
    await enqueueEmail({
      recipientEmail: email,
      template: "contact-form-confirmation",
      payload: {
        firstName,
        messagePreview: message ? message.slice(0, 280) : null,
        calendlyUrl: CALENDLY_DISCOVERY_URL,
      },
      dedupeKey: submissionId
        ? `contact-form-confirmation:${submissionId}`
        : `contact-form-confirmation:${email}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[contact] enqueue confirmation failed:", err);
  }

  // 3) Internal notification to the team inbox.
  try {
    await enqueueEmail({
      recipientEmail: INTERNAL_NOTIFICATION_EMAIL,
      template: "internal-lead-notification",
      payload: {
        source: "contact-form",
        email,
        firstName,
        lastName,
        businessName,
        annualRevenue,
        programInterest: topic,
        message,
        submittedAt: new Date().toISOString(),
        supabaseRowUrl: submissionId
          ? `https://supabase.com/dashboard/project/rrordqfdrdtbobmmkdss/editor?table=contact_submissions&filter=id.eq.${submissionId}`
          : null,
      },
      dedupeKey: submissionId
        ? `internal-lead-notification:${submissionId}`
        : `internal-lead-notification:${email}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[contact] enqueue internal notification failed:", err);
  }

  return NextResponse.redirect(new URL("/contact/thank-you", req.url), 303);
}
