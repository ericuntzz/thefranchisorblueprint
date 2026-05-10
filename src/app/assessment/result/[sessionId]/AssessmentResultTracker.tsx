"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import type { AssessmentBand } from "@/lib/supabase/types";

/**
 * Fires `assessment_complete` once on mount. Lives as a tiny client
 * island inside the otherwise-server-rendered result page so we can
 * record score + recommended tier in GA4 without converting the whole
 * page to a client component.
 *
 * The `useRef` guard prevents a double-fire if React strict-mode runs
 * the effect twice (dev only) or if the user navigates back-and-forward.
 */
export function AssessmentResultTracker({
  score,
  band,
}: {
  score: number;
  band: AssessmentBand;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("assessment_complete", {
      score,
      recommended_tier: tierForBand(band),
    });
  }, [score, band]);
  return null;
}

/**
 * Map the score band into the GA4 tier taxonomy used everywhere else
 * (intake snapshot, Stripe items, select_item events). Keeps GA4
 * funnel reports comparable across surfaces.
 */
function tierForBand(
  band: AssessmentBand,
): "the-blueprint" | "navigator" | "builder" | "not-ready" {
  switch (band) {
    case "franchise_ready":
      return "builder";
    case "nearly_there":
      return "navigator";
    case "building_foundation":
      return "the-blueprint";
    case "early_stage":
      return "not-ready";
  }
}
