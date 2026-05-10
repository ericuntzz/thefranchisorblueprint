"use client";

import { useEffect, useRef } from "react";
import { track, type GA4Event } from "@/lib/analytics";

/**
 * Tiny zero-render client island. Fires a single GA4 event once on mount.
 *
 * Used inside server-rendered portal pages so we can record opens/views
 * (portal_login, portal_section_open, portal_upgrade_view, etc.) without
 * converting the host page to a client component.
 *
 * Two dedupe layers:
 *   1. useRef — prevents React strict-mode double-invocation in dev.
 *   2. sessionStorage — when `dedupeKey` is provided, the event only
 *      fires once per browser tab session. Use this for portal_login
 *      (which would otherwise re-fire on every dashboard refresh).
 *
 * Typed via the existing GA4Event discriminated union, so passing an
 * event name + params for that event is enforced at compile time.
 */
export function PortalEventTracker<E extends GA4Event>({
  event,
  params,
  dedupeKey,
}: {
  event: E["name"];
  params: E["params"];
  /** When set, only fires once per browser session (per key). */
  dedupeKey?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (dedupeKey && typeof window !== "undefined") {
      try {
        const k = `tfb_ga_dedupe:${dedupeKey}`;
        if (sessionStorage.getItem(k) === "1") return;
        sessionStorage.setItem(k, "1");
      } catch {
        // sessionStorage blocked (private mode / iframe); fall through.
      }
    }

    track(event, params);
    // params change every render reference, but the ref guard ensures we
    // only fire once. Don't include params in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, dedupeKey]);
  return null;
}
