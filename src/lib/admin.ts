/**
 * Admin auth — gates Jason's redline UI and any other admin-only
 * surfaces.
 *
 * The model: env-list of user_ids. Set `ADMIN_USER_IDS` to a
 * comma-separated list of `auth.users.id` UUIDs. Anyone whose
 * authenticated user id is in that list passes; anyone else gets
 * a 403.
 *
 * Why env list and not a `is_admin` flag on `profiles`: this is the
 * smallest possible "admin" feature surface — Jason + maybe Eric.
 * No DB column means no RLS edits and no migration; just rotate the
 * env in Vercel when the list changes.
 */

import "server-only";
import { getSupabaseServer } from "./supabase/server";

export function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().has(userId);
}

/**
 * Server-component / API-route helper. Returns the user id when the
 * caller is an authenticated admin, null otherwise. The caller decides
 * how to react (redirect, 403, hide UI).
 */
export async function getAuthenticatedAdminId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return isAdminUserId(user.id) ? user.id : null;
}
