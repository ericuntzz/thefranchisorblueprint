/**
 * Gmail thread classifier — uses Claude to triage inbox threads.
 *
 * Categories:
 *   urgent       — needs Eric's attention within the hour (customer issue,
 *                  payment problem, legal, partnership request from a known name)
 *   action       — needs a reply within 24h (customer question, vendor follow-up,
 *                  scheduling). Claude drafts a reply suggestion.
 *   fyi          — informational, no reply needed (newsletters, notifications,
 *                  receipts, automated reports)
 *   spam         — unsolicited outreach, marketing, phishing
 *
 * The classifier runs on Sonnet for speed+cost — classification doesn't
 * need Opus-level reasoning.
 */

import "server-only";
import { getAnthropic, CHAT_MODEL } from "@/lib/agent/anthropic";
import type { GmailThread } from "./fetch";

export type InboxCategory = "urgent" | "action" | "fyi" | "spam";

export type ClassifiedThread = {
  threadId: string;
  subject: string;
  from: string;
  category: InboxCategory;
  /** One-line reason for the classification. */
  reason: string;
  /** Draft reply suggestion (only for "action" category). */
  draftReply: string | null;
  /** Summary of the thread for the audit log. */
  summary: string;
};

const SYSTEM_PROMPT = `You are an inbox triage assistant for The Franchisor Blueprint, a franchise consulting business run by Jason (the franchise expert) and Eric (operations). You're reviewing the team@ inbox.

Your job: classify each email thread and, for "action" items, draft a professional reply suggestion.

## Classification rules

**urgent** — Needs Eric's attention within the hour:
- Customer reporting a bug, payment failure, or access issue
- Legal correspondence (cease and desist, trademark, compliance)
- Partnership or press inquiry from a recognizable company/person
- Stripe/payment system alerts indicating real money issues
- Time-sensitive vendor deadlines

**action** — Needs a reply within 24 hours:
- Customer asking a question about the product, pricing, or their account
- Vendor follow-ups or proposals requiring a decision
- Scheduling requests (calls, meetings)
- Business inquiries that aren't urgent
- Resend/Vercel/Supabase support responses

**fyi** — No reply needed, informational:
- Automated reports and notifications (GA4, Vercel, Supabase, Stripe)
- Newsletter subscriptions and industry updates
- Receipt confirmations and invoices
- GitHub notifications
- Marketing analytics summaries
- Internal system emails (cron confirmations, deploy notifications)

**spam** — Should be archived/ignored:
- Unsolicited cold outreach and sales pitches
- SEO/marketing service offers
- Phishing attempts
- Mass newsletters you didn't subscribe to
- Link-building requests

## Reply drafting rules (action items only)

- Write in a professional, warm tone matching The Franchisor Blueprint brand
- Keep replies concise (3-5 sentences max)
- If the email is about pricing, reference the three tiers: Blueprint ($2,997), Navigator ($8,500), Builder ($29,500)
- For technical issues, suggest the customer reach out via the portal chat with Jason AI
- Never commit to specific timelines without Eric's approval — use "I'll look into this and get back to you shortly"
- Sign off as "The Franchisor Blueprint Team"

## Output format

Return a JSON array. Each item:
{
  "threadId": "...",
  "category": "urgent" | "action" | "fyi" | "spam",
  "reason": "one-line explanation",
  "draftReply": "suggested reply text or null",
  "summary": "2-3 sentence summary of the thread"
}`;

/**
 * Classify a batch of Gmail threads using Claude.
 */
export async function classifyThreads(
  threads: GmailThread[],
): Promise<ClassifiedThread[]> {
  if (threads.length === 0) return [];

  const anthropic = getAnthropic();

  // Format threads for the prompt
  const threadDescriptions = threads
    .map((t, i) => {
      const latestMsg = t.messages[t.messages.length - 1];
      const allMessages = t.messages
        .map(
          (m) =>
            `  From: ${m.from}\n  Date: ${m.date}\n  Body:\n  ${m.body.slice(0, 2000)}`,
        )
        .join("\n  ---\n");

      return `### Thread ${i + 1}
Thread ID: ${t.threadId}
Subject: ${t.subject}
From (latest): ${latestMsg?.from ?? "unknown"}
Messages (${t.messages.length}):
${allMessages}`;
    })
    .join("\n\n");

  const userPrompt = `Classify these ${threads.length} email threads. Return ONLY a JSON array, no markdown fences.\n\n${threadDescriptions}`;

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text from response
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? (block as { text: string }).text : ""))
    .join("");

  // Parse JSON — handle possible markdown fences
  const jsonStr = text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr) as Array<{
      threadId: string;
      category: InboxCategory;
      reason: string;
      draftReply: string | null;
      summary: string;
    }>;

    return parsed.map((item) => {
      const thread = threads.find((t) => t.threadId === item.threadId);
      return {
        threadId: item.threadId,
        subject: thread?.subject ?? "",
        from: thread?.messages[thread.messages.length - 1]?.from ?? "",
        category: item.category,
        reason: item.reason,
        draftReply: item.category === "action" ? (item.draftReply ?? null) : null,
        summary: item.summary,
      };
    });
  } catch (err) {
    console.error("[inbox-classify] failed to parse Claude response:", text.slice(0, 500));
    throw new Error(
      `Classification parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
