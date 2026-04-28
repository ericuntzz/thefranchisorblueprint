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
        Insert: Omit<Purchase, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Purchase, "id" | "user_id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
