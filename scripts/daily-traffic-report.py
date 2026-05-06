#!/usr/bin/env python3
"""
Daily traffic report orchestrator.

Pulls GA4 + GSC + Bing data, compares to previous reports for trend
analysis, writes a unified markdown report to analytics/reports/.

Designed to be run by:
  - A scheduled Claude Code routine (daily)
  - A human via `python3 scripts/daily-traffic-report.py`

The output report is intentionally readable as plain markdown AND
contains structured trend data the next run will pick up.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "analytics" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
STATUS_FILE = REPORTS_DIR / ".last-run-status.json"

VENV_PY = "/tmp/ga4-test-venv/bin/python3"

# How many days back to check for missed-run backfill. Bounded to avoid
# unbounded work if the script hasn't run for weeks.
MAX_BACKFILL_DAYS = 7

# Retry config for each sub-report API call
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = (2, 8, 20)  # exponential: 2s, 8s, 20s

# Load .env.local for synthesis + email
def _load_env():
    env = {}
    p = ROOT / ".env.local"
    if not p.exists(): return env
    for line in p.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            # Strip surrounding quotes (dotenv convention)
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    return env

ENV = _load_env()

def run_subreport(script_name, *args):
    """Run a subreport script and return its JSON output. Retries on failure."""
    cmd = [VENV_PY, str(ROOT / "scripts" / script_name), "--json", *args]
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if r.returncode == 0:
                return json.loads(r.stdout)
            last_err = r.stderr.strip()[:500] or f"non-zero exit ({r.returncode})"
        except Exception as e:
            last_err = str(e)[:200]
        if attempt < MAX_RETRIES - 1:
            wait = RETRY_BACKOFF_SECONDS[attempt]
            print(f"  [{script_name}] attempt {attempt+1} failed ({last_err[:80]}), retrying in {wait}s...")
            time.sleep(wait)
    return {"error": f"all {MAX_RETRIES} retries failed: {last_err}"}


def load_status():
    """Read .last-run-status.json, returns {} if absent or unparseable."""
    if not STATUS_FILE.exists():
        return {}
    try:
        return json.loads(STATUS_FILE.read_text())
    except Exception:
        return {}


def save_status(date_str, status, errors=None):
    """Write atomic status update so other agents can check liveness."""
    cur = load_status()
    cur["last_attempt_at"] = datetime.now(timezone.utc).isoformat()
    cur["last_attempt_date"] = date_str
    cur["last_attempt_status"] = status  # "success", "partial", "failure"
    if status == "success":
        cur["last_success_at"] = cur["last_attempt_at"]
        cur["last_success_date"] = date_str
    if errors:
        cur["last_errors"] = errors
    elif "last_errors" in cur and status == "success":
        del cur["last_errors"]
    STATUS_FILE.write_text(json.dumps(cur, indent=2))


def already_ran_today(today_str):
    """Idempotency check: did we already produce a successful report today?"""
    status = load_status()
    return (
        status.get("last_success_date") == today_str
        and (REPORTS_DIR / f"{today_str}.md").exists()
        and (REPORTS_DIR / f"{today_str}-summary.md").exists()
    )


def find_missed_weekdays(today, lookback_days=MAX_BACKFILL_DAYS):
    """Return list of weekday dates between (today - lookback) and yesterday
    that don't yet have a report file. Used to backfill if launchd missed runs.

    today: datetime.date object (UTC)
    """
    missed = []
    for n in range(1, lookback_days + 1):
        d = today - timedelta(days=n)
        # Skip weekends (Mon=0, Sun=6)
        if d.weekday() >= 5:
            continue
        if not (REPORTS_DIR / f"{d.strftime('%Y-%m-%d')}.md").exists():
            missed.append(d)
    return list(reversed(missed))  # oldest first

def find_previous_report():
    """Find the most recent report file (excluding today)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    files = sorted(REPORTS_DIR.glob("*.md"), reverse=True)
    for f in files:
        if today not in f.name:
            return f
    return None

def parse_totals_from_report(report_md):
    """Extract numerical totals from a previous markdown report."""
    out = {}
    for line in report_md.splitlines():
        # Match patterns like "- **Sessions:** 27" or "Sessions | 27"
        if "Sessions:" in line or "Active users:" in line or "Pageviews:" in line:
            try:
                key, val = line.rsplit(":", 1)
                key = key.replace("**", "").replace("-", "").strip()
                val = val.replace("**", "").replace(",", "").strip()
                out[key.lower()] = int(val) if val.isdigit() else val
            except: pass
    return out

