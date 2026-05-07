/**
 * Lead journey status — single source of truth for "is this lead converted?"
 *
 * Given a list of normalized emails (from assessment_sessions), returns a
 * map of `email → { booked, bookedAt, purchased, purchasedAt }` derived
 * from a fresh join against:
 *   - `profiles`         (email → user_id)
 *   - `coaching_sessions` (matched on invitee_email OR user_id)
 *   - `purchases`         (matched on user_id, status='paid')
 *
 * The function never caches or persists — every call computes status
 * from current rows. That guarantees the daily digest cannot show stale
 * "missed lead" data: if a lead booked at 11:58pm yesterday, the 6am
 * digest already reflects their `booked: true` status.
 *
 * Matching by email only. Assessment, Calendly, and Stripe all
 * lowercase + trim email at ingestion (see normalizeEmail). Future
 * enhancement: phone number as secondary match key once the assessment
 * captures it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeEmail } from "@/lib/utils/normalize-email";

export type LeadJourneyStatus = {
  email: string;
  booked: boolean;
  /** ISO timestamp of the earliest non-canceled booking (scheduled OR completed). */
  bookedAt: string | null;
  /** Status of the most recent booking. Null when no booking found. */
  bookingStatus: "scheduled" | "completed" | "no_show" | null;
  purchased: boolean;
  /** ISO timestamp of the earliest paid purchase. */
  purchasedAt: string | null;
  /** Tier (1/2/3) of the most recent paid purchase. Null when not purchased. */
  purchaseTier: 1 | 2 | 3 | null;
};

/**
 * Returns a map of normalized email → journey status.
 * Emails not present in the input are not in the returned map.
 * Emails present but with no bookings/purchases get `{ booked: false, purchased: false, ... }`.
 */
export async function getLeadJourneyStatuses(
  admin: SupabaseClient<Database>,
  emails: string[],
): Promise<Map<string, LeadJourneyStatus>> {
  // Normalize + dedupe input emails.
  const normalized = Array.from(
    new Set(emails.map(normalizeEmail).filter((e) => e && e.includes("@"))),
  );

  // Initialize every requested email with a "not converted" baseline so
  // the caller can iterate over all of them confidently.
  const out = new Map<string, LeadJourneyStatus>();
  for (const email of normalized) {
    out.set(email, {
      email,
      booked: false,
      bookedAt: null,
      bookingStatus: null,
      purchased: false,
      purchasedAt: null,
      purchaseTier: null,
    });
  }

  if (normalized.length === 0) return out;

  // 1) Look up profiles for these emails to get user_ids. (Profile may
  //    or may not exist — non-customers won't have one.)
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", normalized);

  const userIdToEmail = new Map<string, string>();
  const emailToUserId = new Map<string, string>();
  for (const row of profileRows ?? []) {
    const email = normalizeEmail(row.email);
    userIdToEmail.set(row.id, email);
    emailToUserId.set(email, row.id);
  }

  const allUserIds = Array.from(userIdToEmail.keys());

  // 2) Coaching sessions — match by either invitee_email (post-migration,
  //    works even without a profile) or user_id (pre-migration backfilled
  //    rows). Two parallel queries because Supabase doesn't OR across
  //    different columns cleanly without resorting to .or() string syntax.
  const [byEmail, byUserId] = await Promise.all([
    admin
      .from("coaching_sessions")
      .select("user_id, invitee_email, scheduled_at, status")
      .in("invitee_email", normalized)
      .neq("status", "canceled"),
    allUserIds.length > 0
      ? admin
          .from("coaching_sessions")
          .select("user_id, invitee_email, scheduled_at, status")
          .in("user_id", allUserIds)
          .neq("status", "canceled")
      : Promise.resolve({ data: [] }),
  ]);

  const bookings = [
    ...(byEmail.data ?? []),
    ...(byUserId.data ?? []),
  ];

  for (const b of bookings) {
    // Resolve which email this booking belongs to.
    const email =
      normalizeEmail(b.invitee_email ?? "") ||
      (b.user_id ? userIdToEmail.get(b.user_id) ?? "" : "");
    if (!email) continue;
    const status = out.get(email);
    if (!status) continue;

    const bookingStatus =
      b.status === "canceled" ? null : (b.status as "scheduled" | "completed" | "no_show");

    if (!status.booked) {
      status.booked = true;
      status.bookedAt = b.scheduled_at;
      status.bookingStatus = bookingStatus;
    } else if (status.bookedAt && b.scheduled_at < status.bookedAt) {
      // Keep the earliest scheduled time; prefer 'completed' status if available.
      status.bookedAt = b.scheduled_at;
      if (bookingStatus === "completed") status.bookingStatus = "completed";
    }
  }

  // 3) Purchases — only joinable through user_id, so leads without a
  //    profile by definition can't have purchased anything.
  if (allUserIds.length > 0) {
    const { data: purchases } = await admin
      .from("purchases")
      .select("user_id, tier, status, created_at")
      .in("user_id", allUserIds)
      .eq("status", "paid");

    for (const p of purchases ?? []) {
      const email = userIdToEmail.get(p.user_id);
      if (!email) continue;
      const status = out.get(email);
      if (!status) continue;

      if (!status.purchased) {
        status.purchased = true;
        status.purchasedAt = p.created_at;
        status.purchaseTier = p.tier as 1 | 2 | 3;
      } else if (status.purchasedAt && p.created_at < status.purchasedAt) {
        status.purchasedAt = p.created_at;
        status.purchaseTier = p.tier as 1 | 2 | 3;
      }
    }
  }

  return out;
}
