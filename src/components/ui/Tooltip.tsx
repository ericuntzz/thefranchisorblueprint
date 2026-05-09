"use client";

/**
 * Tooltip — small hover/focus popover for icon helps and chip
 * explanations.
 *
 * Why this exists: HTML's native `title` attribute is what the portal
 * was using for the Info-icon help text (and the "Suggested" chip's
 * source explanation, etc). Two problems with the native version:
 *
 *   1. Browser delay is ~700ms before the bubble appears. Customers
 *      hover, see nothing, and move on — the tooltip is effectively
 *      invisible.
 *   2. The OS/browser styling is ugly and inconsistent (light grey
 *      box on Windows, dark on macOS Chrome, etc.) and doesn't match
 *      the navy/cream brand at all.
 *
 * This component renders an absolutely-positioned navy bubble with a
 * short show-delay (~80ms — long enough to avoid flicker as the
 * cursor sweeps across the trigger, short enough to feel instant)
 * and a matching hide-delay so the tooltip doesn't snap shut if the
 * user briefly leaves the trigger.
 *
 * Accessibility: the wrapper forwards focus events from any
 * descendant, so consumers should either use a focusable child
 * (a button) or add `tabIndex={0}` to the trigger element. The
 * tooltip itself uses role="tooltip" and aria-hidden to play nice
 * with screen readers.
 *
 * Visual: bg-navy/95 + backdrop-blur for a slightly translucent
 * feel, rounded-lg corners, cream text, soft shadow. Eric's spec
 * 2026-05-09.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

type Side = "top" | "bottom";
type Align = "center" | "start" | "end";

type Props = {
  /** Tooltip content. Pass a string for help text or any ReactNode for
   *  richer layouts. */
  content: ReactNode;
  /** Side of the trigger to render on. Default "top". */
  side?: Side;
  /** Horizontal alignment relative to the trigger. Default "center". */
  align?: Align;
  /** Max width in pixels — caps long help text into a readable column.
   *  Default 260. */
  maxWidthPx?: number;
  /** ms before showing on hover. Short enough to feel instant, long
   *  enough to skip the bubble when the cursor sweeps past. Default 80. */
  showDelayMs?: number;
  /** ms before hiding on mouseleave — small grace period so the tooltip
   *  doesn't flicker on tiny cursor wobbles. Default 80. */
  hideDelayMs?: number;
  /** The trigger element. Should be focusable for keyboard
   *  accessibility (button, or a span/div with tabIndex={0}). */
  children: ReactNode;
};

export function Tooltip({
  content,
  side = "top",
  align = "center",
  maxWidthPx = 260,
  showDelayMs = 80,
  hideDelayMs = 80,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelShow = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };
  const cancelHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // Cleanup any pending timers on unmount.
  useEffect(
    () => () => {
      cancelShow();
      cancelHide();
    },
    [],
  );

  const handleEnter = () => {
    cancelHide();
    if (open) return;
    showTimerRef.current = setTimeout(() => setOpen(true), showDelayMs);
  };
  const handleLeave = () => {
    cancelShow();
    if (!open) return;
    hideTimerRef.current = setTimeout(() => setOpen(false), hideDelayMs);
  };
  // Focus is "instant on" — keyboard users have already done a
  // deliberate action to get here, no need for a delay.
  const handleFocus = () => {
    cancelShow();
    cancelHide();
    setOpen(true);
  };
  const handleBlur = () => {
    cancelShow();
    setOpen(false);
  };

  const sideClass = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const alignClass =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "start"
        ? "left-0"
        : "right-0";

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      <span
        role="tooltip"
        aria-hidden={!open}
        className={`pointer-events-none absolute z-50 ${sideClass} ${alignClass} transition-opacity duration-150 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        style={{ maxWidth: maxWidthPx, width: "max-content" }}
      >
        <span className="block rounded-lg border border-cream/10 bg-navy/95 backdrop-blur-sm text-cream text-xs leading-relaxed font-medium px-3 py-2 shadow-xl">
          {content}
        </span>
      </span>
    </span>
  );
}
