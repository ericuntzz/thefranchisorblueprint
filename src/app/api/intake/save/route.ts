import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const INTAKE_COOKIE = "tfb_intake_session";

function normalizeEmail(raw: string): string {
  let s = raw;
  s = s.replace(/[ ​‌‍﻿]/g, " ");
  s = s.replace(/^["'“‘]+|["'”’]+$/g, "");
  s = s.trim();
  const m = /<([^>]+)>/.exec(s);
  if (m) s = m[1];
  s = s.replace(/^mailto:/i, "");
  return s.trim().toLowerCase();
}

/**
 * POST /api/intake/save
 *
 * Body: { email: string, sessionId: string }
 *
 * Auth: HttpOnly intake cookie equality check.
 *
 * Behavior:
 *   1. Validate email + session.
 *   2. Persist email + saved_at on the intake_sessions row.
 *   3. Send a "snapshot saved" email via Resend with a link back to the
 *      hero page that re-renders the snapshot from the cookie.
 *   4. Return success — the hero UI shows a "check your email" state.
 *
 * NOTE: This DOES NOT create a Supabase auth user. The intake row is
 * still anonymous-with-email. The merge into customer_memory happens
 * later, when the lead converts via Stripe checkout (the Stripe webhook
 * will detect a matching intake row by email and import the snapshot).
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; sessionId?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; sessionId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const emailRaw = typeof body.email === "string" ? body.email : "";
  if (!sessionId || sessionId.length !== 36) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const email = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  }

  const cookieToken = req.cookies.get(INTAKE_COOKIE)?.value;
  if (!cookieToken) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: fetchErr } = await supabase
    .from("intake_sessions")
    .select("id, cookie_token, status, business_data, score_data, url")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.cookie_token !== cookieToken) {
    return NextResponse.json({ error: "Session token mismatch" }, { status: 403 });
  }
  if (session.status !== "complete") {
    return NextResponse.json(
      { error: "Snapshot isn't ready yet — wait for the analysis to finish" },
      { status: 425 },
    );
  }

  // ─── Persist email on the row ────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("intake_sessions")
    .update({ email, saved_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (updateErr) {
    return NextResponse.json({ error: "Couldn't save your email" }, { status: 500 });
  }

  // ─── Send the "your snapshot is saved" email ─────────────────────
  // Best-effort — if Resend errors, the save still succeeded; we don't
  // want to fail the response just because the email layer hiccupped.
  const business = (session.business_data as { name?: string | null } | null) ?? null;
  const businessName = business?.name ?? "your business";
  const fullSnapshot = (session.score_data as {
    snapshot?: {
      readiness?: { overall?: number; suggestedTier?: string };
      existingFranchisor?: {
        isFranchising?: boolean;
        signalType?: string;
        locationCount?: number | null;
      };
    };
  } | null)?.snapshot;
  const score = fullSnapshot?.readiness;
  const overall = score?.overall ?? null;
  const suggestedTier = score?.suggestedTier ?? null;
  // Existing-franchisor branch: when detectFranchiseSignals fired, the
  // sales conversation is portfolio-strategy not franchise-readiness.
  // Flag is propagated into the internal-team notification so sales
  // doesn't walk into the call selling a $2,997 Blueprint to a brand
  // that's already 94 locations deep.
  const existingFranchisor = fullSnapshot?.existingFranchisor;
  const isExistingFranchisor = existingFranchisor?.isFranchising === true;

  // Tier labels for the email body. "not-yet" gets special handling
  // below — the email skips the recommended-path line entirely and
  // pivots to a "let's talk" framing instead of awkwardly inserting
  // a parenthetical like "Recommended path: (not quite ready)".
  const tierLabelMap: Record<string, string> = {
    blueprint: "The Blueprint (DIY, $2,997)",
    navigator: "Navigator (6-month coached, $8,500)",
    builder: "Builder (12-month done-with-you, $29,500)",
  };
  const tierLabel =
    suggestedTier && suggestedTier !== "not-yet"
      ? tierLabelMap[suggestedTier] ?? ""
      : "";
  const isNotYetTier = suggestedTier === "not-yet";

  const resumeUrl = `${SITE_URL}/?intake=${session.id}`;

  const subject = `Your Franchise Readiness Snapshot for ${businessName}`;
  const text = [
    `Thanks for trying the Franchise Readiness Snapshot.`,
    ``,
    overall != null
      ? isNotYetTier
        ? `Your preliminary score: ${overall}/100. Honest read: it's not quite the right time to franchise yet. Hit reply and let's talk about what to fix first — sometimes 6 months of operational tightening makes the next conversation a lot more productive.`
        : `Your preliminary score: ${overall}/100${tierLabel ? ` — recommended tier: ${tierLabel}` : ""}.`
      : `We've saved your snapshot.`,
    ``,
    `Open your snapshot anytime: ${resumeUrl}`,
    ``,
    `When you're ready to build out the full Blueprint, we'll pre-fill what we already know about ${businessName} so you start at ~15-20% complete instead of zero.`,
    ``,
    `— Jason and the team`,
    `The Franchisor Blueprint`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1e3a5f; max-width: 560px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #d4af37; font-weight: 700; border-bottom: 2px solid #d4af37; display: inline-block; padding-bottom: 4px; margin-bottom: 24px;">FRANCHISE READINESS SNAPSHOT</p>
      <h1 style="font-size: 24px; line-height: 1.3; margin: 0 0 16px; color: #1e3a5f;">Your snapshot for ${escapeHtml(businessName)} is saved.</h1>
      ${
        overall != null
          ? isNotYetTier
            ? `<p style="font-size: 16px; line-height: 1.6; color: #4F5562; margin: 0 0 24px;">Preliminary score: <strong style="color: #1e3a5f;">${overall}/100</strong>. Honest read: it's not quite the right time to franchise yet. Hit reply and let's talk about what to fix first.</p>`
            : `<p style="font-size: 16px; line-height: 1.6; color: #4F5562; margin: 0 0 8px;">Preliminary score: <strong style="color: #1e3a5f;">${overall}/100</strong>${tierLabel ? `</p><p style="font-size: 16px; line-height: 1.6; color: #4F5562; margin: 0 0 24px;">Recommended path: <strong style="color: #1e3a5f;">${escapeHtml(tierLabel)}</strong>.` : ""}</p>`
          : ""
      }
      <p style="font-size: 16px; line-height: 1.6; color: #4F5562; margin: 0 0 24px;">When you're ready to build out the full Blueprint, we'll pre-fill what we already know about your business so you start at ~15-20% complete instead of zero.</p>
      <p style="margin: 32px 0;">
        <a href="${resumeUrl}" style="background: #d4af37; color: #1e3a5f; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 999px; display: inline-block;">Open your snapshot</a>
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #888B92; margin: 24px 0 0;">Questions? Just reply to this email — Jason or someone on the team will get back to you.</p>
    </div>
  `.trim();

  // Fire and forget — don't block the response on email delivery.
  void sendEmail({
    to: email,
    subject,
    html,
    text,
    tag: "intake-snapshot-saved",
    idempotencyKey: `intake-saved-${sessionId}`,
  }).catch((err) => {
    console.error("[intake/save] resend failed:", err);
  });

  // ─── Internal team notification ──────────────────────────────────
  // Eric (2026-05-10): when a high-tier lead saves their snapshot,
  // route the suggestedTier flag to the team inbox so sales knows
  // how to prep before the strategy call. Doesn't fire when
  // INTERNAL_NOTIFICATION_EMAIL is unset (dev / test environments).
  const internalTo = process.env.INTERNAL_NOTIFICATION_EMAIL;
  if (internalTo) {
    const tierFlagMap: Record<string, string> = {
      "not-yet": "[NOT-YET] coach to fix-first first",
      blueprint: "[BLUEPRINT] DIY-ready — light touch",
      navigator: "[NAVIGATOR] coached engagement fit",
      builder: "[BUILDER] hot lead — done-with-you fit",
    };
    // Existing-franchisor flag overrides the readiness-tier flag when
    // present — different sales conversation entirely (portfolio
    // strategy, not first-time franchising). The locationCount tag is
    // helpful triage signal: a 5-location lead vs. a 100-location
    // lead are very different conversations.
    const locTag = existingFranchisor?.locationCount
      ? ` ${existingFranchisor.locationCount}+ units`
      : "";
    const tierFlag = isExistingFranchisor
      ? `[EXISTING-FRANCHISOR${locTag}] portfolio strategy fit, NOT readiness funnel`
      : suggestedTier
        ? tierFlagMap[suggestedTier] ?? ""
        : "";
    const businessUrl = (session as { url?: string }).url ?? "";

    const internalSubject = `New intake lead: ${businessName} ${tierFlag}`;
    const internalText = [
      `New intake save from the URL-prefill lead magnet.`,
      ``,
      `Business: ${businessName}`,
      `URL submitted: ${businessUrl}`,
      `Email: ${email}`,
      `Preliminary score: ${overall ?? "(unknown)"}/100`,
      `Suggested tier: ${suggestedTier ?? "(unknown)"}  ${tierFlag}`,
      ``,
      `Open the snapshot: ${resumeUrl}`,
      ``,
      `What this means for the call:`,
      isExistingFranchisor
        ? `  Existing franchisor. Skip the readiness funnel — they're past it. ` +
          `Open with a portfolio-strategy framing: what are they trying to scale ` +
          `next, where are unit-economics tightest, what's their candidate-pipeline ` +
          `velocity look like. ${
            existingFranchisor?.locationCount
              ? `Location count detected: ${existingFranchisor.locationCount}+. `
              : ""
          }Not a Blueprint/Navigator/Builder lead.`
        : suggestedTier === "builder"
          ? `  Hot lead. Their business shape suggests Builder fit. Prep accordingly.`
          : suggestedTier === "navigator"
            ? `  Strong fit for Navigator. They likely need the coached path.`
            : suggestedTier === "blueprint"
              ? `  DIY-ready signal. Light-touch sales — they may want to self-serve.`
              : `  Not-yet signal. Discovery call should focus on what to fix first.`,
    ].join("\n");
    const internalHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1e3a5f; max-width: 560px; padding: 16px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">New intake lead: ${escapeHtml(businessName)} ${escapeHtml(tierFlag)}</h2>
        <table style="font-size: 14px; line-height: 1.5; border-collapse: collapse;">
          <tr><td style="color:#888;padding-right:12px;">URL submitted</td><td><a href="${escapeHtml(businessUrl)}">${escapeHtml(businessUrl)}</a></td></tr>
          <tr><td style="color:#888;padding-right:12px;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="color:#888;padding-right:12px;">Preliminary score</td><td><strong>${overall ?? "(unknown)"}/100</strong></td></tr>
          <tr><td style="color:#888;padding-right:12px;">Suggested tier</td><td><strong>${escapeHtml(suggestedTier ?? "(unknown)")}</strong>  ${escapeHtml(tierFlag)}</td></tr>
        </table>
        <p style="margin: 16px 0;"><a href="${resumeUrl}" style="background: #d4af37; color: #1e3a5f; font-weight: 700; text-decoration: none; padding: 8px 16px; border-radius: 6px;">Open the snapshot</a></p>
      </div>
    `.trim();
    void sendEmail({
      to: internalTo,
      subject: internalSubject,
      html: internalHtml,
      text: internalText,
      tag: "intake-internal-lead-notification",
      idempotencyKey: `intake-internal-${sessionId}`,
    }).catch((err) => {
      console.error("[intake/save] internal notification failed:", err);
    });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
