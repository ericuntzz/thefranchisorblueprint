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

export type CoachingSession = {
  id: string;
  user_id: string;
  calendly_event_uri: string | null;
  calendly_invitee_uri: string | null;
  calendly_event_type_uri: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
  notes: string | null;
  created_at: string;
  canceled_at: string | null;
  completed_at: string | null;
};

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
        Insert: Omit<
          Profile,
          "created_at" | "updated_at" | "tier" | "coaching_credits"
        > & {
          created_at?: string;
          updated_at?: string;
          tier?: Tier;
          coaching_credits?: number;
        };
        Update: Partial<Omit<Profile, "id">>;
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
          "id" | "created_at" | "canceled_at" | "completed_at" | "status" | "notes"
        > & {
          id?: string;
          created_at?: string;
          canceled_at?: string | null;
          completed_at?: string | null;
          status?: CoachingSession["status"];
          notes?: string | null;
        };
        Update: Partial<Omit<CoachingSession, "id">>;
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
    };
    Views: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
