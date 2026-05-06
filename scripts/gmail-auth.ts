#!/usr/bin/env npx tsx
/**
 * Gmail OAuth2 setup script.
 *
 * Run once PER ACCOUNT to generate a refresh token. The inbox review
 * agent supports multiple Gmail accounts (e.g. team@ and eric@).
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com/apis/credentials
 *   2. Create an OAuth 2.0 Client ID (type: Web application)
 *   3. Add http://localhost:3456/callback as an authorized redirect URI
 *   4. Copy the Client ID and Client Secret
 *   5. Enable the Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
 *
 * Usage (run once per account):
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx tsx scripts/gmail-auth.ts team
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx tsx scripts/gmail-auth.ts eric
 *
 * Each run opens a browser. Sign in with the correct Google account
 * (team@thefranchisorblueprint.com or eric@thefranchisorblueprint.com)
 * and authorize. The script prints the env vars to copy.
 *
 * After both accounts are authorized, your .env.local should have:
 *   GMAIL_CLIENT_ID=...
 *   GMAIL_CLIENT_SECRET=...
 *   GMAIL_ACCOUNTS=team,eric
 *   GMAIL_REFRESH_TOKEN_TEAM=...
 *   GMAIL_REFRESH_TOKEN_ERIC=...
 */

import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Account label from CLI arg (default: "team")
const ACCOUNT_LABEL = (process.argv[2] ?? "team").toLowerCase().trim();

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars first.");
  console.error(
    `   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx tsx scripts/gmail-auth.ts ${ACCOUNT_LABEL}`,
  );
  process.exit(1);
}

console.log(`\n📧 Setting up Gmail OAuth for the "${ACCOUNT_LABEL}" account.\n`);
console.log(
  ACCOUNT_LABEL === "team"
    ? "   Sign in with: team@thefranchisorblueprint.com"
    : ACCOUNT_LABEL === "eric"
      ? "   Sign in with: eric@thefranchisorblueprint.com"
      : `   Sign in with the "${ACCOUNT_LABEL}" Google account`,
);

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // force refresh token generation
});

console.log("\n🔗 Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n⏳ Waiting for callback on localhost:" + PORT + "...\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("Missing authorization code");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      `<h1>✅ Authorization successful for "${ACCOUNT_LABEL}"!</h1><p>You can close this tab. Check the terminal for your tokens.</p>`,
    );

    const envKey = `GMAIL_REFRESH_TOKEN_${ACCOUNT_LABEL.toUpperCase()}`;
    const tokenValue = tokens.refresh_token ?? "";

    // Auto-write to .env.local
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envPath = path.resolve(process.cwd(), ".env.local");

    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      const pattern = new RegExp(`^${envKey}=.*$`, "m");
      if (pattern.test(content)) {
        content = content.replace(pattern, `${envKey}=${tokenValue}`);
      } else {
        content += `\n${envKey}=${tokenValue}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
      console.log(`\n✅ Wrote ${envKey} to .env.local (${tokenValue.length} chars)`);
    }

    console.log(`\n✅ Got tokens for "${ACCOUNT_LABEL}"!\n`);
    console.log(`${envKey}=${tokenValue}`);
    console.log(`\n📋 Token saved to .env.local. Add it to Vercel project settings too.`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed");
    console.error("❌ Token exchange failed:", err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);

// Try to open the browser automatically
import("node:child_process").then(({ exec }) => {
  exec(`open "${authUrl}"`);
});
