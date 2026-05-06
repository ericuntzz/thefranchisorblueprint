/**
 * Inbox review digest email — summary of all classified threads
 * from a single inbox review run. Sent after each review cycle
 * so Eric has a paper trail without checking Gmail.
 */

import { Heading, Hr, Section, Text } from "@react-email/components";
import {
  EmailLayout,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  subheadingStyle,
  callOutStyle,
} from "./_layout";

export type InboxThreadSummary = {
  subject: string;
  from: string;
  category: "urgent" | "action" | "fyi" | "spam";
  reason: string;
  summary: string;
  draftReply: string | null;
};

export type InboxReviewDigestPayload = {
  reviewedAt: string;
  totalThreads: number;
  urgent: InboxThreadSummary[];
  action: InboxThreadSummary[];
  fyi: InboxThreadSummary[];
  spam: InboxThreadSummary[];
};

export function inboxReviewDigestSubject(p: InboxReviewDigestPayload): string {
  const urgentTag = p.urgent.length > 0 ? `🚨 ${p.urgent.length} urgent · ` : "";
  return `${urgentTag}Inbox Review — ${p.totalThreads} threads · ${p.reviewedAt}`;
}

const categoryEmoji: Record<string, string> = {
  urgent: "🚨",
  action: "📋",
  fyi: "ℹ️",
  spam: "🗑️",
};

const categoryLabel: Record<string, string> = {
  urgent: "Urgent",
  action: "Action Needed",
  fyi: "FYI",
  spam: "Spam / Archive",
};

const threadItemStyle: React.CSSProperties = {
  margin: "0 0 16px",
  padding: "12px 16px",
  backgroundColor: "#F7F7F5",
  borderRadius: "8px",
};

function ThreadSection({
  threads,
  category,
}: {
  threads: InboxThreadSummary[];
  category: string;
}) {
  if (threads.length === 0) return null;

  return (
    <Section>
      <Text style={{ ...subheadingStyle, margin: "24px 0 8px" }}>
        {categoryEmoji[category]} {categoryLabel[category]} ({threads.length})
      </Text>
      {threads.map((t, i) => (
        <Section key={i} style={threadItemStyle}>
          <Text style={{ ...paragraphStyle, margin: "0 0 2px", fontWeight: 700, fontSize: "14px" }}>
            {t.subject}
          </Text>
          <Text style={{ ...paragraphStyle, margin: "0 0 4px", color: "#888B92", fontSize: "12px" }}>
            From: {t.from} · {t.reason}
          </Text>
          <Text style={{ ...paragraphStyle, margin: "0", fontSize: "13px" }}>
            {t.summary}
          </Text>
          {t.draftReply ? (
            <>
              <Hr style={{ border: "none", borderTop: "1px dashed rgba(30, 58, 95, 0.12)", margin: "8px 0" }} />
              <Text style={{ ...paragraphStyle, margin: "0 0 2px", fontSize: "11px", color: "#888B92", fontWeight: 600 }}>
                SUGGESTED REPLY:
              </Text>
              <Text style={{ ...paragraphStyle, margin: "0", fontSize: "13px", fontStyle: "italic", color: "#4F5562" }}>
                {t.draftReply}
              </Text>
            </>
          ) : null}
        </Section>
      ))}
    </Section>
  );
}

export function InboxReviewDigestEmail(p: InboxReviewDigestPayload) {
  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>INBOX REVIEW</Text>
      <Heading as="h1" style={headingStyle}>
        {p.totalThreads} Threads Reviewed
      </Heading>

      <Section style={callOutStyle}>
        <Text style={{ ...paragraphStyle, margin: "0 0 4px" }}>
          <strong>{p.urgent.length}</strong> urgent · <strong>{p.action.length}</strong> action needed · <strong>{p.fyi.length}</strong> FYI · <strong>{p.spam.length}</strong> spam
        </Text>
        <Text style={{ ...paragraphStyle, margin: "0", color: "#888B92", fontSize: "12px" }}>
          Reviewed at {p.reviewedAt}
        </Text>
      </Section>

      <ThreadSection threads={p.urgent} category="urgent" />
      <ThreadSection threads={p.action} category="action" />
      <ThreadSection threads={p.fyi} category="fyi" />
      <ThreadSection threads={p.spam} category="spam" />
    </EmailLayout>
  );
}

export function inboxReviewDigestText(p: InboxReviewDigestPayload): string {
  const lines: string[] = [
    `INBOX REVIEW — ${p.totalThreads} Threads`,
    `${p.urgent.length} urgent · ${p.action.length} action · ${p.fyi.length} FYI · ${p.spam.length} spam`,
    `Reviewed at ${p.reviewedAt}`,
    "",
  ];

  for (const category of ["urgent", "action", "fyi", "spam"] as const) {
    const threads = p[category];
    if (threads.length === 0) continue;
    lines.push(`--- ${categoryLabel[category]} (${threads.length}) ---`);
    for (const t of threads) {
      lines.push(`• ${t.subject} (from: ${t.from})`);
      lines.push(`  ${t.reason}`);
      lines.push(`  ${t.summary}`);
      if (t.draftReply) {
        lines.push(`  Draft reply: ${t.draftReply}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
