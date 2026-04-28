import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

let _admin: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client backed by the service_role key.
 * Bypasses RLS — use ONLY in trusted server code (webhook handlers,
 * scheduled jobs). Never import this from a Client Component.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_admin) return _admin;
  _admin = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return _admin;
}
