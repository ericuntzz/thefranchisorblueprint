/**
 * Admin redline endpoints — Jason (or another admin) leaves notes on
 * a customer's section draft.
 *
 *   GET    /api/admin/redlines?userId=...&slug=...  → list redlines
 *   POST   /api/admin/redlines                       → create redline
 *   PATCH  /api/admin/redlines                       → update / resolve
 *   DELETE /api/admin/redlines?id=...                → drop redline
 *
 * Auth: ADMIN_USER_IDS gate. Customers don't hit this; they read their
 * own redlines via the section UI which goes through the separate
 * `/api/agent/redlines` route or a server-component read.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedAdminId } from "@/lib/admin";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import type { SectionRedline } from "@/lib/supabase/types";

export const runtime = "nodejs";

async function requireAdmin(): Promise<
  | { ok: true; adminId: string; adminName: string | null }
  | { ok: false; res: NextResponse }
> {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  // Pick up the admin's display name once for the redline reviewer_name.
  const supabase = await getSupabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", adminId)
    .maybeSingle();
  return { ok: true, adminId, adminName: profile?.full_name ?? null };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const slug = url.searchParams.get("slug");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  let query = admin
    .from("section_redlines")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (slug) {
    if (!isValidMemoryFileSlug(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    query = query.eq("section_slug", slug);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ redlines: (data ?? []) as SectionRedline[] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  let body: {
    userId?: string;
    slug?: string;
    claimId?: string | null;
    comment?: string;
    severity?: "info" | "warning" | "blocker";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId || !body.slug || !isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json({ error: "userId + valid slug required" }, { status: 400 });
  }
  if (!body.comment || typeof body.comment !== "string") {
    return NextResponse.json({ error: "comment required" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("section_redlines")
    .insert({
      user_id: body.userId,
      section_slug: body.slug,
      claim_id: body.claimId ?? null,
      comment: body.comment,
      severity: body.severity ?? "info",
      reviewer_user_id: auth.adminId,
      reviewer_name: auth.adminName,
    })
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath(`/portal/section/${body.slug}`);
  return NextResponse.json({ ok: true, redline: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  let body: {
    id?: string;
    resolved?: boolean;
    comment?: string;
    severity?: "info" | "warning" | "blocker";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const update: Partial<Omit<SectionRedline, "id" | "user_id">> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.comment === "string") update.comment = body.comment;
  if (body.severity) update.severity = body.severity;
  if (typeof body.resolved === "boolean") {
    update.resolved_at = body.resolved ? new Date().toISOString() : null;
    update.resolved_by_user_id = body.resolved ? auth.adminId : null;
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("section_redlines")
    .update(update)
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("section_redlines").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
