#!/usr/bin/env python3
"""
Monthly GSC URL Inspection sweep + new-page detection.

For each URL in the site's sitemap, calls Google Search Console's URL
Inspection API to check indexing status. Surfaces:

  • Pages NOT indexed (with the reason: "discovered, currently not
    indexed", "crawled, currently not indexed", "duplicate", etc.)
  • NEW pages added since the last sweep (so we know what to monitor
    for organic traffic going forward)
  • Pages whose status REGRESSED (was indexed, now isn't)

The output goes to analytics/reports/gsc-inspection/YYYY-MM.md and a
JSON snapshot for the next run to diff against.

Usage:
    python3 scripts/gsc-inspection-sweep.py [--force]

Schedule: monthly via launchd (after the monthly traffic report fires).

Note: GSC URL Inspection API has a quota of 2000 requests/day per
property. We have ~165 URLs so we're well under, but if we add lots
of pages we'd need to either batch across days or sample.
"""
import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"
SWEEP_DIR = ROOT / "analytics" / "reports" / "gsc-inspection"
SWEEP_DIR.mkdir(parents=True, exist_ok=True)


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    for k in ("GA4_OAUTH_CLIENT_ID", "GA4_OAUTH_CLIENT_SECRET",
              "GA4_OAUTH_REFRESH_TOKEN", "GSC_SITE_URL"):
        if not env.get(k):
            sys.exit(f"ERROR: {k} missing from .env.local")
    return env


def get_access_token(env):
    """Exchange refresh token for an access token (valid ~1 hour)."""
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


