#!/usr/bin/env python3
"""
Monthly / Quarterly / Yearly traffic rollup reports.

A single parameterized script that runs at one of three cadences:
    --period month     (1st of each month, covers prior month)
    --period quarter   (1st of Jan/Apr/Jul/Oct, covers prior quarter)
    --period year      (Jan 1, covers prior calendar year)

Differences from daily/weekly:
  - Different time windows (30 / 90 / 365 days)
  - Synthesis prompts framed for executive-level review:
      * Monthly: trends and tactical wins/losses
      * Quarterly: strategic narrative + plans for next quarter
      * Yearly: the year's story, what compounded, customer insights
  - Reads more historical context (e.g. yearly reads the past 4 yearly
    reports if they exist; quarterly reads the past 4 quarters; etc.)
  - Recipients identical to weekly (eric + team + jason)
  - Reports archived under analytics/reports/{monthly,quarterly,yearly}/
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DAILY_SCRIPT = ROOT / "scripts" / "daily-traffic-report.py"

# Reuse helpers + branded email renderer from the daily script
sys.path.insert(0, str(ROOT / "scripts"))
import importlib.util
_spec = importlib.util.spec_from_file_location("daily_report", str(DAILY_SCRIPT))
_daily = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_daily)

ENV = _daily.ENV
VENV_PY = "/tmp/ga4-test-venv/bin/python3"
MAX_RETRIES = 3
RETRY_BACKOFF = (2, 8, 20)


# ─── Period config ──────────────────────────────────────────────────
PERIODS = {
    "month": {
        "days": 30,
        "label": "Monthly",
        "dir": "monthly",
        "prior_count": 6,        # show last 6 months as trend context
        "synthesis_frame": (
            "Write a 8-12 sentence monthly traffic synthesis. Structure:\n"
            "1. **Headline** — one sentence, the most important thing this month.\n"
            "2. **Month-over-month deltas** — sessions, real users (excluding internal "
            "Summit Park/Kamas), GSC clicks/impressions, key events. Use specific numbers.\n"
            "3. **What worked** — pages/queries/channels that grew. Anything that "
            "appeared mid-month and is now compounding?\n"
            "4. **What didn't** — pages/queries/channels that fell or never lit up. "
            "Anything we shipped this month that hasn't earned traffic?\n"
            "5. **Customer signals** — which pages near the bottom of the funnel "
            "(/pricing, /assessment, /programs, /strategy-call) saw real engagement?\n"
            "6. **What to do next month** — concrete, prioritized.\n"
        ),
    },
    "quarter": {
        "days": 90,
        "label": "Quarterly",
        "dir": "quarterly",
        "prior_count": 4,
        "synthesis_frame": (
            "Write a 12-20 sentence quarterly executive review. This is the strategic "
            "version Eric and Jason use to plan next quarter's marketing. Structure:\n"
            "1. **Quarter headline** — one sentence summary of the quarter.\n"
            "2. **The funnel, top-to-bottom** — total sessions → real external "
            "users → assessment starts → strategy call clicks → checkout sessions. "
            "Walk the conversion math with specific numbers.\n"
            "3. **Channel mix evolution** — how did organic search vs direct vs "
            "referral change quarter-over-quarter? Where's growth coming from?\n"
            "4. **SEO momentum** — keyword/page growth, Google index coverage, "
            "international traffic emergence.\n"
            "5. **What we shipped this quarter and how it performed** — 165 SSG "
            "pages, glossary, comparison pages, programmatic SEO — which categories "
            "earned traffic, which didn't?\n"
            "6. **What's the leading indicator we should watch into next quarter?**\n"
            "7. **One specific recommendation** for the coming quarter.\n"
        ),
    },
    "year": {
        "days": 365,
        "label": "Year-In-Review",
        "dir": "yearly",
        "prior_count": 3,
        "synthesis_frame": (
            "Write a 20-30 sentence year-in-review for The Franchisor Blueprint. "
            "This is THE annual marketing report. Eric will read it and reflect on "
            "the year. Structure:\n"
            "1. **The year's headline** — what's the story?\n"
            "2. **Total reach** — sessions, real external users, total impressions.\n"
            "3. **The funnel** — site visitors → assessments → strategy calls → "
            "purchases. Walk the math top to bottom with numbers.\n"
            "4. **What compounded** — pages, queries, channels that grew steadily "
            "all year. Any moments that broke through?\n"
            "5. **What didn't compound** — content/categories that should have "
            "worked but didn't.\n"
            "6. **The customer the data describes** — based on top queries, top "
            "pages, geographic distribution, behavior patterns: what is the typical "
            "real visitor like?\n"
            "7. **Three lessons we'd tell ourselves a year ago.**\n"
            "8. **Where to invest next year** — specific, opinionated.\n"
            "Be honest about gaps and weaknesses. This isn't a pep talk — it's a "
            "real review."
        ),
    },
}


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


def build_report_md(period_label, days, ga4, gsc, bing):
    """Render the full report markdown for a rollup period."""
    out = []
    now = datetime.now(timezone.utc)
    out.append(f"# {period_label} Traffic Report")
    out.append(f"_Window: last {days} days · Generated {now.strftime('%Y-%m-%d %H:%M UTC')}_\n")

    if ga4.get("totals"):
        t = ga4["totals"][0]
        out.append("## GA4 totals")
        out.append(f"- Sessions: {int(t.get('sessions',0)):,}")
        out.append(f"- Active users: {int(t.get('activeUsers',0)):,}")
        out.append(f"- Pageviews: {int(t.get('screenPageViews',0)):,}")
        out.append(f"- Engaged sessions: {int(t.get('engagedSessions',0)):,}")
        out.append("")
    if ga4.get("by_channel"):
        out.append("**By channel**")
        out.append("| Channel | Sessions | Users |")
        out.append("|---|---:|---:|")
        for r in ga4["by_channel"][:10]:
            out.append(f"| {r.get('sessionDefaultChannelGroup','?')} | {int(r.get('sessions',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")
    if ga4.get("by_city"):
        out.append("**By city** (🏠 = internal)")
        out.append("| City | Region | Sessions | Users |")
        out.append("|---|---|---:|---:|")
        internal = ("Summit Park", "Kamas", "Francis")
        for r in ga4["by_city"][:25]:
            city = r.get("city") or "(unset)"
            region = r.get("region") or ""
            flag = " 🏠" if any(c.lower() in city.lower() for c in internal) else ""
            out.append(f"| {city}{flag} | {region} | {int(r.get('sessions',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")
    if ga4.get("top_pages"):
        out.append("**Top 25 pages**")
        out.append("| Page | Views | Users |")
        out.append("|---|---:|---:|")
        for r in ga4["top_pages"][:25]:
            out.append(f"| `{r.get('pagePath','?')}` | {int(r.get('screenPageViews',0)):,} | {int(r.get('activeUsers',0)):,} |")
        out.append("")
    if ga4.get("key_events"):
        out.append("**Events**")
        out.append("| Event | Count | Users |")
        out.append("|---|---:|---:|")
        for r in ga4["key_events"][:20]:
            out.append(f"| {r.get('eventName','?')} | {int(r.get('eventCount',0)):,} | {int(r.get('totalUsers',0)):,} |")
        out.append("")

    if gsc.get("by_date"):
        clicks = sum(r.get("clicks",0) for r in gsc["by_date"])
        impressions = sum(r.get("impressions",0) for r in gsc["by_date"])
        out.append("## Google Search Console")
        out.append(f"- Total clicks: {clicks:,}")
        out.append(f"- Total impressions: {impressions:,}")
        if impressions:
            out.append(f"- Avg CTR: {(clicks/impressions)*100:.2f}%")
        out.append("")
    if gsc.get("top_queries"):
        out.append("**Top queries**")
        out.append("| Query | Clicks | Imps | Avg pos |")
        out.append("|---|---:|---:|---:|")
        for r in gsc["top_queries"][:25]:
            out.append(f"| `{r['query']}` | {r['clicks']:,} | {r['impressions']:,} | {r['position']:.1f} |")
        out.append("")
    if gsc.get("top_pages"):
        out.append("**Top pages**")
        out.append("| Page | Clicks | Imps |")
        out.append("|---|---:|---:|")
        for r in gsc["top_pages"][:25]:
            page = r["page"].replace("https://www.thefranchisorblueprint.com", "") or "/"
            out.append(f"| `{page}` | {r['clicks']:,} | {r['impressions']:,} |")
        out.append("")
    if gsc.get("by_country"):
        out.append("**By country**")
        out.append("| Country | Clicks | Imps |")
        out.append("|---|---:|---:|")
        for r in gsc["by_country"][:15]:
            out.append(f"| {r['country'].upper()} | {r['clicks']:,} | {r['impressions']:,} |")
        out.append("")

    if bing.get("rank_stats"):
        out.append("## Bing")
        out.append("| Date | Imps | Clicks |")
        out.append("|---|---:|---:|")
        for r in bing["rank_stats"][:30]:
            out.append(f"| {r.get('Date','?')} | {r.get('Impressions',0):,} | {r.get('Clicks',0):,} |")
        out.append("")
    return "\n".join(out)


def synthesize(period_cfg, this_period_md, prior_periods):
    api_key = ENV.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "_(synthesis skipped: ANTHROPIC_API_KEY not set)_"
    prev = "\n\n".join(f"### {key}\n{md}" for key, md in prior_periods[:period_cfg["prior_count"]])
    if not prior_periods:
        prev = "_(no prior reports — this is the first run for this cadence)_"

    prompt = f"""You are the analytics observer for The Franchisor Blueprint, a franchise consulting firm. You write the {period_cfg["label"].lower()} traffic synthesis. Eric (operations) and Jason (founder, 30-yr franchise SME) read this to plan their marketing.