def trend_arrow(current, previous):
    """Return ↑X / ↓X / → relative to previous."""
    try:
        c, p = float(current), float(previous)
        if p == 0:
            return "🆕" if c > 0 else "→"
        delta = c - p
        pct = (delta / p) * 100
        if abs(pct) < 5: return "→"
        return f"↑{pct:+.0f}%" if delta > 0 else f"↓{pct:+.0f}%"
    except: return ""

def synthesize_report(ga4, gsc, bing, previous_report_md=None):
    """Build the final markdown report with trends inline."""
    now = datetime.now(timezone.utc)
    out = [f"# Daily Traffic Report — {now.strftime('%Y-%m-%d')}"]
    out.append(f"_Generated {now.strftime('%Y-%m-%d %H:%M UTC')}_\n")

    # Trend baseline
    prev_totals = {}
    if previous_report_md:
        prev_totals = parse_totals_from_report(previous_report_md)

    # === Summary ===
    out.append("## At a glance\n")
    summary_rows = []

    # GA4 totals
    if ga4.get("totals"):
        t = ga4["totals"][0]
        for label, key in [("Sessions","sessions"), ("Active users","activeUsers"),
                           ("Pageviews","screenPageViews")]:
            cur = int(t.get(key, 0))
            arrow = trend_arrow(cur, prev_totals.get(label.lower(), 0)) if prev_totals else ""
            summary_rows.append(f"- **GA4 {label}:** {cur:,} {arrow}")
    elif "error" in ga4:
        summary_rows.append(f"- ⚠️ GA4 error: {ga4['error'][:100]}")

    # GSC totals
    if gsc.get("by_date"):
        clicks = sum(r.get("clicks", 0) for r in gsc["by_date"])
        impressions = sum(r.get("impressions", 0) for r in gsc["by_date"])
        summary_rows.append(f"- **GSC clicks:** {clicks:,}")
        summary_rows.append(f"- **GSC impressions:** {impressions:,}")
    elif "error" in gsc:
        summary_rows.append(f"- ⚠️ GSC error: {gsc['error'][:100]}")

    # Bing totals (best-effort — Bing data shape varies)
    if bing.get("rank_stats"):
        bi = sum(r.get("Impressions", 0) for r in bing["rank_stats"][:14])
        bc = sum(r.get("Clicks", 0) for r in bing["rank_stats"][:14])
        summary_rows.append(f"- **Bing impressions (14d):** {bi:,}")
        summary_rows.append(f"- **Bing clicks (14d):** {bc:,}")
    elif "error" in bing:
        summary_rows.append(f"- ⚠️ Bing error: {bing['error'][:100]}")

    out.extend(summary_rows)
    out.append("")

    # === GA4 detail ===
    out.append("## GA4 (yesterday)\n")
    if "error" not in ga4:
        if ga4.get("by_channel"):
            out.append("**By channel**")
            for r in ga4["by_channel"][:10]:
                ch = r.get("sessionDefaultChannelGroup", "?")
                s = r.get("sessions", 0)
                u = r.get("activeUsers", 0)
                out.append(f"- {ch}: {s} sessions, {u} users")
            out.append("")
        if ga4.get("by_city"):
            out.append("**By city** (🏠 = internal)")
            internal = ("Summit Park", "Kamas", "Francis")
            for r in ga4["by_city"][:15]:
                city = r.get("city") or "(unset)"
                region = r.get("region") or ""
                s = r.get("sessions", 0)
                u = r.get("activeUsers", 0)
                flag = " 🏠" if any(c.lower() in city.lower() for c in internal) else ""
                out.append(f"- {city}, {region}: {s} sessions, {u} users{flag}")
            out.append("")
        if ga4.get("top_pages"):
            out.append("**Top 10 pages**")
            for r in ga4["top_pages"][:10]:
                out.append(f"- `{r.get('pagePath')}` — {r.get('screenPageViews')} views")
            out.append("")

    # === GSC detail ===
    out.append("## GSC (last 7 days)\n")
    if "error" not in gsc:
        if gsc.get("top_queries"):
            out.append("**Top queries**")
            for r in gsc["top_queries"][:10]:
                out.append(f"- `{r['query']}` — {r['clicks']} clicks, "
                           f"{r['impressions']} impressions, pos {r['position']:.1f}")
            out.append("")
        if gsc.get("top_pages"):
            out.append("**Top pages by impressions**")
            for r in gsc["top_pages"][:10]:
                page = r["page"].replace("https://www.thefranchisorblueprint.com", "") or "/"
                out.append(f"- `{page}` — {r['clicks']} clicks, {r['impressions']} imps")
            out.append("")
        if gsc.get("by_country"):
            out.append("**By country**")
            for r in gsc["by_country"][:5]:
                out.append(f"- {r['country'].upper()}: {r['clicks']} clicks, "
                           f"{r['impressions']} imps")
            out.append("")

    # === Bing detail ===
    out.append("## Bing\n")
    if "error" not in bing:
        if bing.get("query_stats"):
            out.append("**Top queries**")
            for r in bing["query_stats"][:10]:
                q = r.get("Query", "?")
                i = r.get("Impressions", 0)
                c = r.get("Clicks", 0)
                out.append(f"- `{q}` — {c} clicks, {i} imps")
            out.append("")

    # === Self-learning section ===
    out.append("## Notes for next run\n")
    out.append("(this section is read by the next routine to maintain a thread)\n")
    if ga4.get("by_city"):
        external_users = sum(
            int(r.get("activeUsers", 0)) for r in ga4["by_city"]
            if not any(c.lower() in (r.get("city") or "").lower()
                       for c in ("Summit Park", "Kamas", "Francis"))
        )
        out.append(f"- **External users yesterday (excluding Eric/Jason):** {external_users}")
    if gsc.get("by_date"):
        clicks_today = sum(r.get("clicks", 0) for r in gsc["by_date"])
        out.append(f"- **GSC clicks last 7 days:** {clicks_today}")
    if previous_report_md:
        out.append("- **Previous report exists** — trends computed where possible.")
    else:
        out.append("- **First report run** — no previous report to compare to.")
    out.append("")

    return "\n".join(out)

