/**
 * Section draft pipeline.
 *
 * Single entry point: `draftSection()`. Loads the customer's Memory,
 * Jason's principles, and the High Point precedent for the requested
 * section; calls Claude Opus 4.7 with adaptive thinking; returns the
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
  readAttachments,
  readMemoryFile,
  type ProvenanceEntry,
} from "@/lib/memory";
import type { SectionAttachment } from "@/lib/supabase/types";
import {
  hasLockedSpans,
  lockedSpansMissing,
  parseLockedSpans,
  spliceMissingLocksBack,
} from "@/lib/memory/locks";
import { extractFieldsFromContent } from "./extract-fields";
import { performSectionResearch } from "./research/preflight";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerMemory } from "@/lib/supabase/types";

type FieldValue = string | number | boolean | string[] | null;

export type DraftResult = {
  /** The drafted markdown (with embedded `<!-- claim:X -->` anchors). */
  contentMd: string;
  /** Per-claim provenance the caller persists into customer_memory_provenance. */
  provenance: ProvenanceEntry[];
  /**
   * Structured field values extracted from the draft. Caller persists
   * via `writeMemoryFields` with source="agent_inference" so the
   * editor's "Edit fields" view is pre-populated with what Opus
   * inferred — never blank when there's a real draft on the page.
   */
  extractedFields: Record<string, FieldValue>;
  /** Token usage for cost tracking. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
};

/**
 * Draft (or redraft) a section for a specific customer.
 *
 * The agent reads:
 *   - The global Jason system prompt
 *   - Jason's per-section principles (if recorded)
 *   - The High Point precedent for this section (if curated)
 *   - The customer's full Memory snapshot
 *   - The caller's specific instruction (e.g. "draft based on what we have"
 *     or "redraft incorporating these new facts...")
 *
 * Returns the drafted markdown with claim anchors AND a list of provenance
 * entries the caller persists alongside.
 */
