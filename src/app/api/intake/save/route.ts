import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
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
 * Tranche 12 (2026-05-10): this endpoint now ALSO creates a free-tier
 * Supabase auth user and signs them in via server-side magic-link
 * redemption — no click required. Friction-free signup per Eric's
 * 2026-05-10 ask. Sequence:
 *
 *   1. Validate email + session (existing).
 *   2. Persist email + saved_at + user_id link on the intake row.
 *   3. Create OR fetch the Supabase auth user (admin API,
 *      email_confirm=true so they skip the "verify your email" wall).
 *   4. Insert a free-tier profile row if none exists.
 *   5. Server-side, redeem a single-use magic-link OTP to populate
 *      the auth cookies on the response. Browser now arrives at
 *      /portal authenticated as the new free-tier user.
 *   6. Send the "your snapshot is saved" email (best-effort, async).
 *   7. Return { ok: true, redirectTo: "/portal" } — client navigates.
 *
 * For returning visitors (email already exists in auth.users), the
 * same OTP-redemption path logs them in. No password lookup needed
 * because everything is OTP-based.
 *
 * The merge into customer_memory happens later, when the lead converts
 * via Stripe checkout (the Stripe webhook detects the matching intake
 * row by email/user_id and imports the snapshot into the paid portal).
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

  // ─── Resolve or create the auth user ─────────────────────────────
  // Tranche 12: friction-free signup. We use the admin API to create
  // (or fetch) a Supabase auth user keyed by email, with
  // email_confirm=true so they don't need to click a link before
  // accessing the portal. Returning users (email already in
  // auth.users) get matched without duplicating rows.
  let authUserId: string | null = null;
  {
    // Look up by email first via the admin list-users API. Supabase
    // doesn't have a direct "getUserByEmail" but listUsers with a
    // filter works fine for the single-email case.
    const { data: listData } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // listUsers doesn't accept a filter on email — we have to scan.
    // For most accounts this is one round-trip; the listUsers result
    // is paginated but we filter client-side. If it's empty, create
    // the user; otherwise reuse.
    const existing = listData?.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (existing) {
      authUserId = existing.id;
    } else {
      // Fall through to the createUser path. We pass email_confirm
      // so they don't get gated by Supabase's "verify your email"
      // wall — the magic-link redemption below stands in for
      // verification.
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            signup_source: "intake_snapshot",
            tier: "free",
          },
        });
      if (createErr) {
        // The most common reason this fails is "User already
        // registered" — Supabase's email index is case-insensitive
        // and pre-existing accounts created via a different flow
        // can collide. Handle by doing a more thorough lookup.
        if (createErr.message?.toLowerCase().includes("already")) {
          // Fall back to a fuller paginated scan. listUsers maxes
          // at 1000 per page; we shouldn't ever need more than 1
          // page in practice.
          const { data: bigList } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          const match = bigList?.users.find(
            (u) => u.email?.toLowerCase() === email,
          );
          if (match) {
            authUserId = match.id;
          } else {
            console.error("[intake/save] createUser failed and no match:", createErr);
            return NextResponse.json(
              { error: "Couldn't create your account" },
              { status: 500 },
            );
          }
        } else {
          console.error("[intake/save] createUser failed:", createErr);
          return NextResponse.json(
            { error: "Couldn't create your account" },
            { status: 500 },
          );
        }
      } else if (created?.user) {
        authUserId = created.user.id;
      }
    }
  }

  if (!authUserId) {
    return NextResponse.json(
      { error: "Couldn't resolve your account — try again" },
      { status: 500 },
    );
  }

  // ─── Ensure a profile row exists ─────────────────────────────────
  // The portal page expects a row in `profiles` keyed by auth user id.
  // Most paid flows create this via the Stripe webhook; for the free-
  // tier path we create it directly. Idempotent — UPSERT with
  // user_id as the conflict key.
  {
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: authUserId,
          email,
          // No Stripe customer until they upgrade to paid. Webhook
          // backfills this on first checkout.
          stripe_customer_id: null,
          // full_name stays null for free signup — populated later
          // from Stripe checkout metadata.
          full_name: null,
        },
        { onConflict: "id", ignoreDuplicates: false },
      );
    if (profileErr) {
      // Profile creation is non-critical for the snapshot save path —
      // the portal can render without a profile row (firstName just
      // stays null). Log and continue.
      console.error("[intake/save] profile upsert failed:", profileErr);
    }
  }

  // ─── Persist email + user_id on the intake row ───────────────────
  const { error: updateErr } = await supabase
    .from("intake_sessions")
    .update({
      email,
      saved_at: new Date().toISOString(),
      user_id: authUserId,
    })
    .eq("id", sessionId);
  if (updateErr) {
    return NextResponse.json({ error: "Couldn't save your email" }, { status: 500 });
  }

  // ─── Server-side magic-link redemption (sets auth cookies) ───────
  // Generate a single-use magic-link via the admin API, then redeem
  // it through the SSR-aware client so the auth cookies get written
  // to the response. From the browser's perspective: the POST returns
  // with the visitor already logged in, and a redirect to /portal
  // lands them in the authenticated view.
  let signInSucceeded = false;
  try {
    const { data: linkData, error: linkErr } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (!linkErr && linkData?.properties?.hashed_token) {
      const ssrSupabase = await getSupabaseServer();
      const { error: verifyErr } = await ssrSupabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      });
      if (!verifyErr) {
        signInSucceeded = true;
      } else {
        console.error("[intake/save] verifyOtp failed:", verifyErr);
      }
    } else if (linkErr) {
      console.error("[intake/save] generateLink failed:", linkErr);
    }
  } catch (err) {
    console.error("[intake/save] auth sign-in step failed:", err);
  }

  // If auto-sign-in failed for any reason (Supabase outage, etc),
  // we still want the save to succeed. The "snapshot saved" email
  // contains a link back to the snapshot URL and the visitor can
  // log in via the normal /portal/login flow if needed.

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

  // Tranche 12: tell the client to navigate to /portal when sign-in
  // succeeded. If it didn't, fall back to the previous behavior (the
  // hero shows its "check your inbox" state without redirecting).
  return NextResponse.json({
    ok: true,
    redirectTo: signInSucceeded ? "/portal" : null,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
