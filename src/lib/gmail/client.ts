/**
 * Gmail API client — OAuth2 authenticated.
 *
 * Uses a service-level refresh token for the team@ account. The
 * initial OAuth flow is manual (run scripts/gmail-auth.ts once);
 * after that the refresh token auto-renews access tokens.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN
 *
 * The inbox-review cron is the only consumer. If any var is missing,
 * getGmailClient() returns null so the cron can skip gracefully.
 */

import "server-only";
import { google, type gmail_v1 } from "googleapis";

let _gmail: gmail_v1.Gmail | null = null;

export function getGmailClient(): gmail_v1.Gmail | null {
  if (_gmail) return _gmail;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn(
      "[gmail] skipping — GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN not set",
    );
    return null;
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  _gmail = google.gmail({ version: "v1", auth });
  return _gmail;
}
