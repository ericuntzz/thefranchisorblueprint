#!/usr/bin/env python3
"""
Re-run the OAuth flow with the GA4 + GSC scopes.

Run this whenever you need to:
  - Add a new scope (e.g. when we first enable GSC)
  - Refresh tokens that have been revoked

Reads CLIENT_ID + CLIENT_SECRET from .env.local, opens browser, captures
the new refresh token, writes it back to .env.local.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"

def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env

def update_env_var(key, value):
    """Replace or append a single env var line."""
    text = ENV_PATH.read_text()
    new_lines = []
    found = False
    for line in text.splitlines():
        if line.startswith(f"{key}="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(new_lines) + "\n")

def main():
    env = load_env()
    cid = env.get("GA4_OAUTH_CLIENT_ID")
    sec = env.get("GA4_OAUTH_CLIENT_SECRET")
    if not cid or not sec:
        sys.exit("ERROR: GA4_OAUTH_CLIENT_ID + GA4_OAUTH_CLIENT_SECRET must be in .env.local first")

    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_config(
        client_config={"installed": {
            "client_id": cid,
            "client_secret": sec,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }},
        scopes=[
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/webmasters.readonly",
        ],
    )

    print(">>> Opening browser. Sign in with the account that has access to BOTH GA4 and GSC.")
    print(">>> Click Allow on both scopes (Analytics + Search Console).")
    creds = flow.run_local_server(
        port=0, open_browser=True, prompt="consent", access_type="offline"
    )

    if not creds.refresh_token:
        sys.exit("ERROR: no refresh token returned (Google sometimes withholds if you've authorized this client before — revoke at myaccount.google.com → Security → Third-party apps and re-run)")

    update_env_var("GA4_OAUTH_REFRESH_TOKEN", creds.refresh_token)
    print(">>> Updated .env.local with new refresh token.")
    print(">>> Both GA4 and GSC API access now active locally.")

if __name__ == "__main__":
    main()
