#!/usr/bin/env python3
"""
Anomaly detection — compares today's metrics against the rolling baseline
of the past N days and surfaces statistically significant deviations.

Reads analytics/reports/YYYY-MM-DD.json files (the raw data snapshots
the daily orchestrator already writes) and computes:
  - Rolling mean + stddev for each tracked metric over the past 14 days
  - Z-score for today's value
  - Anomaly flag if |z-score| > 2 (95th percentile threshold)

Importable by daily-traffic-report.py:
    from anomaly_detection import detect_anomalies
    anomalies = detect_anomalies(today_data, history_dir)

Or runnable standalone for ad-hoc inspection:
    python3 scripts/anomaly-detection.py
"""
import argparse
import json
import math
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "analytics" / "reports"

# Z-score threshold: ±2 ≈ 95th percentile of normal variation.
# Values above 2.5 are aggressive; values below 1.5 fire too often.
Z_THRESHOLD = 2.0
MIN_SAMPLES = 5  # need at least N days of history before calling anomalies
DEFAULT_LOOKBACK_DAYS = 14


def extract_metrics(report_data):
    """Pull a flat dict of numeric metrics from a report's raw JSON.
    These are the metrics we'll track for anomalies.
    """
    metrics = {}
    ga4 = report_data.get("ga4", {}) or {}
    gsc = report_data.get("gsc", {}) or {}
    bing = report_data.get("bing", {}) or {}
    stripe = report_data.get("stripe", {}) or {}
    sb = report_data.get("supabase", {}) or {}

    # GA4 totals (yesterday)
    if ga4.get("totals"):
        t = ga4["totals"][0] if isinstance(ga4["totals"], list) else ga4["totals"]
        metrics["ga4_sessions"] = _to_int(t.get("sessions"))
        metrics["ga4_users"] = _to_int(t.get("activeUsers"))
        metrics["ga4_pageviews"] = _to_int(t.get("screenPageViews"))
        metrics["ga4_engaged_sessions"] = _to_int(t.get("engagedSessions"))

    # GA4 external users (excluding Eric/Jason cities)
    internal = ("Summit Park", "Kamas", "Francis")
    if ga4.get("by_city"):
        ext = sum(
            _to_int(r.get("activeUsers"))
            for r in ga4["by_city"]
            if not any(c.lower() in (r.get("city") or "").lower() for c in internal)
        )
        metrics["ga4_external_users"] = ext

    # GSC totals (last 7 days from today's report)
    if gsc.get("by_date"):
        metrics["gsc_clicks"] = sum(_to_int(r.get("clicks")) for r in gsc["by_date"])
        metrics["gsc_impressions"] = sum(_to_int(r.get("impressions")) for r in gsc["by_date"])
        metrics["gsc_unique_queries"] = len(gsc.get("top_queries", []))

    # Bing
    if bing.get("rank_stats"):
        metrics["bing_clicks"] = sum(_to_int(r.get("Clicks")) for r in bing["rank_stats"])
        metrics["bing_impressions"] = sum(_to_int(r.get("Impressions")) for r in bing["rank_stats"])

    # Stripe (window-bound)
    if stripe.get("totals"):
        st = stripe["totals"]
        metrics["stripe_external_purchases"] = _to_int(st.get("complete_paid_external"))
        metrics["stripe_external_revenue_usd"] = _to_int(st.get("external_revenue_usd"))
        metrics["stripe_anon_abandoners"] = _to_int(st.get("expired"))

    # Supabase funnel
    if sb.get("assessment_funnel"):
        af = sb["assessment_funnel"]
        metrics["assessment_starts"] = _to_int(af.get("starts_in_window"))
        metrics["assessment_completions"] = _to_int(af.get("completions_in_window"))
    if sb.get("contact_form"):
        cf = sb["contact_form"]
        metrics["contact_real_submissions"] = _to_int(cf.get("real_submissions_in_window"))

    return metrics


def _to_int(v):
    if v is None: return 0
    try: return int(float(v))
    except: return 0


def load_history(reports_dir, today_str, lookback_days=DEFAULT_LOOKBACK_DAYS):
    """Load metric vectors from past report .json files."""
    history = []
    today = datetime.strptime(today_str, "%Y-%m-%d").date()
    for n in range(1, lookback_days + 1):
        d = today - timedelta(days=n)
        f = reports_dir / f"{d.strftime('%Y-%m-%d')}.json"
        if not f.exists():
            continue
        try:
            data = json.loads(f.read_text())
            metrics = extract_metrics(data)
            if metrics:
                history.append({"date": d.strftime("%Y-%m-%d"), "metrics": metrics})
        except Exception:
            continue
    return history


