"use client";

/**
 * AnimatedDisclosure — smooth expand/collapse for any block.
 *
 * Uses the grid-template-rows trick (0fr → 1fr) which is the only
 * pure-CSS way to animate height: auto. Supported in evergreen
 * browsers since 2023. Older browsers gracefully snap with no
 * animation.
 *
 * Easing: cubic-bezier(0.4, 0, 0.2, 1) — Material's "standard"
 * curve. Feels balanced, premium without being precious.
 *
 * Duration: 280ms by default. Long enough to register as
 * intentional, short enough to never feel sluggish.
 *
 * Reduced motion: respects `prefers-reduced-motion: reduce`. When
 * the user has that preference set, the disclosure snaps open/closed
 * with no animation.
 *
 * Children stay mounted. Conditional unmount would defeat the
 * animation. If unmount is critical (heavy component, big tree),
 * use the `unmountWhenClosed` prop — content unmounts after the
 * collapse transition completes.
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  /** Duration in ms. Defaults to 280ms. */
  duration?: number;
  /** Unmount children after the collapse animation completes. Use
   *  for heavy subtrees that you don't want sitting in the DOM
   *  while collapsed. */
  unmountWhenClosed?: boolean;
};

export function AnimatedDisclosure({
  open,
  children,
  className,
  duration = 280,
  unmountWhenClosed = false,
}: Props) {
  const [shouldRender, setShouldRender] = useState(open);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!unmountWhenClosed) return;
    if (open) {
      // Open immediately — content needs to be in the DOM before
      // the grid-rows transition can run.
      if (timerRef.current) clearTimeout(timerRef.current);
      setShouldRender(true);
    } else {
      // Wait for collapse animation to finish, then unmount.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShouldRender(false), duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, duration, unmountWhenClosed]);

  return (
    <div
      className={`grid transition-[grid-template-rows] motion-reduce:transition-none ${className ?? ""}`}
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        {unmountWhenClosed && !shouldRender ? null : children}
      </div>
    </div>
  );
}
