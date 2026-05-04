"use client";

/**
 * JasonChatDock — bottom-right floating chat surface for the in-portal
 * Jason agent.
 *
 * Design rules (see docs/agentic-portal-buildout.md §UX):
 *  - Calm by default: collapsed to a small avatar bubble.
 *  - Breathes (subtle opacity pulse, 2.6s loop) when idle, with a tiny
 *    nudge that there's an assistant here. Goes static when opened.
 *  - Streams responses token-by-token so it never feels like a hang.
 *  - Avatar is a stylized JS monogram in the gold/navy palette — Jason's
 *    actual headshot is a P1.5 follow-up.
 *  - Page-aware: callers pass `pageContext` (e.g. "/portal" or
 *    "/portal/lab/intake") so the agent knows where the user is.
 *
 * Tool use (1.5b):
 *  - Server emits NDJSON `ChatEvent`s on the response body. Each line
 *    is one JSON object: `text` deltas append to the current assistant
 *    bubble, `tool_call` / `tool_result` pairs render as inline action
 *    cards between bubbles.
 *  - When a tool completes successfully, we call router.refresh() so
 *    the chapter cards on the page underneath pick up the new field
 *    values without the customer having to reload.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { CHAPTER_DOC_PROMPTS } from "@/lib/memory/doc-prompts";
import {
  isValidMemoryFileSlug,
  MEMORY_FILE_TITLES,
  type MemoryFileSlug,
} from "@/lib/memory/files";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

/** Items the transcript can hold — bubbles (user/assistant prose) and
 *  tool cards (the inline "✓ Updated X = Y" rows). The transcript is
 *  the union so the renderer can iterate one ordered list. */
type TranscriptItem =
  | { kind: "bubble"; role: "user" | "assistant"; text: string }
  | {
      kind: "tool";
      id: string;
      status: "running" | "ok" | "error";
      summary: string;
    };

/** Wire format from the server — mirrors `ChatEvent` in lib/agent/chat.ts. */
type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      ok: boolean;
      summary: string;
      detail?: {
        slug: string;
        chapterTitle: string;
        fieldName: string;
        fieldLabel: string;
        value: unknown;
      };
    }
  | { type: "done" }
  | { type: "error"; message: string };

type Props = {
  /** A short string describing what the user is currently looking at. */
  pageContext?: string;
  /** Customer's first name, for the friendly opener. */
  firstName?: string | null;
};

const OPENER_DEFAULT =
  "I'm Jason. I've got everything we know about your business loaded — ask me anything about the next step in your Blueprint, or just tell me what you're working on.";

/**
 * Starter chips — clickable suggestions surfaced under the greeting
 * when the chat first opens. Each chip is a short user-message that
 * the customer can send with one click. The set is derived from
 * pageContext so the suggestions land where the customer is right
 * now (chapter page → "got an X doc?", queue → "what would speed
 * this up?", dashboard → "where do I start?").
 *
 * Keep the count tight (3 max). More than that and the chip strip
 * starts feeling like a menu, not a nudge.
 */
type StarterChip = {
  /** What's shown on the chip face. Keep short. */
  label: string;
  /** What gets sent as the user message when the chip is clicked.
   *  The model has full Memory context, so the chip text just has
   *  to express intent — Jason fills in the rest. */
  send: string;
  /** Optional leading icon. Default is no icon (just text). */
  icon?: "upload" | "sparkle";
};

