#!/usr/bin/env python3
"""
Resend report — email lifecycle engagement.

Pulls recent emails sent via Resend and aggregates by:
  - Status (delivered / opened / clicked / bounced / complained)
  - From-template (parsed from the subject line — best-effort)
  - Recipient domain (to spot internal vs external)

Resend's REST API exposes per-email `last_event` which is the freshest
status the email reached. Aggregating those gives us a delivery + open
+ click rate proxy. (Resend also has a /events endpoint with full
event history, but that's per-email; aggregation across the campaign
is best done via webhook persistence — TODO if we need it.)

Usage:
    python3 scripts/resend-report.py [--days N] [--json]

Reads RESEND_API_KEY from .env.local (already set up).
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    if "RESEND_API_KEY" not in env:
        sys.exit("ERROR: RESEND_API_KEY missing from .env.local")
    return env


def resend_list_emails(env, limit=100, after=None):
    """List emails via Resend API. Pages via `after` cursor."""
    url = f"https://api.resend.com/emails?limit={limit}"
    if after:
        url += f"&after={after}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {env['RESEND_API_KEY']}",
        "User-Agent": "tfb-resend-report/1.0",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def collect(days=1):
    env = load_env()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    # Pull recent emails — paginate up to a reasonable limit
    all_emails = []
    cursor = None
    pages = 0
    MAX_PAGES = 5  # 5 × 100 = 500 emails max
    while pages < MAX_PAGES:
        resp = resend_list_emails(env, limit=100, after=cursor)
        batch = resp.get("data", [])
        if not batch:
            break
        all_emails.extend(batch)
        # Stop paginating if oldest email in batch is before our cutoff
        oldest = batch[-1].get("created_at")
        if oldest:
            try:
                oldest_dt = datetime.fromisoformat(oldest.replace("Z", "+00:00"))
                if oldest_dt < cutoff:
                    break
            except: pass
        cursor = resp.get("next_cursor") or batch[-1].get("id")
        if not cursor:
            break
        pages += 1

    # Filter to window
    in_window = []
    for e in all_emails:
        try:
            created = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
            if cutoff <= created <= now:
                in_window.append(e)
        except: pass

    # Aggregate by last_event
    statuses = {}
    template_buckets = {}
    domain_buckets = {}
    for e in in_window:
        st = e.get("last_event") or "unknown"
        statuses[st] = statuses.get(st, 0) + 1

        # Bucket by subject prefix (a rough proxy for template)
        subj = e.get("subject") or ""
        # Normalize: strip dynamic content like "(2026-05-06)" or names
        bucket = subj.split("—")[0].split(":")[0].strip()[:60] or "(no subject)"
        template_buckets[bucket] = template_buckets.get(bucket, 0) + 1

        # Recipient domain
        to_list = e.get("to") or []
        if to_list and isinstance(to_list, list):
            domain = to_list[0].split("@")[-1] if "@" in to_list[0] else "(unknown)"
            domain_buckets[domain] = domain_buckets.get(domain, 0) + 1

    sent = len(in_window)
    delivered = sum(c for st, c in statuses.items() if st in ("delivered", "opened", "clicked"))
    opened = statuses.get("opened", 0) + statuses.get("clicked", 0)
    clicked = statuses.get("clicked", 0)
    bounced = statuses.get("bounced", 0)
    complained = statuses.get("complained", 0)

    return {
        "metadata": {
            "generated_at": now.isoformat(),
            "window_days": days,
        },
        "totals": {
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "bounced": bounced,
            "complained": complained,
            "delivery_rate_pct": (delivered / sent * 100) if sent else 0,
            "open_rate_pct": (opened / delivered * 100) if delivered else 0,
            "click_rate_pct": (clicked / delivered * 100) if delivered else 0,
            "bounce_rate_pct": (bounced / sent * 100) if sent else 0,
        },
        "by_status": statuses,
        "by_template_bucket": dict(sorted(template_buckets.items(), key=lambda x: -x[1])[:15]),
        "by_recipient_domain": dict(sorted(domain_buckets.items(), key=lambda x: -x[1])[:10]),
    }


def to_markdown(report):
    out = ["# Resend Report (Email Engagement)"]
    md = report["metadata"]
    out.append(f"_Window: last {md['window_days']} day(s) · Generated {md['generated_at'][:19]} UTC_\n")

    t = report["totals"]
    out.append("## Email volume + engagement")
    out.append(f"- **Sent:** {t['sent']}")
    out.append(f"- Delivered: {t['delivered']} ({t['delivery_rate_pct']:.1f}%)")
    out.append(f"- Opened: {t['opened']} ({t['open_rate_pct']:.1f}% of delivered)")
    out.append(f"- Clicked: {t['clicked']} ({t['click_rate_pct']:.1f}% of delivered)")
    out.append(f"- Bounced: {t['bounced']} ({t['bounce_rate_pct']:.1f}%)")
    out.append(f"- Complained (spam reports): {t['complained']}")
    out.append("")

    if report["by_template_bucket"]:
        out.append("**Top subject patterns**")
        for k, v in list(report["by_template_bucket"].items())[:10]:
            out.append(f"- {k}: {v}")
        out.append("")

    if report["by_recipient_domain"]:
        out.append("**By recipient domain**")
        for k, v in list(report["by_recipient_domain"].items()):
            out.append(f"- {k}: {v}")
        out.append("")

    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    report = collect(args.days)
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(to_markdown(report))


if __name__ == "__main__":
    main()
