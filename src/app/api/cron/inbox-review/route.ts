import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getGmailAccounts } from "@/lib/gmail/client";
import { fetchUnreadThreads, markThreadRead, applyLabel } from "@/lib/gmail/fetch";
import { classifyThreads, type ClassifiedThread } from "@/lib/gmail/classify";
import { sendTemplate } from "@/lib/email/dispatch";
import type { InboxReview } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 120; // Classification can take a moment

/**
 * Inbox review agent cron.
 *
 * Daily at noon UTC (6am MDT). Reads unread threads from BOTH the
 * team@ and eric@ Gmail inboxes, classifies them with Claude
 * (Sonnet for speed), and:
 *
 *   urgent  → immediate alert email to Eric + label "TFB/Urgent"
 *   action  → label "TFB/Action" + draft reply stored in DB
 *   fyi     → label "TFB/FYI" + mark read
 *   spam    → label "TFB/Spam" + mark read
 *
 * Writes all classifications to `inbox_reviews` for audit trail.
 * Sends a digest summary to eric@ if any NEW threads were found.
 * Silent (no email) when inbox is empty or everything was already
 * reviewed.
 *
 * Multi-account support via GMAIL_ACCOUNTS env var:
 *   GMAIL_ACCOUNTS=team,eric
 *   GMAIL_REFRESH_TOKEN_TEAM=...
 *   GMAIL_REFRESH_TOKEN_ERIC=...
 *
 * All notifications go to eric@thefranchisorblueprint.com.
 *
 * Skips gracefully if Gmail creds aren't configured.
 */

/** Where all inbox notifications are routed. */
const ERIC_EMAIL =
  process.env.INBOX_ALERT_EMAIL ?? "eric@thefranchisorblueprint.com";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Gmail accounts ---
  const accounts = getGmailAccounts();
  if (accounts.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Gmail not configured (missing credentials)",
    });
  }

  const admin = getSupabaseAdmin();
  const DEDUP_HOURS = 24; // daily run — dedup window matches

  try {
    // 1) Fetch unread threads from ALL configured accounts.
    type TaggedThread = Awaited<ReturnType<typeof fetchUnreadThreads>>[number] & {
      account: string;
    };

    const allThreads: TaggedThread[] = [];

    for (const acct of accounts) {
      try {
        const threads = await fetchUnreadThreads(acct.client, 20, 24);
        for (const t of threads) {
          allThreads.push({ ...t, account: acct.label });
        }
        console.log(
          `[inbox-review] ${acct.label}@: ${threads.length} unread threads`,
        );
      } catch (err) {
        console.error(
          `[inbox-review] error fetching ${acct.label}@:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (allThreads.length === 0) {
      return NextResponse.json({
        ok: true,
        accounts: accounts.map((a) => a.label),
        threads: 0,
        message: "all inboxes empty",
      });
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

    const newThreads = allThreads.filter(
      (t) => !recentThreadIds.has(t.threadId),
    );

    if (newThreads.length === 0) {
      // Nothing new — stay silent, no digest email.
      return NextResponse.json({
        ok: true,
        accounts: accounts.map((a) => a.label),
        threads: allThreads.length,
        newThreads: 0,
        message: "all threads already reviewed — no digest sent",
      });
    }

    // 3) Classify with Claude.
    const classified = await classifyThreads(newThreads);

    // 4) Process each classified thread.
    const results: Array<{
      threadId: string;
      account: string;
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

    // Build account→client lookup for labeling
    const clientMap = new Map(accounts.map((a) => [a.label, a.client]));

    for (const item of classified) {
      let labeled = false;
      let alerted = false;

      // Find which account this thread came from
      const taggedThread = newThreads.find(
        (t) => t.threadId === item.threadId,
      );
      const acctLabel = taggedThread?.account ?? "team";
      const gmail = clientMap.get(acctLabel) ?? clientMap.values().next().value;

      try {
        if (gmail) {
          // Apply Gmail label.
          const labelName = LABEL_MAP[item.category] ?? "TFB/Reviewed";
          await applyLabel(gmail, item.threadId, labelName);
          labeled = true;

          // Mark FYI and spam as read.
          if (item.category === "fyi" || item.category === "spam") {
            await markThreadRead(gmail, item.threadId);
          }
        }

        // Send urgent alert immediately to Eric.
        if (item.category === "urgent") {
          const now = new Date().toLocaleString("en-US", {
            timeZone: "America/Denver",
            dateStyle: "short",
            timeStyle: "short",
          });
          const alertResult = await sendTemplate(
            "inbox-urgent-alert",
            ERIC_EMAIL,
            {
              threadSubject: `[${acctLabel}@] ${item.subject}`,
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
          subject: `[${acctLabel}@] ${item.subject}`,
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
        account: acctLabel,
        category: item.category,
        labeled,
        alerted,
      });
    }

    // 5) Send digest summary to Eric (only if we classified new threads).
    const now = new Date().toLocaleString("en-US", {
      timeZone: "America/Denver",
      dateStyle: "short",
      timeStyle: "short",
    });
    const byCategory = groupByCategory(classified, newThreads);

    await sendTemplate(
      "inbox-review-digest",
      ERIC_EMAIL,
      {
        reviewedAt: now,
        totalThreads: classified.length,
        urgent: byCategory.urgent,
        action: byCategory.action,
        fyi: byCategory.fyi,
        spam: byCategory.spam,
      },
      {
        idempotencyKey: `inbox-digest:${new Date().toISOString().slice(0, 10)}`,
      },
    );

    return NextResponse.json({
      ok: true,
      accounts: accounts.map((a) => a.label),
      threads: allThreads.length,
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
function groupByCategory(
  classified: ClassifiedThread[],
  taggedThreads: Array<{ threadId: string; account: string }>,
) {
  type ThreadSummary = {
    subject: string;
    from: string;
    category: "urgent" | "action" | "fyi" | "spam";
    reason: string;
    summary: string;
    draftReply: string | null;
  };

  const groups: Record<"urgent" | "action" | "fyi" | "spam", ThreadSummary[]> =
    {
      urgent: [],
      action: [],
      fyi: [],
      spam: [],
    };

  for (const item of classified) {
    const acctLabel =
      taggedThreads.find((t) => t.threadId === item.threadId)?.account ?? "team";
    groups[item.category].push({
      subject: `[${acctLabel}@] ${item.subject}`,
      from: item.from,
      category: item.category,
      reason: item.reason,
      summary: item.summary,
      draftReply: item.draftReply,
    });
  }

  return groups;
}
