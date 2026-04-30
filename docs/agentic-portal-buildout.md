# The Franchisor Blueprint — Agentic Portal Buildout

> **Status: Phase 0 in progress.** This is the single source of truth for the multi-month rebuild that turns the customer portal from "view 9 PDF templates" into "an AI agent that ingests your business and produces an attorney-ready Franchisor Blueprint." If context is ever lost, read this file first.

---

## 1. Vision & North Star

**What TFB sells in this world:** *"A living Franchisor Blueprint that compiles itself from your business and exports as the deliverables an attorney needs."* Not a course. Not 9 PDFs. One document that grows section by section as the customer feeds it information through voice, document upload, and conversational chat with the in-product Jason agent.

**What the agent replaces:** Today, Jason and his team interview the customer, the customer fills out worksheets, and Jason's team manually researches the market, drafts polished prose, and assembles the deliverable bundle (see `/Users/fin/My Drive/The Franchisor Blueprint/High Point Coffee/` for the canonical example output). The agent replaces that entire back-of-house workflow. Jason's involvement at higher tiers becomes review/refinement, not from-scratch authoring.

**Tier differentiation in this world:**
- **Tier 1 ($3K)** — Agent does it end-to-end. Customer ships the bundle to their attorney. Light human review on legal-sensitive sections.
- **Tier 2 ($8.5K)** — Agent draft + Jason redlines key sections + 4–24 coaching calls.
- **Tier 3 ($29.5K)** — Agent + Jason's team customizes everything + done-with-you build + first-franchisee assist.

**Strategic consequence:** Tier 1 becomes a real, profitable product. Today's manual fulfillment cost likely exceeds the $3K price; an AI-driven Tier 1 transforms the unit economics.

---

## 2. The 14–16 deliverables

Today TFB ships 9 capabilities. The High Point Coffee bundle has 16 documents. The new system should produce **all of them**, as projections of one shared Memory:

**Currently in the 9-capability registry** (`src/lib/capabilities.ts`):
1. Audit Your Business (checklist)
2. Model Your Unit Economics (FDD Items 7/19)
3. Build Your 12-Month Roadmap (Gantt)
4. Codify Your Operations (17-chapter Operations Manual)
5. Decode the FDD (23 items)
6. Train Your Team to Replicate ⚠️ *no content yet — natural v1 surface*
7. Score Real Estate Like a Franchisor
8. Qualify Every Candidate (scoring matrix)
9. Close Discovery Day (29-slide deck)

**In High Point but not in the 9** (Phase 3+ additions, Jason-blessed before shipping):
10. Marketing Fund Manual (ad-fund governance)
11. Reimbursement Policy
12. Employee Handbook
13. Site Selection / Build-Out Manual (separate from Score)
14. Site Broker Scorecard / Market-entry strategy
15. Utah-style Market Strategy Report (research-heavy)
16. Competitor Maps Appendix (research-heavy)

The data behind all of these clusters into 5 foundational data shapes (see §4 — Memory schema).

---

## 3. Architecture overview

