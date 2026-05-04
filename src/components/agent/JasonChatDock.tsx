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
import { usePathname, useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageCircle,
  Paperclip,
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
  /** Optional override for what the user is currently looking at.
   *  When omitted, the dock derives this from `usePathname()` so
   *  the layout-level mount automatically reflects whichever route
   *  the customer is on without per-page wiring. */
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
      // Drop the leading article — telegraphic UI copy reads
      // naturally ("Got brand guidelines?" / "Got ops manual?")
      // and avoids the a/an + singular/plural agreement issues
      // we'd otherwise have to encode per shortLabel.
      return [
        {
          label: `Got ${prompt.shortLabel}?`,
          send: `I have ${prompt.shortLabel} I can share — what's the best way to upload it for the ${title} chapter?`,
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

export function JasonChatDock({ pageContext: pageContextProp, firstName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Prefer the explicit prop (legacy per-page mounts) but fall back
  // to the live pathname so the layout-level mount stays accurate
  // as the customer navigates without unmounting the dock.
  const pageContext = pageContextProp ?? pathname ?? "";
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the customer is parked near the bottom of the
  // transcript. We only auto-scroll on new content when this is true,
  // so reading earlier messages doesn't get yanked back down whenever
  // a delta or tool card lands.
  const nearBottomRef = useRef(true);

  // Greet on first open. The dock is layout-mounted now, so this only
  // fires on the very first open of a session. Subsequent navigations
  // keep the existing transcript intact — open/close is purely visual.
  useEffect(() => {
    if (open && transcript.length === 0) {
      const greeting = firstName
        ? `Hi ${firstName} — I'm Jason. I've got everything we know about your business loaded. Ask me anything about the next step in your Blueprint, or tell me what you're working on.`
        : OPENER_DEFAULT;
      setTranscript([{ kind: "bubble", role: "assistant", text: greeting }]);
    }
  }, [open, transcript.length, firstName]);

  // Auto-scroll only when the customer is already near the bottom.
  // If they've scrolled up to read earlier messages, leave them
  // alone — we don't want the dock fighting their scroll position.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  // Update nearBottomRef as the customer scrolls. ~80px slack so
  // wheel/trackpad inertia near the bottom still counts as "at
  // bottom" — otherwise auto-scroll stops feeling alive.
  function onTranscriptScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // Esc closes the dock. Mounted on window so it works even while
  // focus is in the textarea.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    // text deltas arrive). React 18 batches updates from awaited
    // promise callbacks, so a `let` mutated inside one functional
    // updater isn't reliably visible to the next one — promote to
    // an object ref so the read in appendDelta sees the write from
    // ensureBubble even across batched flushes.
    const activeBubble = { index: null as number | null };
    let toolFired = false;

    const ensureBubble = () => {
      setTranscript((t) => {
        // If the last item is an assistant bubble, reuse it.
        const last = t[t.length - 1];
        if (last && last.kind === "bubble" && last.role === "assistant") {
          activeBubble.index = t.length - 1;
          return t;
        }
        // Otherwise, append a fresh empty assistant bubble.
        const next = [
          ...t,
          { kind: "bubble" as const, role: "assistant" as const, text: "" },
        ];
        activeBubble.index = next.length - 1;
        return next;
      });
    };

    const appendDelta = (delta: string) => {
      ensureBubble();
      setTranscript((t) => {
        const i = activeBubble.index;
        if (i == null) return t;
        const copy = t.slice();
        const item = copy[i];
        if (item && item.kind === "bubble") {
          copy[i] = { ...item, text: item.text + delta };
        }
        return copy;
      });
    };

    const lockBubble = () => {
      activeBubble.index = null;
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
      // Don't surface the user's own abort as an "error" — that
      // happens when they navigate away mid-stream. The dock is
      // layout-mounted now so this is rare, but still possible.
      const isAbort =
        err instanceof DOMException && err.name === "AbortError";
      const msg =
        err instanceof Error ? err.message : "Something went sideways.";
      setTranscript((t) => {
        // Mark any still-"running" tool cards as error so we don't
        // leave a permanent spinner sitting in the transcript when
        // the stream dies before we hear back about a tool result.
        const cleaned = t.map((item) =>
          item.kind === "tool" && item.status === "running"
            ? {
                ...item,
                status: "error" as const,
                summary: "Tool didn't finish — try again.",
              }
            : item,
        );
        if (isAbort) return cleaned;
        return [
          ...cleaned,
          {
            kind: "bubble" as const,
            role: "assistant" as const,
            text: `I hit an error: ${msg}. Mind trying again? If it keeps happening, ping support.`,
          },
        ];
      });
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

  /**
   * Upload a file dropped or attached in the chat dock. The file
   * lands at `business_overview` (the most general primary chapter)
   * with `autoClassify=true` so Sonnet fans it out to the chapters
   * it actually belongs to. We surface the in-flight + result state
   * as a tool-card-style row in the transcript, then auto-fire a
   * follow-up chat turn so Jason reads the new excerpt and tells
   * the customer what he extracted.
   *
   * Why business_overview as the default primary: every chapter is
   * a candidate for the doc, but the classifier will only attach
   * the file to chapters it's actually relevant for. Picking a
   * neutral, almost-always-relevant primary minimizes the chance
   * that the file lands somewhere wrong if the classifier returns
   * an empty fan-out list.
   */
  const uploadFile = useCallback(
    async (file: File) => {
      if (uploading || streaming) return;
      setUploading(true);
      // Use the chat timestamp as a card id so the running → ok/error
      // transition lands on the same row.
      const cardId = `upload-${Date.now()}`;
      setTranscript((t) => [
        ...t,
        {
          kind: "tool",
          id: cardId,
          status: "running",
          summary: `Uploading ${file.name}…`,
        },
      ]);
      try {
        const fd = new FormData();
        fd.append("slug", "business_overview");
        fd.append("file", file);
        // Same fan-out behavior as the intake flow — one drop, many
        // chapters get the doc indexed.
        fd.append("autoClassify", "true");
        const res = await fetch("/api/agent/chapter-attachment", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const j = (await res.json()) as {
          attachment?: { label?: string };
          alsoAttachedTo?: string[];
        };
        const fanOutTitles = (j.alsoAttachedTo ?? [])
          .filter(isValidMemoryFileSlug)
          .map((s) => MEMORY_FILE_TITLES[s]);
        const summary =
          fanOutTitles.length > 0
            ? `${file.name} attached + indexed to: Business Overview · ${fanOutTitles.join(" · ")}`
            : `${file.name} attached to Business Overview.`;
        setTranscript((t) =>
          t.map((item) =>
            item.kind === "tool" && item.id === cardId
              ? { ...item, status: "ok" as const, summary }
              : item,
          ),
        );
        // Refresh server data so chapter pages underneath the dock
        // see the new attachment without a manual reload.
        router.refresh();
        // Auto-fire a follow-up so Jason reads the new excerpt and
        // tells the customer what he found relevant. The Memory
        // snapshot built server-side will include the just-saved
        // attachment record (excerpt + label), so Jason sees it.
        // Small delay so the success card renders first and the
        // customer registers the upload before Jason starts typing.
        setTimeout(() => {
          void send(
            `I just uploaded ${file.name}. Read it and tell me what you found that's most useful for the Blueprint.`,
          );
        }, 250);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setTranscript((t) =>
          t.map((item) =>
            item.kind === "tool" && item.id === cardId
              ? {
                  ...item,
                  status: "error" as const,
                  summary: `Couldn't upload ${file.name}: ${msg}`,
                }
              : item,
          ),
        );
      } finally {
        setUploading(false);
      }
    },
    [uploading, streaming, router, send],
  );

  // Drag-drop handlers on the dock body. We accept the first file
  // dropped — multi-file uploads sequentialize cleanly through the
  // attach button if the customer needs that.
  function onDockDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (uploading || streaming) return;
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function onDockDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (uploading || streaming) return;
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function onDockDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when the drag genuinely leaves the dock outer
    // rectangle. Without this guard, dragLeave fires every time
    // the cursor crosses any child boundary (header, transcript,
    // composer) and the overlay flickers.
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragActive(false);
  }
  function onDockDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading || streaming) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

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
    <div
      className={`fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border bg-cream shadow-[0_24px_48px_rgba(30,58,95,0.28)] transition-colors ${
        dragActive ? "border-gold ring-4 ring-gold/30" : "border-navy/10"
      }`}
      onDragEnter={onDockDragEnter}
      onDragOver={onDockDragOver}
      onDragLeave={onDockDragLeave}
      onDrop={onDockDrop}
    >
      {/* Drop overlay — visible only while a file is being dragged
          over the dock so the customer gets immediate "yes I see
          it, drop here" feedback. */}
      {dragActive && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-cream/95 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <Upload size={28} className="text-gold mb-2" />
          <div className="text-navy font-bold text-sm">
            Drop to attach
          </div>
          <div className="text-grey-3 text-xs mt-0.5">
            Jason will read it and route it to the right chapters.
          </div>
        </div>
      )}
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
        onScroll={onTranscriptScroll}
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
          {/* Attach button — opens the native file picker. Same
              upload pipeline as drag-drop. Hidden file input is
              the standard accessible pattern. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || streaming}
            aria-label="Attach a file"
            title="Attach a file (Jason will route it to the right chapters)"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-navy/60 hover:text-navy hover:bg-navy/5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Paperclip size={16} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              // Clear so the same file can be picked again later.
              e.target.value = "";
            }}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming}
            rows={2}
            placeholder="Ask anything, drop a doc, or paste a note…"
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
          ⌘↵ to send · drop a file anywhere on the dock · esc to close
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