# This {period_cfg["label"].lower()}'s report
{this_period_md}

# Prior {period_cfg["label"].lower()}s for trend context
{prev}

# Your task
{period_cfg["synthesis_frame"]}

Use specific numbers. Format as markdown with bold for key facts. Skip sections that genuinely have nothing to say. Discount internal traffic (Summit Park UT = Eric, Kamas/Francis UT = Jason). Real external visitors are the signal.

Start the response immediately with the synthesis. No preamble.
"""

    import urllib.request
    body = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 3000,
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
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())["content"][0]["text"]
    except Exception as e:
        return f"_(synthesis failed: {str(e)[:200]})_"


def send_rollup_email(subject, html_body):
    """Sends to eric + team + jason (same recipients as weekly)."""
    api_key = ENV.get("RESEND_API_KEY")
    from_email = ENV.get("RESEND_FROM_EMAIL")
    recipient_str = ENV.get(
        "ROLLUP_REPORT_RECIPIENTS",
        "eric@thefranchisorblueprint.com,team@thefranchisorblueprint.com,jason@thefranchisorblueprint.com",
    )
    to_emails = [e.strip() for e in recipient_str.split(",") if e.strip()]
    if not api_key or not from_email:
        print("(rollup email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL missing)")
        return False
    import urllib.request
    body = json.dumps({"from": from_email, "to": to_emails, "subject": subject, "html": html_body}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=body, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "tfb-rollup-traffic-report/1.0",
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"Rollup email sent to {', '.join(to_emails)}")
            return True
    except Exception as e:
        print(f"Rollup email failed: {e}")
        return False


def period_key(period, today):
    """Key for the most-recently-COMPLETED period of this cadence.

    Monthly:    "2026-04" (April fully ended)
    Quarterly:  "2026-Q1" (Q1 fully ended; today is anywhere in Q2)
    Yearly:     "2025"   (calendar year fully ended)
    """
    if period == "month":
        first_of_this_month = today.replace(day=1)
        prior_month_last_day = first_of_this_month - timedelta(days=1)
        return prior_month_last_day.strftime("%Y-%m")
    if period == "quarter":
        current_q = (today.month - 1) // 3 + 1  # 1-4
        if current_q == 1:
            return f"{today.year - 1}-Q4"
        return f"{today.year}-Q{current_q - 1}"
    if period == "year":
        return f"{today.year - 1}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", choices=list(PERIODS.keys()), required=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-email", action="store_true")
    ap.add_argument("--no-commit", action="store_true")
    args = ap.parse_args()

    cfg = PERIODS[args.period]
    today = datetime.now(timezone.utc).date()
    key = period_key(args.period, today)
    out_dir = ROOT / "analytics" / "reports" / cfg["dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    status_file = out_dir / ".last-run-status.json"

    # Idempotency
    if not args.force and status_file.exists():
        try:
            s = json.loads(status_file.read_text())
            if s.get("last_success_key") == key and (out_dir / f"{key}.md").exists():
                print(f"{cfg['label']} report for {key} already exists.")
                return 0
        except: pass

    print(f"Pulling {cfg['days']}-day GA4...")
    ga4 = run_subreport("ga4-report.py", "--days", str(cfg["days"]))
    print(f"Pulling {cfg['days']}-day GSC...")
    gsc = run_subreport("gsc-report.py", "--days", str(cfg["days"]))
    print("Pulling Bing...")
    bing = run_subreport("bing-report.py")
    print(f"Pulling {cfg['days']}-day Stripe...")
    stripe = run_subreport("stripe-report.py", "--days", str(cfg["days"]))
    print(f"Pulling {cfg['days']}-day Supabase...")
    supabase = run_subreport("supabase-report.py", "--days", str(cfg["days"]))

    errors = []
    for name, data in [("GA4", ga4), ("GSC", gsc), ("Bing", bing),
                       ("Stripe", stripe), ("Supabase", supabase)]:
        if "error" in data: errors.append(f"{name}: {data['error'][:100]}")

    report = build_report_md(cfg["label"], cfg["days"], ga4, gsc, bing)
    # Append Stripe + funnel sections (reuse daily script formatters)
    if "error" not in stripe:
        report += "\n\n" + _daily._format_stripe_section(stripe)
    if "error" not in supabase:
        report += "\n\n" + _daily._format_supabase_section(supabase)
    (out_dir / f"{key}.md").write_text(report)
    (out_dir / f"{key}.json").write_text(json.dumps(
        {"ga4": ga4, "gsc": gsc, "bing": bing, "stripe": stripe, "supabase": supabase},
        indent=2, default=str
    ))

    # Pull prior period reports for trend context
    prior = []
    for f in sorted(out_dir.glob("*.md"), reverse=True):
        if "-summary" in f.name: continue
        if key in f.name: continue
        prior.append((f.name.replace(".md", ""), f.read_text()))
        if len(prior) >= cfg["prior_count"]: break

    print("Synthesizing via Claude...")
    synthesis = synthesize(cfg, report, prior)
    (out_dir / f"{key}-summary.md").write_text(f"# {cfg['label']} synthesis — {key}\n\n{synthesis}\n")

    if not args.no_email:
        email_html = _daily.render_branded_email(
            synthesis_md=synthesis,
            full_report_md=report,
            today_human=f"{cfg['label']} — {key}",
            errors=errors if errors else None,
        )
        send_rollup_email(f"TFB {cfg['label'].lower()} traffic — {key}", email_html)

    # Status update
    status = {
        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
        "last_attempt_key": key,
        "last_attempt_status": "success" if not errors else "partial",
    }
    if not errors:
        status["last_success_at"] = status["last_attempt_at"]
        status["last_success_key"] = key
    if errors:
        status["last_errors"] = errors
    status_file.write_text(json.dumps(status, indent=2))

    if not args.no_commit:
        try:
            subprocess.run(["git", "add", "analytics/reports/"], cwd=ROOT, check=True, capture_output=True)
            st = subprocess.run(["git", "status", "--porcelain", "analytics/reports/"], cwd=ROOT, capture_output=True, text=True)
            if st.stdout.strip():
                subprocess.run(["git", "commit", "-m", f"chore(analytics): {cfg['label'].lower()} traffic report — {key}"],
                              cwd=ROOT, check=True, capture_output=True)
                subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=True, capture_output=True)
                print(f"Committed {cfg['label'].lower()} report.")
        except Exception as e:
            print(f"Git commit failed: {e}")

    print("\n" + "="*50)
    print(f"{cfg['label'].upper()} SYNTHESIS for {key}:\n")
    print(synthesis)
    print("="*50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
