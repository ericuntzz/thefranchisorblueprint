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
 *    the section cards on the page underneath pick up the new field
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
  History,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Minimize2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SECTION_DOC_PROMPTS } from "@/lib/memory/doc-prompts";
import {
  isValidMemoryFileSlug,
  MEMORY_FILE_TITLES,
  type MemoryFileSlug,
} from "@/lib/memory/files";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * A proactive nudge fetched from /api/agent/nudge — Stage 4 of
 * the Jason AI buildout. When non-null, the closed pill picks
 * up a notification dot + teaser text, and the dock greeting on
 * next open uses this prose instead of the generic context
 * greeting. Dismissals tracked client-side in localStorage by
 * `id` so a customer doesn't see the same nudge repeatedly.
 */
type Nudge = {
  id: string;
  greeting: string;
  starter?: string;
  pillTeaser: string;
};

/** localStorage key that holds the array of dismissed nudge ids. */
const DISMISSED_NUDGES_KEY = "jason-ai-dismissed-nudges";
/** Cap dismissed-id list size — older ones drop off so the
 *  customer eventually sees a recurring nudge again. */
const MAX_DISMISSED_NUDGES = 50;

/**
 * One past chat archived via the "+ New chat" button. We keep a
 * small list of these (server-capped at 10) so the customer can
 * pull a recent conversation back into the active slot if they
 * cleared it by accident or want to revisit context. ID is
 * generated client-side; preview is the first ~80 chars of the
 * first user message so the dropdown row reads as something
 * recognizable, not just a date.
 */
type SavedChatThread = {
  id: string;
  archivedAt: string;
  preview: string;
  transcript: TranscriptItem[];
};

/**
 * Minimal Web Speech API surface we care about. The full type defs
 * for `SpeechRecognition` aren't yet in standard `lib.dom` — we
 * only use a small slice (start/stop/abort + onresult/onend/onerror),
 * so a focused declaration here keeps us out of `@types/dom-speech-recognition`
 * dep territory while the API stays browser-only and behind feature
 * detection.
 */
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { transcript: string; confidence: number };
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror:
    | ((event: { error: string; message?: string }) => void)
    | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Items the transcript can hold — bubbles (user/assistant prose),
 *  tool cards (the inline "✓ Updated X = Y" rows), and resume
 *  dividers (a subtle "picking up from earlier →" rule shown when
 *  we restore a persisted conversation under a fresh greeting).
 *  The transcript is the union so the renderer can iterate one
 *  ordered list. */
type TranscriptItem =
  | {
      kind: "bubble";
      role: "user" | "assistant";
      text: string;
      /** True for the dock's opening greeting line. Stripped on
       *  save so a returning customer always gets a fresh,
       *  context-aware greeting at the top of the next session
       *  rather than a stale one frozen from where they last
       *  opened the dock. */
      isGreeting?: boolean;
    }
  | {
      kind: "tool";
      id: string;
      status: "running" | "ok" | "error";
      summary: string;
    }
  | { kind: "divider"; label: string };

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
        sectionTitle: string;
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
  "I'm Jason AI — Jason's playbooks plus everything we know about your business, loaded and ready. What are you working on?";

/**
 * Context-aware greeting. The dock used to open on a generic
 * "ask me anything" line which forced the customer to invent a
 * question. This version reads the current pathname and opens
 * with intent — naming the section / surface they're on and
 * proposing a concrete next move. Result: Jason AI feels embedded
 * in their work, not parked in the corner waiting to be summoned.
 *
 * The greeting is purely client-derived (pathname + firstName) so
 * it lands instantly without a server round-trip. Future pass can
 * layer on a server-fetched activity feed for "since you were
 * last here, I drafted X" copy.
 */
function getContextGreeting(args: {
  pathname: string;
  firstName: string | null | undefined;
}): string {
  const { pathname, firstName } = args;
  const hi = firstName ? `Hey ${firstName} — ` : "";

  // Per-section greeting names the section and proposes the move.
  const sectionMatch = pathname.match(/\/portal\/section\/([a-z_]+)/);
  if (sectionMatch && isValidMemoryFileSlug(sectionMatch[1])) {
    const slug = sectionMatch[1] as MemoryFileSlug;
    const title = MEMORY_FILE_TITLES[slug];
    return `${hi}you're on **${title}**. Want me to draft what I've got, or do you want to think it through first? Drop a doc anytime and I'll pull what I can.`;
  }

  if (pathname.includes("/portal/lab/next")) {
    return `${hi}let's burn through the queue. Stuck on a question? Drop a doc and I'll skip a chunk of these for you. Or just tell me what's on your mind.`;
  }

  if (pathname.includes("/portal/lab/intake")) {
    return `${hi}walk me through your business or drop a doc — pitch deck, ops manual, P&L, whatever you've got. I'll start a draft from anything you give me.`;
  }

  if (pathname.includes("/portal/lab/blueprint")) {
    return `${hi}looking at your Blueprint as a whole. Want me to flag what's still missing, or pick a section to push forward?`;
  }

  if (pathname.includes("/portal/section")) {
    return `${hi}what section do you want to push on? I've got everything we know about your business loaded.`;
  }

  if (pathname.includes("/portal/coaching")) {
    return `${hi}prepping for a coaching call? Tell me what you want to cover and I'll pull the Memory together.`;
  }

  // /portal dashboard or anywhere else.
  return `${hi}what do you want to work on? I can pick up where you left off, draft a section, read a doc you drop here, or just talk through what's on your mind.`;
}

/**
 * Status-line copy shown in the dock header, under the "Jason AI"
 * name. Reflects whatever the customer is currently looking at so
 * the dock feels like an assistant tracking with them, not a
 * generic chatbot. During a stream this is overridden with
 * "Thinking…".
 */
