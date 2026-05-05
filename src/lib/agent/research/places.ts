/**
 * Google Places wrapper — competitor density + trade-area lookups.
 *
 * Used by the territory_real_estate + competitor_landscape chapter
 * drafts to answer questions like "how many of competitor X are
 * within Y miles of this address?" without the customer manually
 * counting on a map.
 *
 * Env-gated on `GOOGLE_MAPS_API_KEY`. Without the key, every call
 * returns { ok: false, reason: "no_api_key" } and the agent falls
 * back to Memory-only drafting.
 *
 * Two endpoints we hit:
 *   - Geocoding API: address → lat/lng
 *   - Places API (Text Search): keyword + location → list of places
 */

import "server-only";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_TEXTSEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export type GeocodeResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      formattedAddress: string;
    }
  | {
      ok: false;
      reason: "no_api_key" | "no_results" | "api_error" | "request_error";
      message?: string;
    };

export type PlacesResult =
  | {
      ok: true;
      places: Array<{
        name: string;
        address: string;
        lat: number;
        lng: number;
        rating?: number;
        userRatingsTotal?: number;
        placeId: string;
      }>;
    }
  | {
      ok: false;
      reason: "no_api_key" | "api_error" | "request_error" | "no_results";
      message?: string;
    };

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return {
      ok: false,
      reason: "request_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "api_error", message: `HTTP ${res.status}` };
  }
  const json = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };
  if (json.status !== "OK" || !json.results?.length) {
    return { ok: false, reason: "no_results", message: json.status };
  }
  const first = json.results[0];
  return {
    ok: true,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
  };
}

/**
 * Search nearby places matching a keyword. Returns up to 20 results
 * (Places API page-1 limit).
 */
export async function nearbyPlaces(args: {
  keyword: string;
  centerAddress?: string;
  centerLat?: number;
  centerLng?: number;
  /** Search radius in meters; default 5km. */
  radiusMeters?: number;
}): Promise<PlacesResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  let lat = args.centerLat;
  let lng = args.centerLng;
  if ((lat == null || lng == null) && args.centerAddress) {
    const geo = await geocodeAddress(args.centerAddress);
    if (!geo.ok) {
      return { ok: false, reason: geo.reason, message: geo.message };
    }
    lat = geo.lat;
    lng = geo.lng;
  }
  if (lat == null || lng == null) {
    return {
      ok: false,
      reason: "api_error",
      message: "centerAddress or centerLat/centerLng required",
    };
  }

  const params = new URLSearchParams({
    query: args.keyword,
    location: `${lat},${lng}`,
    radius: String(args.radiusMeters ?? 5000),
    key: apiKey,
  });
  let res: Response;
  try {
    res = await fetch(`${PLACES_TEXTSEARCH_URL}?${params}`);
  } catch (err) {
    return {
      ok: false,
      reason: "request_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "api_error", message: `HTTP ${res.status}` };
  }
  const json = (await res.json()) as {
    status: string;
    results?: Array<{
      name: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number;
      user_ratings_total?: number;
      place_id: string;
    }>;
  };
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return { ok: false, reason: "api_error", message: json.status };
  }
  return {
    ok: true,
    places: (json.results ?? []).map((r) => ({
      name: r.name,
      address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      rating: r.rating,
      userRatingsTotal: r.user_ratings_total,
      placeId: r.place_id,
    })),
  };
}

export function isPlacesAvailable(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}
