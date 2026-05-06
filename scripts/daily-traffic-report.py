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
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "analytics" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

VENV_PY = "/tmp/ga4-test-venv/bin/python3"

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
    """Run a subreport script and return its JSON output."""
    cmd = [VENV_PY, str(ROOT / "scripts" / script_name), "--json", *args]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            return {"error": r.stderr.strip()[:500] or "non-zero exit"}
        return json.loads(r.stdout)
    except Exception as e:
        return {"error": str(e)[:200]}

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

    prompt = f"""You are an analytics observer for The Franchisor Blueprint, a franchise consulting business at thefranchisorblueprint.com. Your job: each morning, write a brief "what's different since yesterday" synthesis of website traffic data, surfacing only meaningful changes. Eric reads these emails over coffee — he wants signal, not a data dump.

# Today's report (just generated)
{today_md}

# Previous reports (newest first, for trend context)
{prev_section}

# Your task

Write a 3-7 sentence synthesis of what's notably different from yesterday or recent days. Focus on:
- **First-time appearances:** organic search clicks for the first time, new geographic clusters, new top queries, new pages getting traffic
- **Big shifts:** sessions doubling/halving, sudden drops, channel mix changes
- **Meaningful trends:** a query that first appeared 3 days ago and is now ranking higher; a page that was getting steady traffic and is now spiking; a country that was 0 last week and is now showing impressions
- **Internal vs external:** Summit Park UT = Eric, Kamas/Francis UT = Jason. Discount their traffic. Real outside visitors are the signal.

If nothing meaningful happened — say so briefly. Don't manufacture insight.

Use specific numbers. Format as markdown. Don't repeat the underlying report content; just synthesize. Keep it tight — Eric reads this on his phone over coffee.

Start the response immediately with the synthesis. No preamble like "Here's a summary."
"""

    import urllib.request, urllib.error
    body = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 1024,
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
            resp = json.loads(r.read())
        return resp["content"][0]["text"]
    except Exception as e:
        return f"_(synthesis failed: {str(e)[:200]})_"


def send_email(subject, html_body):
    """Send the daily report via Resend."""
    api_key = ENV.get("RESEND_API_KEY")
    from_email = ENV.get("RESEND_FROM_EMAIL")
    to_email = ENV.get("REPORT_RECIPIENT_EMAIL", "eric@thefranchisorblueprint.com")
    if not api_key or not from_email:
        print("(email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL missing)")
        return False

    import urllib.request
    body = json.dumps({
        "from": from_email,
        "to": [to_email],
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
            print(f"Email sent to {to_email}")
            return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


def md_to_simple_html(md_text):
    """Tiny markdown → HTML for email. Handles headings, lists, tables, code, bold."""
    lines = md_text.split("\n")
    html, in_table, in_list = [], False, False
    for line in lines:
        if line.startswith("# "):
            html.append(f"<h1 style='color:#1e3a5f'>{line[2:]}</h1>")
        elif line.startswith("## "):
            html.append(f"<h2 style='color:#1e3a5f;margin-top:24px'>{line[3:]}</h2>")
        elif line.startswith("### "):
            html.append(f"<h3 style='color:#1e3a5f'>{line[4:]}</h3>")
        elif line.startswith("|") and not in_table:
            html.append("<table style='border-collapse:collapse;margin:8px 0'>")
            in_table = True
            cells = [c.strip() for c in line.strip("|").split("|")]
            html.append("<tr>" + "".join(f"<th style='border:1px solid #ddd;padding:6px 10px;background:#f4f4f4;text-align:left'>{c}</th>" for c in cells) + "</tr>")
        elif line.startswith("|") and in_table:
            if "---" in line: continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            html.append("<tr>" + "".join(f"<td style='border:1px solid #ddd;padding:6px 10px'>{c}</td>" for c in cells) + "</tr>")
        elif in_table and not line.startswith("|"):
            html.append("</table>"); in_table = False
            if line.strip(): html.append(f"<p>{line}</p>")
        elif line.startswith("- "):
            if not in_list: html.append("<ul>"); in_list = True
            html.append(f"<li>{line[2:]}</li>")
        elif in_list and not line.startswith("- "):
            html.append("</ul>"); in_list = False
            if line.strip(): html.append(f"<p>{line}</p>")
        elif line.startswith("_") and line.endswith("_"):
            html.append(f"<p style='color:#666;font-style:italic'>{line.strip('_')}</p>")
        elif line.strip():
            # Inline: **bold**, `code`
            line = line.replace("**", "")  # keep simple
            html.append(f"<p>{line}</p>")
    if in_table: html.append("</table>")
    if in_list: html.append("</ul>")
    return "<div style='font-family:-apple-system,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#222'>" + "\n".join(html) + "</div>"


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


def main():
    print("Pulling GA4 (yesterday)...")
    ga4 = run_subreport("ga4-report.py", "--days", "1")
    print("Pulling GSC (last 7 days)...")
    gsc = run_subreport("gsc-report.py", "--days", "7")
    print("Pulling Bing...")
    bing = run_subreport("bing-report.py")

    prev_path = find_previous_report()
    prev_md = prev_path.read_text() if prev_path else None
    if prev_path:
        print(f"Comparing to previous report: {prev_path.name}")

    report = synthesize_report(ga4, gsc, bing, previous_report_md=prev_md)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_path = REPORTS_DIR / f"{today}.md"
    out_path.write_text(report)

    # Also save raw JSON snapshot for richer trend analysis
    raw_path = REPORTS_DIR / f"{today}.json"
    raw_path.write_text(json.dumps(
        {"ga4": ga4, "gsc": gsc, "bing": bing}, indent=2, default=str
    ))

    print(f"\nReport written to: {out_path.relative_to(ROOT)}")
    print(f"Raw data:          {raw_path.relative_to(ROOT)}")

    # === Synthesize "what's different" via Claude ===
    print("\nSynthesizing what's different via Claude...")
    recent_reports = []
    for f in sorted(REPORTS_DIR.glob("20*-*.md"), reverse=True):
        if "-summary" in f.name: continue
        if today in f.name: continue
        recent_reports.append((f.name.replace(".md", ""), f.read_text()))
        if len(recent_reports) >= 7: break

    synthesis = synthesize_with_claude(report, recent_reports)
    summary_path = REPORTS_DIR / f"{today}-summary.md"
    summary_path.write_text(f"# Synthesis — {today}\n\n{synthesis}\n")
    print(f"Synthesis:         {summary_path.relative_to(ROOT)}")

    # === Email ===
    print("\nSending email...")
    today_human = datetime.now(timezone.utc).strftime("%A, %B %d")
    email_html = md_to_simple_html(
        f"# TFB Traffic — {today_human}\n\n## What's different\n\n{synthesis}\n\n---\n\n## Full report\n\n{report}"
    )
    send_email(f"TFB traffic — {today_human}", email_html)

    # === Commit reports to git ===
    print("\nCommitting reports to git...")
    git_commit_reports()

    print("\n" + "="*60)
    print("SYNTHESIS:\n")
    print(synthesis)
    print("\n" + "="*60)
    print("Done.")

if __name__ == "__main__":
    main()
