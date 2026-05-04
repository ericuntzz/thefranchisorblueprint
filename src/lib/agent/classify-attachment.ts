/**
 * Auto-classify an uploaded document to one or more chapters.
 *
 * The intake flow lands every file at a single primary chapter
 * (Operations step → operating_model, Financials step →
 * unit_economics, etc.). But many real-world docs span multiple
 * chapters — an operations manual covers operating_model AND
 * recipes_and_menu AND vendor_supply_chain AND training_program;
 * a P&L feeds unit_economics AND franchise_economics. Without a
 * classifier, the agent only sees the doc when drafting the
 * primary chapter — every other relevant chapter starts from
 * scratch.
 *
 * This module asks Sonnet (low effort) to read the file's name +
 * the first slice of its extracted text and return a small list of
 * additional chapter slugs the file is likely useful for. The
 * intake route attaches the doc to each returned slug so it
 * becomes available across the whole Blueprint.
 *
 * Best-effort by design. If Sonnet can't classify, returns []
 * (the primary attachment still lands; we just don't fan out).
 * Cap at 4 additional chapters so we don't flood every chapter
 * with the same generic "About Us" PDF.
 */

import "server-only";
import { CACHE_5M, CHAT_MODEL, getAnthropic } from "./anthropic";
import {
  isValidMemoryFileSlug,
  MEMORY_FILES,
  MEMORY_FILE_TITLES,
  type MemoryFileSlug,
} from "@/lib/memory/files";

const MAX_ADDITIONAL_SLUGS = 4;

/** Brief description of each chapter — fed to Sonnet so it can
 *  match the doc against the right ones. Mirrors the compilesInto
 *  framing customers see in the chapter hero. */
const CHAPTER_SUMMARIES: Record<MemoryFileSlug, string> = {
  business_overview:
    "What the business does, founder story, locations, industry — the FDD Item 1 / Operations Manual §1 opening.",
  brand_voice:
    "Brand standards: name, tagline, voice, colors, typography, logo, things to avoid.",
  competitor_landscape:
    "Direct + indirect competitors, market positioning, SWOT analysis.",
  market_strategy:
    "Marketing plan, audience targeting, channel strategy, go-to-market.",
  unit_economics:
    "P&L, COGS percentages, AUV, EBITDA margin, payback period, cost structure.",
  franchise_economics:
    "Initial franchise fee, royalty rate, ad fund %, term lengths, FDD Items 5/6/7 inputs.",
  operating_model:
    "How a single location runs day-to-day — hours, staffing, opening/closing procedures.",
  recipes_and_menu:
    "Menu, product catalog, recipe specs, food/beverage costs (for food concepts).",
  vendor_supply_chain:
    "Approved supplier list, supply chain governance, vendor relationships.",
  training_program:
    "Initial training duration, training curriculum, ongoing training cadence, certification.",
  employee_handbook:
    "HR policies, code of conduct, PTO, employment standards franchisees inherit.",
  franchisee_profile:
    "Ideal franchisee profile, applicant scorecard, financial qualifications.",
  territory_real_estate:
    "Site selection criteria, territorial protection, real estate playbook.",
  marketing_fund:
    "Marketing fund / ad fund governance, contribution rates, spend reports.",
  compliance_legal:
    "Legal posture, FDD content, attorney correspondence, state registrations.",
  reimbursement_policy:
    "What franchisees can claim, expense rules, approved-purchases list.",
};

/**
 * Classify an attachment to additional chapters beyond its
 * primary slug. Returns an array of MemoryFileSlugs (excluding
 * the primary). Empty array on classifier failure or when no
 * additional chapters apply.
 */
export async function classifyAttachmentToChapters(args: {
  primarySlug: MemoryFileSlug;
  fileName: string;
  /** Best-effort excerpt of the file content. May be a placeholder
   *  string for opaque files — the classifier still tries to use
   *  the filename in that case. */
  excerpt: string | null;
}): Promise<MemoryFileSlug[]> {
  // No content to reason from + the filename is ambiguous → skip.
  // (Technically Sonnet could still guess from the filename alone,
  // but classification on filename-only is noisy.)
  const hasContent = !!args.excerpt && args.excerpt.length >= 200;
  if (!hasContent) return [];

  const candidateSlugs = MEMORY_FILES.filter((s) => s !== args.primarySlug);
  const candidateBlock = candidateSlugs
    .map(
      (s) =>
        `- ${s} ("${MEMORY_FILE_TITLES[s]}"): ${CHAPTER_SUMMARIES[s] ?? ""}`,
    )
    .join("\n");

  const prompt = `You're classifying a customer-uploaded business document. The document has been routed to one primary chapter already (${args.primarySlug}: "${MEMORY_FILE_TITLES[args.primarySlug]}"). Your job is to identify which OTHER chapters this document is also useful for, so the customer's agent can read the same file when drafting those chapters.

Rules:
- Return ONLY chapters where the document directly contains relevant facts. Skip "tangentially related" — better to be conservative.
- Return at most ${MAX_ADDITIONAL_SLUGS} additional chapters.
- Skip chapters where the document overlap is generic (every business has "a vendor list" mentioned in their ops manual; that doesn't mean an ops manual classifies as vendor_supply_chain unless it actually lists suppliers).
- DO NOT include the primary chapter (${args.primarySlug}) in your response — it's already attached there.

Available chapters (slug, title, what it's about):
${candidateBlock}

Document:
- Filename: ${args.fileName}
- Content excerpt:
${args.excerpt}

Output a single JSON array of chapter slugs (strings). No prose, no markdown fence. If no additional chapters apply, output []. Examples:
- ["recipes_and_menu", "training_program"]
- []
- ["franchise_economics"]`;

  let response;
  try {
    const client = getAnthropic();
    response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 256,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
              cache_control: CACHE_5M,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.warn(
      "[classify-attachment] API call failed — falling back to no additional chapters:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Find the first balanced JSON array. Tolerant of code-fence
  // wrappers and stray prose.
  const parsed = parseJsonArray(text);
  if (!Array.isArray(parsed)) {
    console.warn(
      "[classify-attachment] No parseable JSON array; raw:",
      text.slice(0, 200),
    );
    return [];
  }

  const out: MemoryFileSlug[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    if (!isValidMemoryFileSlug(item)) continue;
    if (item === args.primarySlug) continue;
    if (out.includes(item)) continue;
    out.push(item);
    if (out.length >= MAX_ADDITIONAL_SLUGS) break;
  }
  return out;
}

function parseJsonArray(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("[");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
