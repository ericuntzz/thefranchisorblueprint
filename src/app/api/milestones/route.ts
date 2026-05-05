/**
 * Milestone update endpoint.
 *
 * POST /api/milestones
 *   Body: { milestoneId, status, targetDate?, notes? }
 *
 * Auth: logged-in + paid purchase.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { upsertMilestone } from "@/lib/milestones/state";
import { isValidMilestoneId, isValidStatus } from "@/lib/milestones/types";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }

  let body: {
    milestoneId?: string;
    status?: string;
    targetDate?: string | null;
    notes?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const milestoneId = body.milestoneId;
  const status = body.status;
  if (!milestoneId || !isValidMilestoneId(milestoneId)) {
    return NextResponse.json({ error: "Invalid milestoneId" }, { status: 400 });
  }
  if (!status || !isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  // Light validation on target_date — if provided, must look like an
  // ISO date (YYYY-MM-DD).
  if (body.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
    return NextResponse.json({ error: "targetDate must be YYYY-MM-DD" }, { status: 400 });
  }

  const ok = await upsertMilestone({
    userId: user.id,
    milestoneId,
    status,
    targetDate: body.targetDate ?? null,
    notes: body.notes ?? null,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Milestone tracker not yet enabled. Apply migration 0015." },
      { status: 503 },
    );
  }

  revalidatePath("/portal");
  return NextResponse.json({ ok: true });
}
