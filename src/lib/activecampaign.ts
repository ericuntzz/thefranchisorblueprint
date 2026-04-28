/**
 * ActiveCampaign v3 API client.
 *
 * Single source of truth for pushing contacts into AC. Every consumer
 * (contact form, newsletter signup, Stripe webhook) calls `acUpsertContact()`
 * with the data it has, and the function:
 *   1. Creates or updates the contact (sync endpoint, idempotent on email)
 *   2. Optionally subscribes them to one or more lists
 *   3. Optionally applies one or more tags (creates tags if they don't exist)
 *   4. Optionally writes custom field values
 *
 * Failure mode: every operation is wrapped in try/catch. We log + return
 * { ok: false } rather than throw, because lead capture should never break
 * the user's submit flow or the Stripe webhook's 200 response.
 *
 * Setup:
 *   - Get API URL + key from AC → Settings → Developer
 *   - Set ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_KEY in Vercel
 *   - Set the list ID(s) and any custom field ID(s) you want to use
 *
 * Reference: https://developers.activecampaign.com/reference/overview
 */

const API_URL = process.env.ACTIVECAMPAIGN_API_URL?.replace(/\/$/, "");
const API_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

export type AcCustomField = {
  /** Numeric AC field ID (Settings → Manage Fields → URL when editing the field) */
  field: string | number;
  value: string;
};

export type AcUpsertParams = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Custom field values (pre-mapped to AC field IDs by the caller) */
  fieldValues?: AcCustomField[];
  /** Numeric AC list IDs to subscribe the contact to (status=1 active) */
  listIds?: number[];
  /** Tag names to apply. Tags will be created if they don't exist. */
  tags?: string[];
};

type AcResult =
  | { ok: true; contactId: string; createdNewContact: boolean }
  | { ok: false; error: string };

function configured(): boolean {
  return Boolean(API_URL && API_KEY);
}

async function ac<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!configured()) throw new Error("ActiveCampaign not configured");
  const res = await fetch(`${API_URL}/api/3${path}`, {
    method,
    headers: {
      "Api-Token": API_KEY!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AC ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── Tag helpers ────────────────────────────────────────────────────────────

type AcTagSearch = { tags: Array<{ id: string; tag: string }> };
type AcTagCreate = { tag: { id: string; tag: string } };

/**
 * Find a tag by exact name. Returns the AC tag ID, or null if not found.
 * AC's search is case-insensitive partial match, so we filter for exact equality.
 */
async function findTagId(tagName: string): Promise<string | null> {
  try {
    const res = await ac<AcTagSearch>("GET", `/tags?search=${encodeURIComponent(tagName)}`);
    const exact = res.tags?.find((t) => t.tag.toLowerCase() === tagName.toLowerCase());
    return exact?.id ?? null;
  } catch {
    return null;
  }
}

/** Get-or-create a tag, returning its ID. */
async function ensureTagId(tagName: string): Promise<string | null> {
  const existing = await findTagId(tagName);
  if (existing) return existing;
  try {
    const created = await ac<AcTagCreate>("POST", "/tags", {
      tag: { tag: tagName, tagType: "contact", description: "" },
    });
    return created.tag?.id ?? null;
  } catch (err) {
    console.warn(`[ac] Failed to create tag "${tagName}":`, err);
    return null;
  }
}

// ─── Main upsert function ──────────────────────────────────────────────────

type AcSyncResponse = {
  contact: { id: string };
};

export async function acUpsertContact(params: AcUpsertParams): Promise<AcResult> {
  if (!configured()) {
    console.warn(
      "[ac] ACTIVECAMPAIGN_API_URL/KEY not set — skipping. Add to Vercel env vars to enable.",
    );
    return { ok: false, error: "not_configured" };
  }

  // Step 1: sync (upsert) the contact by email.
  let contactId: string;
  try {
    const sync = await ac<AcSyncResponse>("POST", "/contact/sync", {
      contact: {
        email: params.email,
        ...(params.firstName ? { firstName: params.firstName } : {}),
        ...(params.lastName ? { lastName: params.lastName } : {}),
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.fieldValues?.length
          ? { fieldValues: params.fieldValues.map((f) => ({ field: String(f.field), value: f.value })) }
          : {}),
      },
    });
    contactId = sync.contact.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[ac] Contact sync failed:", message);
    return { ok: false, error: message };
  }

  // Step 2 (parallel): subscribe to lists + apply tags. Failures are
  // individual — one bad list/tag doesn't kill the rest.
  const listOps = (params.listIds ?? []).map(async (listId) => {
    try {
      await ac("POST", "/contactLists", {
        contactList: { list: listId, contact: contactId, status: 1 },
      });
    } catch (err) {
      console.warn(`[ac] Failed to subscribe contact ${contactId} to list ${listId}:`, err);
    }
  });

  const tagOps = (params.tags ?? []).map(async (tagName) => {
    const tagId = await ensureTagId(tagName);
    if (!tagId) return;
    try {
      await ac("POST", "/contactTags", {
        contactTag: { contact: contactId, tag: tagId },
      });
    } catch (err) {
      console.warn(`[ac] Failed to apply tag "${tagName}" to contact ${contactId}:`, err);
    }
  });

  await Promise.all([...listOps, ...tagOps]);
  return { ok: true, contactId, createdNewContact: false /* AC sync doesn't tell us */ };
}

// ─── Env-var helpers (read once, used everywhere) ──────────────────────────

/** The single AC list everyone goes onto — the "TFB Master" list ID. */
export const AC_MASTER_LIST_ID = process.env.ACTIVECAMPAIGN_LIST_MASTER
  ? Number(process.env.ACTIVECAMPAIGN_LIST_MASTER)
  : undefined;

/** Optional custom-field IDs (set in AC, then reference by ID in env). */
export const AC_FIELD = {
  businessName: process.env.ACTIVECAMPAIGN_FIELD_BUSINESS_NAME,
  annualRevenue: process.env.ACTIVECAMPAIGN_FIELD_ANNUAL_REVENUE,
  programInterest: process.env.ACTIVECAMPAIGN_FIELD_PROGRAM_INTEREST,
  message: process.env.ACTIVECAMPAIGN_FIELD_MESSAGE,
} as const;

/**
 * Build an AC fieldValues array from a plain object, skipping any field whose
 * env-var ID isn't set. Lets the integration progressively enhance: callers
 * always pass everything; only fields the account has configured get sent.
 */
export function buildFieldValues(values: {
  businessName?: string;
  annualRevenue?: string;
  programInterest?: string;
  message?: string;
}): AcCustomField[] {
  const out: AcCustomField[] = [];
  if (AC_FIELD.businessName && values.businessName)
    out.push({ field: AC_FIELD.businessName, value: values.businessName });
  if (AC_FIELD.annualRevenue && values.annualRevenue)
    out.push({ field: AC_FIELD.annualRevenue, value: values.annualRevenue });
  if (AC_FIELD.programInterest && values.programInterest)
    out.push({ field: AC_FIELD.programInterest, value: values.programInterest });
  if (AC_FIELD.message && values.message)
    out.push({ field: AC_FIELD.message, value: values.message });
  return out;
}
