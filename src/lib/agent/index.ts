/**
 * Barrel export for the agent helper library.
 *
 * Phase 0 surface — covers the SDK client, model constants, prompt loader,
 * draft pipeline, and chat streamer. Voice (Whisper), website scrape, and
 * upload classification land in Phase 1.
 *
 * NEVER import from `@/lib/agent` in a Client Component — every module here
 * uses `server-only`.
 */

import "server-only";

export {
  getAnthropic,
  DRAFT_MODEL,
  CHAT_MODEL,
  EFFORT_FOR_DRAFT,
  EFFORT_FOR_CHAT,
  CACHE_1H,
  CACHE_5M,
  type EffortLevel,
} from "./anthropic";

export {
  loadAgentSystemPrompt,
  loadChapterPrinciples,
  loadHighPointPrecedent,
  buildDraftContext,
} from "./prompt";

export { draftChapter, type DraftResult } from "./draft";

export { streamChatEvents, type ChatTurn, type ChatEvent } from "./chat";

export {
  UPDATE_MEMORY_FIELD_TOOL,
  executeUpdateMemoryField,
  type ToolResult,
} from "./tools";
