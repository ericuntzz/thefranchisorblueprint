import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Optional tag for Resend dashboard analytics (e.g. "welcome", "upgrade-nudge"). */
  tag?: string;
};

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend.
 *
 * Defensive: if RESEND_API_KEY isn't set, logs and returns a clean "not
 * configured" failure instead of throwing — so the caller (typically the
 * cron drip processor) can mark the row as failed and move on.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const client = getResend();
  if (!client) {
    console.warn(`[email] skipping send to ${args.to} — RESEND_API_KEY not set`);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const replyTo =
    args.replyTo ?? process.env.RESEND_REPLY_TO ?? undefined;

  try {
    const result = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(replyTo ? { replyTo } : {}),
      ...(args.tag ? { tags: [{ name: "template", value: args.tag }] } : {}),
    });

    if (result.error) {
      console.error(`[email] send to ${args.to} failed: ${result.error.message}`);
      return { ok: false, error: result.error.message };
    }
    if (!result.data?.id) {
      return { ok: false, error: "no id returned" };
    }
    console.log(
      `[email] sent ${args.tag ?? "(untagged)"} to ${args.to} id=${result.data.id}`,
    );
    return { ok: true, id: result.data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] send to ${args.to} threw: ${msg}`);
    return { ok: false, error: msg };
  }
}