```
┌───────────────────────────────────────────────────────────────┐
│  Customer (browser)                                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  /portal — single-document Blueprint canvas              │ │
│  │  Bottom-right Jason chat dock (streaming, memory-aware)  │ │
│  │  Voice intake (MediaRecorder → Whisper → transcript)     │ │
│  │  Drop-anything upload zone                               │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js server (App Router, Node runtime)                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  src/lib/agent/                                        │   │
│  │    anthropic.ts   ← shared SDK client + caching        │   │
│  │    draft.ts       ← chapter draft pipeline (Opus 4.7)  │   │
│  │    chat.ts        ← in-portal chat (Sonnet 4.6)        │   │
│  │    prompt.ts      ← loads jason-agent-prompt.md        │   │
│  │    voice.ts       ← Whisper transcription              │   │
│  │    scrape.ts      ← website-scrape pre-fill            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  src/lib/memory/                                       │   │
│  │    index.ts       ← CRUD over customer_memory          │   │
│  │    files.ts       ← canonical file slugs (constants)   │   │
│  │    provenance.ts  ← claim tracking                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Storage + RLS)                          │
│                                                                │
│  Tables (new in 0010):                                         │
│    customer_memory             ← per-user file directory       │
│    customer_memory_provenance  ← per-claim audit trail         │
│                                                                │
│  Storage buckets (new):                                        │
│    customer-uploads/{user_id}/voice/*.mp3                      │
│    customer-uploads/{user_id}/voice/*.transcript.json          │
│    customer-uploads/{user_id}/docs/*                           │
│                                                                │
│  Existing (untouched):                                         │
│    profiles (gains: website_url)                               │
│    purchases, capability_progress, coaching_sessions,          │
│    upgrade_offers, assessment_*, contact_submissions,          │
│    newsletter_subscribers, scheduled_emails                    │
└──────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Anthropic API                                                 │
│    Claude Opus 4.7 (1M ctx)  — heavy drafts, full chapters     │
│    Claude Sonnet 4.6         — chat, classification            │
│    Whisper API               — voice transcription             │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. The Memory schema (the spine)

### Core principle

**The deliverable IS the memory.** Each customer has a directory of markdown-ish files keyed to chapters of the Blueprint. Each file is *simultaneously* the agent's source of truth for that domain AND the draft of that chapter that compiles into the export bundle. No hidden user model. No JSON blob the customer can't read.

This pattern is borrowed from the Cline / Cursor "memory bank" convention and Anthropic's released `memory_20250818` tool — both are file-based directories with view/create/update/delete operations.

### Tables (migration 0010)

```sql
-- Per-user directory of structured business knowledge.
-- Each row is one "file" the agent reads and writes.
public.customer_memory
  user_id          uuid        FK auth.users
  file_slug        text        e.g. "business_overview", "unit_economics"
  content_md       text        markdown — both the agent's memory AND a draft chapter
  confidence       text        "verified" | "inferred" | "draft"
  last_updated_by  text        "agent" | "user" | "jason" | "scraper"
  created_at       timestamptz
  updated_at       timestamptz
  PRIMARY KEY (user_id, file_slug)

-- Per-claim audit trail. Every assertion in every file points back to its source.
-- Read by the on-hover provenance UI.
public.customer_memory_provenance
  id               uuid        PK
  user_id          uuid        FK auth.users
  file_slug        text
  claim_id         text        anchor inside the markdown, e.g. "para-3"
  source_type      text        see below
  source_ref       text        URL or storage path
  source_excerpt   text        the actual quote/line from source
  created_at       timestamptz
  INDEX (user_id, file_slug)

-- source_type values:
--   "voice_session"   — customer voice intake transcript
--   "upload"          — uploaded document
--   "form"            — typed form field
--   "agent_inference" — agent derived from other Memory
--   "jason_playbook"  — Jason's video transcript or written framework
--   "research"        — agent web research / external data
--   "assessment"      — pre-purchase assessment data
--   "scraper"         — website scrape
```

**RLS:** Same pattern as everything else (`auth.uid() = user_id`).

**Storage bucket** (private, RLS by user):
```
customer-uploads/
  {user_id}/
    voice/
      2026-04-29-intake.mp3
      2026-04-29-intake.transcript.json
    docs/
      handbook-2024.pdf
      handbook-2024.parsed.json   ← extracted structure
