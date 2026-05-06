#!/usr/bin/env python3
"""
GA4 traffic report — pulls structured queries from Google Analytics 4
via the Data API using OAuth credentials stored in .env.local.

Usage:
    python3 scripts/ga4-report.py [--days N] [--json]

    --days N   Window for the report (default: 1, i.e. yesterday-only)
    --json     Output as JSON instead of markdown

Designed to be called by:
  - Humans: ad-hoc traffic checks
  - The daily-traffic-report.py orchestrator
  - Future scheduled routines

Requires the following in .env.local:
    GA4_OAUTH_CLIENT_ID
    GA4_OAUTH_CLIENT_SECRET
    GA4_OAUTH_REFRESH_TOKEN
    GA4_PROPERTY_ID

Dependencies (install once into a venv):
    pip install google-auth google-analytics-data google-auth-oauthlib
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Load .env.local manually (no python-dotenv dep needed)
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
                "GA4_OAUTH_REFRESH_TOKEN", "GA4_PROPERTY_ID")
    missing = [k for k in required if not env.get(k)]
    if missing:
        sys.exit(f"ERROR: missing env vars: {missing}")
    return env

def build_client(env):
    from google.oauth2.credentials import Credentials
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    creds = Credentials(
        token=None,
        refresh_token=env["GA4_OAUTH_REFRESH_TOKEN"],
        client_id=env["GA4_OAUTH_CLIENT_ID"],
        client_secret=env["GA4_OAUTH_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/analytics.readonly"],
    )
    return BetaAnalyticsDataClient(credentials=creds)

def query(client, property_id, dimensions, metrics, days, limit=20):
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric
    )
    if days == 1:
        date_range = DateRange(start_date="yesterday", end_date="yesterday")
    else:
        date_range = DateRange(start_date=f"{days}daysAgo", end_date="today")
    req = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[date_range],
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        limit=limit,
    )
    resp = client.run_report(req)
    return [
        {**{dimensions[i]: r.dimension_values[i].value for i in range(len(dimensions))},
         **{metrics[i]: r.metric_values[i].value for i in range(len(metrics))}}
        for r in resp.rows
    ]

def collect_report(days=1):
    """Pull a standard set of queries. Returns dict of named result sets."""
    env = load_env()
    client = build_client(env)
    prop = env["GA4_PROPERTY_ID"]

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "window_days": days,
            "property_id": prop,
        },
        # Top-level: total sessions, users, pageviews
        "totals": query(client, prop, [], [
            "sessions", "activeUsers", "screenPageViews",
            "engagedSessions", "averageSessionDuration",
        ], days, limit=1),
        # By channel — direct, organic search, organic shopping, etc.
        "by_channel": query(client, prop,
            ["sessionDefaultChannelGroup"],
            ["sessions", "activeUsers", "engagedSessions", "averageSessionDuration"],
            days, limit=15),
        # By source/medium — most granular attribution
        "by_source_medium": query(client, prop,
            ["sessionSource", "sessionMedium"],
            ["sessions", "activeUsers"],
            days, limit=20),
        # By city (so we can identify Eric/Jason vs real visitors)
        "by_city": query(client, prop,
            ["city", "region", "country"],
            ["sessions", "activeUsers"],
            days, limit=30),
        # Top pages
        "top_pages": query(client, prop,
            ["pagePath"],
            ["screenPageViews", "activeUsers"],
            days, limit=25),
        # Conversion events (key events)
        "key_events": query(client, prop,
            ["eventName"],
            ["eventCount", "totalUsers"],
            days, limit=30),
    }

def fmt_int(s):
    """Format possibly-string-int with thousands separators."""
    try: return f"{int(s):,}"
    except: return s

def fmt_dur(s):
    """Format avg session duration (seconds) as Xm Ys."""
    try:
        secs = float(s)
        m = int(secs // 60); s = int(secs % 60)
        return f"{m}m {s}s" if m else f"{s}s"
    except: return str(s)

def to_markdown(report, internal_cities=("Summit Park", "Kamas", "Francis")):
    out = []
    md = report["metadata"]
    out.append(f"# GA4 Traffic Report")
    out.append(f"_Window: last {md['window_days']} day(s) · Generated {md['generated_at'][:19]} UTC_\n")

    # Totals
    if report["totals"]:
        t = report["totals"][0]
        out.append("## Totals")
        out.append(f"- **Sessions:** {fmt_int(t.get('sessions', 0))}")
        out.append(f"- **Active users:** {fmt_int(t.get('activeUsers', 0))}")
        out.append(f"- **Pageviews:** {fmt_int(t.get('screenPageViews', 0))}")
        out.append(f"- **Engaged sessions:** {fmt_int(t.get('engagedSessions', 0))}")
        out.append(f"- **Avg session duration:** {fmt_dur(t.get('averageSessionDuration', 0))}")
        out.append("")

    # By channel
    if report["by_channel"]:
        out.append("## By channel")
        out.append("| Channel | Sessions | Users | Engaged | Avg duration |")
        out.append("|---|---:|---:|---:|---:|")
        for r in report["by_channel"]:
            out.append(f"| {r.get('sessionDefaultChannelGroup','(unset)')} | "
                       f"{fmt_int(r.get('sessions',0))} | {fmt_int(r.get('activeUsers',0))} | "
                       f"{fmt_int(r.get('engagedSessions',0))} | "
                       f"{fmt_dur(r.get('averageSessionDuration',0))} |")
        out.append("")

    # By city — flag internal locations
    if report["by_city"]:
        out.append("## By city (internal traffic flagged)")
        out.append("| City | Region | Sessions | Users | Note |")
        out.append("|---|---|---:|---:|---|")
        for r in report["by_city"]:
            city = r.get("city") or "(unset)"
            region = r.get("region") or ""
            note = ""
            if any(ic.lower() in city.lower() for ic in internal_cities):
                note = "🏠 internal"
            out.append(f"| {city} | {region} | {fmt_int(r.get('sessions',0))} | "
                       f"{fmt_int(r.get('activeUsers',0))} | {note} |")
        out.append("")

    # By source/medium
    if report["by_source_medium"]:
        out.append("## By source / medium")
        out.append("| Source / Medium | Sessions | Users |")
        out.append("|---|---:|---:|")
        for r in report["by_source_medium"]:
            sm = f"{r.get('sessionSource','?')} / {r.get('sessionMedium','?')}"
            out.append(f"| {sm} | {fmt_int(r.get('sessions',0))} | "
                       f"{fmt_int(r.get('activeUsers',0))} |")
        out.append("")

    # Top pages
    if report["top_pages"]:
        out.append("## Top pages")
        out.append("| Page | Views | Users |")
        out.append("|---|---:|---:|")
        for r in report["top_pages"]:
            out.append(f"| `{r.get('pagePath','?')}` | "
                       f"{fmt_int(r.get('screenPageViews',0))} | "
                       f"{fmt_int(r.get('activeUsers',0))} |")
        out.append("")

    # Key events
    if report["key_events"]:
        out.append("## Events")
        out.append("| Event | Count | Users |")
        out.append("|---|---:|---:|")
        for r in report["key_events"]:
            out.append(f"| {r.get('eventName','?')} | "
                       f"{fmt_int(r.get('eventCount',0))} | "
                       f"{fmt_int(r.get('totalUsers',0))} |")
        out.append("")

    return "\n".join(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=1,
                    help="Window in days (default: 1 = yesterday only)")
    ap.add_argument("--json", action="store_true",
                    help="Output JSON instead of markdown")
    args = ap.parse_args()

    report = collect_report(days=args.days)
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(to_markdown(report))

if __name__ == "__main__":
    main()