def synthesize_with_claude(today_md, recent_reports):
    """Ask Claude to produce a 3-5 sentence "what's different" synthesis.

    today_md: this morning's full report (markdown)
    recent_reports: list of (date_str, full_md) for previous reports, newest first
    Returns: synthesis text (markdown).
    """
    api_key = ENV.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "_(synthesis skipped: ANTHROPIC_API_KEY not set in .env.local)_"

    # Build a compact context: today + last 7 days of reports if available
    prev_section = "\n\n".join(
        f"### {date}\n{md}" for date, md in recent_reports[:7]
    ) if recent_reports else "_(no previous reports — this is the first run)_"

    prompt = f"""You are an analytics observer for The Franchisor Blueprint, a franchise consulting business at thefranchisorblueprint.com. Each morning, write a brief "what's different" synthesis covering the FULL FUNNEL — site traffic, search visibility, real customer behavior, and conversions. Eric reads these emails over coffee — he wants signal across all stages of the funnel, not just traffic.

# Today's report (just generated — includes anomaly check, GA4, GSC, Bing, Stripe, Supabase funnel data)
{today_md}

# Previous reports (newest first, for trend context)
{prev_section}

# Your task

Write a 4-8 sentence synthesis. Walk down the funnel:

1. **Top of funnel (visibility/traffic):** GA4 sessions, real external users (excluding Summit Park = Eric, Kamas/Francis = Jason), GSC clicks/impressions, new geographic clusters, first-time queries.

2. **Middle of funnel (engagement):** Assessment starts, completions, completion rate. Did real prospect engagement track with traffic? A spike in traffic with no assessment lift = wrong audience or messaging gap.

3. **Bottom of funnel (conversion):** Stripe external purchases, contact form real submissions (not spam). Anonymous Stripe abandoners are interesting — they considered buying but bailed.

4. **Anomalies:** the report includes statistical anomaly detection (z-score vs 14-day baseline). If it flagged something, decide whether it's signal or noise — sometimes a single test can spike a metric.

Specific guidance:
- If nothing meaningful happened across the whole funnel: say so briefly in one sentence.
- Connect the dots when possible: "Sessions flat WoW but assessment completions doubled — the traffic we're getting is more qualified" — that kind of insight.
- Discount internal traffic (Summit Park / Kamas) explicitly.
- Don't manufacture insight. If you can't explain why something happened, say "worth watching" rather than guessing.

Format as markdown with **bold** for key facts. Tight sentences. Start immediately with the synthesis — no "Here's a summary" preamble.
"""

    import urllib.request, urllib.error, time
    body = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    # Retry up to 3 times on transient errors (529 overloaded, 503 unavailable,
    # 504 gateway timeout). Rate-limit (429) gets longer waits.
    for attempt in range(3):
        try:
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
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.loads(r.read())
            return resp["content"][0]["text"]
        except urllib.error.HTTPError as e:
            transient = e.code in (429, 502, 503, 504, 529)
            if transient and attempt < 2:
                wait = 30 * (2 ** attempt)  # 30s, 60s
                print(f"  Anthropic returned {e.code} (transient), retrying in {wait}s...")
                time.sleep(wait)
                continue
            return f"_(synthesis failed: HTTP {e.code} after {attempt+1} attempts)_"
        except Exception as e:
            if attempt < 2:
                time.sleep(15)
                continue
            return f"_(synthesis failed: {str(e)[:200]})_"


