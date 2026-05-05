/**
 * Memory snapshot endpoints — version history + rollback for chapters.
 *
 *   GET  /api/agent/snapshots?slug=<MemoryFileSlug>
 *        → { snapshots: SnapshotRow[] }
 *
 *   POST /api/agent/snapshots
 *        body: { slug: MemoryFileSlug, snapshotId: string }
 *        → { ok: true } — restores the chapter to that snapshot
 *
 * Auth: must be logged in + paid. RLS enforces user-scoped reads on
 * the table itself, but we double-check at the route boundary.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import {
  listSnapshots,
  rollbackToSnapshot,
} from "@/lib/memory/snapshots";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 30;

async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; res: NextResponse }
> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) {
    return {
      ok: false,
      res: NextResponse.json({ error: "No active purchase" }, { status: 403 }),
    };
  }
  return { ok: true, userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug || !isValidMemoryFileSlug(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const snapshots = await listSnapshots({ userId: auth.userId, slug });
  return NextResponse.json({ snapshots });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  let body: { slug?: string; snapshotId?: string };
  try {
    body = (await req.json()) as { slug?: string; snapshotId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.slug || !isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (!body.snapshotId || typeof body.snapshotId !== "string") {
    return NextResponse.json({ error: "snapshotId required" }, { status: 400 });
  }
  const result = await rollbackToSnapshot({
    userId: auth.userId,
    slug: body.slug,
    snapshotId: body.snapshotId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Rollback failed" },
      { status: 500 },
    );
  }
  // Revalidate the chapter pages so the UI shows the restored content.
  revalidatePath(`/portal/chapter/${body.slug}`);
  revalidatePath(`/portal/lab/blueprint`);
  return NextResponse.json({ ok: true });
}
