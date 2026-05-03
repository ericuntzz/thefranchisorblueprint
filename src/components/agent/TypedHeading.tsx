"use client";

/**
 * Types out the provided text character-by-character on mount.
 *
 * Used for the Day 1 welcome moment ("Welcome back, Eric") so the page
 * feels alive within the first 200ms after load. Plays exactly once per
 * mount; doesn't restart on re-renders unless `text` changes.
 *
 * Visual: ends with a blinking caret for a beat, then the caret fades
 * away — so the screen lands at rest, not in motion.
 */

import { useEffect, useState } from "react";

type Props = {
  text: string;
  /** ms per character. Default 28 — fast enough to not feel slow on long names. */
  speed?: number;
  /** Tailwind classes for the wrapper. */
  className?: string;
  /** Additional ms to delay before starting (lets the page settle). */
  startDelay?: number;
};

export function TypedHeading({
  text,
  speed = 28,
  className = "",
  startDelay = 80,
}: Props) {
  const [shown, setShown] = useState("");
  const [caretVisible, setCaretVisible] = useState(true);

  useEffect(() => {
    // Respect prefers-reduced-motion: render the full text immediately
    // (no per-character animation) and hide the caret. The blink CSS rule
    // is also disabled by the @media query below as a belt-and-suspenders.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) {
      setShown(text);
      setCaretVisible(false);
      return;
    }

    let i = 0;
    setShown("");
    const start = setTimeout(() => {
      const tick = () => {
        i += 1;
        setShown(text.slice(0, i));
        if (i < text.length) {
          setTimeout(tick, speed);
        } else {
          // Blink for ~1.5s then fade caret away.
          setTimeout(() => setCaretVisible(false), 1500);
        }
      };
      tick();
    }, startDelay);
    return () => clearTimeout(start);
  }, [text, speed, startDelay]);

  return (
    <span className={className}>
      {shown}
      {caretVisible && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-[2px] align-text-bottom bg-current opacity-70 typed-caret"
          style={{ height: "0.95em" }}
        />
      )}
      <style jsx>{`
        @keyframes typed-caret-blink {
          0%, 49% { opacity: 0.7; }
          50%, 100% { opacity: 0; }
        }
        .typed-caret {
          animation: typed-caret-blink 0.85s step-end infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .typed-caret { animation: none; opacity: 0.7; }
        }
      `}</style>
    </span>
  );
}
