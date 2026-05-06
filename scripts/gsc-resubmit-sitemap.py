#!/usr/bin/env python3
"""
Re-submit sitemap.xml to Google Search Console.

This pings GSC to re-fetch the sitemap. It does NOT force re-indexing of
individual URLs — Google deprecated that public API in 2023. The only way
to manually request indexing is the GSC UI (10 URLs/day quota).

This script also outputs a prioritized list of the top non-indexed URLs
from the most recent inspection sweep, so they can be pasted into the
GSC UI's "URL inspection" → "Request indexing" flow one-by-one.

Usage:
    python3 scripts/gsc-resubmit-sitemap.py
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"
SWEEP_DIR = ROOT / "analytics" / "reports" / "gsc-inspection"


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    return env


def get_token(env):
    body = (f"client_id={env['GA4_OAUTH_CLIENT_ID']}"
            f"&client_secret={env['GA4_OAUTH_CLIENT_SECRET']}"
            f"&refresh_token={env['GA4_OAUTH_REFRESH_TOKEN']}"
            f"&grant_type=refresh_token").encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["access_token"]


def submit_sitemap(token, site_url, sitemap_url):
    """PUT to webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}."""
    import urllib.parse
    site_enc = urllib.parse.quote(site_url, safe="")
    feed_enc = urllib.parse.quote(sitemap_url, safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{site_enc}/sitemaps/{feed_enc}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode() or "(empty body — sitemap submitted)"
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def get_priority_urls():
    """Pull the most recent sweep, return non-indexed URLs sorted by SEO value."""
    sweeps = sorted(SWEEP_DIR.glob("20*-*.json"), reverse=True)
    if not sweeps:
        return []
    data = json.loads(sweeps[0].read_text())
    not_indexed = [
        r for r in data.get("results", [])
        if r.get("verdict") in ("FAIL", "NEUTRAL", "PARTIAL")
    ]
    # Priority order: hub pages → pillar blog posts → state pages → industry pages → glossary
    def score(r):
        url = r["url"]
        if url.endswith("/"):
            return 0  # homepage
        if "/franchise-by-state" == url.rstrip("/").split(".com")[-1]:
            return 1
        if "/franchise-by-industry" == url.rstrip("/").split(".com")[-1]:
            return 1
        if "/blog/" in url and url.count("/") <= 5:
            return 2
        if "/franchise-your-business-in/" in url:
            return 3
        if "/franchise-your/" in url:
            return 4
        if "/glossary/" in url:
            return 5
        if "/compare/" in url:
            return 5
        return 9
    return sorted(not_indexed, key=lambda r: (score(r), r["url"]))


def main():
    env = load_env()
    site_url = env.get("GSC_SITE_URL")
    if not site_url:
        sys.exit("ERROR: GSC_SITE_URL missing from .env.local")

    sitemap_url = "https://www.thefranchisorblueprint.com/sitemap.xml"

    print(f"Site: {site_url}")
    print(f"Submitting sitemap: {sitemap_url}\n")

    token = get_token(env)
    code, body = submit_sitemap(token, site_url, sitemap_url)
    if 200 <= code < 300:
        print(f"✓ Sitemap re-submitted to GSC (HTTP {code})")
    else:
        print(f"✗ HTTP {code}: {body}")

    print("\n" + "=" * 70)
    print("MANUAL INDEXING — paste these into GSC URL Inspection one by one")
    print("(quota: ~10 requests per day per property)")
    print("=" * 70 + "\n")

    priority = get_priority_urls()
    if not priority:
        print("No prior sweep found — run scripts/gsc-inspection-sweep.py first.")
        return 0

    # Top 10 highest-value non-indexed URLs
    for r in priority[:10]:
        url = r["url"]
        coverage = r.get("coverageState", "?")
        print(f"  {url}")
        print(f"    └─ {coverage}")

    if len(priority) > 10:
        print(f"\n  ... and {len(priority) - 10} more (run again tomorrow for the next batch)")

    print("\nGSC UI: https://search.google.com/search-console")
    return 0


if __name__ == "__main__":
    sys.exit(main())
