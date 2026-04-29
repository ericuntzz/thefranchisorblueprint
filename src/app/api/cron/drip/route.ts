import { NextRequest, NextResponse } from "next/server";
import { fetchDueEmails, markEmailSent, markEmailFailed } from "@/lib/email/queue";
import { sendTemplate, type TemplateName } from "@/lib/email/dispatch";

export const runtime = "nodejs";
// Vercel Cron's max execution is 10s on hobby, 60s on Pro. Either is fine
// for our batch size.
export const maxDuration = 60;

/**
 * Drip processor — pulls due emails from scheduled_emails and sends them
 * via Resend. Vercel Cron pings this on schedule.
 *
 * Security: requires Authorization: Bearer ${CRON_SECRET}. Vercel Cron
 * sends this automatically when CRON_SECRET is set as an env var.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await fetchDueEmails(25);
  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  for (const row of due) {
    try {
      const result = await sendTemplate(
        row.template as TemplateName,
        row.recipient_email,
        row.payload as never,
      );
      if (result.ok) {
        await markEmailSent(row.id);
        results.push({ id: row.id, ok: true });
      } else {
        await markEmailFailed(row.id, result.error, row.attempts + 1);
        results.push({ id: row.id, ok: false, reason: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markEmailFailed(row.id, msg, row.attempts + 1);
      results.push({ id: row.id, ok: false, reason: msg });
    }
  }

  console.log(`[cron/drip] processed ${results.length} emails`);
  return NextResponse.json({
    processed: results.length,
    successes: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok).length,
    results,
  });
}

// POST for manual triggering (same auth)
export async function POST(req: NextRequest) {
  return GET(req);
}
