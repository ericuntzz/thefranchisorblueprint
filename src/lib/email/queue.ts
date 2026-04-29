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
 * Pulls due emails (send_after <= now, not sent, not failed) for the cron
 * processor. Limits to a batch size to keep cron invocations fast.
 */
export async function fetchDueEmails(limit = 25): Promise<ScheduledEmail[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("scheduled_emails")
    .select("*")
    .is("sent_at", null)
    .is("failed_at", null)
    .lte("send_after", new Date().toISOString())
    .order("send_after", { ascending: true })
    .limit(limit);
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
