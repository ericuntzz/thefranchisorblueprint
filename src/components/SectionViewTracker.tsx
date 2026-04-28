"use client";
import { type ReactNode, useEffect, useRef } from "react";
import { track, type GA4Event } from "@/lib/analytics";

type Props = {
  children: ReactNode;
  /** GA4 event to fire when this element scrolls into view. */
  event: GA4Event["name"];
  /** Strongly-typed params for the event. */
  params: GA4Event["params"];
  /** % of element that must be visible before firing. Default 0.4 (40%). */
  threshold?: number;
  /** Element tag for the wrapper. Default "div". */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
};

/**
 * Wraps content and fires a single GA4 event when it scrolls into view.
 * Fires once per page load — repeated scrolls don't re-fire.
 *
 *   <SectionViewTracker event="view_item" params={{ item_id: "navigator", ... }}>
 *     <PricingCard ... />
 *   </SectionViewTracker>
 */
export function SectionViewTracker({
  children,
  event,
  params,
  threshold = 0.4,
  as: Tag = "div",
  className,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!ref.current || fired.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !fired.current) {
          fired.current = true;
          try {
            track(event as GA4Event["name"], params as never);
          } catch {
            /* swallow */
          }
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [event, params, threshold]);

  // The `as` prop pattern with refs is awkward in TS — cast to a div ref.
  // Visually neutral wrapper; consumers control styling via className.
  const Element = Tag as "div";
  return (
    <Element ref={ref as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </Element>
  );
}
