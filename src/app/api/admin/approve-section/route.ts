/**
 * Admin endpoint to stamp a section as Jason-approved.
 *
 *   POST   /api/admin/approve-section
 *     body: { userId, slug }
 *     → sets customer_memory.jason_approved_at = now()
 *
 *   DELETE /api/admin/approve-section
 *     body: { userId, slug }
 *     → clears the approval (e.g. customer made changes that need re-review)
 *
 * Auth: ADMIN_USER_IDS gate. The customer never hits this directly —
 * they see the stamp via the section card UI but can't apply it
 * themselves.
 *
 * Rule: sections with unresolved blocker-severity redlines can't be
 * approved. UI surfaces this; we re-check server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedAdminId } from "@/lib/admin";
import { isValidMemoryFileSlug } from "@/lib/memory/files";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: string; slug?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId || !body.slug || !isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json({ error: "userId + valid slug required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Refuse approval if there are unresolved blocker redlines.
  const { data: blockers } = await admin
    .from("section_redlines")
    .select("id")
    .eq("user_id", body.userId)
    .eq("section_slug", body.slug)
    .eq("severity", "blocker")
    .is("resolved_at", null)
    .limit(1);
  if (blockers && blockers.length > 0) {
    return NextResponse.json(
      {
        error:
          "Resolve every blocker-severity redline on this section before stamping it approved.",
      },
      { status: 409 },
    );
  }

  const { error } = await admin.from("customer_memory").upsert(
    {
      user_id: body.userId,
      file_slug: body.slug,
      jason_approved_at: new Date().toISOString(),
      jason_approved_by_user_id: adminId,
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath(`/portal/section/${body.slug}`);
  revalidatePath(`/portal/lab/blueprint`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: string; slug?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId || !body.slug || !isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json({ error: "userId + valid slug required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("customer_memory")
    .update({
      jason_approved_at: null,
      jason_approved_by_user_id: null,
    })
    .eq("user_id", body.userId)
    .eq("file_slug", body.slug);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath(`/portal/section/${body.slug}`);
  return NextResponse.json({ ok: true });
}
