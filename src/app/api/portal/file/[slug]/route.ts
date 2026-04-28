import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCapability } from "@/lib/capabilities";
import type { Purchase, Tier } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Returns a signed URL for a capability's master file.
 * - ?mode=view (default) → redirects to Microsoft Office Online viewer with
 *   the signed URL embedded, so the browser renders the .docx/.pptx inline.
 * - ?mode=download → 302s straight to the signed Supabase URL with a
 *   Content-Disposition that forces a download.
 *
 * Auth: requires a logged-in user with at least one paid (non-refunded)
 * purchase whose tier covers the requested capability. RLS on the
 * profiles/purchases tables also enforces this, but we double-check in
 * application code to give clearer error responses.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cap = getCapability(slug);
  if (!cap) {
    return NextResponse.json({ error: "Unknown capability" }, { status: 404 });
  }
  if (!cap.storagePath) {
    return NextResponse.json(
      { error: "This capability's content isn't available yet" },
      { status: 404 },
    );
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Confirm at least one paid purchase covers this capability's minTier.
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid");
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return NextResponse.json(
      { error: "No active purchase on file" },
      { status: 403 },
    );
  }
  const userTier = Math.max(...purchases.map((p) => p.tier), 1) as Tier;
  if (cap.minTier > userTier) {
    return NextResponse.json(
      { error: "Higher tier required for this capability" },
      { status: 403 },
    );
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "view";
  const ext = cap.storageExtension ?? "docx";
  const filename = `${cap.title.replace(/[^a-z0-9]+/gi, "-")}.${ext}`;

  // Use service-role client to mint a signed URL (storage RLS isn't yet on
  // — the bucket is private, signed URLs are how we gate access).
  // Short TTL (2 min) — only the immediate redirect needs to work. Anything
  // longer leaks via Office Online's caching of the URL it fetches.
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("deliverables")
    .createSignedUrl(cap.storagePath, 120, {
      download: mode === "download" ? filename : false,
    });

  if (error || !data?.signedUrl) {
    console.error(`[portal/file] signed URL failed for ${slug}: ${error?.message}`);
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  if (mode === "download") {
    return NextResponse.redirect(data.signedUrl, 302);
  }

  // mode=view: redirect to Microsoft Office Online viewer pointing at the
  // signed URL. Office Online will fetch + render the .docx/.pptx in an
  // iframe-friendly way without exposing our storage URLs.
  const officeViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`;
  return NextResponse.redirect(officeViewer, 302);
}
