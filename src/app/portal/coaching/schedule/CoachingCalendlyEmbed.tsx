"use client";

import { CalendlyEmbed } from "@/components/CalendlyEmbed";
import { track } from "@/lib/analytics";

/**
 * Client wrapper around CalendlyEmbed that fires `portal_coaching_book`
 * when the customer confirms a coaching slot. The standard `generate_lead`
 * event is still fired by CalendlyEmbed itself; this just adds the
 * portal-specific signal so the coaching booking funnel is independently
 * trackable in GA4.
 */
export function CoachingCalendlyEmbed({
  url,
  tier,
  minHeight = 760,
}: {
  url: string;
  tier: "the-blueprint" | "navigator" | "builder";
  minHeight?: number;
}) {
  return (
    <CalendlyEmbed
      url={url}
      minHeight={minHeight}
      onScheduled={() => track("portal_coaching_book", { tier })}
    />
  );
}
