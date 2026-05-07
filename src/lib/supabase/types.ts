export type Tier = 1 | 2 | 3;

// IMPORTANT: these MUST be `type` not `interface`. Supabase JS v2's
// type inference checks the schema against `GenericSchema`, which
// requires Row/Insert/Update to extend `Record<string, unknown>`.
// `interface` types are treated as "open" by TypeScript (because of
// declaration merging) and don't structurally satisfy that constraint,
// so the whole Database type collapses to `never` and every query
// loses its types. Keep these as type aliases.
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  tier: Tier;
  coaching_credits: number;
  /** Customer's website. Captured at assessment or post-purchase, scraped
   *  by the website pre-fill service to seed brand_voice + business_overview
   *  Memory chapters before the customer even starts voice intake. */
  website_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Purchase = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  product: string;
  tier: Tier;
  amount_cents: number;
  currency: string;
  status: "paid" | "refunded";
  refunded_at: string | null;
  refund_amount_cents: number;
  created_at: string;
};

export type CapabilityProgress = {
  user_id: string;
  capability_slug: string;
  /** Set to a timestamp when the customer marked the capability complete.
   *  Null means "viewed but not completed" (still in progress). */
  completed_at: string | null;
  /** First time the customer opened this capability. */
  started_at: string | null;
  /** Most-recent view. Used by the "stuck for 14+ days" nudges. */
  last_viewed_at: string | null;
};

export type UpgradeOffer = {
  id: string;
  user_id: string;
  source_tier: 1 | 2;
  target_tier: 2 | 3;
  base_amount_cents: number;
  promo_amount_cents: number;
  promo_expires_at: string;
  triggered_by: string;
  redeemed_at: string | null;
  created_at: string;
};

export type ContactSubmission = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  annual_revenue: string | null;
  program_interest: string | null;
  message: string | null;
  ip: string | null;
  user_agent: string | null;
  user_id: string | null;
  created_at: string;
};

