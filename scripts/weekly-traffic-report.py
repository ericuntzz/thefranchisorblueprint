#!/usr/bin/env python3
"""
Weekly traffic report — Sunday evening rollup.

Differences from the daily report:
  - Window: last 7 days (not yesterday)
  - Recipients: eric + team + jason
  - Synthesis frame: weekly trends, leading indicators, week-over-week
    deltas, what's compounding. Less "what changed today," more
    "what's the trajectory?"
  - Reads the past 4 weekly reports (~1 month) for context, not just
    the past 7 daily reports.
  - Same idempotency + retry + branded email machinery as the daily.

Schedule: Sunday at 6:00 PM Mountain Time via a separate launchd job
(com.tfb.weekly-traffic-report.plist).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Reuse helpers + branded email renderer from the daily script.
ROOT = Path(__file__).resolve().parents[1]
DAILY_SCRIPT = ROOT / "scripts" / "daily-traffic-report.py"
sys.path.insert(0, str(ROOT / "scripts"))

# Import via importlib because the filename has a hyphen
import importlib.util
_spec = importlib.util.spec_from_file_location("daily_report", str(DAILY_SCRIPT))
_daily = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_daily)

REPORTS_DIR = ROOT / "analytics" / "reports"
WEEKLY_DIR = REPORTS_DIR / "weekly"
WEEKLY_DIR.mkdir(parents=True, exist_ok=True)
WEEKLY_STATUS = WEEKLY_DIR / ".last-run-status.json"

VENV_PY = "/tmp/ga4-test-venv/bin/python3"
ENV = _daily.ENV  # reuse the parsed env from the daily script
MAX_RETRIES = 3
RETRY_BACKOFF = (2, 8, 20)


def run_subreport(script_name, *args):
    cmd = [VENV_PY, str(ROOT / "scripts" / script_name), "--json", *args]
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if r.returncode == 0:
                return json.loads(r.stdout)
            last_err = r.stderr.strip()[:500] or f"non-zero exit ({r.returncode})"
        except Exception as e:
            last_err = str(e)[:200]
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_BACKOFF[attempt])
    return {"error": f"all {MAX_RETRIES} retries failed: {last_err}"}


def load_status():
    if not WEEKLY_STATUS.exists(): return {}
    try: return json.loads(WEEKLY_STATUS.read_text())
    except: return {}


def save_status(week_str, status, errors=None):
    cur = load_status()
    cur["last_attempt_at"] = datetime.now(timezone.utc).isoformat()
    cur["last_attempt_week"] = week_str
    cur["last_attempt_status"] = status
    if status == "success":
        cur["last_success_at"] = cur["last_attempt_at"]
        cur["last_success_week"] = week_str
    if errors: cur["last_errors"] = errors
    WEEKLY_STATUS.write_text(json.dumps(cur, indent=2))


def most_recent_sunday(d):
    """Given a date, return the most recent Sunday on or before it."""
    # Python's weekday(): Mon=0...Sun=6
    return d - timedelta(days=(d.weekday() + 1) % 7)


def already_ran_this_week(today):
    """True if we've successfully covered the most recent Sunday's week."""
    s = load_status()
    last_sunday = most_recent_sunday(today)
    last_sunday_str = last_sunday.strftime("%Y-%m-%d")
    return (
        s.get("last_success_week") == last_sunday_str
        and (WEEKLY_DIR / f"{last_sunday_str}.md").exists()
    )


def synthesize_weekly(this_week_md, recent_weeks):
    """Ask Claude for a weekly synthesis with longer-trend framing."""
    api_key = ENV.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "_(synthesis skipped: ANTHROPIC_API_KEY not set)_"

    prev = "\n\n".join(f"### Week ending {wk}\n{md}" for wk, md in recent_weeks[:4])
    if not recent_weeks:
        prev = "_(no previous weekly reports — this is the first weekly run)_"

    prompt = f"""You are an analytics observer for The Franchisor Blueprint, a franchise consulting firm. Each Sunday evening you write a weekly traffic synthesis. Eric and Jason read these on Sunday night to plan the week ahead.

# This week's report (last 7 days)
{this_week_md}

