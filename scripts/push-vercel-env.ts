/**
 * One-shot bootstrap: push the four research/voice API keys + the
 * ADMIN_USER_IDS env to Vercel production, then trigger a redeploy.
 *
 * Run with:  npx tsx scripts/push-vercel-env.ts
 *
 * Requires (already in .env.local):
 *   VERCEL_TOKEN
 *   OPENAI_API_KEY
 *   TAVILY_API_KEY
 *   GOOGLE_MAPS_API_KEY
 *   CENSUS_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (to look up Eric's user_id)
 *   NEXT_PUBLIC_SUPABASE_URL
 *
 * The script:
 *   1. Reads .env.local
 *   2. Looks up the customer Eric by email in auth.users
 *   3. Builds ADMIN_USER_IDS from his user_id
 *   4. POSTs each env to Vercel (or PATCHes if it exists)
 *   5. Triggers a redeploy of latest production deployment
 */

import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");
const PROJECT_ID = "prj_9tgWaQA4UxEYcOZBA9NeaoAp9xTX";
const TEAM_ID = "team_qA2hGsmKZl5o2cS63JG48kgl";

// Parse .env.local manually — dotenv strips quotes weirdly for some
// values and we want to push the EXACT string the customer typed
// to Vercel, byte-for-byte.
function parseEnvFile(filepath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = fs.readFileSync(filepath, "utf-8");
  for (const line of text.split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawVal] = m;
    let val = rawVal;
    // Strip wrapping quotes if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const localEnv = parseEnvFile(ENV_PATH);
const VERCEL_TOKEN = localEnv.VERCEL_TOKEN;
if (!VERCEL_TOKEN) {
  console.error("Missing VERCEL_TOKEN in .env.local");
  process.exit(1);
}

async function vercelFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM_ID}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function listExistingEnvs(): Promise<
  Array<{ id: string; key: string; target: string[] }>
> {
  const res = await vercelFetch(`/v9/projects/${PROJECT_ID}/env`);
  if (!res.ok) {
    throw new Error(`List envs failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    envs?: Array<{ id: string; key: string; target: string[] }>;
  };
  return data.envs ?? [];
}

async function upsertEnv(
  key: string,
  value: string,
  existing: Array<{ id: string; key: string; target: string[] }>,
): Promise<void> {
  const targets = ["production", "preview", "development"];
  // Vercel env vars can have one entry per target — to keep this
  // idempotent, we delete every existing entry for this key first
  // and then post a single combined entry.
  const matches = existing.filter((e) => e.key === key);
  for (const m of matches) {
    const res = await vercelFetch(`/v9/projects/${PROJECT_ID}/env/${m.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      console.warn(`  Couldn't delete existing ${key} (${m.id}):`, await res.text());
    }
  }
  // Create single entry covering all targets.
  const res = await vercelFetch(`/v10/projects/${PROJECT_ID}/env`, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      target: targets,
      type: "encrypted",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  POST ${key} failed: ${res.status} ${body}`);
    throw new Error(`Failed to push ${key}`);
  }
  console.log(`  ✓ ${key} → ${targets.join(", ")}`);
}

async function findEricUserId(): Promise<string | null> {
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn(
      "Missing Supabase URL/service role — skipping ADMIN_USER_IDS lookup",
    );
    return null;
  }
  // List users via the auth admin API. Eric's email is hardcoded
  // here — if you want this script reusable, parameterize it.
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    console.warn(`Auth admin lookup failed: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    users?: Array<{ id: string; email: string | null }>;
  };
  // Match either of Eric's known emails.
  const candidates = (json.users ?? []).filter((u) =>
    u.email && /eric/i.test(u.email),
  );
  if (candidates.length === 0) {
    console.warn("No user with 'eric' in email found");
    return null;
  }
  console.log(`  Found ${candidates.length} candidate user(s):`);
  for (const u of candidates) console.log(`    ${u.email} → ${u.id}`);
  // Prefer thefranchisorblueprint domain if present.
  const tfb = candidates.find((u) =>
    u.email?.toLowerCase().includes("thefranchisorblueprint.com"),
  );
  return (tfb ?? candidates[0]).id;
}

async function triggerRedeploy(): Promise<void> {
  // Find latest production deployment, redeploy it.
  const listRes = await vercelFetch(
    `/v6/deployments?projectId=${PROJECT_ID}&target=production&limit=1`,
  );
  const list = (await listRes.json()) as {
    deployments?: Array<{ uid: string; name: string; meta?: Record<string, string> }>;
  };
  const latest = list.deployments?.[0];
  if (!latest) {
    console.warn("No latest deployment found — skipping redeploy");
    return;
  }
  const res = await vercelFetch(`/v13/deployments`, {
    method: "POST",
    body: JSON.stringify({
      name: latest.name,
      deploymentId: latest.uid,
      target: "production",
      meta: {
        action: "redeploy-after-env-update",
      },
    }),
  });
  if (!res.ok) {
    console.warn(`Redeploy failed: ${res.status} ${await res.text()}`);
    return;
  }
  const j = (await res.json()) as { url?: string };
  console.log(`  ✓ Redeploy triggered → https://${j.url}`);
}

async function main() {
  console.log("== Pushing API keys to Vercel ==");
  const required = [
    "OPENAI_API_KEY",
    "TAVILY_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "CENSUS_API_KEY",
  ];
  const existing = await listExistingEnvs();

  for (const key of required) {
    const val = localEnv[key];
    if (!val) {
      console.warn(`  ⚠ ${key} not in .env.local — skipping`);
      continue;
    }
    await upsertEnv(key, val, existing);
  }

  console.log("\n== Looking up admin user ID ==");
  const userId = await findEricUserId();
  if (userId) {
    await upsertEnv("ADMIN_USER_IDS", userId, await listExistingEnvs());
  }

  console.log("\n== Triggering production redeploy ==");
  await triggerRedeploy();

  console.log("\n✓ Done. Wait ~60s for Vercel to finish, then hit:");
  console.log("  https://www.thefranchisorblueprint.com/api/admin/diagnostics");
}

void main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