function getStatusLine(pathname: string): string {
  const sectionMatch = pathname.match(/\/portal\/section\/([a-z_]+)/);
  if (sectionMatch && isValidMemoryFileSlug(sectionMatch[1])) {
    return `Reading ${MEMORY_FILE_TITLES[sectionMatch[1] as MemoryFileSlug]}`;
  }
  if (pathname.includes("/portal/lab/next")) return "Watching the question queue";
  if (pathname.includes("/portal/lab/intake")) return "Watching intake";
  if (pathname.includes("/portal/lab/blueprint")) return "Reading the full Blueprint";
  if (pathname.includes("/portal/coaching")) return "Coaching mode";
  if (pathname.includes("/portal/account")) return "Account settings";
  if (pathname.includes("/portal/upgrade")) return "Tier upgrade";
  return "Online · Memory loaded";
}

/**
 * Read the dismissed-nudge id list from localStorage. Defensive
 * around storage exceptions (private mode, quota errors) and
 * malformed JSON — returns an empty list rather than throwing.
 */
function readDismissedNudges(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_NUDGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function isNudgeDismissed(id: string): boolean {
  return readDismissedNudges().includes(id);
}

function markNudgeDismissed(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = readDismissedNudges();
    if (list.includes(id)) return;
    const next = [id, ...list].slice(0, MAX_DISMISSED_NUDGES);
    window.localStorage.setItem(DISMISSED_NUDGES_KEY, JSON.stringify(next));
  } catch {
    /* ignore — nudge will simply re-fire next mount */
  }
}

/**
 * Render a relative-time string for the chat-history dropdown
 * rows ("just now", "2h ago", "yesterday", "Mar 4"). Uses the
 * customer's locale for the absolute fallback so dates read
 * naturally in their region. Defensively wrapped — a malformed
 * timestamp returns an empty string rather than throwing.
 */