def detect_anomalies(today_data, today_str=None, lookback_days=DEFAULT_LOOKBACK_DAYS, reports_dir=None):
    """Return list of anomalies detected for today's data vs rolling history.

    Each anomaly:
        {
          "metric": "ga4_sessions",
          "today": 87,
          "baseline_mean": 27.5,
          "baseline_stddev": 8.2,
          "z_score": 7.25,
          "direction": "high",           # or "low"
          "severity": "extreme",         # >3σ
          "narrative": "GA4 sessions: 87 today vs baseline 27.5 (±8.2). z=+7.25, extreme.",
        }
    """
    reports_dir = reports_dir or REPORTS_DIR
    today_str = today_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_metrics = extract_metrics(today_data)
    history = load_history(reports_dir, today_str, lookback_days=lookback_days)

    if len(history) < MIN_SAMPLES:
        return [{
            "metric": "_baseline_insufficient",
            "narrative": (
                f"Anomaly detection skipped — only {len(history)} of {lookback_days} "
                f"history days available, need ≥ {MIN_SAMPLES}."
            ),
        }]

    anomalies = []
    for metric, today_val in today_metrics.items():
        # Build the baseline series for this metric
        series = [h["metrics"].get(metric, 0) for h in history]
        if not series:
            continue
        n = len(series)
        mean = sum(series) / n
        variance = sum((x - mean) ** 2 for x in series) / n
        stddev = math.sqrt(variance)

        if stddev == 0:
            # All baseline values identical. Today's deviation is qualitative,
            # not statistical — only flag if today differs from the constant.
            if today_val != mean:
                anomalies.append({
                    "metric": metric,
                    "today": today_val,
                    "baseline_mean": mean,
                    "baseline_stddev": 0,
                    "z_score": float("inf") if today_val > mean else float("-inf"),
                    "direction": "high" if today_val > mean else "low",
                    "severity": "first_time",
                    "narrative": (
                        f"**{_pretty(metric)}**: {today_val} today, "
                        f"but baseline was constant at {mean:.0f} for the past {n} days. "
                        f"First time this number has moved."
                    ),
                })
            continue

        z = (today_val - mean) / stddev
        if abs(z) >= Z_THRESHOLD:
            severity = "extreme" if abs(z) >= 3 else "elevated"
            direction = "high" if z > 0 else "low"
            anomalies.append({
                "metric": metric,
                "today": today_val,
                "baseline_mean": round(mean, 1),
                "baseline_stddev": round(stddev, 1),
                "z_score": round(z, 2),
                "direction": direction,
                "severity": severity,
                "narrative": (
                    f"**{_pretty(metric)}**: {today_val} today vs baseline "
                    f"{mean:.1f} (±{stddev:.1f}). z={z:+.2f}, {severity} {direction}."
                ),
            })

    # Sort by absolute z-score, biggest first
    anomalies.sort(key=lambda a: abs(a.get("z_score", 0)) if a.get("z_score") not in (float("inf"), float("-inf")) else 999, reverse=True)
    return anomalies


def _pretty(metric):
    """Turn snake_case_metric into Pretty Label."""
    return metric.replace("_", " ").replace("ga4 ", "GA4 ").replace("gsc ", "GSC ").replace("usd", "USD").title().replace("Ga4", "GA4").replace("Gsc", "GSC").replace("Usd", "USD")


def render_anomaly_section(anomalies):
    """Render anomalies as a markdown block for the daily email/synthesis."""
    if not anomalies:
        return "_No anomalies detected — today's metrics are within ±2σ of the 14-day baseline._"
    if len(anomalies) == 1 and anomalies[0]["metric"] == "_baseline_insufficient":
        return f"_{anomalies[0]['narrative']}_"

    lines = []
    extreme = [a for a in anomalies if a.get("severity") == "extreme"]
    elevated = [a for a in anomalies if a.get("severity") == "elevated"]
    first_time = [a for a in anomalies if a.get("severity") == "first_time"]

    if extreme:
        lines.append("### 🔥 Extreme deviations (>3σ)")
        for a in extreme:
            lines.append(f"- {a['narrative']}")
        lines.append("")
    if first_time:
        lines.append("### 🆕 First-time movement")
        for a in first_time:
            lines.append(f"- {a['narrative']}")
        lines.append("")
    if elevated:
        lines.append("### ⚡ Elevated deviations (2–3σ)")
        for a in elevated:
            lines.append(f"- {a['narrative']}")
        lines.append("")
    return "\n".join(lines)


def main():
    """Standalone: read today's report, run detection, print to stdout."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--lookback", type=int, default=DEFAULT_LOOKBACK_DAYS)
    args = ap.parse_args()

    report_path = REPORTS_DIR / f"{args.date}.json"
    if not report_path.exists():
        sys.exit(f"ERROR: no report at {report_path}")

    today_data = json.loads(report_path.read_text())
    anomalies = detect_anomalies(today_data, today_str=args.date, lookback_days=args.lookback)
    print(render_anomaly_section(anomalies))


if __name__ == "__main__":
    main()
