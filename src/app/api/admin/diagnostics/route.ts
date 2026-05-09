/**
 * Admin diagnostics endpoint — single-call health probe for all the
 * env-gated integrations.
 *
 *   GET /api/admin/diagnostics
 *
 * Hits each external API with a small known-good test input and
 * reports back which ones answered. Lets the admin verify that
 * env vars are actually wired and the wrappers are working without
 * having to navigate to 4 different section pages.
 *
 * Auth: ADMIN_USER_IDS gate. Probes are real API calls so they
 * count against quotas — admin-only avoids drive-by usage.
 *
 * Response shape:
 *   {
 *     anthropic: { configured: true, ok: true | "skipped" },
 *     openai_whisper: { configured, ok, message? },
 *     tavily: { configured, ok, message? },
 *     google_maps: { configured, ok, message?, geocoding, places },
 *     census: { configured, ok, message?, sample? },
 *     supabase: { ok }
 *   }
 */

import { NextResponse } from "next/server";
import { getAuthenticatedAdminId } from "@/lib/admin";
import { isVoiceTranscriptionAvailable } from "@/lib/agent/voice";
import { isWebSearchAvailable, tavilySearch } from "@/lib/agent/research/tavily";
import {
  geocodeAddress,
  isPlacesAvailable,
  nearbyPlaces,
} from "@/lib/agent/research/places";
import { isCensusAvailable, zipDemographics } from "@/lib/agent/research/census";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // ── Anthropic ─────────────────────────────────────────────────────
  // We don't call Anthropic here — it's used on every chat turn so a
  // separate probe is wasteful. Just verify env exists.
  result.anthropic = {
    configured: !!process.env.ANTHROPIC_API_KEY,
    ok: !!process.env.ANTHROPIC_API_KEY,
  };

  // ── OpenAI Whisper ────────────────────────────────────────────────
  // Same logic — actually calling Whisper requires an audio file. Just
  // verify env presence; the voice route end-to-end test is the manual
  // test path.
  result.openai_whisper = {
    configured: isVoiceTranscriptionAvailable(),
    ok: isVoiceTranscriptionAvailable(),
  };

  // ── Tavily web search ─────────────────────────────────────────────
  if (!isWebSearchAvailable()) {
    result.tavily = {
      configured: false,
      ok: false,
      message: "TAVILY_API_KEY not set",
    };
  } else {
    const r = await tavilySearch({
      query: "franchise industry trends",
      searchDepth: "basic",
      maxResults: 1,
    });
    result.tavily = {
      configured: true,
      ok: r.ok,
      message: r.ok
        ? `${r.results.length} result${r.results.length === 1 ? "" : "s"}`
        : `${r.reason}: ${r.message ?? ""}`.trim(),
    };
  }

  // ── Google Maps (Geocoding + Places) ──────────────────────────────
  if (!isPlacesAvailable()) {
    result.google_maps = {
      configured: false,
      ok: false,
      message: "GOOGLE_MAPS_API_KEY not set",
    };
  } else {
    // Geocoding probe
    const geo = await geocodeAddress("1600 Amphitheatre Parkway, Mountain View, CA");
    // Places probe — only if geocoding worked, since that's the
    // common failure mode (key missing or restricted).
    let places:
      | { ok: boolean; count?: number; message?: string }
      | undefined;
    if (geo.ok) {
      const p = await nearbyPlaces({
        keyword: "coffee",
        centerLat: geo.lat,
        centerLng: geo.lng,
        radiusMeters: 1000,
      });
      places = p.ok
        ? { ok: true, count: p.places.length }
        : { ok: false, message: `${p.reason}: ${p.message ?? ""}`.trim() };
    }
    result.google_maps = {
      configured: true,
      ok: geo.ok && (places?.ok ?? false),
      geocoding: geo.ok
        ? { ok: true, formattedAddress: geo.formattedAddress }
        : { ok: false, message: `${geo.reason}: ${geo.message ?? ""}`.trim() },
      places,
    };
  }

  // ── Census ────────────────────────────────────────────────────────
  if (!isCensusAvailable()) {
    result.census = {
      configured: false,
      ok: false,
      message: "CENSUS_API_KEY not set",
    };
  } else {
    const c = await zipDemographics("90210"); // Beverly Hills — known data
    result.census = {
      configured: true,
      ok: c.ok,
      sample: c.ok
        ? {
            zip: c.zip,
            population: c.population,
            medianHouseholdIncome: c.medianHouseholdIncome,
            medianAge: c.medianAge,
          }
        : undefined,
      message: c.ok ? undefined : `${c.reason}: ${c.message ?? ""}`.trim(),
    };
  }

  // ── Supabase ─────────────────────────────────────────────────────
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("customer_memory")
      .select("user_id", { count: "exact", head: true })
      .limit(1);
    result.supabase = {
      ok: !error,
      message: error?.message,
    };
  } catch (e) {
    result.supabase = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
