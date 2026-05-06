#!/usr/bin/env npx tsx
/**
 * Gmail OAuth2 setup script.
 *
 * Run once to generate a refresh token for the team@ Gmail account.
 * The refresh token goes into .env.local and Vercel env vars.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com/apis/credentials
 *   2. Create an OAuth 2.0 Client ID (type: Web application)
 *   3. Add http://localhost:3456/callback as an authorized redirect URI
 *   4. Copy the Client ID and Client Secret
 *   5. Enable the Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
 *
 * Usage:
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx tsx scripts/gmail-auth.ts
 *
 * This opens a browser window. Sign in with the team@ Google account
 * and authorize. The script prints the refresh token to copy into
 * .env.local / Vercel.
 */

import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars first.");
  console.error(
    "   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx tsx scripts/gmail-auth.ts",
  );
  process.exit(1);
}

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

console.log("\n🔗 Open this URL in your browser and sign in with the team@ account:\n");
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
      "<h1>✅ Authorization successful!</h1><p>You can close this tab. Check the terminal for your tokens.</p>",
    );

    console.log("✅ Got tokens!\n");
    console.log("Add these to .env.local and Vercel project settings:\n");
    console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\n📋 Copy the GMAIL_REFRESH_TOKEN above — it won't be shown again.");

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
