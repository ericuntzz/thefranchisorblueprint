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
  completed_at: string;
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
  created_at: string;
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
        Insert: Omit<Profile, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
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
        Insert: Omit<CapabilityProgress, "completed_at"> & {
          completed_at?: string;
        };
        Update: Partial<Omit<CapabilityProgress, "user_id" | "capability_slug">>;
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
      scheduled_emails: {
        Row: ScheduledEmail;
        Insert: Omit<
          ScheduledEmail,
          "id" | "created_at" | "sent_at" | "failed_at" | "failure_reason" | "attempts"
        > & {
          id?: string;
          created_at?: string;
          sent_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          attempts?: number;
        };
        Update: Partial<Omit<ScheduledEmail, "id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