function getStarterChips(pageContext: string | undefined): StarterChip[] {
  const ctx = (pageContext ?? "").toLowerCase();
  // Per-chapter context: extract the slug from /portal/chapter/[slug].
  const chapterMatch = ctx.match(/\/portal\/chapter\/([a-z_]+)/);
  if (chapterMatch && isValidMemoryFileSlug(chapterMatch[1])) {
    const slug = chapterMatch[1] as MemoryFileSlug;
    const prompt = CHAPTER_DOC_PROMPTS[slug];
    const title = MEMORY_FILE_TITLES[slug];
    if (prompt) {
      return [
        {
          label: `Got a ${prompt.shortLabel}?`,
          send: `I have a ${prompt.shortLabel} I can share — what's the best way to upload it for the ${title} chapter?`,
          icon: "upload",
        },
        {
          label: `Help me draft ${title}`,
          send: `Walk me through what I need to finish the ${title} chapter.`,
          icon: "sparkle",
        },
        {
          label: "What docs would help?",
          send: `What documents would speed up the ${title} chapter?`,
        },
      ];
    }
  }

  // Question Queue context.
  if (ctx.includes("/portal/lab/next")) {
    return [
      {
        label: "What docs speed this up?",
        send: "What documents could I upload to skip a chunk of these questions?",
        icon: "upload",
      },
      {
        label: "I have a P&L — where?",
        send: "I have a P&L statement — what's the best way to upload it?",
        icon: "upload",
      },
      {
        label: "What's most important?",
        send: "Of the questions in front of me, which ones most affect the FDD quality?",
      },
    ];
  }

  // Day-1 intake context.
  if (ctx.includes("/portal/lab/intake")) {
    return [
      {
        label: "What docs should I gather?",
        send: "What documents should I dig up before I keep going?",
        icon: "upload",
      },
      {
        label: "Skip — what's next?",
        send: "If I skip the doc uploads, what should I expect from the next steps?",
      },
    ];
  }

  // Blueprint canvas (assembled view).
  if (ctx.includes("/portal/lab/blueprint")) {
    return [
      {
        label: "What's missing?",
        send: "Looking at my Blueprint as a whole, what's the most important thing missing?",
      },
      {
        label: "Help me prioritize",
        send: "Which chapters should I focus on next?",
      },
      {
        label: "Got more docs to share",
        send: "I have more documents to share — where's the best place to upload them?",
        icon: "upload",
      },
    ];
  }

  // Default (dashboard / other).
  return [
    {
      label: "What's the fastest way to start?",
      send: "What's the fastest way to make progress on my Blueprint right now?",
      icon: "sparkle",
    },
    {
      label: "I have docs to upload",
      send: "I have a few documents I want to upload — where's the best place to put them?",
      icon: "upload",
    },
    {
      label: "What's blocking me?",
      send: "What's blocking my Blueprint from being attorney-ready?",
    },
  ];
}

