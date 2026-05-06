#!/usr/bin/env python3
"""
Stripe report — pulls checkout sessions, payments, refunds, disputes
for a given window. Outputs JSON or markdown.

Usage:
    python3 scripts/stripe-report.py [--days N] [--json]

Notes:
- Requires STRIPE_SECRET_KEY in .env.local
- Excludes internal test emails from "real customer" stats so the
  numbers reflect actual external buyer behavior.
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

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
    if "STRIPE_SECRET_KEY" not in env:
        sys.exit("ERROR: STRIPE_SECRET_KEY missing from .env.local")
    return env


def stripe_get(env, path, **params):
    """GET helper for Stripe REST API. Returns parsed JSON."""
    from urllib.parse import urlencode
    qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    url = f"https://api.stripe.com/v1/{path}"
    if qs:
        url += "?" + qs
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {env['STRIPE_SECRET_KEY']}",
        "User-Agent": "tfb-stripe-report/1.0",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def collect(days=1):
    env = load_env()
    now = datetime.now(timezone.utc)
    cutoff = int((now - timedelta(days=days)).timestamp())

    # Checkout sessions
    sessions = stripe_get(env, "checkout/sessions", limit=100,
                          **{"created[gte]": cutoff}).get("data", [])
    # Charges (successful payments)
    charges = stripe_get(env, "charges", limit=100,
                         **{"created[gte]": cutoff}).get("data", [])
    # Refunds
    refunds = stripe_get(env, "refunds", limit=100,
                         **{"created[gte]": cutoff}).get("data", [])
    # Disputes
    disputes = stripe_get(env, "disputes", limit=100,
                          **{"created[gte]": cutoff}).get("data", [])

    def is_internal(email):
        return email and email.lower() in INTERNAL_EMAILS

    # Bucket sessions
    sess_complete_external = []
    sess_complete_internal = []
    sess_expired = []
    sess_open = []
    for s in sessions:
        cd = s.get("customer_details") or {}
        email = (cd.get("email") or "").lower()
        if s.get("status") == "complete" and s.get("payment_status") == "paid":
            if is_internal(email):
                sess_complete_internal.append(s)
            else:
                sess_complete_external.append(s)
        elif s.get("status") == "expired":
            sess_expired.append(s)
        else:
            sess_open.append(s)

    # External-only revenue
    external_revenue_cents = sum(s.get("amount_total", 0) for s in sess_complete_external)

    return {
        "metadata": {
            "generated_at": now.isoformat(),
            "window_days": days,
        },
        "totals": {
            "checkout_sessions": len(sessions),
            "complete_paid_external": len(sess_complete_external),
            "complete_paid_internal": len(sess_complete_internal),
            "expired": len(sess_expired),
            "open_or_other": len(sess_open),
            "external_revenue_usd": external_revenue_cents / 100,
            "total_charges": len(charges),
            "total_refunds": len(refunds),
            "total_disputes": len(disputes),
        },
        "external_sessions": [
            {
                "created": datetime.fromtimestamp(s["created"], tz=timezone.utc).isoformat(),
                "email": (s.get("customer_details") or {}).get("email"),
                "amount_usd": s.get("amount_total", 0) / 100,
                "status": s.get("status"),
                "payment_status": s.get("payment_status"),
            }
            for s in sess_complete_external
        ],
        "anonymous_expired_sessions": [
            {
                "created": datetime.fromtimestamp(s["created"], tz=timezone.utc).isoformat(),
                "amount_usd": s.get("amount_total", 0) / 100,
            }
            for s in sess_expired if not (s.get("customer_details") or {}).get("email")
        ],
    }


def to_markdown(report):
    out = ["# Stripe Report"]
    md = report["metadata"]
    out.append(f"_Window: last {md['window_days']} day(s) · Generated {md['generated_at'][:19]} UTC_\n")
    t = report["totals"]
    out.append("## Totals")
    out.append(f"- **External (real customer) purchases:** {t['complete_paid_external']}")
    out.append(f"- **External revenue:** ${t['external_revenue_usd']:,.2f}")
    out.append(f"- **Internal/test purchases:** {t['complete_paid_internal']}")
    out.append(f"- Checkout sessions total: {t['checkout_sessions']}")
    out.append(f"- Expired (incl. anonymous abandoners): {t['expired']}")
    out.append(f"- Open / in progress: {t['open_or_other']}")
    out.append(f"- Refunds in window: {t['total_refunds']}")
    out.append(f"- Disputes in window: {t['total_disputes']}")
    out.append("")

    if report["external_sessions"]:
        out.append("## External purchases this window")
        out.append("| When | Email | Amount | Status |")
        out.append("|---|---|---:|---|")
        for s in report["external_sessions"]:
            out.append(f"| {s['created'][:16]} | {s['email']} | ${s['amount_usd']:,.2f} | {s['payment_status']} |")
        out.append("")

    if report["anonymous_expired_sessions"]:
        out.append(f"## Anonymous abandoners ({len(report['anonymous_expired_sessions'])})")
        out.append("_Sessions that expired without an email captured — could be real visitors who bailed at checkout, or pre-signup testing._\n")
        for s in report["anonymous_expired_sessions"][:10]:
            out.append(f"- {s['created'][:16]} — ${s['amount_usd']:,.2f}")
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
