/**
 * Gmail API client — OAuth2 authenticated, multi-account.
 *
 * Supports reading from multiple Gmail inboxes (e.g. team@ and eric@).
 * Each account gets its own refresh token. The initial OAuth flow is
 * manual (run scripts/gmail-auth.ts once per account); after that
 * refresh tokens auto-renew access tokens.
 *
 * Account config via env vars:
 *   Shared:
 *     GMAIL_CLIENT_ID
 *     GMAIL_CLIENT_SECRET
 *
 *   Per-account refresh tokens (comma-separated labels + tokens):
 *     GMAIL_ACCOUNTS=team,eric
 *     GMAIL_REFRESH_TOKEN_TEAM=...
 *     GMAIL_REFRESH_TOKEN_ERIC=...
 *
 *   Legacy single-account fallback:
 *     GMAIL_REFRESH_TOKEN=...  (treated as "team" account)
 *
 * The inbox-review cron is the only consumer. If creds are missing,
 * getGmailAccounts() returns an empty array so the cron skips gracefully.
 */

import "server-only";
import { google, type gmail_v1 } from "googleapis";

export type GmailAccount = {
  /** Label for this account (e.g. "team", "eric"). */
  label: string;
  /** The Gmail API client authenticated as this account. */
  client: gmail_v1.Gmail;
};

const _cache = new Map<string, gmail_v1.Gmail>();

function makeClient(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

/**
 * Returns Gmail clients for all configured accounts.
 * Empty array if nothing is configured.
 */
export function getGmailAccounts(): GmailAccount[] {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("[gmail] skipping — GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not set");
    return [];
  }

  const accounts: GmailAccount[] = [];

  // Multi-account: GMAIL_ACCOUNTS=team,eric
  const accountLabels = process.env.GMAIL_ACCOUNTS?.split(",").map((s) => s.trim()).filter(Boolean);

  if (accountLabels && accountLabels.length > 0) {
    for (const label of accountLabels) {
      const envKey = `GMAIL_REFRESH_TOKEN_${label.toUpperCase()}`;
      const refreshToken = process.env[envKey];
      if (!refreshToken) {
        console.warn(`[gmail] skipping account "${label}" — ${envKey} not set`);
        continue;
      }

      if (!_cache.has(label)) {
        _cache.set(label, makeClient(clientId, clientSecret, refreshToken));
      }
      accounts.push({ label, client: _cache.get(label)! });
    }
  }

  // Legacy fallback: single GMAIL_REFRESH_TOKEN → "team" account
  if (accounts.length === 0) {
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (refreshToken) {
      if (!_cache.has("team")) {
        _cache.set("team", makeClient(clientId, clientSecret, refreshToken));
      }
      accounts.push({ label: "team", client: _cache.get("team")! });
    }
  }

  if (accounts.length === 0) {
    console.warn("[gmail] no accounts configured — set GMAIL_ACCOUNTS + per-account tokens, or GMAIL_REFRESH_TOKEN");
  }

  return accounts;
}

/**
 * Legacy single-client getter — returns the first configured account
 * or null. Kept for backward compat if anything else imports it.
 */
export function getGmailClient(): gmail_v1.Gmail | null {
  const accounts = getGmailAccounts();
  return accounts.length > 0 ? accounts[0].client : null;
}
