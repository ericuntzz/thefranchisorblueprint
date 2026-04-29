import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ScheduledEmail } from "@/lib/supabase/types";

/**
 * Enqueue an email to be sent later by the cron drip processor.
 *
 * The dedupe_key prevents accidental double-enqueuing for the same logical
 * event. Re-running a triggering function with the same dedupe_key is a
 * silent no-op (the unique constraint kicks in and we ignore the error).
 */
export async function enqueueEmail(args: {
  userId?: string | null;
  recipientEmail: string;
  template: string;
  payload?: Record<string, unknown>;
  sendAfter?: Date;
  dedupeKey?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const sendAfter = (args.sendAfter ?? new Date()).toISOString();

  const { error } = await supabase.from("scheduled_emails").insert({
    user_id: args.userId ?? null,
    recipient_email: args.recipientEmail,
    template: args.template,
    payload: (args.payload ?? {}) as never, // jsonb
    send_after: sendAfter,
    dedupe_key: args.dedupeKey ?? null,
  });

  if (error) {
    // Duplicate dedupe_key (23505) is expected on retries — not an error.
    if (error.code === "23505") {
      console.log(
        `[email-queue] dedupe hit for ${args.template} -> ${args.recipientEmail} (key=${args.dedupeKey})`,
      );
      return;
    }
    console.error(
      `[email-queue] enqueue ${args.template} -> ${args.recipientEmail} failed: ${error.message}`,
    );
  } else {
    console.log(
      `[email-queue] enqueued ${args.template} -> ${args.recipientEmail} for ${sendAfter} (key=${args.dedupeKey ?? "none"})`,
    );
  }
}

/**
 * Atomically claims a batch of due emails for processing.
 *
 * Uses the public.claim_due_emails Postgres function (FOR UPDATE SKIP LOCKED
 * + atomic UPDATE) so that two concurrent cron triggers (Vercel Cron AND
 * Supabase pg_cron, in our case) never claim the same row. Without this,
 * customers could receive the same drip email twice.
 *
 * A claimed row's claimed_at goes stale after 5 minutes; if a worker died
 * mid-send, the row becomes claimable again on the next tick.
 */
export async function fetchDueEmails(limit = 25): Promise<ScheduledEmail[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_due_emails", {
    batch_size: limit,
  });
  if (error) {
    console.error(`[email-queue] claim_due_emails failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as ScheduledEmail[];
}

export async function markEmailSent(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("scheduled_emails")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markEmailFailed(id: string, reason: string, attempts: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  // Failed permanently after 3 attempts; otherwise just bump attempts and
  // leave it un-failed so the next cron tick retries.
  const update =
    attempts >= 3
      ? {
          failed_at: new Date().toISOString(),
          failure_reason: reason,
          attempts,
        }
      : { attempts, failure_reason: reason };
  await supabase.from("scheduled_emails").update(update).eq("id", id);
}
