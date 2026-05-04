/**
 * In-portal chat assistant — Claude Sonnet 4.6 with adaptive thinking,
 * Memory-aware context, streaming, AND tool use.
 *
 * The chat dock at the bottom-right of every portal page calls into here.
 * It's much shorter and cheaper per turn than the drafting pipeline:
 * we want sub-second time-to-first-token, conversational tone, and the
 * ability to reference any Memory chapter the customer has built up.
 *
 * Tool use (v1.5b): Jason can call `update_memory_field` mid-conversation
 * to write structured-field changes the moment a customer states a fact.
 * The streamed event protocol is NDJSON — one typed event per line — so
 * the client can interleave text deltas with "tool_call / tool_result"
 * cards inside the visible assistant bubble.
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
import {
  executeUpdateMemoryField,
  UPDATE_MEMORY_FIELD_TOOL,
  type ToolResult,
} from "./tools";

/**
 * Conversation history we accept from the client. Plain text only —
 * the wire format up from the client is still text, but the wire
 * format DOWN from the server is now NDJSON ChatEvents.
 */
export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Typed events the streamer yields. The route serializes each one as
 * one JSON line on the response body; the client splits on newlines
 * and parses them.
 *
 * Why a typed envelope instead of raw text-only:
 *   - Tool calls need to be visible to the customer ("✓ Updated X").
 *   - Errors should be styled differently from prose.
 *   - The client needs a "done" signal so it can flush the in-flight
 *     bubble into history without keeping the cursor blinking.
 */
export type ChatEvent =
  | { type: "text"; delta: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      id: string;
      ok: boolean;
      summary: string;
      detail?: ToolResult["detail"];
    }
  | { type: "done" }
  | { type: "error"; message: string };

/** Hard cap on tool-use loop iterations per chat turn. The model
 *  shouldn't ever need more than a few — anything higher means it's
 *  in a runaway loop and we should bail rather than burn tokens. */
const MAX_TOOL_ROUNDS = 6;

/**
 * Chat-mode style addendum. The base system prompt is tuned for
 * drafting chapter-quality long-form output; in the chat dock that
 * register is way too verbose and reads as condescending. This
 * second system block tells Jason to talk like a senior advisor
 * over Slack: tight, plain, no preamble, no recap, no bullet
 * dumps unless asked.
 *
 * Kept as a SEPARATE system text block (no cache_control) so the
 * primary prompt cache prefix above stays intact — only this
 * addendum gets re-sent on every chat turn.
 */
const CHAT_STYLE_DIRECTIVE = `
<chat_mode>
You're in the in-portal chat dock right now, not drafting a chapter. The customer reads your reply between other things — they don't want a polished essay, they want the answer.

Style rules for chat:
- Default to 1–3 sentences. Stretch only when the question genuinely needs the air.
- No preamble. No "Great question." No "Let me think about this." No restating what they asked. Open on the answer.
- No recap of what's already in the conversation. They were there.
- No bullet lists unless the answer is genuinely a list of 3+ peer items the customer needs to scan. Prefer prose.
- No headings. No bold-faced section titles. Inline emphasis (one or two **bolded** phrases per turn) is fine when it actually helps a fast read; don't bold every other word.
- Markdown renders properly in this dock — \`**bold**\`, \`*italic*\`, \`\`code\`\`, \`[links](url)\`, and \`-\` lists all display the way you'd expect. Use them sparingly.
- Numbers, dollar amounts, percentages — always inline, never in a table.
- If the customer asks "should I…?" give an opinion and one reason. Don't enumerate considerations.
- If you need information you don't have, ask one focused question — not a discovery checklist.

When you DO need to be longer (e.g. explaining FDD Item 19 the first time, or walking through their specific unit economics), still cut every sentence that doesn't advance the answer.
</chat_mode>`.trim();

/**
 * Run a single chat turn end-to-end, yielding ChatEvents as they arrive.
 *
 * Tool-use loop:
 *   1. Stream the model's response.
 *   2. Forward text deltas to the caller as `text` events.
 *   3. After the stream completes, if `stop_reason === "tool_use"`,
 *      execute every tool_use block, yield `tool_call` + `tool_result`
 *      events for each, append the assistant + tool_result messages
 *      to the conversation, and stream again.
 *   4. Loop until the model emits a non-tool_use stop_reason.
 *
 * We hard-cap the loop at MAX_TOOL_ROUNDS so a misbehaving model can't
 * run up an unbounded bill.
 */
