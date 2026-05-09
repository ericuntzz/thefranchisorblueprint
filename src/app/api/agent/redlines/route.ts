/**
 * Customer-facing redline summary.
 *
 *   GET /api/agent/redlines?slug=<MemoryFileSlug>
 *     → { redlines, openCount, blockerCount, approved }
 *
 *   PATCH /api/agent/redlines
 *     body: { id, resolved: boolean }
 *     → mark a redline resolved (or unresolve it)
 *
 * The customer sees their own redlines via this route. RLS already
 * scopes reads — we use the user-session client.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import type { SectionRedline, Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";

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
  const supabase = await getSupabaseServer();
  const [{ data: redlines }, { data: row }] = await Promise.all([
    supabase
      .from("section_redlines")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("section_slug", slug)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_memory")
      .select("jason_approved_at")
      .eq("user_id", auth.userId)
      .eq("file_slug", slug)
      .maybeSingle(),
  ]);
  const list = (redlines ?? []) as SectionRedline[];
  const open = list.filter((r) => !r.resolved_at);
  return NextResponse.json({
    redlines: list,
    openCount: open.length,
    blockerCount: open.filter((r) => r.severity === "blocker").length,
    approved: !!row?.jason_approved_at,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.res;
  let body: { id?: string; resolved?: boolean; slug?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || typeof body.resolved !== "boolean") {
    return NextResponse.json(
      { error: "id + resolved required" },
      { status: 400 },
    );
  }
  const supabase = await getSupabaseServer();
  const update = body.resolved
    ? {
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: auth.userId,
        updated_at: new Date().toISOString(),
      }
    : {
        resolved_at: null,
        resolved_by_user_id: null,
        updated_at: new Date().toISOString(),
      };
  const { error } = await supabase
    .from("section_redlines")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.slug && isValidMemoryFileSlug(body.slug)) {
    revalidatePath(`/portal/section/${body.slug}`);
  }
  return NextResponse.json({ ok: true });
}
