/**
 * Chapter draft pipeline.
 *
 * Single entry point: `draftChapter()`. Loads the customer's Memory,
 * Jason's principles, and the High Point precedent for the requested
 * chapter; calls Claude Opus 4.7 with adaptive thinking; returns the
 * drafted markdown with provenance entries the caller can persist.
 *
 * Streaming variant for when we want to surface progress in the UI live.
 */

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  CACHE_1H,
  CACHE_5M,
  DRAFT_MODEL,
  EFFORT_FOR_DRAFT,
  type EffortLevel,
  getAnthropic,
} from "./anthropic";
import { buildDraftContext } from "./prompt";
import {
  type MemoryFileSlug,
  MEMORY_FILE_TITLES,
} from "@/lib/memory/files";
import {
  getMemorySnapshotForPrompt,
  type ProvenanceEntry,
} from "@/lib/memory";

export type DraftResult = {
  /** The drafted markdown (with embedded `<!-- claim:X -->` anchors). */
  contentMd: string;
  /** Per-claim provenance the caller persists into customer_memory_provenance. */
  provenance: ProvenanceEntry[];
  /** Token usage for cost tracking. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
};

/**
 * Draft (or redraft) a chapter for a specific customer.
 *
 * The agent reads:
 *   - The global Jason system prompt
 *   - Jason's per-chapter principles (if recorded)
 *   - The High Point precedent for this chapter (if curated)
 *   - The customer's full Memory snapshot
 *   - The caller's specific instruction (e.g. "draft based on what we have"
 *     or "redraft incorporating these new facts...")
 *
 * Returns the drafted markdown with claim anchors AND a list of provenance
 * entries the caller persists alongside.
 */
export async function draftChapter(args: {
  userId: string;
  slug: MemoryFileSlug;
  /** Free-form instruction for this draft pass. */
  instruction: string;
  /** Override the default effort level (e.g. "max" for a critical chapter). */
  effort?: EffortLevel;
}): Promise<DraftResult> {
  const { userId, slug, instruction } = args;
  const effort = args.effort ?? EFFORT_FOR_DRAFT;

  const [{ systemPrompt, groundingMessage }, memorySnapshot] = await Promise.all([
    buildDraftContext(slug),
    getMemorySnapshotForPrompt(userId),
  ]);

  const chapterTitle = MEMORY_FILE_TITLES[slug];
  const client = getAnthropic();

  // Render order is: tools → system → messages. We have no tools here,
  // so the cache prefix is system + (early) messages.
  // - System prompt: cached 1h (stable across all drafts for all customers
  //   on this deploy).
  // - Grounding message (precedent + principles): cached 1h (stable
  //   per-chapter across all customers).
  // - Memory snapshot: cached 5m (stable per-customer across drafts in
  //   the same session).
  // - Instruction: NOT cached (volatile by definition).
  const messages: Anthropic.MessageParam[] = [];

  if (groundingMessage) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: groundingMessage,
          cache_control: CACHE_1H,
        },
      ],
    });
    messages.push({
      role: "assistant",
      content:
        "Understood. I have the precedent and principles loaded. What's the customer's situation?",
    });
  }

  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: `<customer_memory>\nEverything I currently know about the customer's business, organized by chapter. Some chapters are empty — that's where there are gaps to fill.\n\n${memorySnapshot}\n</customer_memory>`,
        cache_control: CACHE_5M,
      },
      {
        type: "text",
        text: `Now draft the **${chapterTitle}** (\`${slug}\`) chapter.\n\nDrafting instruction:\n${instruction}\n\nFormat requirements:\n- Output the chapter as polished markdown.\n- Embed claim anchors as HTML comments: \`<!-- claim:short-id -->\` immediately before each meaningfully sourced paragraph or numeric assertion. Keep the IDs short and unique within the chapter.\n- After the chapter body, output a fenced \`\`\`json block named \`provenance\` containing an array of objects of the form: \`{ "claim_id": "...", "source_type": "voice_session|upload|form|agent_inference|jason_playbook|research|assessment|scraper", "source_ref": "...", "source_excerpt": "..." }\`. One entry per claim_id used in the chapter. Use \`agent_inference\` for any claim derived from other Memory content vs. directly stated by the customer.\n- Where you don't have enough information, leave a clearly marked \`[NEEDS INPUT: short description]\` block — don't fabricate.\n\nDraft the chapter now.`,
      },
    ],
  });

  const response = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    thinking: { type: "adaptive" },
    output_config: { effort },
    messages,
  });

  // Pull out the text content. Adaptive thinking on Opus 4.7 returns
  // thinking blocks (display: omitted by default) — we ignore those and
  // grab just the text blocks.
  const textBlocks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text);
  const fullText = textBlocks.join("\n");

  // Parse the markdown body and the trailing ```json provenance block.
  const { contentMd, provenance } = parseDraftWithProvenance(fullText);

  return {
    contentMd,
    provenance,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Pull the chapter markdown and the trailing JSON provenance block apart.
 *
 * Format we instructed the agent to produce:
 *
 *   <chapter markdown body...>
 *
 *   ```json
 *   provenance
 *   [
 *     { "claim_id": "...", "source_type": "...", "source_ref": "...", "source_excerpt": "..." },
 *     ...
 *   ]
 *   ```
 *
 * In practice the model sometimes labels the fence as just `json` (no
 * `provenance` line) — we accept both.
 */
function parseDraftWithProvenance(text: string): {
  contentMd: string;
  provenance: ProvenanceEntry[];
} {
  // Match the LAST fenced JSON block — drafts may contain illustrative
  // JSON inside the chapter body, but the provenance block is always
  // last.
  const fenceRegex = /```json(?:\s*provenance)?\s*\n([\s\S]*?)\n```\s*$/i;
  const match = text.match(fenceRegex);

  if (!match) {
    // No provenance block — return the chapter as-is and warn. Caller
    // can decide whether to retry or accept a sourceless draft.
    console.warn(
      "[agent/draft] No trailing JSON provenance block found in draft. Returning empty provenance.",
    );
    return { contentMd: text.trim(), provenance: [] };
  }

  const contentMd = text.slice(0, match.index).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch (err) {
    console.error(
      "[agent/draft] Provenance JSON failed to parse — returning empty:",
      err,
    );
    return { contentMd, provenance: [] };
  }

  if (!Array.isArray(parsed)) {
    console.warn(
      "[agent/draft] Provenance block was not an array — returning empty.",
    );
    return { contentMd, provenance: [] };
  }

  const provenance: ProvenanceEntry[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.claim_id !== "string" || typeof e.source_type !== "string") {
      continue;
    }
    provenance.push({
      claimId: e.claim_id,
      sourceType: e.source_type as ProvenanceEntry["sourceType"],
      sourceRef: typeof e.source_ref === "string" ? e.source_ref : null,
      sourceExcerpt:
        typeof e.source_excerpt === "string" ? e.source_excerpt : null,
    });
  }

  return { contentMd, provenance };
}