```

### Canonical file slugs

These map to chapters of the living Blueprint. New chapters are added by appending to the registry — no schema migration needed.

| Slug | Chapter title | Compiles into deliverable(s) |
|---|---|---|
| `business_overview` | Concept & Story | FDD Item 1, Operations Manual §1 |
| `brand_voice` | Brand Standards | Operations Manual §2, Marketing Fund Manual |
| `unit_economics` | Unit Economics & Financial Model | FDD Items 7+19, Financial Model |
| `operating_model` | Daily Operations | Operations Manual §3-12 |
| `recipes_and_menu` | Product / Service Specs | Operations Manual §13 |
| `vendor_supply_chain` | Approved Suppliers | Operations Manual §14 |
| `franchise_economics` | Royalty / Ad Fund / Fees | FDD Items 5+6, Marketing Fund Manual, Franchise Agreement |
| `territory_real_estate` | Site Selection & Territory | Site Selection Guide, FDD Item 12 |
| `training_program` | Training & Certification | Train chapter (currently empty) |
| `franchisee_profile` | Ideal Franchisee | Qualify Matrix, Discovery Day deck |
| `compliance_legal` | FDD Posture & State Strategy | Decode FDD, Franchise Agreement scaffolding |
| `marketing_fund` | Ad Fund Governance | Marketing Fund Manual |
| `employee_handbook` | HR & Employment | Employee Handbook |
| `reimbursement_policy` | Expense Reimbursement | Reimbursement Policy |
| `market_strategy` | Competitive Positioning | Market Strategy Report |
| `competitor_landscape` | Direct/Indirect Competitors | Competitor Maps |

---

## 5. The agent system

### Two model tiers

| Use case | Model | Why |
|---|---|---|
| Heavy chapter drafting | `claude-opus-4-7` | 1M context — fits Jason's playbooks + High Point precedent + customer's full Memory in a single call. Adaptive thinking with `effort: "high"` or `"xhigh"`. |
| In-portal chat assistant | `claude-sonnet-4-6` | Fast, cheap, plenty smart for conversational turns with Memory-aware context. Adaptive thinking with `effort: "medium"`. |
| Voice transcription | OpenAI Whisper (v1) → Deepgram streaming (v2) | Whisper is cheap and trivial to wire up; Deepgram gives Wispr-Flow-quality realtime later. |
| Long-tail upload embedding | Voyage 3 (later phase) | Better retrieval quality than OpenAI's embeddings at similar cost. |

### Aggressive prompt caching

Every agent call structures inputs to maximize prefix reuse. The cache prefix is:

```
[ system: AGENTS.md content + jason_principles_<chapter>.md ]   ← cached, 1h TTL
[ tools: deterministic toolset (sorted by name) ]                ← cached
[ messages: High Point precedent for this chapter ]              ← cached, 1h TTL
[ messages: customer Memory snapshot ]                            ← cached, 5m TTL
[ messages: the actual question/draft request (volatile) ]        ← uncached
```

Top-level `cache_control: { type: "ephemeral", ttl: "1h" }` on `messages.create()` auto-places on the last cacheable block. Verify hits via `usage.cache_read_input_tokens`.

### The system prompt

Lives at `docs/jason-agent-prompt.md` — version-controlled markdown that the agent helper library loads at startup. Co-edited by Eric and Jason. This file is the product's voice.

### Per-chapter prompt addenda

When Jason records his per-chapter videos, Whisper transcribes them and they're processed into `docs/jason-principles/<chapter_slug>.md` files. The drafting pipeline loads the relevant chapter's principles file alongside the global system prompt:

```typescript
// src/lib/agent/draft.ts
const systemPrompt = await loadAgentPrompt();          // global Jason voice
const chapterPrinciples = await loadChapterPrinciples(slug);  // Jason on this topic
const highPointPrecedent = await loadHighPointChapter(slug);  // canonical "good"
const memorySnapshot = await getMemorySnapshot(userId);       // what we know