def send_email(subject, html_body):
    """Send the daily report via Resend."""
    api_key = ENV.get("RESEND_API_KEY")
    from_email = ENV.get("RESEND_FROM_EMAIL")
    # Default recipients: Eric + team. Override via REPORT_RECIPIENT_EMAIL
    # (comma-separated for multiple).
    recipient_str = ENV.get(
        "REPORT_RECIPIENT_EMAIL",
        "eric@thefranchisorblueprint.com,team@thefranchisorblueprint.com",
    )
    to_emails = [e.strip() for e in recipient_str.split(",") if e.strip()]
    if not api_key or not from_email:
        print("(email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL missing)")
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
            "User-Agent": "tfb-daily-traffic-report/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"Email sent to {', '.join(to_emails)}")
            return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


def _md_inline(text):
    """Inline markdown: **bold**, `code`, _italic_."""
    import re
    # **bold** → strong
    text = re.sub(r"\*\*([^\*]+)\*\*", r"<strong style='color:#1E3A5F;font-weight:700'>\1</strong>", text)
    # `code` → mono span
    text = re.sub(r"`([^`]+)`",
                  r"<code style='background:#F5F2E8;color:#1E3A5F;padding:1px 6px;border-radius:4px;font-family:Menlo,Monaco,monospace;font-size:0.92em'>\1</code>",
                  text)
    return text


def _md_block_to_html(md_text):
    """Block-level markdown → branded HTML.
    Handles headings, lists, tables, code blocks, italics, paragraphs.
    Inline-styled for email client compatibility.
    """
    lines = md_text.split("\n")
    html, in_table, in_list = [], False, False

    H_NAVY = "#1E3A5F"
    BODY_GREY = "#4F5562"
    CREAM = "#F5F2E8"
    BORDER = "rgba(30, 58, 95, 0.10)"

    H1 = f"color:{H_NAVY};font-size:26px;font-weight:800;line-height:1.25;margin:0 0 16px"
    H2 = f"color:{H_NAVY};font-size:18px;font-weight:700;margin:24px 0 10px"
    H3 = f"color:{H_NAVY};font-size:15px;font-weight:700;margin:18px 0 8px;text-transform:uppercase;letter-spacing:0.4px"
    P = f"color:{BODY_GREY};font-size:15px;line-height:1.65;margin:0 0 14px"
    LI = f"color:{BODY_GREY};font-size:15px;line-height:1.65;margin:0 0 6px"
    EMPH = f"color:#888B92;font-size:13px;font-style:italic;margin:0 0 14px"
    TABLE = "border-collapse:collapse;width:100%;margin:12px 0 18px;font-size:13.5px"
    TH = f"background:{CREAM};color:{H_NAVY};font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid {BORDER}"
    TD = f"color:{BODY_GREY};padding:8px 10px;border-bottom:1px solid {BORDER}"

    def close_open():
        nonlocal in_table, in_list
        if in_table: html.append("</tbody></table>"); in_table = False
        if in_list:  html.append("</ul>");           in_list  = False

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            close_open()
            continue
        if line.startswith("# "):
            close_open()
            html.append(f"<h1 style='{H1}'>{_md_inline(line[2:])}</h1>")
        elif line.startswith("## "):
            close_open()
            html.append(f"<h2 style='{H2}'>{_md_inline(line[3:])}</h2>")
        elif line.startswith("### "):
            close_open()
            html.append(f"<h3 style='{H3}'>{_md_inline(line[4:])}</h3>")
        elif line.lstrip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if "---" in line:
                continue  # markdown table separator
            if not in_table:
                if in_list: html.append("</ul>"); in_list = False
                html.append(f"<table style='{TABLE}'><thead><tr>" +
                            "".join(f"<th style='{TH}'>{_md_inline(c)}</th>" for c in cells) +
                            "</tr></thead><tbody>")
                in_table = True
            else:
                html.append("<tr>" +
                            "".join(f"<td style='{TD}'>{_md_inline(c)}</td>" for c in cells) +
                            "</tr>")
        elif line.startswith("- ") or line.startswith("* "):
            if in_table: close_open()
            if not in_list:
                html.append(f"<ul style='margin:0 0 18px;padding-left:22px'>")
                in_list = True
            html.append(f"<li style='{LI}'>{_md_inline(line[2:])}</li>")
        elif line.startswith("_") and line.endswith("_") and len(line) > 2:
            close_open()
            html.append(f"<p style='{EMPH}'>{line.strip('_')}</p>")
        else:
            close_open()
            html.append(f"<p style='{P}'>{_md_inline(line)}</p>")

    close_open()
    return "\n".join(html)


