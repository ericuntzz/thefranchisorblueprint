/**
 * Read/write layer for regulatory milestones.
 *
 * Resilient to the migration not having been applied yet — table-
 * missing errors are caught and treated as "no milestones tracked."
 * The UI then renders the catalog as all-pending, which is the right
 * default. Once the migration is applied (`supabase db push`), the
 * table-aware code lights up automatically.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  MILESTONES,
  type MilestoneState,
  type MilestoneStatus,
} from "./types";

const TABLE = "regulatory_milestones";

/**
 * Read every milestone row for the user. Returns an empty array when
 * the table doesn't exist yet (migration unapplied) so the UI keeps
 * working — every milestone renders as "pending."
 */
export async function readMilestones(userId: string): Promise<MilestoneState[]> {
  const admin = getSupabaseAdmin();
  // The table isn't in the typed Database schema yet (added by
  // migration 0015). Use an untyped client for this query so we don't
  // fight the types until the schema regen lands.
  const untyped = admin as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: unknown[] | null;
          error: { code?: string; message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await untyped
    .from(TABLE)
    .select("milestone_id, status, target_date, completed_at, notes, updated_at")
    .eq("user_id", userId);

  if (error) {
    if (isMissingRelation(error)) {
      console.info(
        "[milestones] regulatory_milestones table not present yet — run migration 0015. Returning empty list.",
      );
      return [];
    }
    console.error("[milestones] read failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as {
      milestone_id: string;
      status: MilestoneStatus;
      target_date: string | null;
      completed_at: string | null;
      notes: string | null;
      updated_at: string;
    };
    return {
      milestoneId: r.milestone_id,
      status: r.status,
      targetDate: r.target_date,
      completedAt: r.completed_at,
      notes: r.notes,
      updatedAt: r.updated_at,
    };
  });
}

/** Index milestones by id for easy template lookup. */
export function indexMilestones(rows: MilestoneState[]): Map<string, MilestoneState> {
  const m = new Map<string, MilestoneState>();
  for (const r of rows) m.set(r.milestoneId, r);
  return m;
}

/**
 * Upsert one milestone's state. Auth check is the caller's job.
 * Returns true on success, false if the table is missing.
 */
export async function upsertMilestone(args: {
  userId: string;
  milestoneId: string;
  status: MilestoneStatus;
  targetDate?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const completedAt = args.status === "complete" ? new Date().toISOString() : null;

  const untyped = admin as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { code?: string; message: string } | null }>;
    };
  };
  const { error } = await untyped.from(TABLE).upsert(
    {
      user_id: args.userId,
      milestone_id: args.milestoneId,
      status: args.status,
      target_date: args.targetDate ?? null,
      completed_at: completedAt,
      notes: args.notes ?? null,
    },
    { onConflict: "user_id,milestone_id" },
  );

  if (error) {
    if (isMissingRelation(error)) {
      console.warn(
        "[milestones] write blocked — regulatory_milestones table missing. Run migration 0015.",
      );
      return false;
    }
    console.error("[milestones] write failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Compute aggregate stats for the milestone tracker hero.
 *  - totalMilestones, completedMilestones
 *  - percentComplete
 *  - nextMilestone (first non-complete, non-skipped in catalog order)
 */
export function computeMilestoneSummary(states: Map<string, MilestoneState>) {
  let completed = 0;
  let inProgress = 0;
  for (const m of MILESTONES) {
    const state = states.get(m.id);
    if (state?.status === "complete") completed += 1;
    if (state?.status === "in_progress") inProgress += 1;
  }
  const total = MILESTONES.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const next = MILESTONES.find((m) => {
    const s = states.get(m.id);
    return !s || (s.status !== "complete" && s.status !== "skipped");
  });

  return {
    total,
    completed,
    inProgress,
    percentComplete: pct,
    nextMilestone: next ?? null,
  };
}

function isMissingRelation(err: { code?: string; message: string }): boolean {
  // Direct Postgres: 42P01 = undefined_table.
  if (err.code === "42P01") return true;
  // PostgREST when table isn't in the schema cache (most common path
  // when the migration hasn't been applied yet). Code is PGRST205;
  // the human message reads "Could not find the table 'X' in the
  // schema cache." Match either signal.
  if (err.code === "PGRST205") return true;
  if (/Could not find the table/i.test(err.message)) return true;
  return /relation .* does not exist/i.test(err.message);
}
