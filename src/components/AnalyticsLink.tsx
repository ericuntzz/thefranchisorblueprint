"use client";
import Link, { type LinkProps } from "next/link";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { track, type GA4Event } from "@/lib/analytics";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, keyof LinkProps>;

type Props = LinkProps &
  AnchorProps & {
    children: ReactNode;
    /** GA4 event name to fire on click. */
    trackEvent: GA4Event["name"];
    /** Strongly-typed params for the chosen event. */
    trackParams: GA4Event["params"];
  };

/**
 * Drop-in replacement for next/link that fires a typed GA4 event on click.
 *
 *   <AnalyticsLink
 *     href="/programs/blueprint"
 *     trackEvent="select_item"
 *     trackParams={{
 *       item_id: "the-blueprint",
 *       item_name: "The Blueprint",
 *       price: 2997,
 *       cta_location: "homepage_pricing_card",
 *     }}
 *     className="..."
 *   >
 *     Buy the Blueprint
 *   </AnalyticsLink>
 *
 * Why client component? `track()` reads window.gtag at runtime; we need
 * the onClick handler to live on the client.
 */
export function AnalyticsLink({
  trackEvent,
  trackParams,
  onClick,
  children,
  ...rest
}: Props) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        // Fire-and-forget: never block navigation on analytics.
        try {
          track(trackEvent as GA4Event["name"], trackParams as never);
        } catch {
          /* swallow */
        }
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