export async function draftSection(args: {
  userId: string;
  slug: MemoryFileSlug;
  /** Free-form instruction for this draft pass. */
  instruction: string;
  /** Override the default effort level (e.g. "max" for a critical section). */
  effort?: EffortLevel;
  /**
   * Cross-section attachments the customer explicitly opted-in to via
   * the pre-draft modal. Merged with the section's own attachments
   * (de-duped by id) for Opus's prompt. Each entry includes
   * `fromSlug` so the prompt can label "from another section" so Opus
   * knows it's external context, not section-native source material.
   */
  additionalAttachments?: Array<{
    fromSlug: MemoryFileSlug;
    attachment: SectionAttachment;
  }>;
}): Promise<DraftResult> {
  const { userId, slug, instruction } = args;
  const effort = args.effort ?? EFFORT_FOR_DRAFT;

  const [
    { systemPrompt, groundingMessage },
    memorySnapshot,
    existingSection,
    attachments,
    research,
  ] = await Promise.all([
    buildDraftContext(slug),
    getMemorySnapshotForPrompt(userId),
    readMemoryFile(userId, slug),
    readAttachments(userId, slug),
    // Pre-draft research bundle for sections that benefit from
    // external data (market_strategy, competitor_landscape,
    // territory_real_estate). Best-effort; returns empty when
    // env-gated APIs aren't configured.
    runResearchPreflight(userId, slug),
  ]);

  // If the section already has user-locked spans (the customer has
  // hand-edited prose at some point), we MUST preserve them verbatim
  // through the redraft. Build an explicit instruction for Opus and
  // post-validate after the response.
  const previousContent = existingSection?.content_md ?? "";
  const previousLocks = previousContent ? parseLockedSpans(previousContent) : [];
  const lockPreservationInstruction =
    previousLocks.length > 0
      ? buildLockPreservationInstruction(previousContent, previousLocks)
      : null;

  const sectionTitle = MEMORY_FILE_TITLES[slug];
  const client = getAnthropic();

  // Render order is: tools → system → messages. We have no tools here,
  // so the cache prefix is system + (early) messages.
  // - System prompt: cached 1h (stable across all drafts for all customers
  //   on this deploy).
  // - Grounding message (precedent + principles): cached 1h (stable
  //   per-section across all customers).
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
        text: `<customer_memory>\nEverything I currently know about the customer's business, organized by section. Some sections are empty — that's where there are gaps to fill.\n\n${memorySnapshot}\n</customer_memory>`,
        cache_control: CACHE_5M,
      },
      ...(research.markdown
        ? ([
            {
              type: "text" as const,
              text: `<research>\nLive external data gathered for this section. Cite any claim derived from this block with \`source_type: "research"\` and put the tool used (Tavily / Google Places / Census) in \`source_ref\`. Don't restate research data verbatim — synthesize and credit.\n\n${research.markdown}\n</research>`,
            },
          ] as const)
        : []),
      {
        type: "text",
        text: `Now draft the **${sectionTitle}** (\`${slug}\`) section.\n\nDrafting instruction:\n${instruction}${lockPreservationInstruction ? `\n\n${lockPreservationInstruction}` : ""}${(() => {
          // Merge section-native attachments (always-on) with any
          // cross-section attachments the customer explicitly opted
          // into via the pre-draft modal. De-dupe by id in case an
          // attachment is somehow listed in both buckets.
          const merged: Array<{
            attachment: SectionAttachment;
            fromSlug: MemoryFileSlug | null;
          }> = attachments.map((a) => ({ attachment: a, fromSlug: null }));
          const seen = new Set(attachments.map((a) => a.id));
          for (const extra of args.additionalAttachments ?? []) {
            if (seen.has(extra.attachment.id)) continue;
            seen.add(extra.attachment.id);
            merged.push({ attachment: extra.attachment, fromSlug: extra.fromSlug });
          }
          return merged.length > 0
            ? `\n\n${formatAttachmentsForPrompt(merged)}`
            : "";
        })()}\n\nFormat requirements:\n- Output the section as polished markdown.\n- Embed claim anchors as HTML comments: \`<!-- claim:short-id -->\` immediately before each meaningfully sourced paragraph or numeric assertion. Keep the IDs short and unique within the section.\n- After the section body, output a fenced \`\`\`json block named \`provenance\` containing an array of objects of the form: \`{ "claim_id": "...", "source_type": "voice_session|upload|form|agent_inference|jason_playbook|research|assessment|scraper", "source_ref": "...", "source_excerpt": "..." }\`. One entry per claim_id used in the section. Use \`agent_inference\` for any claim derived from other Memory content vs. directly stated by the customer.\n- Where you don't have enough information, leave a clearly marked \`[NEEDS INPUT: short description]\` block — don't fabricate.\n\nDraft the section now.`,
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
  const parsed = parseDraftWithProvenance(fullText);
  let contentMd = parsed.contentMd;
  const provenance = parsed.provenance;

  // Post-validate: every user-locked span from the prior version must
  // exist verbatim in the redraft. If Opus dropped any (it sometimes
  // happens despite the explicit instruction), splice them back in
  // under a "Restored from your prior edits" footer rather than
  // silently losing the customer's words.
  if (previousLocks.length > 0) {
    const missing = lockedSpansMissing(previousContent, contentMd);
    if (missing.length > 0) {
      console.warn(
        `[agent/draft] Opus dropped ${missing.length} user-locked span(s) on redraft of ${slug}; splicing them back.`,
        { ids: missing.map((s) => s.id) },
      );
      contentMd = spliceMissingLocksBack(contentMd, missing);
    }
  }

  // Extract structured field values from the freshly-drafted content
  // so the editor's "Edit fields" view shows what Opus inferred. Best-
  // effort: extraction failure is logged but doesn't fail the draft.
  let extractedFields: Record<string, FieldValue> = {};
  try {
    extractedFields = await extractFieldsFromContent({
      slug,
      content: contentMd,
    });
  } catch (err) {
    console.error(
      `[agent/draft] field extraction failed for ${slug} (non-fatal):`,
      err instanceof Error ? err.message : err,
    );
  }

  return {
    contentMd,
    provenance,
    extractedFields,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Pull the section markdown and the trailing JSON provenance block apart.
 *
 * Format we instructed the agent to produce:
 *
 *   <section markdown body...>
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
  // JSON inside the section body, but the provenance block is always
  // last.
  const fenceRegex = /```json(?:\s*provenance)?\s*\n([\s\S]*?)\n```\s*$/i;
  const match = text.match(fenceRegex);

  if (!match) {
    // No JSON block — fall back to extracting any <!-- claim:X --> anchors
    // the model embedded inline. Each anchor becomes a stub provenance row
    // with source_type=agent_inference; the customer still sees a "show
    // provenance" button and the audit trail lists what the model thought
    // was a meaningful claim, even if the source attribution is generic.
    // This is the v1 tradeoff: the model sometimes forgets the JSON block
    // when it's deep in drafting prose; the embedded anchors are easier
    // for it to remember.
    console.warn(
      "[agent/draft] No trailing JSON provenance block — falling back to anchor extraction.",
    );
    const anchorRe = /<!--\s*claim:([^\s>-][^>]*?)\s*-->/g;
    const seen = new Set<string>();
    const provenance: ProvenanceEntry[] = [];
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(text)) !== null) {
      const claimId = m[1].trim();
      if (!claimId || seen.has(claimId)) continue;
      seen.add(claimId);
      provenance.push({
        claimId,
        sourceType: "agent_inference",
        sourceRef: null,
        sourceExcerpt: null,
      });
    }
    return { contentMd: text.trim(), provenance };
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

/**
 * Render the customer-attached references (files + links) into a prompt
 * block. Includes the label, kind, source ref, and the excerpt the
 * uploader pipeline captured (text-file content, scraped link text, or
 * a placeholder for opaque files like PDFs we don't yet parse).
 *
 * The block is wrapped in <section_attachments> so Opus sees it as
 * structured input distinct from Memory. This is what powers the "I
 * uploaded our training manual — use it when drafting" workflow.
 */
function formatAttachmentsForPrompt(
  attachments: Array<{
    attachment: SectionAttachment;
    fromSlug: MemoryFileSlug | null;
  }>,
): string {
  const blocks = attachments.map(({ attachment: a, fromSlug }, i) => {
    const origin = fromSlug
      ? `  [from ${fromSlug} section]`
      : "";
    const head = `${i + 1}. [${a.kind === "file" ? "FILE" : "LINK"}] ${a.label}${a.kind === "link" ? `  (${a.ref})` : ""}${origin}`;
    const excerpt = a.excerpt
      ? `\n   Excerpt:\n   ${a.excerpt.replace(/\n/g, "\n   ")}`
      : "";
    return `${head}${excerpt}`;
  });
  return `<section_attachments>
The customer has attached ${attachments.length} reference${attachments.length === 1 ? "" : "s"} for this draft. Items marked "from <slug> section" were pulled in by the customer as additional context. Use them as primary source material when relevant.

${blocks.join("\n\n")}
</section_attachments>`;
}

/**
 * Build the prompt fragment that tells Opus how to handle existing
 * user-locked spans on a redraft. Inlines the prior section content so
 * the model sees both the locked text it must preserve AND the
 * surrounding agent prose it can rewrite.
 *
 * Why so explicit: the marker convention is unusual, and Opus's
 * default instinct on a "redraft this section" prompt is to rewrite
 * everything. Without an unambiguous instruction it will paraphrase
 * the customer's words. We post-validate as a safety net, but the
 * goal is to never need the splice.
 */
function buildLockPreservationInstruction(
  previousContent: string,
  locks: Array<{ id: string; text: string }>,
): string {
  const lockSummary = locks
    .map(
      (s, i) =>
        `${i + 1}. id="${s.id}" — ${s.text.slice(0, 140).replace(/\n/g, " ")}${s.text.length > 140 ? "…" : ""}`,
    )
    .join("\n");
  return `<existing_section_with_user_edits>
The customer has hand-edited this section previously. Their exact words are wrapped in HTML-comment markers like:

  <!-- user-locked:abc123 -->
  …customer's words…
  <!-- /user-locked:abc123 -->

There ${locks.length === 1 ? "is" : "are"} ${locks.length} locked span${locks.length === 1 ? "" : "s"} in the existing draft:
${lockSummary}

HARD RULE: Every locked span (markers + content) must appear in your output, byte-for-byte identical to what's below. You may:
  • Rewrite or replace any prose that is NOT inside locked markers.
  • Add new sections before, between, or after locked spans.
  • Move a locked span to a more appropriate place in the section — but the markers and the text inside them stay intact.

You may NOT:
  • Paraphrase, shorten, or expand text inside the markers.
  • Drop any locked span.
  • Modify the marker IDs.

Here is the existing draft with the locked markers shown:

${previousContent}
</existing_section_with_user_edits>`;
}

/**
 * Pre-draft research bundle. Reads every section's structured fields
 * once (the preflight queries depend on cross-section data — e.g.
 * competitor_landscape uses business_overview.first_location_address
 * to anchor the Places search). Returns the markdown block + the
 * source list for provenance hints.
 */
async function runResearchPreflight(
  userId: string,
  slug: MemoryFileSlug,
): Promise<{ markdown: string; sourcesUsed: string[] }> {
  // Skip the round-trip for sections without any preflight queries.
  if (
    slug !== "market_strategy" &&
    slug !== "competitor_landscape" &&
    slug !== "territory_real_estate"
  ) {
    return { markdown: "", sourcesUsed: [] };
  }
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("customer_memory")
      .select("file_slug, fields")
      .eq("user_id", userId);
    const fieldsBySlug: Partial<Record<MemoryFileSlug, Record<string, unknown>>> = {};
    for (const row of (data ?? []) as Pick<CustomerMemory, "file_slug" | "fields">[]) {
      fieldsBySlug[row.file_slug as MemoryFileSlug] = (row.fields ?? {}) as Record<
        string,
        unknown
      >;
    }
    const result = await performSectionResearch({ slug, fieldsBySlug });
    return result;
  } catch (err) {
    console.warn(
      "[draft] research preflight failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
    return { markdown: "", sourcesUsed: [] };
  }
}
