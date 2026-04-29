import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Calendly webhook handler.
 *
 * Subscribed events:
 *   - invitee.created  → debit a coaching credit, log the session
 *   - invitee.canceled → restore the credit, mark session canceled
 *
 * Setup (one-time, in Calendly):
 *   1. Calendly → Integrations → Webhooks → Create webhook subscription
 *   2. URL: https://www.thefranchisorblueprint.com/api/webhooks/calendly
 *   3. Events: invitee.created, invitee.canceled
 *   4. Scope: organization (so all event types are covered)
 *   5. Calendly returns a signing key — paste into CALENDLY_WEBHOOK_SIGNING_KEY env var
 *   6. Set CALENDLY_COACHING_EVENT_TYPES to a comma-separated list of the
 *      Calendly event-type URIs that count as "coaching sessions" (the
 *      ones that should debit a credit). Other event types (Discovery
 *      Call, Builder Fit Call, etc.) are noise — we skip them silently.
 *
 * Signature scheme: HMAC-SHA256 over `${timestamp}.${rawBody}` with the
 * signing key. Header format: "t=<timestamp>,v1=<signature>". Reject if
 * signature doesn't match — prevents anyone from spoofing booking events
 * to drain coaching credits or fabricate sessions.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ─── Signature verification ───────────────────────────────────────────
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    // Webhook arrived but we haven't configured the signing key yet — fail
    // closed (any unverified request gets 503) so a misconfigured env var
    // can't silently let unsigned events through.
    console.error("[calendly] CALENDLY_WEBHOOK_SIGNING_KEY not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const sigHeader = req.headers.get("calendly-webhook-signature") ?? "";
  const parsed = parseSignatureHeader(sigHeader);
  if (!parsed) {
    return NextResponse.json({ error: "Bad signature header" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${parsed.t}.${rawBody}`)
    .digest("hex");

  if (
    expected.length !== parsed.v1.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.v1))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Replay protection: reject events older than 5 minutes
  const eventAgeSec = Math.abs(Date.now() / 1000 - Number(parsed.t));
  if (Number.isFinite(eventAgeSec) && eventAgeSec > 300) {
    return NextResponse.json({ error: "Event too old" }, { status: 401 });
  }

  // ─── Parse event ──────────────────────────────────────────────────────
  type CalendlyPayload = {
    event: "invitee.created" | "invitee.canceled" | string;
    payload: {
      uri?: string; // invitee URI
      email?: string;
      name?: string;
      scheduled_event?: {
        uri?: string;
        event_type?: string;
        start_time?: string;
        end_time?: string;
      };
    };
  };

  let body: CalendlyPayload;
  try {
    body = JSON.parse(rawBody) as CalendlyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteeEmail = body.payload?.email?.toLowerCase();
  const inviteeUri = body.payload?.uri;
  const eventUri = body.payload?.scheduled_event?.uri ?? null;
  const eventTypeUri = body.payload?.scheduled_event?.event_type ?? null;
  const scheduledAt = body.payload?.scheduled_event?.start_time;

  if (!inviteeEmail || !inviteeUri) {
    console.warn(`[calendly] ${body.event}: missing invitee email or URI — ignoring`);
    return NextResponse.json({ ok: true, ignored: "missing fields" });
  }

  // ─── Decide if this is a coaching event we should track ───────────────
  // The customer might book a discovery call, builder fit call, onboarding
  // call, final readiness review, or a coaching session. Only coaching
  // sessions should debit a credit — the others are free.
  const coachingEventTypes = (
    process.env.CALENDLY_COACHING_EVENT_TYPES ?? ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isCoachingEvent =
    coachingEventTypes.length > 0 &&
    eventTypeUri !== null &&
    coachingEventTypes.includes(eventTypeUri);

  if (!isCoachingEvent) {
    console.log(
      `[calendly] ${body.event} for non-coaching event_type ${eventTypeUri} — skip`,
    );
    return NextResponse.json({ ok: true, skipped: "non-coaching event" });
  }

  // ─── Look up the customer by invitee email ────────────────────────────
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", inviteeEmail)
    .maybeSingle();

  if (!profile) {
    console.warn(
      `[calendly] ${body.event}: no profile for ${inviteeEmail} — booking made by non-customer? logging session without debit`,
    );
    // We could still log the session for analytics, but skip the credit
    // debit. For safety, just return — the customer must be in our system
    // for us to track their coaching session.
    return NextResponse.json({ ok: true, skipped: "no matching customer" });
  }

  if (body.event === "invitee.created") {
    // Try to debit a credit. If they have none (booking made via
    // someone giving them a free pass, or via Tier-2/3 included calls),
    // we still log the session — just at zero credits.
    const { data: didDebit } = await supabase.rpc("debit_coaching_credit", {
      uid: profile.id,
    });

    const { error: insertErr } = await supabase.from("coaching_sessions").insert({
      user_id: profile.id,
      calendly_event_uri: eventUri,
      calendly_invitee_uri: inviteeUri,
      calendly_event_type_uri: eventTypeUri,
      scheduled_at: scheduledAt ?? new Date().toISOString(),
      status: "scheduled",
    });
    if (insertErr && insertErr.code !== "23505") {
      // Duplicate (we already saw this invitee URI) is fine — just don't
      // double-debit. We should restore the credit since debit fired but
      // session was a duplicate.
      console.error(
        `[calendly] coaching_sessions insert failed: ${insertErr.message}`,
      );
      if (didDebit) {
        // Restore the credit because we couldn't actually log the session.
        await supabase.rpc("add_coaching_credits", { uid: profile.id, delta: 1 });
      }
    } else if (insertErr?.code === "23505") {
      // Duplicate webhook delivery — restore the credit
      console.log(
        `[calendly] duplicate invitee.created for ${inviteeUri} — restoring credit`,
      );
      if (didDebit) {
        await supabase.rpc("add_coaching_credits", { uid: profile.id, delta: 1 });
      }
    } else {
      console.log(
        `[calendly] booked session for user ${profile.id} (debit=${didDebit ? "yes" : "no-balance"})`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.event === "invitee.canceled") {
    // Find the existing session and mark canceled. Restore the credit.
    const { data: existing } = await supabase
      .from("coaching_sessions")
      .select("id, status")
      .eq("calendly_invitee_uri", inviteeUri)
      .maybeSingle();

    if (!existing) {
      console.warn(`[calendly] cancel for unknown invitee ${inviteeUri}`);
      return NextResponse.json({ ok: true, skipped: "unknown session" });
    }

    if (existing.status === "canceled") {
      // Already canceled — duplicate webhook, no-op
      return NextResponse.json({ ok: true, idempotent: true });
    }

    await supabase
      .from("coaching_sessions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    // Restore the credit (only if it was a 'scheduled' session — completed
    // sessions can't be "canceled" in any meaningful sense, and the credit
    // is already spent).
    if (existing.status === "scheduled") {
      await supabase.rpc("add_coaching_credits", { uid: profile.id, delta: 1 });
    }

    console.log(`[calendly] canceled session ${existing.id} for user ${profile.id}`);
    return NextResponse.json({ ok: true });
  }

  // Other events — log and ignore
  console.log(`[calendly] unhandled event ${body.event}`);
  return NextResponse.json({ ok: true, ignored: body.event });
}

function parseSignatureHeader(
  header: string,
): { t: string; v1: string } | null {
  // "t=1234567890,v1=abcdef..."
  const parts = header.split(",").map((s) => s.trim());
  let t: string | undefined;
  let v1: string | undefined;
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") t = v;
    if (k === "v1") v1 = v;
  }
  if (!t || !v1) return null;
  return { t, v1 };
}