export type NewsletterSubscriber = {
  id: string;
  email: string;
  source: string;
  unsubscribed_at: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AssessmentBand =
  | "franchise_ready"
  | "nearly_there"
  | "building_foundation"
  | "early_stage";

export type AssessmentSession = {
  id: string;
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  business_name: string | null;
  /** Captured during assessment so the agentic-portal scraper has a head start
   *  by the time the customer purchases. */
  website_url: string | null;
  annual_revenue: string | null;
  urgency: string | null;
  total_score: number | null;
  band: AssessmentBand | null;
  /** Per-category point totals keyed by category slug ('business_model' etc). */
  category_scores: Record<string, number> | null;
  started_at: string;
  completed_at: string | null;
  resume_token: string | null;
  ip: string | null;
  user_agent: string | null;
  source: string | null;
};

export type AssessmentResponse = {
  session_id: string;
  question_id: string;
  answer_value: string;
  answer_score: number;
  answered_at: string;
};

/**
 * Persistent Jason AI chat-dock transcript. One row per user.
 * The dock fetches this on first open so a returning customer
 * sees their previous conversation continue rather than a fresh
 * greeting every page reload. Capped to the last ~30 entries
 * server-side on write to keep row size bounded over months of use.
 */
/**
 * Tier 2/3 redline note left by Jason (or another admin reviewer)
 * against a customer's chapter draft. The customer resolves redlines
 * one by one; once every blocker-severity redline is resolved, the
 * admin can stamp the chapter as Jason-approved.
 */
export type ChapterRedline = {
  id: string;
  user_id: string;
  chapter_slug: string;
  claim_id: string | null;
  comment: string;
  severity: "info" | "warning" | "blocker";
  reviewer_user_id: string;
  reviewer_name: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Versioned snapshot of a customer_memory chapter at a point in
 * time. Captured BEFORE every meaningful write (agent redraft,
 * scrape, user edit) so the customer can roll back. Pruned to
 * the most-recent N per (user, chapter) by the snapshots helper.
 */
export type MemorySnapshot = {
  id: string;
  user_id: string;
  chapter_slug: string;
  /** Snapshot payload — the chapter contents at capture time.
   *  Validated as `SnapshotPayload` in lib/memory/snapshots.ts. */
  payload: unknown;
  reason: string | null;
  source:
    | "pre_draft"
    | "pre_redraft"
    | "pre_scrape"
    | "pre_user_edit"
    | "pre_extract"
    | "pre_field_save"
    | "manual";
  created_at: string;
};

export type ChatHistory = {
  user_id: string;
  /** Array of TranscriptItem (defined client-side in JasonChatDock).
   *  Stored as `unknown[]` here so we don't pull a client-only type
   *  into the server boundary; the API route validates shape on the
   *  way in and out. */
  transcript: unknown[];
  /** Past chats archived via the "+ New chat" button. Each entry is
   *  a structured `SavedChatThread` (defined client-side); the API
   *  route validates shape and caps array length on write. */
  saved_threads: unknown[];
  updated_at: string;
};

export type ScheduledEmail = {
  id: string;
  user_id: string | null;
  recipient_email: string;
  template: string;
  payload: Record<string, unknown>;
  send_after: string;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  attempts: number;
  dedupe_key: string | null;
  /** Set by claim_due_emails RPC — concurrency lock. Null = available. */
  claimed_at: string | null;
  created_at: string;
};

/**
 * Per-user directory of structured business knowledge. One row per
 * (user, file_slug). content_md is *both* the agent's source of truth AND
 * the live draft of the corresponding chapter that compiles into the
 * customer's Franchisor Blueprint export bundle.
 *
 * `fields` is the structured-data layer added in Phase 1.5a — typed
 * values per chapter, keyed by field name. The schema lives in
 * `src/lib/memory/schemas.ts`. The actual values are JSON-serializable:
 * strings, numbers, booleans, and `string[]` for lists. Empty/unknown
 * values are stored as `null` (not undefined) so the diff stays
 * meaningful — a field set to null was deliberately cleared; a missing
 * key was never touched.
 *
 * `field_status` is parallel jsonb keyed by the same field names;
 * each value is `{ source, updated_at, note? }`. Records where each
 * field's value came from (voice_session, scraper, user_typed, etc.).
 *
 * See `src/lib/memory/files.ts` for the canonical list of file_slug values
 * and `src/lib/memory/schemas.ts` for the per-chapter field schemas.
 */
export type CustomerMemory = {
  user_id: string;
  file_slug: string;
  content_md: string;
  /** Structured field values per chapter. See `ChapterFields` in schemas.ts. */
  fields: Record<string, string | number | boolean | string[] | null>;
  /** Per-field provenance metadata. See `ChapterFieldStatus` in schemas.ts. */
  field_status: Record<
    string,
    {
      source:
        | "voice_session"
        | "upload"
        | "form"
        | "agent_inference"
        | "research"
        | "scraper"
        | "user_correction"
        | "user_typed";
      updated_at: string;
      note?: string;
    }
  >;
  confidence: "verified" | "inferred" | "draft";
  last_updated_by: "agent" | "user" | "jason" | "scraper";
  /** Per-chapter attachments (files + links) the customer added to
   *  enrich the agent's drafting context. See migration 0012 for shape. */
  attachments: ChapterAttachment[];
  /** Stamped when Jason (or another admin reviewer) marks the chapter
   *  approved. Surfaced on export cover pages + chapter cards.
   *  Null = no human review yet. See migration 0022. */
  jason_approved_at: string | null;
  jason_approved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One per-chapter attachment. Files live in the customer-uploads
 * storage bucket; links are external URLs we may have lightly scraped
 * for an excerpt. Both surface in the chapter card and feed into
 * Opus's draft prompt as additional context.
 */
export type ChapterAttachment = {
  id: string;
  kind: "file" | "link";
  /** Storage object path for files; absolute https URL for links. */
  ref: string;
  /** Display name — original filename, scraped page title, or user-typed label. */
  label: string;
  mime_type: string | null;
  size_bytes: number | null;
  /** Short text snippet (~2KB) the agent reads. For text files this is
   *  the file content prefix; for links it's the scraped page text;
   *  for opaque files (PDF/DOCX/images) it's a placeholder. */
  excerpt: string | null;
  created_at: string;
};

/**
 * Per-claim audit trail. Every meaningful assertion in a customer_memory
 * file ties back to a row here so the on-hover provenance UI can show the
 * customer where the claim came from. claim_id is an anchor embedded in
 * the markdown (e.g. `<!-- claim:para-3 -->`).
 */
export type CustomerMemoryProvenance = {
  id: string;
  user_id: string;
  file_slug: string;
  claim_id: string;
  source_type:
    | "voice_session"
    | "upload"
    | "form"
    | "agent_inference"
    | "jason_playbook"
    | "research"
    | "assessment"
    | "scraper";
  source_ref: string | null;
  source_excerpt: string | null;
  created_at: string;
};

export type CoachingSession = {
  id: string;
  /** Nullable since migration 20260507000000 — non-customer bookings (warm
   *  assessment leads who haven't purchased) are now stored too, with
   *  invitee_email/name as the only identifying info. */
  user_id: string | null;
  calendly_event_uri: string | null;
  calendly_invitee_uri: string | null;
  calendly_event_type_uri: string | null;
  /** Lowercased invitee email — populated for ALL bookings (both customer
   *  and non-customer) post-migration so the lead-status helper can
   *  match assessment leads → bookings purely by email. */
  invitee_email: string | null;
  /** Display name from the Calendly invitee record. */
  invitee_name: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
  notes: string | null;
  created_at: string;
  canceled_at: string | null;
  completed_at: string | null;
};

export type CustomerRescueSend = {
  id: string;
  user_id: string;
  chapter_slug: string;
  days_idle: number;
  sent_at: string;
};

export type OpsDigestSend = {
  id: string;
  sent_to: string;
  payload: Record<string, unknown>;
  sent_at: string;
};

export type StripeReconciliationIssue = {
  id: string;
  stripe_ref: string;
  issue_type: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RefundOutreachSend = {
  id: string;
  user_id: string;
  days_remaining: number;
  readiness_pct: number;
  sent_at: string;
};

export type HealthCheckIncident = {
  id: string;
  check_name: string;
  severity: "degraded" | "down";
  latency_ms: number | null;
  detail: string | null;
  created_at: string;
};

export type InboxReview = {
  id: string;
  thread_id: string;
  message_id: string | null;
  subject: string;
  sender: string;
  category: "urgent" | "action" | "fyi" | "spam";
  reason: string;
  summary: string;
  draft_reply: string | null;
  reviewed_at: string;
  created_at: string;
};

// MemorySnapshot type defined above near ChatHistory.

// Supabase JS v2 type inference requires this exact shape — including the
// __InternalSupabase marker and the `{ [_ in never]: never }` empty-record
// idiom for Views/Functions/Enums/CompositeTypes. Deviations cause every
// `.from(...).select(...)` call to collapse to `never`, which silently
// poisons every downstream type until the build dies at type-check.
// Match the structure produced by `supabase gen types typescript` exactly.
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        // tier (default 1) and coaching_credits (default 0) are NOT NULL in
        // the DB but DO have defaults — so they're optional on Insert.
        // website_url defaults to NULL.
        Insert: Omit<
          Profile,
          "created_at" | "updated_at" | "tier" | "coaching_credits" | "website_url"
        > & {
          created_at?: string;
          updated_at?: string;
          tier?: Tier;
          coaching_credits?: number;
          website_url?: string | null;
        };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      customer_memory: {
        Row: CustomerMemory;
        // content_md, confidence, last_updated_by, fields, field_status
        // all have DB defaults; only user_id + file_slug are strictly
        // required on insert. created_at + updated_at are managed by DB.
        Insert: Pick<CustomerMemory, "user_id" | "file_slug"> & {
          content_md?: string;
          fields?: CustomerMemory["fields"];
          field_status?: CustomerMemory["field_status"];
          confidence?: CustomerMemory["confidence"];
          last_updated_by?: CustomerMemory["last_updated_by"];
          attachments?: CustomerMemory["attachments"];
          jason_approved_at?: string | null;
          jason_approved_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CustomerMemory, "user_id" | "file_slug" | "created_at">>;
        Relationships: [];
      };
      customer_memory_provenance: {
        Row: CustomerMemoryProvenance;
        Insert: Omit<CustomerMemoryProvenance, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CustomerMemoryProvenance, "id" | "user_id">>;
        Relationships: [];
      };
      purchases: {
        Row: Purchase;
        // Refund fields default to NULL / 0 in the database, so they must be
        // optional on Insert. Otherwise the fulfillment code that creates a
        // purchase at checkout time (before any refund) fails to type-check.
        Insert: Omit<Purchase, "id" | "created_at" | "refunded_at" | "refund_amount_cents"> & {
          id?: string;
          created_at?: string;
          refunded_at?: string | null;
          refund_amount_cents?: number;
        };
        Update: Partial<Omit<Purchase, "id" | "user_id">>;
        Relationships: [];
      };
      capability_progress: {
        Row: CapabilityProgress;
        Insert: Omit<CapabilityProgress, "completed_at" | "started_at" | "last_viewed_at"> & {
          completed_at?: string | null;
          started_at?: string | null;
          last_viewed_at?: string | null;
        };
        Update: Partial<Omit<CapabilityProgress, "user_id" | "capability_slug">>;
        Relationships: [];
      };
      coaching_sessions: {
        Row: CoachingSession;
        Insert: Omit<
          CoachingSession,
          | "id"
          | "created_at"
          | "canceled_at"
          | "completed_at"
          | "status"
          | "notes"
          | "invitee_email"
          | "invitee_name"
        > & {
          id?: string;
          created_at?: string;
          canceled_at?: string | null;
          completed_at?: string | null;
          status?: CoachingSession["status"];
          notes?: string | null;
          invitee_email?: string | null;
          invitee_name?: string | null;
        };
        Update: Partial<Omit<CoachingSession, "id">>;
        Relationships: [];
      };
      customer_rescue_sends: {
        Row: CustomerRescueSend;
        Insert: Omit<CustomerRescueSend, "id" | "sent_at"> & {
          id?: string;
          sent_at?: string;
        };
        Update: Partial<Omit<CustomerRescueSend, "id">>;
        Relationships: [];
      };
      ops_digest_sends: {
        Row: OpsDigestSend;
        Insert: Omit<OpsDigestSend, "id" | "sent_at"> & {
          id?: string;
          sent_at?: string;
        };
        Update: Partial<Omit<OpsDigestSend, "id">>;
        Relationships: [];
      };
      stripe_reconciliation_issues: {
        Row: StripeReconciliationIssue;
        Insert: Omit<StripeReconciliationIssue, "id" | "created_at" | "updated_at" | "resolved_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          resolved?: boolean;
          resolved_at?: string | null;
        };
        Update: Partial<Omit<StripeReconciliationIssue, "id">>;
        Relationships: [];
      };
      refund_outreach_sends: {
        Row: RefundOutreachSend;
        Insert: Omit<RefundOutreachSend, "id" | "sent_at"> & {
          id?: string;
          sent_at?: string;
        };
        Update: Partial<Omit<RefundOutreachSend, "id">>;
        Relationships: [];
      };
      health_check_incidents: {
        Row: HealthCheckIncident;
        Insert: Omit<HealthCheckIncident, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<HealthCheckIncident, "id">>;
        Relationships: [];
      };
      upgrade_offers: {
        Row: UpgradeOffer;
        Insert: Omit<UpgradeOffer, "id" | "created_at" | "redeemed_at"> & {
          id?: string;
          created_at?: string;
          redeemed_at?: string | null;
        };
        Update: Partial<Omit<UpgradeOffer, "id" | "user_id">>;
        Relationships: [];
      };
      contact_submissions: {
        Row: ContactSubmission;
        Insert: Omit<ContactSubmission, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ContactSubmission, "id">>;
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: NewsletterSubscriber;
        Insert: Omit<
          NewsletterSubscriber,
          "id" | "created_at" | "source" | "unsubscribed_at"
        > & {
          id?: string;
          created_at?: string;
          source?: string;
          unsubscribed_at?: string | null;
        };
        Update: Partial<Omit<NewsletterSubscriber, "id">>;
        Relationships: [];
      };
      assessment_sessions: {
        Row: AssessmentSession;
        // Most fields default to null. started_at + id have DB defaults.
        // Lead-capture fields and score fields are populated lazily.
        Insert: Partial<Omit<AssessmentSession, "id" | "started_at">> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<Omit<AssessmentSession, "id">>;
        Relationships: [];
      };
      assessment_responses: {
        Row: AssessmentResponse;
        Insert: Omit<AssessmentResponse, "answered_at"> & {
          answered_at?: string;
        };
        Update: Partial<Omit<AssessmentResponse, "session_id" | "question_id">>;
        Relationships: [];
      };
      chat_history: {
        Row: ChatHistory;
        Insert: {
          user_id: string;
          transcript?: unknown[];
          saved_threads?: unknown[];
          updated_at?: string;
        };
        Update: Partial<Omit<ChatHistory, "user_id">>;
        Relationships: [];
      };
      memory_snapshots: {
        Row: MemorySnapshot;
        Insert: {
          id?: string;
          user_id: string;
          chapter_slug: string;
          payload: unknown;
          reason?: string | null;
          source: MemorySnapshot["source"];
          created_at?: string;
        };
        Update: Partial<Omit<MemorySnapshot, "id" | "user_id">>;
        Relationships: [];
      };
      chapter_redlines: {
        Row: ChapterRedline;
        Insert: {
          id?: string;
          user_id: string;
          chapter_slug: string;
          claim_id?: string | null;
          comment: string;
          severity?: ChapterRedline["severity"];
          reviewer_user_id: string;
          reviewer_name?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ChapterRedline, "id" | "user_id">>;
        Relationships: [];
      };
      inbox_reviews: {
        Row: InboxReview;
        Insert: Omit<InboxReview, "id" | "created_at" | "reviewed_at" | "message_id"> & {
          id?: string;
          created_at?: string;
          reviewed_at?: string;
          message_id?: string | null;
        };
        Update: Partial<Omit<InboxReview, "id">>;
        Relationships: [];
      };
      scheduled_emails: {
        Row: ScheduledEmail;
        Insert: Omit<
          ScheduledEmail,
          | "id"
          | "created_at"
          | "sent_at"
          | "failed_at"
          | "failure_reason"
          | "attempts"
          | "claimed_at"
        > & {
          id?: string;
          created_at?: string;
          sent_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          attempts?: number;
          claimed_at?: string | null;
        };
        Update: Partial<Omit<ScheduledEmail, "id">>;
        Relationships: [];
      };
    };
    Functions: {
      add_coaching_credits: {
        Args: { uid: string; delta: number };
        Returns: void;
      };
      claim_due_emails: {
        Args: { batch_size?: number };
        Returns: ScheduledEmail[];
      };
      debit_coaching_credit: {
        Args: { uid: string };
        Returns: boolean;
      };
      clawback_unused_credits: {
        Args: { uid: string; grant_amount: number };
        Returns: number;
      };
      log_capability_view: {
        Args: { uid: string; slug: string };
        Returns: void;
      };
      upsert_memory_with_provenance: {
        Args: {
          p_user_id: string;
          p_file_slug: string;
          p_content_md: string;
          p_confidence: CustomerMemory["confidence"];
          p_last_updated_by: CustomerMemory["last_updated_by"];
          /** JSON array of { claim_id, source_type, source_ref, source_excerpt } */
          p_provenance: Array<{
            claim_id: string;
            source_type: CustomerMemoryProvenance["source_type"];
            source_ref: string | null;
            source_excerpt: string | null;
          }> | null;
        };
        Returns: void;
      };
    };
    Views: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
