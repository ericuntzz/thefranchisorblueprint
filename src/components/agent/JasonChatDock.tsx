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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  /** A short string describing what the user is currently looking at. */
  pageContext?: string;
  /** Customer's first name, for the friendly opener. */
  firstName?: string | null;
};

const OPENER_DEFAULT =
  "I'm Jason. I've got everything we know about your business loaded — ask me anything about the next step in your Blueprint, or just tell me what you're working on.";

export function JasonChatDock({ pageContext, firstName }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  /** The text we've streamed so far for the in-progress assistant turn. */
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Greet on first open. We never persist history across page loads in
  // v1 — that's a Phase 2 concern. The Memory snapshot goes in via the
  // server every turn anyway, so the agent always has full context.
  useEffect(() => {
    if (open && history.length === 0) {
      const greeting = firstName
        ? `Hi ${firstName} — I'm Jason. I've got everything we know about your business loaded. Ask me anything about the next step in your Blueprint, or tell me what you're working on.`
        : OPENER_DEFAULT;
      setHistory([{ role: "assistant", content: greeting }]);
    }
  }, [open, history.length, firstName]);

  // Auto-scroll the panel to bottom whenever new content lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, streamingText]);

  // Cancel any in-flight stream when the dock closes or unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;
    const nextHistory: ChatTurn[] = [
      ...history,
      { role: "user", content: trimmed },
    ];
    setHistory(nextHistory);
    setDraft("");
    setStreaming(true);
    setStreamingText("");

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
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamingText(acc);
      }
      // Commit the streamed text into history once complete.
      setHistory((h) => [...h, { role: "assistant", content: acc }]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went sideways.";
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: `I hit an error: ${msg}. Mind trying again? If it keeps happening, ping support.`,
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText("");
      abortRef.current = null;
    }
  }, [draft, streaming, history, pageContext]);

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
        {history.map((turn, idx) => (
          <Bubble key={idx} role={turn.role} text={turn.content} />
        ))}
        {streaming && streamingText && (
          <Bubble role="assistant" text={streamingText} streaming />
        )}
        {streaming && !streamingText && (
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
            onClick={send}
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