def render_branded_email(synthesis_md, full_report_md, today_human, errors=None):
    """Render the complete branded HTML email matching TFB's email layout.
    Mimics src/lib/email/templates/_layout.tsx (cream bg, white card, gold
    accents, footer with links + legal disclaimer).
    """
    error_block_html = ""
    if errors:
        error_block_html = (
            "<div style='background:#FEF3F2;border:1px solid #F5C5BD;"
            "border-radius:10px;padding:14px 18px;margin:0 0 20px'>"
            "<p style='color:#A94B3B;font-size:13px;font-weight:700;"
            "margin:0 0 6px;text-transform:uppercase;letter-spacing:0.6px'>"
            "⚠ Partial run</p>"
            "<p style='color:#4F5562;font-size:13.5px;line-height:1.6;margin:0'>"
            "Some data sources failed:</p>"
            "<ul style='color:#4F5562;font-size:13px;margin:6px 0 0;padding-left:20px'>"
            + "".join(f"<li>{e}</li>" for e in errors) +
            "</ul></div>"
        )

    eyebrow_style = (
        "color:#BC8A36;font-size:11px;font-weight:700;letter-spacing:1.5px;"
        "text-transform:uppercase;margin:0 0 10px"
    )
    heading_style = (
        "color:#1E3A5F;font-size:26px;font-weight:800;line-height:1.25;"
        "margin:0 0 18px"
    )

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TFB Traffic — {today_human}</title>
</head>
<body style="background:#F5F2E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:32px 0;width:100%">

    <!-- Header / logo -->
    <div style="padding:0 24px 24px;text-align:center">
      <img src="https://www.thefranchisorblueprint.com/logos/tfb-logo-color.png"
           alt="The Franchisor Blueprint" width="180" style="display:block;margin:0 auto" />
    </div>

    <!-- Main content card -->
    <div style="background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 14px rgba(30,58,95,0.06)">
      <p style="{eyebrow_style}">Daily Traffic Report</p>
      <h1 style="{heading_style}">{today_human}</h1>

      {error_block_html}

      <h2 style="color:#1E3A5F;font-size:18px;font-weight:700;margin:24px 0 10px">
        What's different
      </h2>
      <div style="background:#F5F2E8;border-radius:12px;padding:18px 22px;margin:0 0 28px">
        {_md_block_to_html(synthesis_md)}
      </div>

      <h2 style="color:#1E3A5F;font-size:18px;font-weight:700;margin:32px 0 10px">
        Full report
      </h2>
      {_md_block_to_html(full_report_md)}
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid rgba(30,58,95,0.08);margin:32px 24px 16px" />
    <div style="padding:0 24px 16px;text-align:center">
      <p style="color:#4F5562;font-size:13px;line-height:1.6;margin:0 0 8px">
        The Franchisor Blueprint · The Smartest, Most Affordable Path to Becoming a Franchisor
      </p>
      <p style="color:#888B92;font-size:12px;margin:0 0 12px">
        <a href="https://www.thefranchisorblueprint.com" style="color:#1E3A5F;text-decoration:underline">thefranchisorblueprint.com</a>
        &nbsp;·&nbsp;
        <a href="mailto:team@thefranchisorblueprint.com" style="color:#1E3A5F;text-decoration:underline">team@thefranchisorblueprint.com</a>
      </p>
      <p style="color:#888B92;font-size:11px;line-height:1.6;margin:0;font-style:italic">
        Auto-generated daily by the TFB analytics pipeline. Reports archived at
        <code style="font-family:Menlo,Monaco,monospace">analytics/reports/</code>
        in the repo.
      </p>
    </div>

  </div>
