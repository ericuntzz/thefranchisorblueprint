/**
 * In-portal chat assistant — Claude Sonnet 4.6 with adaptive thinking,
 * Memory-aware context, and streaming.
 *
 * The chat dock at the bottom-right of every portal page calls into here.
 * It's much shorter and cheaper per turn than the drafting pipeline:
 * we want sub-second time-to-first-token, conversational tone, and the
 * ability to reference any Memory chapter the customer has built up.
 *
 * Streaming is via the SDK's `messages.stream()` helper which accumulates
 * the final message and exposes the final usage object — much cleaner
 * than wiring up raw SSE events.
 */

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  CACHE_1H,
  CACHE_5M,
  CHAT_MODEL,
  EFFORT_FOR_CHAT,
  getAnthropic,
} from "./anthropic";
import { loadAgentSystemPrompt } from "./prompt";
import { getMemorySnapshotForPrompt } from "@/lib/memory";

/**
 * Conversation history we accept from the client. Plain text only —
 * we don't yet expose tool use to the chat dock surface.
 */
export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Open a streaming chat completion. Returns the SDK's MessageStream —
 * the caller pipes events to the client (typically via Web Streams in
 * a Route Handler).
 *
 * Usage in a Route Handler:
 *
 *   const stream = await streamChat({ userId, history, pageContext: "..." });
 *   const encoder = new TextEncoder();
 *   const readable = new ReadableStream({
 *     async start(controller) {
 *       for await (const event of stream) {
 *         if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
 *           controller.enqueue(encoder.encode(event.delta.text));
 *         }
 *       }
 *       controller.close();
 *     },
 *   });
 *   return new Response(readable, { headers: { "Content-Type": "text/plain" } });
 */
export async function streamChat(args: {
  userId: string;
  /** Full conversation history (oldest → newest). Last turn must be user. */
  history: ChatTurn[];
  /** Free-form context about what page the customer is on. */
  pageContext?: string;
}) {
  if (args.history.length === 0) {
    throw new Error("streamChat requires at least one user message in history");
  }
  if (args.history[args.history.length - 1].role !== "user") {
    throw new Error("streamChat: last history turn must be from 'user'");
  }

  const [systemPrompt, memorySnapshot] = await Promise.all([
    loadAgentSystemPrompt(),
    getMemorySnapshotForPrompt(args.userId),
  ]);

  const client = getAnthropic();

  // Inject the Memory snapshot + page context as a synthetic first user
  // turn, with a synthetic assistant ack — that way the actual user
  // history flows naturally afterward and the snapshot sits in the
  // cacheable prefix.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `<customer_memory>\nWhat I currently know about this customer's business:\n\n${memorySnapshot}\n</customer_memory>${
            args.pageContext
              ? `\n\n<page_context>\nThe customer is currently viewing: ${args.pageContext}\n</page_context>`
              : ""
          }`,
          cache_control: CACHE_5M,
        },
      ],
    },
    {
      role: "assistant",
      content:
        "Got it — I have the customer's current Memory loaded. Ready to help.",
    },
    ...args.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  return client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: CACHE_1H,
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT_FOR_CHAT },
    messages,
  });
}
