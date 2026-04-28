import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCapability } from "@/lib/capabilities";

export const runtime = "nodejs";

/**
 * Toggle a capability's completion state for the current user.
 *
 * POST with form field `action=mark` → upsert (idempotent complete)
 * POST with form field `action=unmark` → delete the progress row
 *
 * Single endpoint, single button per capability — server flips state and
 * redirects back. RLS on capability_progress enforces user_id = auth.uid().
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cap = getCapability(slug);
  if (!cap) return NextResponse.json({ error: "Unknown capability" }, { status: 404 });

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const action = (form.get("action") || "").toString().toLowerCase();

  if (action === "mark") {
    const { error } = await supabase.from("capability_progress").upsert(
      {
        user_id: user.id,
        capability_slug: slug,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,capability_slug" },
    );
    if (error) {
      console.error(`[portal/progress] mark failed: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "unmark") {
    const { error } = await supabase
      .from("capability_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("capability_slug", slug);
    if (error) {
      console.error(`[portal/progress] unmark failed: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  }

  const referer = req.headers.get("referer") ?? `${req.nextUrl.origin}/portal/${slug}`;
  return NextResponse.redirect(referer, 303);
}