function formatRelative(iso: string): string {
  let then: number;
  try {
    then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
  } catch {
    return "";
  }
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  // Older — fall back to a short month/day label.
  try {
    return new Date(then).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Starter chips — clickable suggestions surfaced under the greeting
 * when the chat first opens. Each chip is a short user-message that
 * the customer can send with one click. The set is derived from
 * pageContext so the suggestions land where the customer is right
 * now (section page → "got an X doc?", queue → "what would speed
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
  // Per-section context: extract the slug from /portal/section/[slug].
  const sectionMatch = ctx.match(/\/portal\/section\/([a-z_]+)/);
  if (sectionMatch && isValidMemoryFileSlug(sectionMatch[1])) {
    const slug = sectionMatch[1] as MemoryFileSlug;
    const prompt = SECTION_DOC_PROMPTS[slug];
    const title = MEMORY_FILE_TITLES[slug];
    if (prompt) {
      // Drop the leading article — telegraphic UI copy reads
      // naturally ("Got brand guidelines?" / "Got ops manual?")
      // and avoids the a/an + singular/plural agreement issues
      // we'd otherwise have to encode per shortLabel.
      return [
        {
          label: `Got ${prompt.shortLabel}?`,
          send: `I have ${prompt.shortLabel} I can share — what's the best way to upload it for the ${title} section?`,
          icon: "upload",
        },
        {
          label: `Help me draft ${title}`,
          send: `Walk me through what I need to finish the ${title} section.`,
          icon: "sparkle",
        },
        {
          label: "What docs would help?",
          send: `What documents would speed up the ${title} section?`,
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
        send: "Which sections should I focus on next?",
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
  // Broadcast open/close so the portal sidebar can auto-collapse
  // when the chat dock opens (and reclaim space when it closes).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("tfb-jason-dock-state", { detail: { open } }),
    );
  }, [open]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [recording, setRecording] = useState(false);
  // null while we haven't probed yet, false if unsupported, true
  // if SpeechRecognition is available. Suppresses the mic button
  // entirely on browsers without Web Speech (Firefox, older Safari,
  // privacy-mode browsers) so we don't show a button that can't
  // do anything.
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(
    null,
  );
  // Has the persisted transcript finished loading from the server?
  // The greeting effect waits on this so we don't briefly show
  // "ask me anything" and then yank it away with the customer's
  // resumed conversation. Initial false → we attempt the load on
  // mount → flips true regardless of whether anything was found.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Expanded drawer mode. Defaults to TRUE — the dock opens in the
  // roomy "real conversation" frame because that's what the chat is
  // actually for; the compact pill is opt-in for when the customer
  // wants to peek-and-collapse. Preference is sticky via localStorage
  // so a customer who collapses to compact stays collapsed.
  const [expanded, setExpanded] = useState(true);
  // Past chats archived via the "+ New chat" button. Server-capped
  // at 10. Whenever this flips, we POST it back so the dropdown
  // stays in sync across reloads.
  const [savedThreads, setSavedThreads] = useState<SavedChatThread[]>([]);
  // Whether the history dropdown is currently open. Click-outside
  // closes via a window listener while open.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Proactive nudge fetched from /api/agent/nudge on mount. When
  // present and not dismissed, the closed pill shows a notification
  // dot + teaser, and the next open's greeting is the nudge prose.
  const [pendingNudge, setPendingNudge] = useState<Nudge | null>(null);
  // Tracks whether the current transcript was opened with a nudge
  // (vs a context greeting). Used to render the optional nudge
  // starter chip below the greeting on first open.
  const [activeNudge, setActiveNudge] = useState<Nudge | null>(null);
  // Save debouncer — schedules a chat-history POST a beat after
  // the transcript settles so we don't hammer the endpoint on
  // every streamed delta.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Captures the draft text at the moment recording started. Final
  // transcripts are appended to THIS baseline so re-recording mid-
  // utterance doesn't pile transcripts on top of each other.
  const recordingBaselineRef = useRef<string>("");
  // Tracks whether the customer is parked near the bottom of the
  // transcript. We only auto-scroll on new content when this is true,
  // so reading earlier messages doesn't get yanked back down whenever
  // a delta or tool card lands.
  const nearBottomRef = useRef(true);

  // Persisted transcript fetched from the server, kept separate
  // from the live `transcript` state. On first open, we splice
  // these in AFTER a fresh greeting so the opener always reflects
  // the customer's current page, not the stale context they last
  // opened the dock under.
  const persistedHistoryRef = useRef<TranscriptItem[]>([]);

  // Load any persisted transcript + saved chat history from the
  // previous session. Fires once on mount. The transcript itself
  // isn't applied yet — it gets spliced in by the greeting effect
  // once the dock opens, under a fresh context-aware greeting.
  // Failure is non-fatal — we just fall through to the empty-history
  // path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agent/chat-history", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setHistoryLoaded(true);
          return;
        }
        const j = (await res.json()) as {
          transcript?: TranscriptItem[];
          savedThreads?: SavedChatThread[];
        };
        if (cancelled) return;
        if (Array.isArray(j.transcript)) {
          persistedHistoryRef.current = j.transcript;
        }
        if (Array.isArray(j.savedThreads)) {
          setSavedThreads(j.savedThreads);
        }
        setHistoryLoaded(true);
      } catch {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch any pending proactive nudge once on mount. Runs in
  // parallel with the chat-history load — the greeting effect
  // waits for both to settle before deciding what to show.
  // Failures are non-fatal (no nudge → standard greeting flow).
  const [nudgeFetched, setNudgeFetched] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agent/nudge", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setNudgeFetched(true);
          return;
        }
        const j = (await res.json()) as { nudge?: Nudge | null };
        if (cancelled) return;
        const incoming = j.nudge ?? null;
        if (incoming && !isNudgeDismissed(incoming.id)) {
          setPendingNudge(incoming);
        }
        setNudgeFetched(true);
      } catch {
        if (!cancelled) setNudgeFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Greet on first open. Always emits a fresh, context-aware
  // greeting line tied to the CURRENT pathname — never the stale
  // greeting from whatever page the customer was on the last time
  // they opened the dock. If a persisted history exists, it's
  // spliced in AFTER the greeting under a "Resumed from earlier"
  // divider so the conversation continuity stays without freezing
  // the opener.
  //
  // Special case: if the server has surfaced a proactive nudge
  // (Stage 4), that prose becomes the greeting instead of the
  // generic context line — and we mark it dismissed in
  // localStorage so the same nudge doesn't fire on the next
  // mount until conditions change.
  //
  // Gated on `historyLoaded` AND `nudgeFetched` so the greeting
  // doesn't flash before either signal lands.
  useEffect(() => {
    if (!historyLoaded || !nudgeFetched) return;
    if (open && transcript.length === 0) {
      const usingNudge = pendingNudge != null;
      const greetingText = usingNudge
        ? pendingNudge.greeting
        : getContextGreeting({
            pathname: pathname ?? "",
            firstName,
          });
      const greetingItem: TranscriptItem = {
        kind: "bubble",
        role: "assistant",
        text: greetingText,
        isGreeting: true,
      };
      const persisted = persistedHistoryRef.current;
      if (persisted.length === 0) {
        setTranscript([greetingItem]);
      } else {
        setTranscript([
          greetingItem,
          { kind: "divider", label: "Picking up where we left off" },
          ...persisted,
        ]);
      }
      // Lock in the nudge for the starter-chip render, then
      // mark it dismissed + clear the pill notification.
      if (usingNudge) {
        setActiveNudge(pendingNudge);
        markNudgeDismissed(pendingNudge.id);
        setPendingNudge(null);
      }
    }
  }, [
    open,
    transcript.length,
    firstName,
    pathname,
    historyLoaded,
    nudgeFetched,
    pendingNudge,
  ]);

  // Persist the active transcript to Supabase a beat after it
  // settles. Debounce window covers the streaming case — we don't
  // want to POST on every character delta, only after the model
  // finishes and the buffer drains. 1.5s after the last change
  // is plenty.
  //
  // Greetings and dividers are stripped before save so the next
  // session starts with a fresh, current-page-aware opener and
  // doesn't double up on resume markers.
  //
  // Saved threads are NOT touched here — they're persisted
  // eagerly inside the startNewChat / restoreThread / deleteSaved
  // handlers because each of those is a discrete user-driven
  // action, not a stream of small updates worth debouncing.
  useEffect(() => {
    if (!historyLoaded) return; // don't overwrite server-side data
                                // before we've even loaded it
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const persistable = transcript.filter((item) => {
        if (item.kind === "divider") return false;
        if (item.kind === "bubble" && item.isGreeting) return false;
        return true;
      });
      void fetch("/api/agent/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcript: persistable }),
      }).catch((err) => {
        // Persistence is best-effort — log but don't disrupt UX.
        console.warn("[jason-ai] chat-history save failed:", err);
      });
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [transcript, historyLoaded]);

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

  // Restore the expanded-drawer preference from localStorage on
  // mount. Default is `true` (expanded), so we only honor an explicit
  // "0" meaning "the customer chose compact previously, keep them
  // there." Wrapped in try/catch because some browsers (private
  // mode, strict storage policies) throw on access.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("jason-ai-expanded");
      if (saved === "0") setExpanded(false);
    } catch {
      /* ignore — default expanded */
    }
  }, []);

  // Persist the preference whenever it flips.
  useEffect(() => {
    try {
      window.localStorage.setItem("jason-ai-expanded", expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  // Feature-detect Web Speech once on mount so we can hide the mic
  // button entirely on browsers without it. The two namespaces
  // cover Chrome/Edge/Brave (webkitSpeechRecognition) and the
  // standard prefix-free name (Safari + recent Chromium). Firefox
  // ships neither at the time of writing.
  useEffect(() => {
    if (typeof window === "undefined") {
      setVoiceSupported(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setVoiceSupported(!!Ctor);
  }, []);

  // Stop any in-flight recognition when the dock closes or unmounts
  // — otherwise the mic stays hot and the customer sees an OS-level
  // mic indicator with no way to stop it from inside the app.
  useEffect(() => {
    if (!open && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      setRecording(false);
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
    };
  }, [open]);

  /**
   * Start / stop voice dictation. Final transcripts are appended
   * to the draft text — interim (in-progress) transcripts are
   * shown live too so the customer sees the recognition happening
   * in real time, but only finals "stick" if they stop recording.
   *
   * Click-to-start, click-again-to-stop. We tried push-to-hold
   * earlier but mobile doesn't have a clean equivalent and it's a
   * worse fit for founders dictating long thoughts.
   */
  function toggleRecording() {
    if (streaming || uploading) return;
    if (recording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* will fire onend */
      }
      return;
    }
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    recordingBaselineRef.current = draft;

    recognition.onresult = (event) => {
      // Walk every result from `resultIndex` onward and split it
      // into "final" (committed by the recognizer) vs "interim"
      // (still being figured out). Final pieces concat onto the
      // baseline; interim text is shown after them so the user
      // sees their words appear as they speak.
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const baseline = recordingBaselineRef.current;
      const sep = baseline && !baseline.endsWith(" ") ? " " : "";
      // Promote finals into the baseline so the next interim batch
      // starts after them.
      if (finalText) {
        recordingBaselineRef.current = baseline + sep + finalText.trim();
      }
      const liveBaseline = recordingBaselineRef.current;
      const liveSep =
        liveBaseline && !liveBaseline.endsWith(" ") && interimText
          ? " "
          : "";
      setDraft(liveBaseline + liveSep + interimText.trim());
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
    };

    recognition.onerror = (event) => {
      // Common errors: "not-allowed" (mic permission denied),
      // "no-speech" (silence timeout), "aborted" (we called stop).
      // For permission denied we surface a hint; otherwise stay
      // quiet and let the user try again.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setTranscript((t) => [
          ...t,
          {
            kind: "bubble",
            role: "assistant",
            text:
              "I couldn't access your mic. Check the browser's site permissions and try again.",
          },
        ]);
      } else if (
        event.error !== "aborted" &&
        event.error !== "no-speech"
      ) {
        console.warn("[jason-ai] speech recognition error:", event.error);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setRecording(true);
    } catch (err) {
      console.warn("[jason-ai] could not start speech recognition:", err);
      recognitionRef.current = null;
    }
  }

  /** Build the plain-text history we send to the server. Tool cards
   *  are server-side bookkeeping — the model already knows about
   *  past tool calls because they were re-injected as tool_result
   *  blocks; we don't need to round-trip them through the client.
   *  Dividers are pure UI furniture, also dropped. The dock's
   *  greeting bubble is included so the model has the full
   *  customer-facing context. */
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

    // --- Typewriter buffer ---------------------------------------
    // Anthropic streams tokens, but each text_delta is usually a
    // chunk (a few characters to a sentence). Pushing each chunk
    // straight into state makes the UI jump in big visible steps.
    // Instead we accumulate incoming text in a buffer and drain it
    // into the active bubble at a steady, readable pace via
    // requestAnimationFrame.
    //
    // Drain rate is mildly adaptive: we always emit at least
    // BASE_RATE chars/frame, but if the buffer gets long (the
    // network burst was big or the stream is way ahead of the
    // typewriter) we accelerate so the customer never waits more
    // than a couple of frames behind reality. Stream-end flushes
    // immediately so there's no lingering delay after the model
    // is genuinely done.
    const buffer = { text: "" };
    let rafId: number | null = null;
    const BASE_RATE = 2; // chars per frame ≈ 120/sec at 60fps

    const flushChunk = (chunk: string) => {
      ensureBubble();
      setTranscript((t) => {
        const i = activeBubble.index;
        if (i == null) return t;
        const copy = t.slice();
        const item = copy[i];
        if (item && item.kind === "bubble") {
          copy[i] = { ...item, text: item.text + chunk };
        }
        return copy;
      });
    };

    const drainTick = () => {
      const pending = buffer.text;
      if (pending.length === 0) {
        rafId = null;
        return;
      }
      // Adaptive: catch up faster when the buffer is long so the
      // typewriter doesn't lag visibly behind a finished stream.
      const rate =
        pending.length > 200
          ? Math.max(BASE_RATE, Math.ceil(pending.length / 30))
          : BASE_RATE;
      const take = Math.min(rate, pending.length);
      const chunk = pending.slice(0, take);
      buffer.text = pending.slice(take);
      flushChunk(chunk);
      rafId = requestAnimationFrame(drainTick);
    };

    const appendDelta = (delta: string) => {
      buffer.text += delta;
      if (rafId == null && typeof requestAnimationFrame !== "undefined") {
        rafId = requestAnimationFrame(drainTick);
      }
    };

    /** Drain the buffer immediately and stop the rAF loop. Used
     *  when we hit a tool_call (need to commit text before the
     *  card lands) or stream end (don't make the user wait). */
    const flushBuffer = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const remaining = buffer.text;
      buffer.text = "";
      if (remaining) flushChunk(remaining);
    };

    const lockBubble = () => {
      flushBuffer();
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
      // Drain any text the typewriter buffer is still holding so
      // the customer never sees a gap between "Thinking…" turning
      // off and the last sentence of the reply landing.
      flushBuffer();
      setStreaming(false);
      abortRef.current = null;
      // If any tool fired during this turn, refresh the page data
      // so the section cards reflect the new field values without
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

  // Enter sends; Shift+Enter inserts a newline. This matches the
  // muscle memory of every modern chat surface (ChatGPT, Claude.ai,
  // Slack, iMessage, Discord). Cmd/Ctrl+Enter still sends too, for
  // anyone with the inverse habit from earlier composers.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return; // newline
      // IME composition (Japanese / Chinese / Korean input methods)
      // — don't intercept Enter while a candidate is being chosen.
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void send();
    },
    [send],
  );

  /**
   * "+ New chat" — archive the current conversation into the
   * saved-threads list and start fresh. Greetings and dividers
   * are stripped from the archive (they're regenerated on every
   * open so they shouldn't persist), and an empty conversation
   * is skipped entirely (nothing to save). After clearing, the
   * greeting effect fires a fresh context-aware opener.
   */
  const startNewChat = useCallback(() => {
    if (streaming) return;
    setHistoryOpen(false);

    // Pull the persistable subset of the current transcript —
    // skip greeting bubbles, dividers, and in-flight tool cards.
    const archivable = transcript.filter((item) => {
      if (item.kind === "divider") return false;
      if (item.kind === "bubble" && item.isGreeting) return false;
      if (item.kind === "tool" && item.status === "running") return false;
      return true;
    });

    // First user message → preview text. If there's no user
    // message yet (rare — they've only seen Jason talk), fall
    // back to the first assistant text or a generic label.
    const firstUserMsg = archivable.find(
      (i) => i.kind === "bubble" && i.role === "user",
    );
    const firstAnyText = archivable.find((i) => i.kind === "bubble");
    const previewSource =
      firstUserMsg && firstUserMsg.kind === "bubble"
        ? firstUserMsg.text
        : firstAnyText && firstAnyText.kind === "bubble"
          ? firstAnyText.text
          : "(empty chat)";
    const preview =
      previewSource.length > 80
        ? previewSource.slice(0, 80) + "…"
        : previewSource;

    // Skip archiving an empty / greeting-only conversation —
    // archiving "fresh greeting only" rows would clutter the
    // history dropdown with placeholders.
    let nextSaved = savedThreads;
    if (archivable.length > 0) {
      const archive: SavedChatThread = {
        id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        archivedAt: new Date().toISOString(),
        preview,
        transcript: archivable,
      };
      nextSaved = [archive, ...savedThreads].slice(0, 10);
      setSavedThreads(nextSaved);
    }

    // Reset persisted-history ref so the next greeting open
    // doesn't splice the just-archived chat back in under a
    // "picking up" divider.
    persistedHistoryRef.current = [];
    setTranscript([]);
    setDraft("");

    // Push to server immediately so a refresh doesn't lose the
    // archive operation (the debounced save would also catch it
    // but eagerness matches the customer's mental model).
    void fetch("/api/agent/chat-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        transcript: [],
        savedThreads: nextSaved,
      }),
    }).catch((err) => {
      console.warn("[jason-ai] new-chat archive save failed:", err);
    });
  }, [streaming, transcript, savedThreads]);

  /**
   * Restore a saved thread back into the active slot. The
   * currently-active conversation gets archived too (if
   * non-empty) so loading a past chat doesn't silently destroy
   * what the customer has now. Effectively a "swap" — the
   * customer can always undo by restoring the other one.
   */
  const restoreThread = useCallback(
    (threadId: string) => {
      if (streaming) return;
      const target = savedThreads.find((t) => t.id === threadId);
      if (!target) return;

      // Archive whatever's currently active (mirrors the
      // archive logic in startNewChat).
      const archivableCurrent = transcript.filter((item) => {
        if (item.kind === "divider") return false;
        if (item.kind === "bubble" && item.isGreeting) return false;
        if (item.kind === "tool" && item.status === "running") return false;
        return true;
      });

      let nextSaved = savedThreads.filter((t) => t.id !== threadId);
      if (archivableCurrent.length > 0) {
        const firstUser = archivableCurrent.find(
          (i) => i.kind === "bubble" && i.role === "user",
        );
        const firstAny = archivableCurrent.find((i) => i.kind === "bubble");
        const previewSrc =
          firstUser && firstUser.kind === "bubble"
            ? firstUser.text
            : firstAny && firstAny.kind === "bubble"
              ? firstAny.text
              : "(empty chat)";
        const preview =
          previewSrc.length > 80
            ? previewSrc.slice(0, 80) + "…"
            : previewSrc;
        nextSaved = [
          {
            id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
            archivedAt: new Date().toISOString(),
            preview,
            transcript: archivableCurrent,
          },
          ...nextSaved,
        ].slice(0, 10);
      }

      setSavedThreads(nextSaved);
      setHistoryOpen(false);

      // Build the restored transcript — fresh context-aware
      // greeting at the top, then a "Restored from earlier"
      // divider, then the saved thread's content. Same shape
      // the resume-on-mount flow uses.
      const greetingItem: TranscriptItem = {
        kind: "bubble",
        role: "assistant",
        text: getContextGreeting({
          pathname: pathname ?? "",
          firstName,
        }),
        isGreeting: true,
      };
      setTranscript([
        greetingItem,
        { kind: "divider", label: "Restored from earlier" },
        ...target.transcript,
      ]);

      // Eager save so a refresh doesn't lose the swap.
      void fetch("/api/agent/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transcript: target.transcript,
          savedThreads: nextSaved,
        }),
      }).catch((err) => {
        console.warn("[jason-ai] restore save failed:", err);
      });
    },
    [streaming, savedThreads, transcript, pathname, firstName],
  );

  /**
   * Drop a single saved thread from the history list (the trash
   * icon on each row). Doesn't touch the active transcript.
   */
  const deleteSavedThread = useCallback(
    (threadId: string) => {
      const nextSaved = savedThreads.filter((t) => t.id !== threadId);
      setSavedThreads(nextSaved);
      void fetch("/api/agent/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ savedThreads: nextSaved }),
      }).catch((err) => {
        console.warn("[jason-ai] delete saved thread failed:", err);
      });
    },
    [savedThreads],
  );

  // Click-outside for the history dropdown.
  useEffect(() => {
    if (!historyOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-jason-history-popover]")) return;
      if (target?.closest("[data-jason-history-toggle]")) return;
      setHistoryOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [historyOpen]);

  /**
   * Upload a file dropped or attached in the chat dock. The file
   * lands at `business_overview` (the most general primary section)
   * with `autoClassify=true` so Sonnet fans it out to the sections
   * it actually belongs to. We surface the in-flight + result state
   * as a tool-card-style row in the transcript, then auto-fire a
   * follow-up chat turn so Jason reads the new excerpt and tells
   * the customer what he extracted.
   *
   * Why business_overview as the default primary: every section is
   * a candidate for the doc, but the classifier will only attach
   * the file to sections it's actually relevant for. Picking a
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
        // sections get the doc indexed.
        fd.append("autoClassify", "true");
        const res = await fetch("/api/agent/section-attachment", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
          };
          // Prefer `detail` when the server set it — that's the
          // actual underlying error message; `error` is the
          // category. Fall back to status code if both missing.
          throw new Error(
            j.detail ?? j.error ?? `HTTP ${res.status}`,
          );
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
        // Refresh server data so section pages underneath the dock
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
    // Closed-pill state. When a proactive nudge is pending, the
    // pill picks up a small notification dot AND swaps its label
    // text to the nudge's pillTeaser so the customer sees Jason
    // AI has something to say without us auto-opening the dock
    // (auto-open would be too aggressive).
    const hasNudge = pendingNudge != null;
    const pillLabel = hasNudge ? pendingNudge.pillTeaser : "Ask Jason AI";
    return (
      <button
        type="button"
        aria-label={
          hasNudge
            ? `Open chat with Jason AI — ${pendingNudge.pillTeaser}`
            : "Open chat with Jason AI"
        }
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full px-4 py-3 transition-all ${
          hasNudge
            ? // Nudge-active: gold ring, gold accent dot, slightly
              // brighter shadow so the pill catches the eye.
              "bg-navy text-cream ring-2 ring-gold/60 shadow-[0_16px_36px_rgba(30,58,95,0.36)] jason-dock-pulse"
            : "bg-navy text-cream shadow-[0_12px_28px_rgba(30,58,95,0.28)] hover:shadow-[0_16px_36px_rgba(30,58,95,0.36)] jason-dock-breathe"
        }`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-warm text-navy font-bold text-sm tracking-wider">
          JS
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-navy ${
              hasNudge ? "bg-gold" : "bg-emerald-400"
            }`}
          />
        </span>
        <span className="text-sm font-semibold tracking-tight max-w-[180px] truncate">
          {pillLabel}
        </span>
        <MessageCircle size={16} className="text-cream/70" />
        <style jsx>{`
          @keyframes jason-breathe {
            0%, 100% { opacity: 0.92; }
            50% { opacity: 1; }
          }
          .jason-dock-breathe {
            animation: jason-breathe 2.6s ease-in-out infinite;
          }
          /* Stronger pulse for nudge-active state — opacity sweep
             + gold ring expansion so the pill telegraphs "I have
             something for you" without yelling. */
          @keyframes jason-pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(212, 168, 83, 0.55),
                          0 16px 36px rgba(30, 58, 95, 0.36);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(212, 168, 83, 0),
                          0 16px 36px rgba(30, 58, 95, 0.36);
            }
          }
          .jason-dock-pulse {
            animation: jason-pulse 2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .jason-dock-breathe,
            .jason-dock-pulse { animation: none; opacity: 1; }
          }
        `}</style>
      </button>
    );
  }

  return (
    <div
      className={`fixed right-6 z-50 flex flex-col rounded-2xl border bg-cream shadow-[0_24px_48px_rgba(30,58,95,0.28)] transition-[width,top,bottom,border-color,box-shadow] duration-200 ${
        expanded
          ? // Expanded: anchored top + bottom so the dock spans most
            // of the right side vertically. The transcript flexes to
            // fill all available height — way more visible context
            // than the squat 480px the compact dock gets.
            "top-24 bottom-6 w-[600px] max-w-[calc(100vw-3rem)]"
          : "bottom-6 w-[380px] max-w-[calc(100vw-2rem)]"
      } ${dragActive ? "border-gold ring-4 ring-gold/30" : "border-navy/10"}`}
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
            Jason will read it and route it to the right sections.
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
            <div className="text-sm font-bold">Jason AI</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-cream/60">
              {streaming ? "Thinking…" : getStatusLine(pathname ?? "")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 relative">
          {/* + New chat — archives the current conversation into
              the saved-threads list and starts fresh. Disabled
              while streaming so a click mid-reply doesn't lose
              the in-flight content. */}
          <Tooltip label="New chat" side="bottom">
            <button
              type="button"
              aria-label="Start a new chat"
              onClick={startNewChat}
              disabled={streaming}
              className="rounded-full p-1.5 text-cream/70 hover:bg-cream/10 transition-colors disabled:opacity-40"
            >
              <MessageSquarePlus size={15} />
            </button>
          </Tooltip>
          {/* History — opens a dropdown of saved past chats.
              Only renders when there's at least one to show. */}
          {savedThreads.length > 0 && (
            <Tooltip label="Chat history" side="bottom">
              <button
                type="button"
                data-jason-history-toggle
                aria-label="Open chat history"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((v) => !v)}
                className={`rounded-full p-1.5 transition-colors ${
                  historyOpen
                    ? "bg-cream/15 text-cream"
                    : "text-cream/70 hover:bg-cream/10"
                }`}
              >
                <History size={15} />
              </button>
            </Tooltip>
          )}
          <Tooltip label={expanded ? "Collapse" : "Expand"} side="bottom">
            <button
              type="button"
              aria-label={expanded ? "Collapse chat" : "Expand chat"}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full p-1.5 text-cream/70 hover:bg-cream/10 transition-colors"
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </Tooltip>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-cream/70 hover:bg-cream/10 transition-colors"
            >
              <X size={16} />
            </button>
          </Tooltip>

          {/* History dropdown — anchored to the right under the
              header buttons. Click a row to restore that chat
              (current conversation gets archived in the swap so
              nothing is lost). Trash icon drops a single past
              chat from the list. */}
          {historyOpen && savedThreads.length > 0 && (
            <div
              data-jason-history-popover
              className="absolute right-0 top-full mt-2 w-[320px] max-w-[calc(100vw-3rem)] rounded-xl border border-navy/10 bg-cream shadow-[0_16px_36px_rgba(30,58,95,0.24)] overflow-hidden z-10"
            >
              <div className="px-3 py-2 border-b border-navy/10 text-[10px] uppercase tracking-[0.16em] font-bold text-grey-3">
                Past chats
              </div>
              <ul className="max-h-[260px] overflow-y-auto">
                {savedThreads.map((thread) => (
                  <li
                    key={thread.id}
                    className="border-b border-navy/5 last:border-b-0"
                  >
                    <div className="flex items-start gap-1 px-3 py-2 hover:bg-navy/5 transition-colors">
                      <button
                        type="button"
                        onClick={() => restoreThread(thread.id)}
                        disabled={streaming}
                        className="flex-1 text-left disabled:opacity-50"
                      >
                        <div className="text-[12px] text-navy leading-snug line-clamp-2">
                          {thread.preview}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-grey-4 mt-0.5">
                          {formatRelative(thread.archivedAt)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedThread(thread.id)}
                        aria-label="Delete this saved chat"
                        title="Delete"
                        className="flex-shrink-0 p-1 text-grey-4 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Transcript — when expanded the wrapper is height-anchored
          (top-24 to bottom-6), so flex-1 lets this fill all the
          available space. Compact stays capped to a polite size
          so the dock doesn't overshadow the page underneath. */}
      <div
        ref={scrollRef}
        onScroll={onTranscriptScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{
          maxHeight: expanded ? undefined : "min(60vh, 480px)",
        }}
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
          if (item.kind === "divider") {
            return <ResumeDivider key={`divider-${idx}`} label={item.label} />;
          }
          return (
            <ToolCard
              key={`${item.id}-${idx}`}
              status={item.status}
              summary={item.summary}
            />
          );
        })}

        {/* Nudge starter chip — when the dock opened with a
            proactive nudge as the greeting, surface its
            single-click follow-up first. Highlighted gold (vs
            the muted context chips below) because the customer's
            attention is already on it. */}
        {transcript.length === 1 &&
          transcript[0].kind === "bubble" &&
          transcript[0].role === "assistant" &&
          !streaming &&
          activeNudge?.starter && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (activeNudge.starter) void send(activeNudge.starter);
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-navy bg-gold hover:bg-gold-dark border border-gold rounded-full px-3 py-1.5 transition-colors"
              >
                <Sparkles size={10} />
                {activeNudge.starter}
              </button>
            </div>
          )}

        {/* Starter chips — only render right after the greeting,
            before the customer's typed anything. Chips are
            context-aware: section-page → "Got an X doc?", queue →
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
          <Tooltip label="Attach a file" side="top">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || streaming}
              aria-label="Attach a file"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-navy/60 hover:text-navy hover:bg-navy/5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Paperclip size={16} />
              )}
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.heic,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/*"
            aria-label="Attach a reference file"
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
            placeholder={
              recording
                ? "Listening — keep talking, I'm catching it…"
                : "Ask anything, drop a doc, or paste a note…"
            }
            className={`flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-[13px] text-navy placeholder-grey-4 focus:ring-2 focus:ring-gold/20 outline-none transition disabled:opacity-50 ${
              recording
                ? "border-red-400 focus:border-red-500"
                : "border-navy/15 focus:border-gold"
            }`}
          />
          {/* Voice input button — only renders when the browser
              supports Web Speech. Click toggles recognition on/off;
              live transcripts feed straight into the draft so the
              customer can edit before sending. */}
          {voiceSupported && (
            <Tooltip
              label={recording ? "Stop recording" : "Dictate"}
              side="top"
            >
              <button
                type="button"
                onClick={toggleRecording}
                disabled={streaming || uploading}
                aria-label={recording ? "Stop recording" : "Dictate a message"}
                className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                  recording
                    ? "bg-red-500 text-white hover:bg-red-600 jason-mic-pulse"
                    : "text-navy/60 hover:text-navy hover:bg-navy/5 disabled:opacity-40 disabled:hover:bg-transparent"
                }`}
              >
                <Mic size={16} />
                <style jsx>{`
                  @keyframes jason-mic-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
                    50%      { box-shadow: 0 0 0 7px rgba(239, 68, 68, 0); }
                  }
                  .jason-mic-pulse {
                    animation: jason-mic-pulse 1.4s ease-in-out infinite;
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .jason-mic-pulse { animation: none; }
                  }
                `}</style>
              </button>
            </Tooltip>
          )}
          <Tooltip label="Send" side="top">
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
          </Tooltip>
        </div>
        {/* Footer hint deliberately removed — the affordances
            (paperclip, mic, send) speak for themselves and the
            keyboard shortcuts are discoverable on hover. The hint
            line read as instructional clutter inside the chat
            surface itself. */}
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
    // User messages render as plain text — the customer typed them,
    // so any markdown-looking characters are literal, not formatting
    // to interpret.
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
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white border border-navy/10 text-navy px-3.5 py-2 text-[13px] leading-relaxed jason-md">
        <MarkdownBubble text={text} />
        {streaming && (
          <span
            className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-navy/40 animate-pulse"
            aria-hidden="true"
          />
        )}
        <style jsx>{`
          /* Lightweight markdown styling tuned for the chat dock —
             react-markdown emits semantic tags (<p>, <strong>, <em>,
             <ul>, <ol>, <code>, <a>) and we style them inline here
             so we don't have to bring along a full prose stylesheet. */
          .jason-md :global(p) {
            margin: 0;
          }
          .jason-md :global(p + p) {
            margin-top: 0.6em;
          }
          .jason-md :global(strong) {
            font-weight: 700;
          }
          /* Action-question highlight. Applied by MarkdownBubble's
             custom <strong> renderer when the bolded text ends with
             '?'. Pulls the customer's eye to the handoff in long
             responses without a heavy callout block. */
          .jason-md :global(.jason-question) {
            font-weight: 700;
            text-decoration: underline;
            text-decoration-color: #bc8a36; /* gold-warm */
            text-decoration-thickness: 2px;
            text-underline-offset: 3px;
          }
          .jason-md :global(em) {
            font-style: italic;
          }
          .jason-md :global(ul),
          .jason-md :global(ol) {
            margin: 0.4em 0;
            padding-left: 1.1em;
          }
          .jason-md :global(li) {
            margin: 0.15em 0;
          }
          .jason-md :global(li > p) {
            display: inline;
          }
          .jason-md :global(code) {
            background: rgba(30, 58, 95, 0.06);
            border-radius: 4px;
            padding: 0.05em 0.3em;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 0.92em;
          }
          .jason-md :global(pre) {
            background: rgba(30, 58, 95, 0.06);
            border-radius: 6px;
            padding: 0.5em 0.7em;
            overflow-x: auto;
            margin: 0.5em 0;
            font-size: 0.9em;
          }
          .jason-md :global(a) {
            color: rgb(217, 158, 56);
            text-decoration: underline;
            text-underline-offset: 2px;
          }
          .jason-md :global(a:hover) {
            color: rgb(180, 122, 28);
          }
          .jason-md :global(blockquote) {
            border-left: 3px solid rgba(30, 58, 95, 0.18);
            padding-left: 0.7em;
            margin: 0.4em 0;
            color: rgba(30, 58, 95, 0.75);
          }
          .jason-md :global(h1),
          .jason-md :global(h2),
          .jason-md :global(h3) {
            font-weight: 700;
            font-size: inherit;
            margin: 0.4em 0 0.2em;
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Renders Jason's assistant text as markdown via react-markdown.
 * The component is split out so the streaming cursor span renders
 * after the markdown block (otherwise react-markdown would try to
 * interpret the cursor markup as content).
 *
 * Question highlighting: in long responses Jason often ends with the
 * actionable question — "do you have a P&L for either West Jordan
 * or Murray I can work from?" — and customers skim past it. We pre-
 * process the text to wrap the LAST sentence-ending-in-? in markdown
 * bold, then style any bold-ending-in-? with a gold-warm underline
 * (the `.jason-question` class in the bubble's styled-jsx). The
 * effect: the customer's eye lands on the handoff. Bold gives weight,
 * underline says "actionable, your turn."
 *
 * `linkTarget` opens links in a new tab — chat is not the page,
 * we don't want a click to navigate the dock away from itself.
 */
function MarkdownBubble({ text }: { text: string }) {
  const processed = highlightFinalQuestion(text);
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
        strong: ({ children, ...props }) => {
          // Flatten children to detect bold-ending-in-? — Jason's
          // actionable-question pattern. Plain string children cover
          // the common case; nested-markdown bolds (rare) just fall
          // through to default bold styling.
          const flat = Array.isArray(children)
            ? children
                .map((c) => (typeof c === "string" ? c : ""))
                .join("")
            : typeof children === "string"
              ? children
              : "";
          const isQuestion = flat.trimEnd().endsWith("?");
          return (
            <strong
              className={isQuestion ? "jason-question" : undefined}
              {...props}
            >
              {children}
            </strong>
          );
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

/**
 * Wrap the last sentence-ending-in-? in markdown bold so the
 * `<strong>` renderer can apply the question-highlight class.
 *
 * The matcher walks back from the last `?` to the nearest sentence
 * boundary (`. ! ?` followed by whitespace, OR a paragraph break,
 * OR the start of the message). If the sentence is already inside
 * a markdown bold (`**…**`) or contains bold tokens, we skip — Jason
 * already chose the emphasis, no need to fight him for it.
 *
 * Token-cheap: pure string ops, runs once per render. No regex
 * across the whole text, no markdown re-parsing.
 */
export function highlightFinalQuestion(text: string): string {
  if (!text) return text;
  const lastQ = text.lastIndexOf("?");
  if (lastQ === -1) return text;

  // Walk back to find where the question's sentence starts. Bounds:
  //   (a) prior sentence end: . ! ? followed by whitespace
  //   (b) paragraph break: \n\n
  //   (c) start of text
  let start = 0;
  for (let i = lastQ - 1; i >= 0; i--) {
    const ch = text[i];
    if ((ch === "." || ch === "!" || ch === "?") && /\s/.test(text[i + 1] ?? "")) {
      start = i + 1;
      break;
    }
    if (ch === "\n" && text[i - 1] === "\n") {
      start = i + 1;
      break;
    }
  }
  // Skip leading whitespace inside the captured sentence.
  while (start < lastQ && /\s/.test(text[start])) start++;

  const before = text.slice(0, start);
  const sentence = text.slice(start, lastQ + 1);
  const after = text.slice(lastQ + 1);

  // Don't double-wrap if Jason (or the prompt) already bolded it,
  // and don't disrupt sentences that contain inline bold tokens.
  if (sentence.includes("**")) return text;

  return `${before}**${sentence}**${after}`;
}

/**
 * Lightweight hover-tooltip wrapper. Each header / composer
 * action gets one of these so the customer learns what the
 * icons mean without us having to label them inline. Native
 * `title=` attributes have an inconsistent ~700ms browser
 * delay and styling we can't control; this matches the dock's
 * palette and shows immediately.
 *
 * `side` controls whether the bubble pops above (composer
 * buttons in the bottom row) or below (header buttons at top).
 */
function Tooltip({
  label,
  side,
  children,
}: {
  label: string;
  side: "top" | "bottom";
  children: React.ReactNode;
}) {
  return (
    <span className="relative group inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy text-cream text-[10px] font-bold uppercase tracking-wider px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 z-30 shadow-[0_4px_12px_rgba(30,58,95,0.24)] ${
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Subtle horizontal rule shown above persisted history when we
 * resume a previous conversation under a fresh greeting. Reads
 * "Picking up where we left off" — small, low-contrast, calm —
 * so the customer instantly clocks "this is older context, the
 * line above is the new opener."
 */
function ResumeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 select-none">
      <div className="h-px flex-1 bg-navy/10" />
      <span className="text-[10px] uppercase tracking-[0.16em] text-grey-4 font-bold">
        {label}
      </span>
      <div className="h-px flex-1 bg-navy/10" />
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
