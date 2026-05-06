#!/usr/bin/env python3
"""
PageSpeed Insights report — Core Web Vitals tracking.

Pulls real Lighthouse + CrUX (Chrome User Experience) data from
Google's PageSpeed Insights API for our key pages. Tracks LCP, CLS,
FID/INP, TBT, performance score for both mobile and desktop.

Notes:
- This API is SLOW: ~30-60 seconds per (URL, strategy) pair. For 5
  URLs × 2 strategies = 10 calls = ~5-10 minutes. Run weekly+, not
  daily.
- Anonymous calls are rate-limited to ~200/day (plenty for our
  cadence). To raise limits, add a Google Cloud API key as
  PAGESPEED_API_KEY in .env.local.
- Performance score below 0.9 is a SEO ranking concern. LCP > 2.5s,
  CLS > 0.1, INP > 200ms all hurt rankings.

Usage:
    python3 scripts/pagespeed-report.py [--json]
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"

# Pages to monitor. Top of the funnel + key conversion pages.
URLS_TO_TEST = [
    "https://www.thefranchisorblueprint.com/",
    "https://www.thefranchisorblueprint.com/pricing",
    "https://www.thefranchisorblueprint.com/assessment",
    "https://www.thefranchisorblueprint.com/programs/blueprint",
    "https://www.thefranchisorblueprint.com/blog/franchise-disclosure-document-explained",
]
STRATEGIES = ("mobile", "desktop")


def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            env[k.strip()] = v
    return env


def psi_call(url, strategy, api_key=None, retries=2):
    """One PageSpeed Insights call. Retries on 429 with backoff.

    Returns dict of relevant metrics, or {"error": "..."} on failure.
    """
    params = {"url": url, "strategy": strategy, "category": "performance"}
    if api_key: params["key"] = api_key
    full = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urlencode(params)
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "tfb-pagespeed-report/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = (attempt + 1) * 30  # 30s, 60s
                time.sleep(wait)
                continue
            raise


def extract_metrics(psi_response):
    """Pull the metrics we care about from a verbose PSI response."""
    out = {}
    try:
        lh = psi_response.get("lighthouseResult", {})
        cats = lh.get("categories", {}).get("performance", {})
        out["performance_score"] = round((cats.get("score") or 0) * 100, 1)

        audits = lh.get("audits", {})
        # Lighthouse audits
        for k, label in [
            ("largest-contentful-paint", "lcp_ms"),
            ("cumulative-layout-shift", "cls"),
            ("total-blocking-time", "tbt_ms"),
            ("interactive", "tti_ms"),
            ("speed-index", "speed_index_ms"),
        ]:
            audit = audits.get(k, {})
            v = audit.get("numericValue")
            if v is not None:
                out[label] = round(v, 2) if "cls" in label else round(v)

        # CrUX field data (real user experience)
        crux = psi_response.get("loadingExperience", {}).get("metrics", {})
        for k, label in [
            ("LARGEST_CONTENTFUL_PAINT_MS", "crux_lcp_p75_ms"),
            ("INTERACTION_TO_NEXT_PAINT", "crux_inp_p75_ms"),
            ("CUMULATIVE_LAYOUT_SHIFT_SCORE", "crux_cls_p75"),
        ]:
            metric = crux.get(k, {})
            p75 = metric.get("percentile")
            if p75 is not None:
                out[label] = p75 / 100 if "cls" in label else p75
                out[f"{label}_category"] = metric.get("category")  # FAST / AVERAGE / SLOW

    except Exception as e:
        out["error"] = str(e)[:200]
    return out


def collect():
    env = load_env()
    # Accept either naming convention
    api_key = env.get("PAGESPEED_API_KEY") or env.get("PAGE_SPEED_API_KEY")
    now = datetime.now(timezone.utc)

    results = []
    skipped_429 = 0
    for url in URLS_TO_TEST:
        for strategy in STRATEGIES:
            try:
                resp = psi_call(url, strategy, api_key=api_key)
                metrics = extract_metrics(resp)
                results.append({"url": url, "strategy": strategy, **metrics})
                time.sleep(3)  # be polite
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    skipped_429 += 1
                results.append({"url": url, "strategy": strategy, "error": f"HTTP {e.code}"})
            except Exception as e:
                results.append({"url": url, "strategy": strategy, "error": str(e)[:200]})

    # If we got rate-limited a lot, surface a helpful note
    note = None
    if skipped_429 > 0 and not api_key:
        note = (
            f"⚠ {skipped_429} requests hit Google's anonymous rate limit. "
            f"Add PAGESPEED_API_KEY to .env.local for reliable runs. "
            f"Get one free at https://console.cloud.google.com/apis/credentials "
            f"(enable PageSpeed Insights API in Cloud Console, then create an API key)."
        )

    return {
        "metadata": {
            "generated_at": now.isoformat(),
            "note": note,
        },
        "results": results,
    }


def to_markdown(report):
    out = ["# PageSpeed Insights Report"]
    md = report["metadata"]
    out.append(f"_Generated {md['generated_at'][:19]} UTC_\n")

    out.append("## Lighthouse performance scores")
    out.append("| URL | Mobile | Desktop |")
    out.append("|---|---:|---:|")
    by_url = {}
    for r in report["results"]:
        by_url.setdefault(r["url"], {})[r["strategy"]] = r
    for url, strats in by_url.items():
        m = strats.get("mobile", {}).get("performance_score", "-")
        d = strats.get("desktop", {}).get("performance_score", "-")
        path = url.replace("https://www.thefranchisorblueprint.com", "") or "/"
        out.append(f"| `{path}` | {m} | {d} |")
    out.append("")

    out.append("## Core Web Vitals (mobile, real-user p75)")
    out.append("_From Chrome User Experience Report — actual visitors, not lab._\n")
    out.append("| URL | LCP (ms) | INP (ms) | CLS |")
    out.append("|---|---:|---:|---:|")
    for url, strats in by_url.items():
        m = strats.get("mobile", {})
        path = url.replace("https://www.thefranchisorblueprint.com", "") or "/"
        lcp = m.get("crux_lcp_p75_ms", "-")
        inp = m.get("crux_inp_p75_ms", "-")
        cls = m.get("crux_cls_p75", "-")
        out.append(f"| `{path}` | {lcp} | {inp} | {cls} |")
    out.append("")
    out.append("_Targets: LCP < 2500ms, INP < 200ms, CLS < 0.1. Pages exceeding any of these hurt SEO ranking._")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    report = collect()
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(to_markdown(report))


if __name__ == "__main__":
    main()