export function JasonChatDock({ pageContext, firstName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Greet on first open. We never persist history across page loads in
  // v1 — that's a Phase 2 concern. The Memory snapshot goes in via the
  // server every turn anyway, so the agent always has full context.
  useEffect(() => {
    if (open && transcript.length === 0) {
      const greeting = firstName
        ? `Hi ${firstName} — I'm Jason. I've got everything we know about your business loaded. Ask me anything about the next step in your Blueprint, or tell me what you're working on.`
        : OPENER_DEFAULT;
      setTranscript([{ kind: "bubble", role: "assistant", text: greeting }]);
    }
  }, [open, transcript.length, firstName]);

  // Auto-scroll the panel to bottom whenever new content lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // Cancel any in-flight stream when the dock unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /** Build the plain-text history we send to the server. Tool cards
   *  are server-side bookkeeping — the model already knows about
   *  past tool calls because they were re-injected as tool_result
   *  blocks; we don't need to round-trip them through the client. */
  const historyForServer = useCallback((): ChatTurn[] => {
    return transcript
      .filter((i): i is Extract<TranscriptItem, { kind: "bubble" }> => i.kind === "bubble")
      .map((i) => ({ role: i.role, content: i.text }));
  }, [transcript]);

  const send = useCallback(async (override?: string) => {
    // Allow override for chip-click sends (where the message text
    // doesn't go through the textarea draft state). Falls back to
    // draft for the normal Send-button path.
    const trimmed = (override ?? draft).trim();
    if (!trimmed || streaming) return;

    const userBubble: TranscriptItem = {
      kind: "bubble",
      role: "user",
      text: trimmed,
    };
    setTranscript((t) => [...t, userBubble]);
    setDraft("");
    setStreaming(true);

    // Build server history including the just-added user turn.
    const nextHistory: ChatTurn[] = [
      ...historyForServer(),
      { role: "user", content: trimmed },
    ];

    // Track the in-flight assistant bubble (we mutate its text as
    // text deltas arrive). React state can't do "append to last
    // string" cleanly, so we keep the index of the active bubble in
    // a ref + use functional setState updates.
    let activeBubbleIndex: number | null = null;
    let toolFired = false;

    const ensureBubble = () => {
      setTranscript((t) => {
        // If the last item is an assistant bubble, reuse it.
        const last = t[t.length - 1];
        if (last && last.kind === "bubble" && last.role === "assistant") {
          activeBubbleIndex = t.length - 1;
          return t;
        }
        // Otherwise, append a fresh empty assistant bubble.
        const next = [
          ...t,
          { kind: "bubble" as const, role: "assistant" as const, text: "" },
        ];
        activeBubbleIndex = next.length - 1;
        return next;
      });
    };

    const appendDelta = (delta: string) => {
      ensureBubble();
      setTranscript((t) => {
        if (activeBubbleIndex == null) return t;
        const copy = t.slice();
        const item = copy[activeBubbleIndex];
        if (item && item.kind === "bubble") {
          copy[activeBubbleIndex] = { ...item, text: item.text + delta };
        }
        return copy;
      });
    };

    const lockBubble = () => {
      activeBubbleIndex = null;
    };

    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory, pageContext }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`chat failed: ${res.status} ${errBody}`.trim());
      }
      if (!res.body) throw new Error("response had no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // NDJSON: split on `\n`, keep the trailing partial in the
        // buffer for the next read.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          let event: ChatEvent;
          try {
            event = JSON.parse(trimmedLine) as ChatEvent;
          } catch {
            // Garbled line — skip rather than blow up the whole turn.
            continue;
          }
          handleEvent(event);
        }
      }
      // Drain any final partial line.
      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer.trim()) as ChatEvent);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went sideways.";
      setTranscript((t) => [
        ...t,
        {
          kind: "bubble",
          role: "assistant",
          text: `I hit an error: ${msg}. Mind trying again? If it keeps happening, ping support.`,
        },
      ]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // If any tool fired during this turn, refresh the page data
      // so the chapter cards reflect the new field values without
      // the customer having to reload the page manually.
      if (toolFired) router.refresh();
    }

    function handleEvent(event: ChatEvent) {
      switch (event.type) {
        case "text":
          appendDelta(event.delta);
          break;
        case "tool_call":
          // Lock whatever assistant text we have so far into the
          // committed transcript and append a "running" tool card.
          // Subsequent text deltas will create a NEW bubble below
          // the tool card.
          lockBubble();
          setTranscript((t) => [
            ...t,
            {
              kind: "tool",
              id: event.id,
              status: "running",
              summary: "Updating Memory…",
            },
          ]);
          break;
        case "tool_result":
          if (event.ok) toolFired = true;
          setTranscript((t) =>
            t.map((item) =>
              item.kind === "tool" && item.id === event.id
                ? {
                    ...item,
                    status: event.ok ? ("ok" as const) : ("error" as const),
                    summary: event.summary,
                  }
                : item,
            ),
          );
          break;
        case "done":
          lockBubble();
          break;
        case "error":
          lockBubble();
          setTranscript((t) => [
            ...t,
            {
              kind: "bubble",
              role: "assistant",
              text: `[error: ${event.message}]`,
            },
          ]);
          break;
      }
    }
  }, [draft, streaming, historyForServer, pageContext, router]);

  // Cmd/Ctrl+Enter sends; plain Enter inserts newline (founders type fast,
  // this matches every modern chat surface so muscle memory transfers).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open chat with Jason"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-navy text-cream px-4 py-3 shadow-[0_12px_28px_rgba(30,58,95,0.28)] hover:shadow-[0_16px_36px_rgba(30,58,95,0.36)] transition-all jason-dock-breathe"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-warm text-navy font-bold text-sm tracking-wider">
          JS
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-navy" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Ask Jason</span>
        <MessageCircle size={16} className="text-cream/70" />
        <style jsx>{`
          @keyframes jason-breathe {
            0%, 100% { opacity: 0.92; }
            50% { opacity: 1; }
          }
          .jason-dock-breathe {
            animation: jason-breathe 2.6s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .jason-dock-breathe { animation: none; opacity: 1; }
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-navy/10 bg-cream shadow-[0_24px_48px_rgba(30,58,95,0.28)]">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-navy/10 bg-navy text-cream px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-warm text-navy font-bold text-xs tracking-wider">
            JS
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-navy" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Jason</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-cream/60">
              {streaming ? "Thinking…" : "Online · Memory loaded"}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
          className="rounded-full p-1.5 text-cream/70 hover:bg-cream/10 transition-colors"
        >
          <X size={16} />
        </button>
      </header>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ maxHeight: "min(60vh, 480px)" }}
      >
        {transcript.map((item, idx) => {
          if (item.kind === "bubble") {
            const isLast = idx === transcript.length - 1;
            const isInflight =
              streaming && isLast && item.role === "assistant";
            return (
              <Bubble
                key={idx}
                role={item.role}
                text={item.text}
                streaming={isInflight}
              />
            );
          }
          return (
            <ToolCard
              key={`${item.id}-${idx}`}
              status={item.status}
              summary={item.summary}
            />
          );
        })}

        {/* Starter chips — only render right after the greeting,
            before the customer's typed anything. Chips are
            context-aware: chapter-page → "Got an X doc?", queue →
            "What docs speed this up?", dashboard → "Where do I
            start?". One click sends the chip's `send` text as a
            user message; Jason's full Memory + tool access then
            handles the rest. */}
        {transcript.length === 1 &&
          transcript[0].kind === "bubble" &&
          transcript[0].role === "assistant" &&
          !streaming && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {getStarterChips(pageContext).map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void send(chip.send)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-navy bg-white hover:bg-gold hover:text-navy border border-navy/15 hover:border-gold rounded-full px-3 py-1.5 transition-colors"
                >
                  {chip.icon === "upload" && <Upload size={10} />}
                  {chip.icon === "sparkle" && <Sparkles size={10} />}
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        {streaming &&
          transcript.length > 0 &&
          transcript[transcript.length - 1].kind === "bubble" &&
          (
            transcript[transcript.length - 1] as Extract<
              TranscriptItem,
              { kind: "bubble" }
            >
          ).role === "user" && (
            <div className="flex items-center gap-2 text-grey-3 text-xs italic px-1">
              <Loader2 size={12} className="animate-spin" />
              Reading your Memory…
            </div>
          )}
      </div>

      {/* Composer */}
      <div className="border-t border-navy/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming}
            rows={2}
            placeholder="Ask anything, or paste a note about your business…"
            className="flex-1 resize-none rounded-lg border border-navy/15 bg-white px-3 py-2 text-[13px] text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={streaming || !draft.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gold text-navy hover:bg-gold-dark disabled:opacity-40 disabled:hover:bg-gold transition-colors"
          >
            {streaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[10px] text-grey-4">
          ⌘↵ to send · Jason has full context of your Blueprint
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-navy text-cream px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }
  // Don't render an empty assistant bubble — it shows as a sad blank
  // pill before any text has streamed. The "Reading your Memory…"
  // hint covers that gap.
  if (!text && !streaming) return null;
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white border border-navy/10 text-navy px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
        {text}
        {streaming && (
          <span
            className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-navy/40 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline action card. Renders between bubbles when Jason calls a
 * tool. States:
 *   - running: spinning loader + "Updating Memory…"
 *   - ok: emerald check + the summary string from the tool result
 *   - error: amber alert + the error summary
 */
function ToolCard({
  status,
  summary,
}: {
  status: "running" | "ok" | "error";
  summary: string;
}) {
  const Icon =
    status === "running"
      ? Loader2
      : status === "ok"
        ? CheckCircle2
        : AlertTriangle;
  const palette =
    status === "running"
      ? "bg-navy/5 border-navy/15 text-navy"
      : status === "ok"
        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
        : "bg-amber-50 border-amber-200 text-amber-900";
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug ${palette}`}
    >
      <Icon
        size={13}
        className={`mt-0.5 flex-shrink-0 ${status === "running" ? "animate-spin" : ""}`}
      />
      <div className="flex-1 min-w-0">
        {status === "ok" && (
          <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-bold mb-0.5 opacity-70">
            <Sparkles size={9} /> Memory updated
          </div>
        )}
        <div className="break-words">{summary}</div>
      </div>
    </div>
  );
}
