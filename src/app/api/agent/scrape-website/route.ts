import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { scrapeAndIngestWebsite } from "@/lib/agent/scrape";
import type { Profile, Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/agent/scrape-website
 *
 * Body: { url?: string }  — optional override; if omitted we use whatever
 * is on the user's profiles.website_url.
 *
 * Auth: logged-in + paid purchase.
 *
 * Side effects:
 *   - Persists the URL to profiles.website_url if the body provided one.
 *   - Writes brand_voice and business_overview Memory sections with
 *     "inferred" confidence and provenance tied to the scrape.
 *
 * Returns a small JSON summary of what landed.
 */
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
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }

  // Body parsing — url is optional.
  let body: { url?: string };
  try {
    body = (await req.json().catch(() => ({}))) as { url?: string };
  } catch {
    body = {};
  }

  // Resolve URL: explicit body > profile > assessment > error.
  const admin = getSupabaseAdmin();
  let websiteUrl = (body.url ?? "").trim() || null;

  if (!websiteUrl) {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    const profile = profileRow as Profile | null;
    websiteUrl = profile?.website_url ?? null;
  }

  if (!websiteUrl) {
    // Fall back to the assessment row that was most recently linked to
    // this user, if any.
    const { data: rows } = await admin
      .from("assessment_sessions")
      .select("website_url")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0] as { website_url: string | null } | undefined;
    websiteUrl = row?.website_url ?? null;
  }

  if (!websiteUrl) {
    return NextResponse.json(
      {
        error:
          "No website URL on file. Pass one in the request body, or set profiles.website_url first.",
      },
      { status: 400 },
    );
  }

  // Persist a body-supplied URL onto the profile so subsequent runs and
  // page visits know about it.
  if (body.url) {
    const { error: profErr } = await admin
      .from("profiles")
      .update({ website_url: websiteUrl })
      .eq("id", user.id);
    if (profErr) {
      console.warn(
        "[agent/scrape-website] failed to persist website_url to profile:",
        profErr.message,
      );
    }
  }

  try {
    const result = await scrapeAndIngestWebsite({
      userId: user.id,
      websiteUrl,
    });
    return NextResponse.json({
      ok: true,
      websiteUrl,
      title: result.artifacts.title,
      metaDescription: result.artifacts.metaDescription,
      ogImage: result.artifacts.ogImage,
      foundAboutPage: result.artifacts.aboutText !== null,
      brandVoicePreview: result.brandVoiceSummary.slice(0, 280),
      businessOverviewPreview: result.businessOverviewSummary.slice(0, 280),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scrape failed";
    console.error("[agent/scrape-website]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
