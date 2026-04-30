/**
 * Loads the Jason agent's system prompt and per-chapter principles files
 * from `docs/`. The markdown is the source of truth — Eric and Jason edit
 * those files, the agent picks up changes on the next request, no rebuild
 * needed beyond a deploy.
 *
 * The prompt is loaded once per server process and cached in memory.
 * Reload requires a deploy (Vercel cold-start picks up the new content
 * naturally).
 */

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const SYSTEM_PROMPT_PATH = path.join(DOCS_DIR, "jason-agent-prompt.md");
const PRINCIPLES_DIR = path.join(DOCS_DIR, "jason-principles");
const PRECEDENT_DIR = path.join(DOCS_DIR, "high-point-chapters");

let _systemPrompt: string | null = null;

/**
 * Load the global Jason system prompt (`docs/jason-agent-prompt.md`).
 * Cached after the first read.
 */
export async function loadAgentSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  try {
    _systemPrompt = await fs.readFile(SYSTEM_PROMPT_PATH, "utf8");
    return _systemPrompt;
  } catch (err) {
    console.error(
      "[agent/prompt] Failed to load jason-agent-prompt.md — falling back to a stub. Eric, this should not happen in production.",
      err,
    );
    return "You are Jason, a 30-year franchise consultant. (System prompt failed to load.)";
  }
}

/**
 * Load Jason's per-chapter principles (`docs/jason-principles/<slug>.md`).
 * These come from transcribed videos Jason records explaining each chapter.
 * Returns null if the file doesn't exist yet — the agent operates on the
 * global prompt + High Point precedent alone in that case.
 */
export async function loadChapterPrinciples(
  slug: string,
): Promise<string | null> {
  const filePath = path.join(PRINCIPLES_DIR, `${slug}.md`);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null; // expected — many chapters won't have principles recorded yet
  }
}

/**
 * Load the High Point precedent chapter for `slug`. Returns null when no
 * precedent exists for that chapter (e.g. brand-new chapter we're adding
 * outside the High Point bundle).
 *
 * Curated subset of the High Point bundle, structured as the canonical
 * "good" example for that chapter. The agent uses these as few-shot
 * examples to anchor the quality bar.
 */
export async function loadHighPointPrecedent(
  slug: string,
): Promise<string | null> {
  const filePath = path.join(PRECEDENT_DIR, `${slug}.md`);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Build the full context for a chapter draft request: system prompt,
 * Jason's principles for this chapter, and High Point precedent. Joined
 * with stable separators so the prompt-cache prefix is deterministic.
 *
 * Order is important — anything that changes invalidates the cache from
 * that point forward. Most-stable first.
 */
export async function buildDraftContext(slug: string): Promise<{
  systemPrompt: string;
  /** Combined precedent + principles, ready to drop into a user message. */
  groundingMessage: string | null;
}> {
  const [systemPrompt, principles, precedent] = await Promise.all([
    loadAgentSystemPrompt(),
    loadChapterPrinciples(slug),
    loadHighPointPrecedent(slug),
  ]);

  const groundingParts: string[] = [];
  if (precedent) {
    groundingParts.push(
      `<high_point_precedent slug="${slug}">\nThe canonical "good" example for this chapter, drawn from a real customer (High Point Coffee) who completed the program. Use this to calibrate depth, structure, and quality bar — DO NOT copy specifics.\n\n${precedent}\n</high_point_precedent>`,
    );
  }
  if (principles) {
    groundingParts.push(
      `<jason_principles slug="${slug}">\nJason's recorded guidance on this chapter (transcribed from his per-chapter video). These are how Jason thinks about this domain.\n\n${principles}\n</jason_principles>`,
    );
  }

  const groundingMessage =
    groundingParts.length > 0 ? groundingParts.join("\n\n") : null;

  return { systemPrompt, groundingMessage };
}