const draft = await draftChapter({
  system: [systemPrompt, chapterPrinciples].join("\n\n---\n\n"),
  precedent: highPointPrecedent,
  memory: memorySnapshot,
  chapter: slug,
});
```

### Tools the agent has (over time)

| Tool | Phase | Purpose |
|---|---|---|
| `update_memory` | Phase 0 | Agent rewrites a Memory file |
| `record_provenance` | Phase 0 | Agent annotates a claim with its source |
| `voice_transcribe` | Phase 1 | Whisper wrapper |
| `scrape_website` | Phase 1 | Fetch + parse a customer URL |
| `parse_upload` | Phase 1 | Extract structure from PDF/DOCX/XLSX |
| `web_search` | Phase 3 | Tavily / Perplexity-style research |
| `census_demographics` | Phase 3 | Trade-area demographics |
| `competitor_lookup` | Phase 3 | Google Places / Maps API |
| `compile_deliverable` | Phase 5 | Convert Memory chapters → DOCX/PPTX |

---

## 6. Phase plan

Each phase commits to `main` with hidden routes (e.g. `/portal/_lab/*`) so deploys never surface half-built UI. Once a phase is verified, the new surface is promoted into the main portal navigation.

### ✅ Phase 0 — Foundation *(this session)*

- `docs/agentic-portal-buildout.md` (this file)
- `docs/jason-agent-prompt.md` (system prompt source)
- Migration 0010: `customer_memory`, `customer_memory_provenance`, `profiles.website_url`, `customer-uploads` storage bucket
- `src/lib/agent/` — Anthropic client, prompt loader, draft scaffold
- `src/lib/memory/` — CRUD + provenance helpers
- TypeScript types
- Env var documentation

**Deliverable:** No customer-visible change, but every downstream phase has its substrate.

### Phase 1 — The Day 1 Wow *(4–6 weeks)*

- Website-URL field added to assessment + post-purchase form
- Website scrape service (Playwright + Cheerio + Claude reads home/about page)
- Voice intake UI under `/portal/_lab/intake` (MediaRecorder + Whisper)
- First chapter draft pipeline: **Brand & Story** chapter, drafted from voice + scrape
- Provenance hover system (invisible until hovered/clicked)
- Alive UI patterns:
  - Welcome message types out character-by-character
  - Pulsing next-action card
  - Streaming upload classification
  - Subtle Jason-avatar chat dock that breathes when idle
- Chat dock connected to Sonnet 4.6 with Memory-aware context
- Jason video upload + transcription pipeline (admin route)

**Deliverable:** A test customer can purchase, do a 30-minute voice intake, watch their Brand & Story chapter draft live, and see provenance for every paragraph.

### Phase 2 — Mechanical-but-judgment-light chapters *(8–10 weeks)*

- `business_overview`, `operating_model`, `unit_economics`, `recipes_and_menu`, `vendor_supply_chain`, `franchise_economics`
- Drop-anything upload zone with streaming classification
- Memory editor UI (table view for power users, doc view for everyone else)
- Deterministic math library (`src/lib/calc/`) for FDD Item 7 totals, royalty calc, ad-fund spend, ramp curves — these are CODE, never LLM inference
- Versioned Memory snapshots so customers can roll back

**Deliverable:** Tier 1 customer can take a Blueprint from 0% → ~60% attorney-ready without ever talking to Jason.

### Phase 3 — Research-heavy chapters *(10–14 weeks)*

- Web search tool integration (Tavily or Perplexity API)
- Mapbox / Google Places integration for trade-area + competitor analysis
- Census + BLS demographics
- `market_strategy` and `competitor_landscape` chapters
- Site Broker Scorecard generator (uses real estate APIs)
- Tier-aware: Tier 1 gets agent-only output with "Jason recommends review" callout; Tier 2/3 routes through Jason for redlines.

### Phase 4 — Legal-sensitive chapters *(10–14 weeks)*

- `compliance_legal` chapter with state-by-state registration matrix
- Franchise Agreement scaffolding (templated, attorney-required-review banner)
- `marketing_fund`, `employee_handbook`, `reimbursement_policy`
- Attorney handoff workflow:
  - Vetted attorney partnership (TBD with Jason)
  - Export bundle with clear "Draft for attorney review" markers throughout

### Phase 5 — Export pipeline *(4–6 weeks)*

- DOCX generation (`docx` npm library)
- PPTX generation (`pptxgenjs`)
- Bundle export: 14–16 polished deliverables in High Point format, downloadable as zip
- Attorney-readiness scoring (per-chapter checklist)

### Phase 6 — Tier 2/3 mode *(ongoing)*

- Jason redline UI (admin-only review of customer drafts)
- Calendly handoffs ("you're stuck on Chapter X — book Jason")
- Per-chapter "Jason approved" stamp
- Live coaching call notes feed back into Memory

---

## 7. File conventions

| Path | Contents |
|---|---|
| `docs/agentic-portal-buildout.md` | This file. Always update first when scope changes. |
| `docs/jason-agent-prompt.md` | Global system prompt for the Jason agent. Co-edited by Eric + Jason. |
| `docs/jason-principles/<chapter>.md` | Per-chapter Jason video transcripts, structured as principles. Generated by the video pipeline; reviewable as markdown. |
| `docs/high-point-chapters/<chapter>.md` | High Point precedent excerpts used as few-shot examples. Curated subset of the actual High Point bundle. |
| `src/lib/agent/*.ts` | Agent runtime: SDK client, prompts, drafting, chat, voice, scrape. All server-side only. |
| `src/lib/memory/*.ts` | Memory CRUD + provenance helpers. Used by both agent code and UI server components. |
| `src/lib/calc/*.ts` | Deterministic math (FDD totals, royalty calc, financial model). NEVER call an LLM from here. |
| `src/app/portal/_lab/*` | Hidden routes for in-progress phases. Promoted to `/portal/*` when stable. |
| `src/app/api/agent/*` | Agent API endpoints (chat, draft, intake). Streaming via Web Streams API. |
| `supabase/migrations/00NN_*.sql` | Numbered, comment-heavy. Continue from 0010. |

---

## 8. Environment variables

### New (Phase 0)
```
ANTHROPIC_API_KEY=                # required for agent code
ANTHROPIC_MODEL_DRAFT=claude-opus-4-7        # heavy drafting
ANTHROPIC_MODEL_CHAT=claude-sonnet-4-6       # chat assistant
```

### New (Phase 1)
```
OPENAI_API_KEY=                   # for Whisper transcription
WHISPER_MODEL=whisper-1
```

### New (Phase 2)
```
VOYAGE_API_KEY=                   # embeddings for long-tail uploads
```

### New (Phase 3)
```
TAVILY_API_KEY=                   # or PERPLEXITY_API_KEY for web search
GOOGLE_MAPS_API_KEY=              # places + geocoding
CENSUS_API_KEY=                   # demographics (free)
```

### Existing (don't touch)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*
RESEND_API_KEY
INTERNAL_NOTIFICATION_EMAIL
CALENDLY_*
```

---

## 9. Locked decisions (do not relitigate without Jason)

- Voice-first intake (Whisper v1 → Deepgram v2 for streaming)
- Memory always-editable (with confirmation when downstream chapters are affected)
- Single-user workspaces v1 (multi-user is Phase 6+)
- Agent does maximum work; Jason layered on at higher tiers as reviewer/refiner
- Build without a workflow audit; Jason's per-chapter videos ARE the workflow audit
- Training corpus = High Point only at v1; capture future engagements as paired examples
- Math is deterministic code, not LLM inference (no confidence badges on numbers)
- Provenance is invisible by default, on-hover/click only (no UI clutter)
- One living "Franchisor Blueprint" document, not nine separate workspaces
- Existing 9 PDFs become the agent's source material; customer never opens them directly
- Tier differentiation: agent floor at all tiers, Jason ceiling at higher tiers

---

## 10. Open decisions (need Jason input)

- Q10 — Attorney handoff: partnership / packet / punt?
- Q11 — POS integrations (Square / Toast / QuickBooks): Phase 3 or skip?
- Additions to the 9 (Marketing Fund Manual, Employee Handbook, etc.) — promote to first-class capabilities or treat as bundled chapters of one of the 9?
- Tier 2/3 unique value beyond Jason coaching calls — bespoke benchmarks? Industry comp data? Attorney-network access?

---

## 11. How to resume work after context loss

1. Read this file end-to-end.
2. Read `docs/jason-agent-prompt.md` for the agent's voice.
3. Run `git log --oneline -20 -- docs/ src/lib/agent/ src/lib/memory/ supabase/migrations/` to see recent work on this initiative.
4. Check the phase plan (§6) to see where we are. Phase boundaries are committed messages tagged `phase(N): ...`.
5. The current todo list (if Eric is mid-session) is in the conversation — but defer to this doc when in doubt.

---

*Last meaningful update: 2026-04-29 — Phase 0 scaffold landed.*
