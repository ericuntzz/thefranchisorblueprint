/**
 * Shared Anthropic SDK client + model constants.
 *
 * Two model tiers:
 *   - DRAFT_MODEL (Claude Opus 4.7, 1M context) — heavy section drafting,
 *     research synthesis, anything where we want the full Memory + Jason's
 *     playbooks + High Point precedent in context simultaneously.
 *   - CHAT_MODEL  (Claude Sonnet 4.6) — fast, cheap conversational turns
 *     in the in-portal chat dock.
 *
 * Both default to adaptive thinking. Effort is tuned per call site: chat
 * uses "medium", drafting uses "high" or "xhigh" depending on section.
 *
 * NEVER import this from a Client Component — the SDK reads
 * ANTHROPIC_API_KEY from the server env.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Add it to .env.local for development and to Vercel project settings for production.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Model IDs. Read from env so we can flip to a newer Opus or experimental
 * model without a code change. Defaults match the locked-in choice from
 * docs/agentic-portal-buildout.md §5.
 */
export const DRAFT_MODEL =
  process.env.ANTHROPIC_MODEL_DRAFT ?? "claude-opus-4-7";
export const CHAT_MODEL =
  process.env.ANTHROPIC_MODEL_CHAT ?? "claude-sonnet-4-6";

/**
 * Effort levels per use case. See `claude-api` skill — "xhigh" is the
 * sweet spot for agentic coding/drafting on Opus 4.7; "medium" is a good
 * default for conversational chat.
 */
export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

export const EFFORT_FOR_DRAFT: EffortLevel = "high";
export const EFFORT_FOR_CHAT: EffortLevel = "medium";

/**
 * Standard cache_control object for prompt caching. Use 1h TTL on stable
 * content (system prompt, Jason's playbooks, High Point precedent) and
 * 5m TTL on volatile-but-reused content (Memory snapshots, conversation
 * history).
 */
export const CACHE_1H = { type: "ephemeral" as const, ttl: "1h" as const };
export const CACHE_5M = { type: "ephemeral" as const };
