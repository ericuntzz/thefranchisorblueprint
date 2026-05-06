/**
 * Gmail thread fetcher — pulls unread threads from the inbox.
 *
 * Fetches threads matching a query (default: unread, inbox, last 24h),
 * hydrates message bodies, and returns structured data ready for
 * classification.
 */

import "server-only";
import type { gmail_v1 } from "googleapis";

export type GmailMessage = {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  /** Plain text body, truncated to ~4000 chars for LLM classification. */
  snippet: string;
  body: string;
  labels: string[];
};

export type GmailThread = {
  threadId: string;
  subject: string;
  messages: GmailMessage[];
  /** Most recent message timestamp. */
  lastMessageAt: string;
};

/**
 * Pull headers from a Gmail message payload.
 */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Extract plain-text body from a Gmail message. Handles both
 * simple messages and multipart (prefers text/plain, falls back
 * to text/html with tags stripped).
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  // Simple body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart — find text/plain first, then text/html
  const parts = payload.parts ?? [];
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
  }

  const htmlPart = parts.find((p) => p.mimeType === "text/html");
  if (htmlPart?.body?.data) {
    const html = Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
    // Strip HTML tags for classification purposes
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
  for (const part of parts) {
    if (part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

/**
 * Fetch unread inbox threads from Gmail.
 *
 * @param gmail - Authenticated Gmail client
 * @param maxThreads - Maximum threads to fetch (default 20)
 * @param sinceHours - Only look at messages from the last N hours (default 24)
 */
export async function fetchUnreadThreads(
  gmail: gmail_v1.Gmail,
  maxThreads = 20,
  sinceHours = 24,
): Promise<GmailThread[]> {
  const afterEpoch = Math.floor((Date.now() - sinceHours * 3600 * 1000) / 1000);
  const query = `is:unread in:inbox after:${afterEpoch}`;

  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: query,
    maxResults: maxThreads,
  });

  const threadIds = listRes.data.threads ?? [];
  if (threadIds.length === 0) return [];

  // Fetch full threads in parallel (max 20 at a time)
  const threads: GmailThread[] = [];

  for (const threadRef of threadIds) {
    if (!threadRef.id) continue;

    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadRef.id,
      format: "full",
    });

    const messages: GmailMessage[] = [];
    let threadSubject = "";
    let lastMessageAt = "";

    for (const msg of threadRes.data.messages ?? []) {
      const headers = msg.payload?.headers;
      const subject = getHeader(headers, "Subject");
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const date = getHeader(headers, "Date");

      if (!threadSubject) threadSubject = subject;
      if (date > lastMessageAt) lastMessageAt = date;

      const fullBody = extractBody(msg.payload);
      // Truncate body to ~4000 chars for LLM classification
      const body = fullBody.length > 4000 ? fullBody.slice(0, 4000) + "\n[...truncated]" : fullBody;

      messages.push({
        messageId: msg.id ?? "",
        threadId: threadRef.id,
        from,
        to,
        subject,
        date,
        snippet: msg.snippet ?? "",
        body,
        labels: msg.labelIds ?? [],
      });
    }

    threads.push({
      threadId: threadRef.id,
      subject: threadSubject,
      messages,
      lastMessageAt,
    });
  }

  return threads;
}

/**
 * Mark a thread as read in Gmail.
 */
export async function markThreadRead(
  gmail: gmail_v1.Gmail,
  threadId: string,
): Promise<void> {
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

/**
 * Apply a label to a thread. Creates the label if it doesn't exist.
 */
export async function applyLabel(
  gmail: gmail_v1.Gmail,
  threadId: string,
  labelName: string,
): Promise<void> {
  // Find or create the label
  const labelsRes = await gmail.users.labels.list({ userId: "me" });
  let label = labelsRes.data.labels?.find(
    (l) => l.name?.toLowerCase() === labelName.toLowerCase(),
  );

  if (!label) {
    const createRes = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    label = createRes.data;
  }

  if (label?.id) {
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: [label.id],
      },
    });
  }
}

/**
 * Archive a thread (remove INBOX label).
 */
export async function archiveThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
): Promise<void> {
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });
}
