#!/usr/bin/env python3
"""
Supabase report — assessment funnel + contact form submissions.

Pulls data straight from the Supabase REST API using the service role
key. The funnel data is the single biggest missing piece in our current
analytics — it tells us whether traffic is converting to engaged
prospects, not just visitors.

Usage:
    python3 scripts/supabase-report.py [--days N] [--json]
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


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    for k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not env.get(k):
            sys.exit(f"ERROR: {k} missing from .env.local")
    return env


def supabase_get(env, table, **params):
    """GET helper for Supabase REST. Returns a list."""
    base = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    qs = urlencode(params)
    url = f"{base}/rest/v1/{table}?{qs}"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def collect(days=1):
    env = load_env()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()
    cutoff_30 = (now - timedelta(days=30)).isoformat()

    # ── Assessment funnel ───────────────────────────
    # All sessions started in window
    started = supabase_get(env, "assessment_sessions",
                           select="id,started_at,completed_at,total_score,band,email,source",
                           **{"started_at": f"gte.{cutoff}"},
                           order="started_at.desc",
                           limit=500)

    # Completed in window (regardless of when started — completion is the conversion event)
    completed = supabase_get(env, "assessment_sessions",
                             select="id,started_at,completed_at,total_score,band,email,source",
                             **{"completed_at": f"gte.{cutoff}"},
                             order="completed_at.desc",
                             limit=500)

    # 30-day rolling for trend
    started_30 = supabase_get(env, "assessment_sessions",
                              select="id,started_at,completed_at,total_score,band",
                              **{"started_at": f"gte.{cutoff_30}"},
                              limit=2000)

    completed_30 = [s for s in started_30 if s.get("completed_at")]

    # Score distribution among completions
    bands = {}
    for s in completed_30:
        b = s.get("band") or "(unset)"
        bands[b] = bands.get(b, 0) + 1

    # Source attribution among recent starts
    sources = {}
    for s in started:
        src = s.get("source") or "(unset)"
        sources[src] = sources.get(src, 0) + 1

    # ── Contact form ───────────────────────────────
    contacts = supabase_get(env, "contact_submissions",
                            select="id,created_at,email,first_name,last_name,business_name,program_interest,message",
                            **{"created_at": f"gte.{cutoff}"},
                            order="created_at.desc",
                            limit=200)

    # Spam heuristic: messages mentioning domain registration / SEO services
    spam_keywords = ["register", "seo services", "back link", "link building",
                     "guest post", "affordable price", ".onmicrosoft", "domain offer"]
    def is_spam(c):
        msg = (c.get("message") or "").lower()
        return any(kw in msg for kw in spam_keywords)

    real_contacts = [c for c in contacts if not is_spam(c)]
    spam_contacts = [c for c in contacts if is_spam(c)]

    return {
        "metadata": {
            "generated_at": now.isoformat(),
            "window_days": days,
        },
        "assessment_funnel": {
            "starts_in_window": len(started),
            "completions_in_window": len(completed),
            "completion_rate_pct": (len(completed) / len(started) * 100) if started else 0,
            "starts_last_30_days": len(started_30),
            "completions_last_30_days": len(completed_30),
            "completion_rate_30d_pct": (len(completed_30) / len(started_30) * 100) if started_30 else 0,
            "score_band_distribution_30d": bands,
            "source_attribution_in_window": sources,
            "completions_detail": [
                {
                    "completed_at": c.get("completed_at"),
                    "started_at": c.get("started_at"),
                    "email": c.get("email"),
                    "total_score": c.get("total_score"),
                    "band": c.get("band"),
                    "source": c.get("source"),
                }
                for c in completed[:25]
            ],
        },
        "contact_form": {
            "submissions_in_window": len(contacts),
            "real_submissions_in_window": len(real_contacts),
            "spam_submissions_in_window": len(spam_contacts),
            "real_submissions_detail": [
                {
                    "created_at": c.get("created_at"),
                    "email": c.get("email"),
                    "name": f"{c.get('first_name','')} {c.get('last_name','')}".strip(),
                    "business": c.get("business_name"),
                    "program_interest": c.get("program_interest"),
                }
                for c in real_contacts[:15]
            ],
        },
    }


def to_markdown(report):
    out = ["# Supabase Report (Assessment Funnel + Contact Form)"]
    md = report["metadata"]
    out.append(f"_Window: last {md['window_days']} day(s) · Generated {md['generated_at'][:19]} UTC_\n")

    f = report["assessment_funnel"]
    out.append("## Assessment funnel")
    out.append(f"- **In window:** {f['starts_in_window']} starts · {f['completions_in_window']} completions ({f['completion_rate_pct']:.1f}%)")
    out.append(f"- **30-day rolling:** {f['starts_last_30_days']} starts · {f['completions_last_30_days']} completions ({f['completion_rate_30d_pct']:.1f}%)")
    out.append("")

    if f["score_band_distribution_30d"]:
        out.append("**Score band distribution (30d completions)**")
        for band, count in sorted(f["score_band_distribution_30d"].items(), key=lambda x: -x[1]):
            out.append(f"- {band}: {count}")
        out.append("")

    if f["source_attribution_in_window"]:
        out.append("**Source attribution (window)**")
        for src, count in sorted(f["source_attribution_in_window"].items(), key=lambda x: -x[1]):
            out.append(f"- {src}: {count}")
        out.append("")

    if f["completions_detail"]:
        out.append("**Recent completions**")
        out.append("| When | Email | Score | Band | Source |")
        out.append("|---|---|---:|---|---|")
        for c in f["completions_detail"][:15]:
            out.append(f"| {(c['completed_at'] or '')[:16]} | {c.get('email') or '(no email)'} | "
                       f"{c.get('total_score') or '?'} | {c.get('band') or '?'} | "
                       f"{c.get('source') or '?'} |")
        out.append("")

    c = report["contact_form"]
    out.append("## Contact form")
    out.append(f"- Real submissions in window: **{c['real_submissions_in_window']}**")
    out.append(f"- Spam (filtered): {c['spam_submissions_in_window']}")
    out.append("")
    if c["real_submissions_detail"]:
        out.append("**Real submissions**")
        for s in c["real_submissions_detail"][:10]:
            out.append(f"- {s['created_at'][:16]} — **{s.get('name','')}** ({s.get('email','')}) "
                       f"— interest: {s.get('program_interest','?')} — {s.get('business','')}")
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