</body>
</html>"""


def git_commit_reports():
    """Stage + commit + push the new report files."""
    try:
        subprocess.run(["git", "add", "analytics/reports/"], cwd=ROOT, check=True, capture_output=True)
        # Check if there's anything to commit
        status = subprocess.run(["git", "status", "--porcelain", "analytics/reports/"], cwd=ROOT, capture_output=True, text=True)
        if not status.stdout.strip():
            print("No new reports to commit.")
            return
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        subprocess.run(
            ["git", "commit", "-m", f"chore(analytics): daily traffic report {today}\n\nAuto-committed by daily-traffic-report.py"],
            cwd=ROOT, check=True, capture_output=True,
        )
        subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=True, capture_output=True)
        print(f"Committed and pushed report {today}.")
    except subprocess.CalledProcessError as e:
        print(f"Git commit/push failed: {e.stderr.decode()[:200] if e.stderr else e}")


def _format_stripe_section(stripe):
    """Render the Stripe section of the daily report (markdown)."""
    out = ["## Stripe (yesterday)"]
    t = stripe.get("totals", {})
    out.append(f"- **External purchases:** {t.get('complete_paid_external', 0)}")
    out.append(f"- **External revenue:** ${t.get('external_revenue_usd', 0):,.2f}")
    out.append(f"- Internal/test purchases: {t.get('complete_paid_internal', 0)}")
    out.append(f"- Anonymous abandoners (expired without email): {t.get('expired', 0)}")
    out.append(f"- Refunds: {t.get('total_refunds', 0)} · Disputes: {t.get('total_disputes', 0)}")
    if stripe.get("external_sessions"):
        out.append("")
        out.append("**External purchases**")
        out.append("| Email | Amount | When |")
        out.append("|---|---:|---|")
        for s in stripe["external_sessions"][:10]:
            out.append(f"| {s.get('email', '?')} | ${s.get('amount_usd', 0):,.2f} | {s.get('created', '')[:16]} |")
    return "\n".join(out)


def _format_calendly_section(cal):
    """Render Calendly section."""
    out = ["## Calendly (strategy calls)"]
    if cal.get("not_configured"):
        out.append(f"⚠ {cal.get('setup_hint', 'CALENDLY_API_KEY not configured.')}")
        return "\n".join(out)
    t = cal.get("totals", {})
    out.append(f"- **External bookings (yesterday):** {t.get('external_bookings', 0)}")
    out.append(f"- Total events incl. internal: {t.get('events_in_window', 0)}")
    out.append(f"- Canceled: {t.get('canceled_in_window', 0)}")
    if cal.get("external_bookings"):
        out.append("")
        out.append("**Bookings**")
        for b in cal["external_bookings"][:10]:
            out.append(f"- {b['start_time'][:16]} — **{b.get('invitee_name','?')}** "
                       f"({b.get('invitee_email','')}) · {b.get('event_type','?')} · {b.get('status','?')}")
    return "\n".join(out)


def _format_resend_section(rs):
    """Render Resend section."""
    out = ["## Resend (email engagement)"]
    t = rs.get("totals", {})
    out.append(f"- Sent: **{t.get('sent', 0)}** · Delivered: {t.get('delivered', 0)} "
               f"({t.get('delivery_rate_pct', 0):.0f}%)")
    out.append(f"- Opened: {t.get('opened', 0)} ({t.get('open_rate_pct', 0):.0f}%) · "
               f"Clicked: {t.get('clicked', 0)} ({t.get('click_rate_pct', 0):.0f}%)")
    out.append(f"- Bounced: {t.get('bounced', 0)} ({t.get('bounce_rate_pct', 0):.1f}%) · "
               f"Spam complaints: {t.get('complained', 0)}")
    if rs.get("by_template_bucket"):
        out.append("")
        out.append("**Top subject patterns**")
        for k, v in list(rs["by_template_bucket"].items())[:5]:
            out.append(f"- {k}: {v}")
    return "\n".join(out)


def _format_supabase_section(sb):
    """Render the Supabase / funnel section."""
    out = ["## Funnel (Supabase)"]
    f = sb.get("assessment_funnel", {})
    out.append(f"- **Assessment starts (yesterday):** {f.get('starts_in_window', 0)}")
    out.append(f"- **Assessment completions (yesterday):** {f.get('completions_in_window', 0)}")
    cr = f.get("completion_rate_pct", 0)
    out.append(f"- Completion rate (yesterday): {cr:.1f}%")
    out.append(f"- 30-day rolling: {f.get('starts_last_30_days', 0)} starts · "
               f"{f.get('completions_last_30_days', 0)} completions "
               f"({f.get('completion_rate_30d_pct', 0):.1f}%)")

    bands = f.get("score_band_distribution_30d", {})
    if bands:
        bands_str = ", ".join(f"{b}: {c}" for b, c in sorted(bands.items(), key=lambda x: -x[1]))
        out.append(f"- 30d score-band mix: {bands_str}")

    if f.get("completions_detail"):
        out.append("")
        out.append("**Recent completions**")
        for c in f["completions_detail"][:8]:
            out.append(f"- {(c.get('completed_at') or '')[:16]} — "
                       f"{c.get('email') or '(no email)'} — "
                       f"score {c.get('total_score', '?')} · band {c.get('band', '?')}")

    cf = sb.get("contact_form", {})
    out.append("")
    out.append(f"**Contact form (yesterday):** {cf.get('real_submissions_in_window', 0)} real · "
               f"{cf.get('spam_submissions_in_window', 0)} spam")
    if cf.get("real_submissions_detail"):
        for s in cf["real_submissions_detail"][:5]:
            out.append(f"- {s.get('name', '')} ({s.get('email', '')}) — "
                       f"{s.get('program_interest', '?')}")
    return "\n".join(out)


def run_one_day(today_str, send_email_for_this_run=True, missed_dates=None):
    """Run one full report cycle for today_str (YYYY-MM-DD).

    Returns dict: {"status": "success"|"partial"|"failure", "errors": [...]}
    """
    print(f"\n=== Running report for {today_str} ===")
    errors = []
    missed_dates = missed_dates or []

    # Lazy import the anomaly module (in scripts/, file has hyphen so use importlib)
    import importlib.util
    _anom_spec = importlib.util.spec_from_file_location(
        "anomaly_detection", str(ROOT / "scripts" / "anomaly-detection.py"))
    _anom = importlib.util.module_from_spec(_anom_spec)
    _anom_spec.loader.exec_module(_anom)

    print("Pulling GA4 (yesterday)...")
    ga4 = run_subreport("ga4-report.py", "--days", "1")
    if "error" in ga4: errors.append(f"GA4: {ga4['error'][:100]}")

    print("Pulling GSC (last 7 days)...")
    gsc = run_subreport("gsc-report.py", "--days", "7")
    if "error" in gsc: errors.append(f"GSC: {gsc['error'][:100]}")

    print("Pulling Bing...")
    bing = run_subreport("bing-report.py")
    if "error" in bing: errors.append(f"Bing: {bing['error'][:100]}")

    print("Pulling Stripe (last 1 day)...")
    stripe = run_subreport("stripe-report.py", "--days", "1")
    if "error" in stripe: errors.append(f"Stripe: {stripe['error'][:100]}")

    print("Pulling Supabase (assessment funnel + contact form)...")
    supabase = run_subreport("supabase-report.py", "--days", "1")
    if "error" in supabase: errors.append(f"Supabase: {supabase['error'][:100]}")

    print("Pulling Calendly (strategy call bookings)...")
    calendly = run_subreport("calendly-report.py", "--days", "1")
    if "error" in calendly: errors.append(f"Calendly: {calendly['error'][:100]}")

    print("Pulling Resend (email engagement)...")
    resend = run_subreport("resend-report.py", "--days", "1")
    if "error" in resend: errors.append(f"Resend: {resend['error'][:100]}")

    prev_path = find_previous_report()
    prev_md = prev_path.read_text() if prev_path else None
    if prev_path:
        print(f"Comparing to previous report: {prev_path.name}")

    report = synthesize_report(ga4, gsc, bing, previous_report_md=prev_md)

    # Append the new data sources to the markdown report
    extras_md = []
    if "error" not in stripe:
        extras_md.append(_format_stripe_section(stripe))
    if "error" not in supabase:
        extras_md.append(_format_supabase_section(supabase))
    if "error" not in calendly:
        extras_md.append(_format_calendly_section(calendly))
    if "error" not in resend:
        extras_md.append(_format_resend_section(resend))
    if extras_md:
        report = report + "\n\n" + "\n\n".join(extras_md)

    # Run anomaly detection BEFORE writing today's file (so detection
    # uses prior days' history, not today's)
    today_raw = {"ga4": ga4, "gsc": gsc, "bing": bing, "stripe": stripe,
                 "supabase": supabase, "calendly": calendly, "resend": resend}
    anomalies = _anom.detect_anomalies(today_raw, today_str=today_str)
    anomaly_md = _anom.render_anomaly_section(anomalies)

    # Prepend anomaly section to the report (top of "what's new today")
    report = f"## Anomaly check\n\n{anomaly_md}\n\n" + report

    out_path = REPORTS_DIR / f"{today_str}.md"
    out_path.write_text(report)
    raw_path = REPORTS_DIR / f"{today_str}.json"
    raw_path.write_text(json.dumps(today_raw, indent=2, default=str))
    print(f"Report written: {out_path.relative_to(ROOT)}")

    # === Synthesize "what's different" via Claude ===
    print("Synthesizing via Claude...")
    recent_reports = []
    for f in sorted(REPORTS_DIR.glob("20*-*.md"), reverse=True):
        if "-summary" in f.name: continue
        if today_str in f.name: continue
        recent_reports.append((f.name.replace(".md", ""), f.read_text()))
        if len(recent_reports) >= 7: break

    synthesis = synthesize_with_claude(report, recent_reports)
    summary_path = REPORTS_DIR / f"{today_str}-summary.md"
    summary_path.write_text(f"# Synthesis — {today_str}\n\n{synthesis}\n")

    # === Email (only for the most recent run, not for backfill) ===
    if send_email_for_this_run:
        print("Sending email...")
        today_human = datetime.strptime(today_str, "%Y-%m-%d").strftime("%A, %B %d")
        # Surface missed-day notice in errors so it appears in the email banner
        banner_errors = list(errors)
        if missed_dates:
            banner_errors.insert(
                0,
                f"Note: missed scheduled run on {len(missed_dates)} prior weekday(s) "
                f"({', '.join(missed_dates)}) — only today's data is reflected below."
            )
        email_html = render_branded_email(
            synthesis_md=synthesis,
            full_report_md=report,
            today_human=today_human,
            errors=banner_errors if banner_errors else None,
        )
        send_email(f"TFB traffic — {today_human}", email_html)

    print("\n" + "="*50)
    print(f"SYNTHESIS for {today_str}:\n")
    print(synthesis)
    print("="*50)

    if errors:
        return {"status": "partial", "errors": errors}
    return {"status": "success", "errors": []}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true",
                        help="Re-run even if today already has a successful report")
    parser.add_argument("--no-backfill", action="store_true",
                        help="Skip backfilling missed weekdays")
    parser.add_argument("--no-email", action="store_true",
                        help="Skip email (for testing)")
    parser.add_argument("--no-commit", action="store_true",
                        help="Skip git commit (for testing)")
    args = parser.parse_args()

    today = datetime.now(timezone.utc).date()
    today_str = today.strftime("%Y-%m-%d")

    # === Idempotency: skip if today already ran successfully ===
    if already_ran_today(today_str) and not args.force:
        print(f"Today's report ({today_str}) already exists with success status.")
        print("Use --force to re-run.")
        return 0

    # === Detect missed weekdays (don't fabricate historical data) ===
    # If the script didn't run for one or more weekdays before today, GA4/GSC
    # data for those specific historical dates can still be queried via the
    # APIs — but the current sub-report scripts always pull "yesterday". Rather
    # than fabricate bad data, surface the gap in today's email so it's
    # transparent. Future enhancement: add --date flag to sub-reports for
    # accurate historical backfill.
    missed = [] if args.no_backfill else find_missed_weekdays(today)
    missed_strs = [d.strftime("%Y-%m-%d") for d in missed]
    if missed:
        print(f"\n⚠ Detected {len(missed)} missed weekday(s) since last run:")
        for d in missed_strs:
            print(f"  • {d}")
        print()

    # === Today's run ===
    try:
        result = run_one_day(
            today_str,
            send_email_for_this_run=not args.no_email,
            missed_dates=missed_strs,
        )
        save_status(today_str, result["status"], errors=result.get("errors"))
    except Exception as e:
        print(f"Today's run threw: {e}")
        save_status(today_str, "failure", errors=[str(e)[:200]])
        # Try to send a failure-notice email (branded)
        if not args.no_email:
            err_md = (
                f"# Daily traffic report failed\n\n"
                f"_The job threw an unhandled exception at "
                f"{datetime.now(timezone.utc).isoformat()}._\n\n"
                f"## Exception\n\n`{str(e)[:500]}`\n\n"
                f"## Where to look\n\n"
                f"Logs: `/Users/fin/Documents/The Franchisor Blueprint Website/"
                f"logs/daily-traffic-report.log`"
            )
            today_human = datetime.now(timezone.utc).strftime("%A, %B %d")
            send_email(
                f"⚠️ TFB traffic — daily report FAILED ({today_str})",
                render_branded_email(
                    synthesis_md=err_md,
                    full_report_md="_(no report generated due to failure above)_",
                    today_human=today_human,
                    errors=[str(e)[:200]],
                ),
            )
        return 1

    # === Commit all reports + status to git ===
    if not args.no_commit:
        print("\nCommitting reports to git...")
        git_commit_reports()

    return 0 if result["status"] == "success" else 2


if __name__ == "__main__":
    sys.exit(main())
