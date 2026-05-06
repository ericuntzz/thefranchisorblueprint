import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getGmailClient } from "@/lib/gmail/client";
import { fetchUnreadThreads, markThreadRead, applyLabel } from "@/lib/gmail/fetch";
import { classifyThreads, type ClassifiedThread } from "@/lib/gmail/classify";
import { sendTemplate } from "@/lib/email/dispatch";
import type { InboxReview } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 120; // Classification can take a moment

/**
 * Inbox review agent cron.
 *
 * Every 30 minutes. Reads unread threads from the team@ Gmail
 * inbox, classifies them with Claude (Sonnet for speed), and:
 *
 *   urgent  → immediate alert email to Eric + label "TFB/Urgent"
 *   action  → label "TFB/Action" + draft reply stored in DB
 *   fyi     → label "TFB/FYI" + mark read
 *   spam    → label "TFB/Spam" + mark read
 *
 * Writes all classifications to `inbox_reviews` for audit trail.
 * Sends a digest email if any threads were reviewed.
 *
 * Dedup: threads already reviewed in the last 2 hours are skipped.
 *
 * Skips gracefully if Gmail creds aren't configured (sandbox mode).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Gmail client ---
  const gmail = getGmailClient();
  if (!gmail) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Gmail not configured (missing GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN)",
    });
  }

  const admin = getSupabaseAdmin();
  const DEDUP_HOURS = 2;
  const ALERT_EMAIL =
    process.env.INBOX_ALERT_EMAIL ??
    process.env.INTERNAL_NOTIFICATION_EMAIL ??
    "team@thefranchisorblueprint.com";

  try {
    // 1) Fetch unread threads from the last 24h.
    const threads = await fetchUnreadThreads(gmail, 20, 24);

    if (threads.length === 0) {
      return NextResponse.json({ ok: true, threads: 0, message: "inbox empty" });
    }

    // 2) Dedup — skip threads we already classified recently.
    const dedupCutoff = new Date(
      Date.now() - DEDUP_HOURS * 3600 * 1000,
    ).toISOString();
    const { data: recentReviews } = await admin
      .from("inbox_reviews")
      .select("thread_id")
      .gte("reviewed_at", dedupCutoff);

    const recentThreadIds = new Set(
      ((recentReviews ?? []) as Pick<InboxReview, "thread_id">[]).map(
        (r) => r.thread_id,
      ),
    );

    const newThreads = threads.filter((t) => !recentThreadIds.has(t.threadId));

    if (newThreads.length === 0) {
      return NextResponse.json({
        ok: true,
        threads: threads.length,
        newThreads: 0,
        message: "all threads already reviewed recently",
      });
    }

    // 3) Classify with Claude.
    const classified = await classifyThreads(newThreads);

    // 4) Process each classified thread.
    const results: Array<{
      threadId: string;
      category: string;
      labeled: boolean;
      alerted: boolean;
    }> = [];

    const LABEL_MAP: Record<string, string> = {
      urgent: "TFB/Urgent",
      action: "TFB/Action",
      fyi: "TFB/FYI",
      spam: "TFB/Spam",
    };

    for (const item of classified) {
      let labeled = false;
      let alerted = false;

      try {
        // Apply Gmail label.
        const labelName = LABEL_MAP[item.category] ?? "TFB/Reviewed";
        await applyLabel(gmail, item.threadId, labelName);
        labeled = true;

        // Mark FYI and spam as read.
        if (item.category === "fyi" || item.category === "spam") {
          await markThreadRead(gmail, item.threadId);
        }

        // Send urgent alert immediately.
        if (item.category === "urgent") {
          const now = new Date().toLocaleString("en-US", {
            timeZone: "America/Denver",
            dateStyle: "short",
            timeStyle: "short",
          });
          const alertResult = await sendTemplate(
            "inbox-urgent-alert",
            ALERT_EMAIL,
            {
              threadSubject: item.subject,
              threadFrom: item.from,
              category: item.category,
              reason: item.reason,
              summary: item.summary,
              threadCount: classified.length,
              reviewedAt: now,
            },
            {
              idempotencyKey: `inbox-urgent:${item.threadId}:${new Date().toISOString().slice(0, 13)}`,
            },
          );
          alerted = alertResult.ok;
        }

        // Write audit row.
        await admin.from("inbox_reviews").insert({
          thread_id: item.threadId,
          subject: item.subject,
          sender: item.from,
          category: item.category,
          reason: item.reason,
          summary: item.summary,
          draft_reply: item.draftReply,
        });
      } catch (err) {
        console.error(
          `[inbox-review] error processing thread ${item.threadId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }

      results.push({
        threadId: item.threadId,
        category: item.category,
        labeled,
        alerted,
      });
    }

    // 5) Send digest summary if we classified anything.
    if (classified.length > 0) {
      const now = new Date().toLocaleString("en-US", {
        timeZone: "America/Denver",
        dateStyle: "short",
        timeStyle: "short",
      });
      const byCategory = groupByCategory(classified);

      await sendTemplate(
        "inbox-review-digest",
        ALERT_EMAIL,
        {
          reviewedAt: now,
          totalThreads: classified.length,
          urgent: byCategory.urgent,
          action: byCategory.action,
          fyi: byCategory.fyi,
          spam: byCategory.spam,
        },
        {
          idempotencyKey: `inbox-digest:${new Date().toISOString().slice(0, 13)}`,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      threads: threads.length,
      newThreads: newThreads.length,
      classified: classified.length,
      urgent: classified.filter((c) => c.category === "urgent").length,
      action: classified.filter((c) => c.category === "action").length,
      fyi: classified.filter((c) => c.category === "fyi").length,
      spam: classified.filter((c) => c.category === "spam").length,
      results,
    });
  } catch (err) {
    console.error(
      "[inbox-review] cron error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/** Group classified threads by category for the digest template. */
function groupByCategory(classified: ClassifiedThread[]) {
  type ThreadSummary = {
    subject: string;
    from: string;
    category: "urgent" | "action" | "fyi" | "spam";
    reason: string;
    summary: string;
    draftReply: string | null;
  };

  const groups: Record<"urgent" | "action" | "fyi" | "spam", ThreadSummary[]> = {
    urgent: [],
    action: [],
    fyi: [],
    spam: [],
  };

  for (const item of classified) {
    groups[item.category].push({
      subject: item.subject,
      from: item.from,
      category: item.category,
      reason: item.reason,
      summary: item.summary,
      draftReply: item.draftReply,
    });
  }

  return groups;
}
