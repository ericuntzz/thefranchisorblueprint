#!/usr/bin/env python3
"""
Google Search Console traffic report — pulls impressions, clicks,
top queries, and top pages from GSC for a verified property.

Usage:
    python3 scripts/gsc-report.py [--days N] [--json]

Requires the same GA4_OAUTH_* credentials in .env.local. The OAuth
client must have been authorized with the
`https://www.googleapis.com/auth/webmasters.readonly` scope (run
scripts/oauth-reauth.py if not yet authorized for GSC).

Plus:
    GSC_SITE_URL — must match the verified property in GSC, e.g.
                   "https://www.thefranchisorblueprint.com/" or
                   "sc-domain:thefranchisorblueprint.com"

Dependencies:
    pip install google-auth google-api-python-client
"""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"

def load_env():
    env = {}
    if not ENV_PATH.exists():
        sys.exit(f"ERROR: {ENV_PATH} not found")
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    required = ("GA4_OAUTH_CLIENT_ID", "GA4_OAUTH_CLIENT_SECRET",
                "GA4_OAUTH_REFRESH_TOKEN", "GSC_SITE_URL")
    missing = [k for k in required if not env.get(k)]
    if missing:
        sys.exit(f"ERROR: missing env vars: {missing}")
    return env

def build_client(env):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    creds = Credentials(
        token=None,
        refresh_token=env["GA4_OAUTH_REFRESH_TOKEN"],
        client_id=env["GA4_OAUTH_CLIENT_ID"],
        client_secret=env["GA4_OAUTH_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=[
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/webmasters.readonly",
        ],
    )
    return build("searchconsole", "v1", credentials=creds)

def query(service, site_url, dimensions, days, row_limit=25):
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    body = {
        "startDate": str(start),
        "endDate":   str(end),
        "dimensions": dimensions,
        "rowLimit":   row_limit,
        "type":       "web",
    }
    resp = service.searchanalytics().query(siteUrl=site_url, body=body).execute()
    rows = resp.get("rows", [])
    out = []
    for r in rows:
        rec = {
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": r.get("ctr", 0),
            "position": r.get("position", 0),
        }
        for i, d in enumerate(dimensions):
            rec[d] = r["keys"][i] if i < len(r["keys"]) else ""
        out.append(rec)
    return out

def collect_report(days=7):
    env = load_env()
    service = build_client(env)
    site = env["GSC_SITE_URL"]

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "window_days": days,
            "site_url": site,
        },
        # Daily trend
        "by_date": query(service, site, ["date"], days, row_limit=days+5),
        # Top queries
        "top_queries": query(service, site, ["query"], days, row_limit=25),
        # Top pages
        "top_pages": query(service, site, ["page"], days, row_limit=25),
        # By country
        "by_country": query(service, site, ["country"], days, row_limit=15),
        # By device
        "by_device": query(service, site, ["device"], days, row_limit=5),
    }

def fmt_int(n): return f"{int(n):,}"
def fmt_pct(n): return f"{n*100:.2f}%"
def fmt_pos(n): return f"{n:.1f}"

def to_markdown(report):
    out = []
    md = report["metadata"]
    out.append(f"# Google Search Console Report")
    out.append(f"_Window: last {md['window_days']} days · Site: {md['site_url']} · "
               f"Generated {md['generated_at'][:19]} UTC_\n")

    # Totals (sum across by_date)
    total_clicks = sum(r["clicks"] for r in report["by_date"])
    total_impressions = sum(r["impressions"] for r in report["by_date"])
    avg_pos = (sum(r["position"] * r["impressions"] for r in report["by_date"]) /
               total_impressions) if total_impressions else 0
    avg_ctr = (total_clicks / total_impressions) if total_impressions else 0

    out.append("## Totals")
    out.append(f"- **Clicks:** {fmt_int(total_clicks)}")
    out.append(f"- **Impressions:** {fmt_int(total_impressions)}")
    out.append(f"- **Avg CTR:** {fmt_pct(avg_ctr)}")
    out.append(f"- **Avg position:** {fmt_pos(avg_pos)}")
    out.append("")

    if report["top_queries"]:
        out.append("## Top queries")
        out.append("| Query | Clicks | Impressions | CTR | Avg pos |")
        out.append("|---|---:|---:|---:|---:|")
        for r in report["top_queries"][:25]:
            out.append(f"| `{r['query']}` | {fmt_int(r['clicks'])} | "
                       f"{fmt_int(r['impressions'])} | {fmt_pct(r['ctr'])} | "
                       f"{fmt_pos(r['position'])} |")
        out.append("")

    if report["top_pages"]:
        out.append("## Top pages")
        out.append("| Page | Clicks | Impressions | CTR | Avg pos |")
        out.append("|---|---:|---:|---:|---:|")
        for r in report["top_pages"][:25]:
            page = r["page"].replace("https://www.thefranchisorblueprint.com", "") or "/"
            out.append(f"| `{page}` | {fmt_int(r['clicks'])} | "
                       f"{fmt_int(r['impressions'])} | {fmt_pct(r['ctr'])} | "
                       f"{fmt_pos(r['position'])} |")
        out.append("")

    if report["by_country"]:
        out.append("## By country")
        out.append("| Country | Clicks | Impressions |")
        out.append("|---|---:|---:|")
        for r in report["by_country"][:15]:
            out.append(f"| {r['country'].upper()} | {fmt_int(r['clicks'])} | "
                       f"{fmt_int(r['impressions'])} |")
        out.append("")

    if report["by_device"]:
        out.append("## By device")
        out.append("| Device | Clicks | Impressions |")
        out.append("|---|---:|---:|")
        for r in report["by_device"]:
            out.append(f"| {r['device']} | {fmt_int(r['clicks'])} | "
                       f"{fmt_int(r['impressions'])} |")
        out.append("")

    return "\n".join(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    report = collect_report(days=args.days)
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(to_markdown(report))

if __name__ == "__main__":
    main()