export async function* streamChatEvents(args: {
  userId: string;
  /** Full conversation history (oldest → newest). Last turn must be user. */
  history: ChatTurn[];
  /** Free-form context about what page the customer is on. */
  pageContext?: string;
}): AsyncGenerator<ChatEvent> {
  if (args.history.length === 0) {
    yield {
      type: "error",
      message: "streamChatEvents requires at least one user message in history",
    };
    return;
  }
  if (args.history[args.history.length - 1].role !== "user") {
    yield {
      type: "error",
      message: "streamChatEvents: last history turn must be from 'user'",
    };
    return;
  }

  const [systemPrompt, memorySnapshot] = await Promise.all([
    loadAgentSystemPrompt(),
    getMemorySnapshotForPrompt(args.userId),
  ]);

  const client = getAnthropic();

  // Inject the Memory snapshot + page context as a synthetic first
  // user turn with a synthetic assistant ack — that way the actual
  // user history flows naturally afterward and the snapshot sits in
  // the cacheable prefix. The cache breakpoint is on the snapshot
  // itself; subsequent turns within the same chat session share it.
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

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let stream;
    try {
      stream = client.messages.stream({
        model: CHAT_MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: CACHE_1H,
          },
          // Chat brevity addendum — uncached so we can tune it
          // without invalidating the big system-prompt cache.
          {
            type: "text",
            text: CHAT_STYLE_DIRECTIVE,
          },
        ],
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT_FOR_CHAT },
        tools: [UPDATE_MEMORY_FIELD_TOOL],
        messages,
      });
    } catch (err) {
      yield {
        type: "error",
        message: err instanceof Error ? err.message : "stream init failed",
      };
      return;
    }

    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", delta: event.delta.text };
        }
        // input_json_delta events are how the SDK streams tool input
        // as it comes in. We don't forward them — we wait for the
        // final message which has the parsed input. The customer-
        // facing card is "Jason updated X = Y", not the
        // intermediate tokens of the JSON.
      }
    } catch (err) {
      yield {
        type: "error",
        message: err instanceof Error ? err.message : "stream error",
      };
      return;
    }

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use") {
      // Normal end of turn — model is done talking.
      yield { type: "done" };
      return;
    }

    // Append the assistant turn (which includes the tool_use blocks)
    // verbatim so the next round sees the full context.
    messages.push({
      role: "assistant",
      content: final.content,
    });

    // Execute every tool_use in the assistant's response. The
    // Anthropic API allows multiple tool calls per turn (Claude can
    // batch e.g. three field updates from one customer message),
    // and we honor that by running them sequentially and collecting
    // tool_result content blocks for the next user turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      yield {
        type: "tool_call",
        id: block.id,
        name: block.name,
        input: block.input,
      };

      let result: ToolResult;
      if (block.name === "update_memory_field") {
        result = await executeUpdateMemoryField({
          userId: args.userId,
          input: block.input,
        });
      } else {
        result = {
          ok: false,
          summary: `Unknown tool: ${block.name}. Available tools: update_memory_field.`,
        };
      }

      yield {
        type: "tool_result",
        id: block.id,
        ok: result.ok,
        summary: result.summary,
        detail: result.detail,
      };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.summary,
        is_error: !result.ok,
      });
    }

    if (toolResults.length === 0) {
      // Defensive: stop_reason was tool_use but no tool_use blocks
      // appeared. Avoid an infinite loop.
      yield { type: "done" };
      return;
    }

    messages.push({
      role: "user",
      content: toolResults,
    });

    // Loop — re-stream so the model can react to the tool results.
  }

  // Hit the hard cap — emit a friendly note and bail.
  yield {
    type: "error",
    message: `Hit the tool-use loop cap (${MAX_TOOL_ROUNDS}). Bailing — Jason was probably stuck in a retry loop.`,
  };
}