def inspect_url(access_token, site_url, page_url):
    """Call URL Inspection API for one page. Returns dict or None on error."""
    body = json.dumps({
        "inspectionUrl": page_url,
        "siteUrl": site_url,
    }).encode()
    req = urllib.request.Request(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        data=body,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "User-Agent": "tfb-gsc-sweep/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"_error": str(e)[:200]}


def get_sitemap_urls():
    """Fetch the live sitemap.xml and extract all <loc> URLs."""
    import re
    req = urllib.request.Request(
        "https://www.thefranchisorblueprint.com/sitemap.xml",
        headers={"User-Agent": "tfb-gsc-sweep/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        xml = r.read().decode()
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def find_previous_sweep():
    """Return path to the most recent prior monthly sweep (.json), or None."""
    files = sorted(SWEEP_DIR.glob("20*-*.json"), reverse=True)
    return files[0] if files else None


def diff_sweeps(prior_path, current_urls, current_results):
    """Compare current sweep to prior. Return (new_urls, removed_urls, regressions)."""
    if not prior_path or not prior_path.exists():
        return list(current_urls), [], []

    prior_data = json.loads(prior_path.read_text())
    prior_urls = set(prior_data.get("urls", []))
    prior_results = {r["url"]: r for r in prior_data.get("results", [])}

    current_set = set(current_urls)
    new_urls = sorted(current_set - prior_urls)
    removed_urls = sorted(prior_urls - current_set)

    regressions = []
    for r in current_results:
        url = r["url"]
        prev = prior_results.get(url)
        if not prev:
            continue
        # Was indexed, now isn't
        was_indexed = prev.get("verdict") == "PASS"
        is_indexed = r.get("verdict") == "PASS"
        if was_indexed and not is_indexed:
            regressions.append({
                "url": url,
                "prior_verdict": prev.get("verdict"),
                "current_verdict": r.get("verdict"),
                "current_coverage": r.get("coverageState"),
            })
    return new_urls, removed_urls, regressions


def collect():
    env = load_env()
    site_url = env["GSC_SITE_URL"]

    print(f"Fetching sitemap from production...")
    urls = get_sitemap_urls()
    print(f"  {len(urls)} URLs in sitemap")

    print("Getting GSC access token...")
    token = get_access_token(env)

    print("Inspecting each URL (this takes a few minutes)...")
    results = []
    for i, url in enumerate(urls):
        if (i + 1) % 25 == 0:
            print(f"  {i + 1}/{len(urls)}...")
        resp = inspect_url(token, site_url, url)
        if "_error" in resp:
            results.append({"url": url, "error": resp["_error"]})
            continue
        result = (resp.get("inspectionResult") or {}).get("indexStatusResult") or {}
        results.append({
            "url": url,
            "verdict": result.get("verdict"),  # PASS / FAIL / NEUTRAL / PARTIAL
            "coverageState": result.get("coverageState"),  # human-readable status
            "robotsTxtState": result.get("robotsTxtState"),
            "indexingState": result.get("indexingState"),
            "lastCrawlTime": result.get("lastCrawlTime"),
            "googleCanonical": result.get("googleCanonical"),
            "userCanonical": result.get("userCanonical"),
            "pageFetchState": result.get("pageFetchState"),
        })
        # Be polite to the API — small pause every 10 calls
        if (i + 1) % 10 == 0:
            time.sleep(1)

    return urls, results


def render_markdown(month_str, urls, results, new_urls, removed_urls, regressions):
    out = [f"# GSC Inspection Sweep — {month_str}"]
    out.append(f"_Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
               f"{len(urls)} URLs in sitemap_\n")

    indexed = [r for r in results if r.get("verdict") == "PASS"]
    not_indexed = [r for r in results if r.get("verdict") in ("FAIL", "NEUTRAL", "PARTIAL")]
    errors = [r for r in results if "error" in r]

    out.append("## Summary")
    out.append(f"- **Indexed:** {len(indexed)} of {len(urls)} ({len(indexed)/len(urls)*100:.1f}%)")
    out.append(f"- **Not indexed:** {len(not_indexed)}")
    if errors:
        out.append(f"- ⚠ API errors: {len(errors)}")
    out.append("")

    if new_urls:
        out.append(f"## 🆕 New URLs since last sweep ({len(new_urls)})")
        out.append("_These pages were added between sweeps — track their indexing status going forward._\n")
        for u in new_urls[:50]:
            out.append(f"- `{u.replace('https://www.thefranchisorblueprint.com', '')}`")
        if len(new_urls) > 50:
            out.append(f"- _... and {len(new_urls) - 50} more_")
        out.append("")

    if regressions:
        out.append(f"## ⚠️ Indexing regressions ({len(regressions)})")
        out.append("_These pages WERE indexed last sweep but aren't now. Investigate immediately._\n")
        out.append("| URL | Prior | Current | Coverage |")
        out.append("|---|---|---|---|")
        for r in regressions:
            url = r["url"].replace("https://www.thefranchisorblueprint.com", "") or "/"
            out.append(f"| `{url}` | {r['prior_verdict']} | {r['current_verdict']} | "
                       f"{r['current_coverage']} |")
        out.append("")

    if removed_urls:
        out.append(f"## Removed URLs ({len(removed_urls)})")
        out.append("_These URLs were in last sweep's sitemap but not this one._\n")
        for u in removed_urls[:25]:
            out.append(f"- `{u.replace('https://www.thefranchisorblueprint.com', '')}`")
        out.append("")

    if not_indexed:
        out.append(f"## Not-yet-indexed pages ({len(not_indexed)})")
        out.append("| URL | Coverage state | Indexing state |")
        out.append("|---|---|---|")
        for r in not_indexed:
            url = r["url"].replace("https://www.thefranchisorblueprint.com", "") or "/"
            out.append(f"| `{url}` | {r.get('coverageState', '?')} | "
                       f"{r.get('indexingState', '?')} |")
        out.append("")

    if errors:
        out.append("## API errors")
        for r in errors[:10]:
            out.append(f"- `{r['url'][:80]}`: {r['error'][:200]}")
        out.append("")

    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    today = datetime.now(timezone.utc).date()
    month_str = today.strftime("%Y-%m")
    out_path = SWEEP_DIR / f"{month_str}.md"
    raw_path = SWEEP_DIR / f"{month_str}.json"

    if out_path.exists() and not args.force:
        print(f"Sweep for {month_str} already exists. Use --force to re-run.")
        return 0

    prior_path = find_previous_sweep()

    urls, results = collect()
    new_urls, removed_urls, regressions = diff_sweeps(prior_path, urls, results)

    md = render_markdown(month_str, urls, results, new_urls, removed_urls, regressions)
    out_path.write_text(md)

    raw_path.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "month": month_str,
        "urls": urls,
        "results": results,
    }, indent=2, default=str))

    print(f"\nSweep written: {out_path.relative_to(ROOT)}")
    print(f"Raw data:       {raw_path.relative_to(ROOT)}")
    indexed = sum(1 for r in results if r.get("verdict") == "PASS")
    print(f"\nResult: {indexed}/{len(urls)} indexed ({indexed/len(urls)*100:.1f}%)")
    if new_urls:
        print(f"        {len(new_urls)} new URLs since last sweep")
    if regressions:
        print(f"        ⚠️ {len(regressions)} indexing regressions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
