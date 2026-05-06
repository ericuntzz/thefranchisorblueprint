#!/usr/bin/env python3
"""
Calendly report — strategy call bookings, no-shows, completions.

Mid-funnel data. Tells us whether site visitors are converting to
actual conversations with Jason, which is the gating step before
anyone buys Navigator or Builder.

Setup (one-time):
  1. Go to https://calendly.com/integrations/api_webhooks
  2. Click "Create New Token" → name it "TFB Analytics" → copy
  3. Add to .env.local:  CALENDLY_API_KEY=<paste here>
  4. Also push to Vercel env vars

Usage:
    python3 scripts/calendly-report.py [--days N] [--json]
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"
INTERNAL_EMAILS = {
    "eric@thefranchisorblueprint.com",
    "team@thefranchisorblueprint.com",
    "jason@thefranchisorblueprint.com",
    "hello@thefranchisorblueprint.com",
    "eric.j.unterberger@gmail.com",
}


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    if "CALENDLY_API_KEY" not in env:
        # Soft fail: return a structured "not configured" report instead
        # of erroring out the orchestrator. This lets the rest of the
        # pipeline run even if Eric hasn't added the key yet.
        return None
    return env


def calendly_get(env, path, **params):
    qs = urlencode(params)
    url = f"https://api.calendly.com{path}"
    if qs: url += f"?{qs}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {env['CALENDLY_API_KEY']}",
        "Content-Type": "application/json",
        "User-Agent": "tfb-calendly-report/1.0",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def collect(days=1):
    env = load_env()
    if env is None:
        return {
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "window_days": days,
            },
            "not_configured": True,
            "setup_hint": (
                "CALENDLY_API_KEY not set in .env.local. Generate one at "
                "https://calendly.com/integrations/api_webhooks → Create New "
                "Token → paste into .env.local and push to Vercel."
            ),
        }

    now = datetime.now(timezone.utc)

    # Get the user's URI (needed to scope event queries)
    me = calendly_get(env, "/users/me")
    user_uri = me["resource"]["uri"]
    org_uri = me["resource"]["current_organization"]

    # Events scheduled in the window (regardless of when they were booked)
    # Calendly time format: ISO8601
    min_start = (now - timedelta(days=days)).isoformat().replace("+00:00", "Z")
    max_start = (now + timedelta(days=30)).isoformat().replace("+00:00", "Z")

    # Events that started/were scheduled in window
    events = calendly_get(env, "/scheduled_events",
                          user=user_uri,
                          min_start_time=min_start,
                          max_start_time=max_start,
                          count=100,
                          status="active",
                          ).get("collection", [])
    canceled = calendly_get(env, "/scheduled_events",
                            user=user_uri,
                            min_start_time=min_start,
                            max_start_time=max_start,
                            count=100,
                            status="canceled",
                            ).get("collection", [])

    # Filter to events whose START is within the window (avoid future events
    # for "what happened in the past N days" reporting)
    cutoff = now - timedelta(days=days)
    def in_window(e):
        try:
            start = datetime.fromisoformat(e["start_time"].replace("Z", "+00:00"))
            return cutoff <= start <= now
        except: return False
    completed_or_upcoming = [e for e in events if in_window(e)]
    canceled_in_window = [e for e in canceled if in_window(e)]

    # Pull invitees for completed events (to get email/name)
    enriched = []
    for e in completed_or_upcoming:
        try:
            ev_uuid = e["uri"].rsplit("/", 1)[-1]
            invitees = calendly_get(env, f"/scheduled_events/{ev_uuid}/invitees").get("collection", [])
            for inv in invitees:
                email = (inv.get("email") or "").lower()
                if email in INTERNAL_EMAILS:
                    continue
                enriched.append({
                    "start_time": e["start_time"],
                    "event_type": e.get("name"),
                    "status": e.get("status"),
                    "invitee_email": inv.get("email"),
                    "invitee_name": inv.get("name"),
                    "scheduled_at": inv.get("created_at"),
                    "rescheduled": inv.get("rescheduled", False),
                })
        except Exception:
            continue

    return {
        "metadata": {
            "generated_at": now.isoformat(),
            "window_days": days,
            "user": me["resource"]["name"],
        },
        "totals": {
            "events_in_window": len(completed_or_upcoming),
            "canceled_in_window": len(canceled_in_window),
            "external_bookings": len(enriched),
        },
        "external_bookings": enriched,
        "canceled_count": len(canceled_in_window),
    }


def to_markdown(report):
    out = ["# Calendly Report"]
    md = report["metadata"]
    out.append(f"_Window: last {md['window_days']} day(s) · Generated {md['generated_at'][:19]} UTC_\n")

    if report.get("not_configured"):
        out.append("⚠ **Not configured** — " + report["setup_hint"])
        return "\n".join(out)

    t = report["totals"]
    out.append("## Strategy calls")
    out.append(f"- **External bookings in window:** {t['external_bookings']}")
    out.append(f"- Total events in window (incl. internal): {t['events_in_window']}")
    out.append(f"- Canceled events: {t['canceled_in_window']}")
    out.append("")

    if report.get("external_bookings"):
        out.append("**External bookings**")
        out.append("| When | Type | Invitee | Status |")
        out.append("|---|---|---|---|")
        for b in report["external_bookings"][:15]:
            out.append(f"| {b['start_time'][:16]} | {b.get('event_type','?')} | "
                       f"{b.get('invitee_name','?')} ({b.get('invitee_email','')}) | "
                       f"{b.get('status','?')} |")
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
