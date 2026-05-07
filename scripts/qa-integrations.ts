/**
 * Local integration probe — calls each env-gated wrapper directly
 * (no HTTP, no admin auth) and reports the result. Use this to
 * verify keys are wired before relying on the Vercel deployment.
 *
 * Run with:  npx tsx scripts/qa-integrations.ts
 */

import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

// Stub the `server-only` import — it throws when run outside a Next.js
// Server Component context, but for this local probe we ARE the server.
const originalResolve = (
  Module as unknown as {
    _resolveFilename: (
      request: string,
      parent: unknown,
      isMain: boolean,
      options: unknown,
    ) => string;
  }
)._resolveFilename;
(
  Module as unknown as {
    _resolveFilename: (
      request: string,
      parent: unknown,
      isMain: boolean,
      options: unknown,
    ) => string;
  }
)._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return path.join(process.cwd(), "node_modules", "server-only-noop.cjs");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
const noopPath = path.join(
  process.cwd(),
  "node_modules",
  "server-only-noop.cjs",
);
if (!fs.existsSync(noopPath)) {
  fs.writeFileSync(noopPath, "module.exports = {};");
}

// Load .env.local manually so we don't depend on dotenv being installed
// at script-level. (The Next.js dev server / API routes load it
// natively via next.config.)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}

async function main() {
  // Imports here, AFTER env load, so the wrappers see the keys.
  const tavily = await import("../src/lib/agent/research/tavily");
  const places = await import("../src/lib/agent/research/places");
  const census = await import("../src/lib/agent/research/census");
  const voice = await import("../src/lib/agent/voice");

  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  // Anthropic
  results.push({
    name: "Anthropic",
    ok: !!process.env.ANTHROPIC_API_KEY,
    detail: process.env.ANTHROPIC_API_KEY ? "key set" : "MISSING",
  });

  // OpenAI Whisper
  results.push({
    name: "OpenAI Whisper",
    ok: voice.isVoiceTranscriptionAvailable(),
    detail: voice.isVoiceTranscriptionAvailable() ? "key set" : "MISSING",
  });

  // Tavily
  if (!tavily.isWebSearchAvailable()) {
    results.push({ name: "Tavily web search", ok: false, detail: "MISSING" });
  } else {
    const r = await tavily.tavilySearch({
      query: "franchise industry trends",
      searchDepth: "basic",
      maxResults: 1,
    });
    results.push({
      name: "Tavily web search",
      ok: r.ok,
      detail: r.ok
        ? `${r.results.length} result(s); answer=${(r.answer ?? "").slice(0, 80)}…`
        : `${r.reason}: ${r.message ?? ""}`.trim(),
    });
  }

  // Google Maps — Geocoding
  if (!places.isPlacesAvailable()) {
    results.push({ name: "Google Maps", ok: false, detail: "MISSING" });
  } else {
    const geo = await places.geocodeAddress(
      "1600 Amphitheatre Parkway, Mountain View, CA",
    );
    results.push({
      name: "  Geocoding",
      ok: geo.ok,
      detail: geo.ok
        ? `${geo.formattedAddress} → ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`
        : `${geo.reason}: ${geo.message ?? ""}`.trim(),
    });
    if (geo.ok) {
      const p = await places.nearbyPlaces({
        keyword: "coffee",
        centerLat: geo.lat,
        centerLng: geo.lng,
        radiusMeters: 1000,
      });
      results.push({
        name: "  Places (text search)",
        ok: p.ok,
        detail: p.ok
          ? `${p.places.length} coffee places within 1km`
          : `${p.reason}: ${p.message ?? ""}`.trim(),
      });
    }
  }

  // Census
  if (!census.isCensusAvailable()) {
    results.push({ name: "Census", ok: false, detail: "MISSING" });
  } else {
    const c = await census.zipDemographics("90210");
    results.push({
      name: "Census ACS",
      ok: c.ok,
      detail: c.ok
        ? `ZIP ${c.zip}: pop ${c.population?.toLocaleString() ?? "—"}, median HH $${c.medianHouseholdIncome?.toLocaleString() ?? "—"}, median age ${c.medianAge ?? "—"}`
        : `${c.reason}: ${c.message ?? ""}`.trim(),
    });
  }

  // Print.
  console.log("\nIntegration probe results:");
  console.log("─".repeat(80));
  let failures = 0;
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    if (!r.ok) failures += 1;
    console.log(`${mark} ${r.name.padEnd(28)} ${r.detail}`);
  }
  console.log("─".repeat(80));
  console.log(
    failures === 0
      ? `\n✓ ${results.length}/${results.length} integrations live\n`
      : `\n✗ ${failures}/${results.length} failed\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
