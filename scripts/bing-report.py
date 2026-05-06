#!/usr/bin/env python3
"""
Bing Webmaster Tools traffic report — pulls impressions, clicks,
top queries, and indexing status from Bing's WMT API.

Usage:
    python3 scripts/bing-report.py [--days N] [--json]

Requires in .env.local:
    BING_API_KEY    — generate at bing.com/webmasters → Settings → API Access
    BING_SITE_URL   — verified site URL (e.g. https://www.thefranchisorblueprint.com)

Bing's WMT API uses a simple API key (no OAuth dance). Read-only access.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode

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
    required = ("BING_API_KEY", "BING_SITE_URL")
    missing = [k for k in required if not env.get(k)]
    if missing:
        sys.exit(f"ERROR: missing env vars: {missing}")
    return env

BASE = "https://ssl.bing.com/webmaster/api.svc/json"

def call(env, method, **params):
    """Call a Bing WMT JSON API method. All methods are GET with query params."""
    params["apikey"] = env["BING_API_KEY"]
    params["siteUrl"] = env["BING_SITE_URL"]
    url = f"{BASE}/{method}?{urlencode(params)}"
    req = Request(url, headers={"Accept": "application/json"})
    with urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    # Bing wraps responses in {"d": ...}
    return data.get("d", data)

def collect_report():
    env = load_env()
    out = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "site_url": env["BING_SITE_URL"],
        }
    }
    # Available methods (best-effort — not all may be enabled for all properties)
    try:
        out["query_stats"] = call(env, "GetQueryStats")[:25]
    except Exception as e:
        out["query_stats_error"] = str(e)[:200]
    try:
        out["page_stats"] = call(env, "GetPageStats")[:25]
    except Exception as e:
        out["page_stats_error"] = str(e)[:200]
    try:
        out["query_traffic_stats"] = call(env, "GetQueryTrafficStats")[:25]
    except Exception as e:
        out["query_traffic_stats_error"] = str(e)[:200]
    try:
        out["rank_stats"] = call(env, "GetRankAndTrafficStats")[:30]
    except Exception as e:
        out["rank_stats_error"] = str(e)[:200]
    try:
        out["crawl_stats"] = call(env, "GetCrawlStats")[:30]
    except Exception as e:
        out["crawl_stats_error"] = str(e)[:200]
    return out

def fmt_int(n):
    try: return f"{int(n):,}"
    except: return str(n)

def to_markdown(report):
    out = []
    md = report["metadata"]
    out.append(f"# Bing Webmaster Tools Report")
    out.append(f"_Site: {md['site_url']} · Generated {md['generated_at'][:19]} UTC_\n")

    if report.get("rank_stats"):
        out.append("## Rank & traffic (Bing's daily aggregate)")
        out.append("| Date | Impressions | Clicks |")
        out.append("|---|---:|---:|")
        for r in report["rank_stats"][:14]:
            d = r.get("Date") or r.get("date") or ""
            i = r.get("Impressions", r.get("impressions", 0))
            c = r.get("Clicks", r.get("clicks", 0))
            out.append(f"| {d} | {fmt_int(i)} | {fmt_int(c)} |")
        out.append("")

    if report.get("query_stats"):
        out.append("## Top queries")
        out.append("| Query | Avg position | Impressions | Clicks |")
        out.append("|---|---:|---:|---:|")
        for r in report["query_stats"][:20]:
            q = r.get("Query", "?")
            p = r.get("AvgImpressionPosition", r.get("avg_position", "?"))
            i = r.get("Impressions", 0)
            c = r.get("Clicks", 0)
            out.append(f"| `{q}` | {p} | {fmt_int(i)} | {fmt_int(c)} |")
        out.append("")

    if report.get("page_stats"):
        out.append("## Top pages")
        out.append("| Page | Impressions | Clicks |")
        out.append("|---|---:|---:|")
        for r in report["page_stats"][:20]:
            p = r.get("Page") or r.get("Url") or ""
            i = r.get("Impressions", 0)
            c = r.get("Clicks", 0)
            out.append(f"| `{p}` | {fmt_int(i)} | {fmt_int(c)} |")
        out.append("")

    if report.get("crawl_stats"):
        out.append("## Crawl stats (last 30 days)")
        out.append("| Date | Crawled pages |")
        out.append("|---|---:|")
        for r in report["crawl_stats"][:14]:
            d = r.get("Date", "?")
            c = r.get("CrawledPages", r.get("crawled_pages", 0))
            out.append(f"| {d} | {fmt_int(c)} |")
        out.append("")

    # Errors / missing data
    errors = {k: v for k, v in report.items() if k.endswith("_error")}
    if errors:
        out.append("## API call issues")
        for k, v in errors.items():
            out.append(f"- `{k}`: {v}")
        out.append("")

    return "\n".join(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    report = collect_report()
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(to_markdown(report))

if __name__ == "__main__":
    main()