# Previous weekly reports (newest first, last 4 weeks for trend context)
{prev}

# Your task

Write a 5-10 sentence weekly synthesis structured as:

1. **Headline** — one sentence. The most important thing about this week.
2. **What changed week-over-week** — specific numbers. Sessions up/down N%? Organic clicks appearing for the first time? New geographic clusters? New top queries?
3. **What's compounding** — anything that's been growing for 2+ weeks. A query that was rank 30 three weeks ago and is now rank 12. A page that's gone from 0 visitors to consistent traffic. Etc.
4. **The signal vs the noise** — Summit Park UT = Eric (internal), Kamas/Francis UT = Jason (internal). Discount their traffic. Real outside visitors are the signal.
5. **What to watch this coming week** — leading indicators that suggest something might break out (or break down) soon.

Use specific numbers. Format as markdown with bold for key facts. Keep it tight — Eric and Jason want signal, not a data dump. Skip sections that genuinely have nothing to say.

Start the response immediately with the synthesis. No "Here's a summary" preamble.
"""

    import urllib.request
    body = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())["content"][0]["text"]
    except Exception as e:
        return f"_(synthesis failed: {str(e)[:200]})_"


def send_weekly_email(subject, html_body):
    api_key = ENV.get("RESEND_API_KEY")
    from_email = ENV.get("RESEND_FROM_EMAIL")
    # Weekly recipients = daily + jason@
    recipient_str = ENV.get(
        "WEEKLY_REPORT_RECIPIENTS",
        "eric@thefranchisorblueprint.com,team@thefranchisorblueprint.com,jason@thefranchisorblueprint.com",
    )
    to_emails = [e.strip() for e in recipient_str.split(",") if e.strip()]
    if not api_key or not from_email:
        print("(weekly email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL missing)")
        return False

    import urllib.request
    body = json.dumps({
        "from": from_email,
        "to": to_emails,
        "subject": subject,
        "html": html_body,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "tfb-weekly-traffic-report/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"Weekly email sent to {', '.join(to_emails)}")
            return True
    except Exception as e:
        print(f"Weekly email failed: {e}")
        return False


def synthesize_week_report(ga4, gsc, bing):
    """Build the weekly markdown report (full data dump)."""
    out = []
    now = datetime.now(timezone.utc)
    week_end = now.date()
    week_start = week_end - timedelta(days=6)
    out.append(f"# Weekly Traffic Report — {week_start} to {week_end}")
    out.append(f"_Generated {now.strftime('%Y-%m-%d %H:%M UTC')}_\n")

    # GA4 totals
    if ga4.get("totals"):
        t = ga4["totals"][0]
        out.append("## GA4 — last 7 days")
        out.append(f"- **Sessions:** {int(t.get('sessions',0)):,}")
        out.append(f"- **Active users:** {int(t.get('activeUsers',0)):,}")
        out.append(f"- **Pageviews:** {int(t.get('screenPageViews',0)):,}")
        out.append(f"- **Engaged sessions:** {int(t.get('engagedSessions',0)):,}")
        out.append("")

    # GA4 by channel
    if ga4.get("by_channel"):
        out.append("**By channel**")
        out.append("| Channel | Sessions | Users |")
        out.append("|---|---:|---:|")
        for r in ga4["by_channel"][:10]:
            out.append(f"| {r.get('sessionDefaultChannelGroup','?')} | {int(r.get('sessions',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")

    # GA4 by city — flag internal
    if ga4.get("by_city"):
        out.append("**By city** (🏠 = internal)")
        out.append("| City | Region | Sessions | Users |")
        out.append("|---|---|---:|---:|")
        internal = ("Summit Park", "Kamas", "Francis")
        for r in ga4["by_city"][:20]:
            city = r.get("city") or "(unset)"
            region = r.get("region") or ""
            flag = " 🏠" if any(c.lower() in city.lower() for c in internal) else ""
            out.append(f"| {city}{flag} | {region} | {int(r.get('sessions',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")

    if ga4.get("top_pages"):
        out.append("**Top 15 pages**")
        out.append("| Page | Views | Users |")
        out.append("|---|---:|---:|")
        for r in ga4["top_pages"][:15]:
            out.append(f"| `{r.get('pagePath','?')}` | {int(r.get('screenPageViews',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")

    # GSC — last 7 days
    if gsc.get("by_date"):
        clicks = sum(r.get("clicks",0) for r in gsc["by_date"])
        impressions = sum(r.get("impressions",0) for r in gsc["by_date"])
        out.append("## Google Search Console — last 7 days")
        out.append(f"- **Total clicks:** {clicks:,}")
        out.append(f"- **Total impressions:** {impressions:,}")
        if impressions:
            out.append(f"- **Avg CTR:** {(clicks/impressions)*100:.2f}%")
        out.append("")

    if gsc.get("top_queries"):
        out.append("**Top queries (this week)**")
        out.append("| Query | Clicks | Imps | Avg pos |")
        out.append("|---|---:|---:|---:|")
        for r in gsc["top_queries"][:15]:
            out.append(f"| `{r['query']}` | {r['clicks']:,} | {r['impressions']:,} | {r['position']:.1f} |")
        out.append("")

    if gsc.get("top_pages"):
        out.append("**Top pages (this week)**")
        out.append("| Page | Clicks | Imps | Avg pos |")
        out.append("|---|---:|---:|---:|")
        for r in gsc["top_pages"][:15]:
            page = r["page"].replace("https://www.thefranchisorblueprint.com", "") or "/"
            out.append(f"| `{page}` | {r['clicks']:,} | {r['impressions']:,} | {r['position']:.1f} |")
        out.append("")

    if gsc.get("by_country"):
        out.append("**By country**")
        out.append("| Country | Clicks | Imps |")
        out.append("|---|---:|---:|")
        for r in gsc["by_country"][:10]:
            out.append(f"| {r['country'].upper()} | {r['clicks']:,} | {r['impressions']:,} |")
        out.append("")

    # Bing
    out.append("## Bing")
    if bing.get("rank_stats"):
        out.append("**Rank & traffic (Bing's daily aggregate)**")
        out.append("| Date | Imps | Clicks |")
        out.append("|---|---:|---:|")
        for r in bing["rank_stats"][:14]:
            d = r.get("Date","?")
            i = r.get("Impressions",0); c = r.get("Clicks",0)
            out.append(f"| {d} | {i:,} | {c:,} |")
        out.append("")
    else:
        out.append("_(no Bing data this week)_\n")

    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-email", action="store_true")
    ap.add_argument("--no-commit", action="store_true")
    args = ap.parse_args()

    today = datetime.now(timezone.utc).date()
    # The "week ending" date is always the most recent Sunday. If today
    # is Sunday, that's today; otherwise it's the prior Sunday. This means
    # if the launchd job misses Sunday and fires Monday/Tuesday on wake,
    # the report still attributes to the correct week-ending date.
    last_sunday = most_recent_sunday(today)
    week_str = last_sunday.strftime("%Y-%m-%d")
    weekly_dir_path = WEEKLY_DIR / f"{week_str}.md"

    if already_ran_this_week(today) and not args.force:
        print(f"Weekly report for week ending {week_str} already exists.")
        return 0

    print("Pulling GA4 (last 7 days)...")
    ga4 = run_subreport("ga4-report.py", "--days", "7")
    print("Pulling GSC (last 7 days)...")
    gsc = run_subreport("gsc-report.py", "--days", "7")
    print("Pulling Bing...")
    bing = run_subreport("bing-report.py")
    print("Pulling Stripe (last 7 days)...")
    stripe = run_subreport("stripe-report.py", "--days", "7")
    print("Pulling Supabase (last 7 days)...")
    supabase = run_subreport("supabase-report.py", "--days", "7")
    print("Pulling Calendly (last 7 days)...")
    calendly = run_subreport("calendly-report.py", "--days", "7")
    print("Pulling Resend (last 7 days)...")
    resend = run_subreport("resend-report.py", "--days", "7")
    print("Pulling PageSpeed Insights (slow, may take 5+ min)...")
    pagespeed = run_subreport("pagespeed-report.py")

    errors = []
    for name, data in [("GA4", ga4), ("GSC", gsc), ("Bing", bing),
                       ("Stripe", stripe), ("Supabase", supabase),
                       ("Calendly", calendly), ("Resend", resend),
                       ("PageSpeed", pagespeed)]:
        if "error" in data: errors.append(f"{name}: {data['error'][:100]}")

    report = synthesize_week_report(ga4, gsc, bing)
    # Append all extra data sections (reuse formatters from daily script)
    if "error" not in stripe:
        report += "\n\n" + _daily._format_stripe_section(stripe)
    if "error" not in supabase:
        report += "\n\n" + _daily._format_supabase_section(supabase)
    if "error" not in calendly:
        report += "\n\n" + _daily._format_calendly_section(calendly)
    if "error" not in resend:
        report += "\n\n" + _daily._format_resend_section(resend)
    if "error" not in pagespeed:
        # Inline a compact PageSpeed section
        report += "\n\n## PageSpeed Insights\n"
        if pagespeed.get("metadata", {}).get("note"):
            report += f"\n_{pagespeed['metadata']['note']}_\n"
        by_url = {}
        for r in pagespeed.get("results", []):
            by_url.setdefault(r["url"], {})[r["strategy"]] = r
        report += "\n| URL | Mobile score | Desktop score | LCP (mobile p75 ms) |\n|---|---:|---:|---:|\n"
        for url, strats in by_url.items():
            m = strats.get("mobile", {})
            d = strats.get("desktop", {})
            path = url.replace("https://www.thefranchisorblueprint.com", "") or "/"
            report += (f"| `{path}` | {m.get('performance_score', '-')} | "
                       f"{d.get('performance_score', '-')} | "
                       f"{m.get('crux_lcp_p75_ms', '-')} |\n")
    weekly_dir_path.write_text(report)
    raw_path = WEEKLY_DIR / f"{week_str}.json"
    raw_path.write_text(json.dumps(
        {"ga4": ga4, "gsc": gsc, "bing": bing, "stripe": stripe,
         "supabase": supabase, "calendly": calendly, "resend": resend,
         "pagespeed": pagespeed},
        indent=2, default=str
    ))

    # Pull last 4 weekly reports for trend context
    print("Synthesizing weekly via Claude...")
    recent_weeks = []
    for f in sorted(WEEKLY_DIR.glob("20*-*.md"), reverse=True):
        if "-summary" in f.name: continue
        if week_str in f.name: continue
        recent_weeks.append((f.name.replace(".md", ""), f.read_text()))
        if len(recent_weeks) >= 4: break

    synthesis = synthesize_weekly(report, recent_weeks)
    summary_path = WEEKLY_DIR / f"{week_str}-summary.md"
    summary_path.write_text(f"# Weekly synthesis — week ending {week_str}\n\n{synthesis}\n")

    if not args.no_email:
        # Reuse the daily script's branded email renderer
        today_human = datetime.now(timezone.utc).strftime("%A, %B %d (week ending)")
        email_html = _daily.render_branded_email(
            synthesis_md=synthesis,
            full_report_md=report,
            today_human=today_human,
            errors=errors if errors else None,
        )
        send_weekly_email(f"TFB weekly traffic — week ending {week_str}", email_html)

    save_status(week_str, "success" if not errors else "partial", errors=errors)

    if not args.no_commit:
        try:
            subprocess.run(["git", "add", "analytics/reports/"], cwd=ROOT, check=True, capture_output=True)
            status = subprocess.run(["git", "status", "--porcelain", "analytics/reports/"], cwd=ROOT, capture_output=True, text=True)
            if status.stdout.strip():
                subprocess.run(
                    ["git", "commit", "-m", f"chore(analytics): weekly traffic report — week ending {week_str}\n\nAuto-committed by weekly-traffic-report.py"],
                    cwd=ROOT, check=True, capture_output=True,
                )
                subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=True, capture_output=True)
                print(f"Committed weekly report.")
        except Exception as e:
            print(f"Git commit failed: {e}")

    print("\n" + "="*50)
    print(f"WEEKLY SYNTHESIS for week ending {week_str}:\n")
    print(synthesis)
    print("="*50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
