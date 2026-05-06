/**
 * GA4 event tracking — typed wrapper around window.gtag.
 *
 * Usage:
 *   import { track } from "@/lib/analytics";
 *   track("select_item", { item_id: "the-blueprint", item_name: "The Blueprint", price: 2997, cta_location: "homepage_pricing_card" });
 *
 * The discriminated `GA4Event` union enforces correct params per event name.
 * If gtag isn't loaded (dev without NEXT_PUBLIC_GA4_ID, or ad-blocker), the
 * helper silently no-ops — never throws.
 */

// ─── gtag global ────────────────────────────────────────────────────────────

type GtagCommand =
  | "js"
  | "config"
  | "event"
  | "set"
  | "consent"
  | "get";

declare global {
  interface Window {
    gtag?: (command: GtagCommand, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ─── Event catalog ──────────────────────────────────────────────────────────

/** A purchasable line item in GA4 ecommerce events. */
export type GA4Item = {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
};

/**
 * Discriminated union — every event has a `name` literal and its own `params`.
 * Add new events here; the `track()` signature picks them up automatically.
 */
export type GA4Event =
  // Conversion: tier-card click intent
  | {
      name: "select_item";
      params: {
        item_id:
          | "the-blueprint"
          | "blueprint-plus"
          | "navigator"
          | "builder"
          | "sample-call"
          | "phase-coaching";
        item_name: string;
        price: number;
        /** Where on the site this happened — "homepage_pricing_card", "pricing_page_card", "programs_page_card" */
        cta_location: string;
      };
    }
  // Conversion: Stripe checkout opened
  | {
      name: "begin_checkout";
      params: {
        currency: "USD";
        value: number;
        items: GA4Item[];
        cta_location?: string;
      };
    }
  // Conversion: real purchase (server-side via Measurement Protocol)
  | {
      name: "purchase";
      params: {
        transaction_id: string;
        currency: "USD";
        value: number;
        items: GA4Item[];
        /** Stripe customer ID for de-duplication */
        customer_id?: string;
      };
    }
  // Conversion: Calendly booking confirmed
  | {
      name: "generate_lead";
      params: {
        /** "30-min-discovery" | "45-min-builder" | "60-min-blueprint-onboarding" */
        event_type: string;
        cta_location?: string;
        /** USD value attributed to the lead — useful for ROAS modeling */
        value?: number;
        currency?: "USD";
      };
    }
  // Conversion: contact form submitted
  | {
      name: "submit_lead_form";
      params: {
        form_location: "contact_page" | "footer" | "blog" | "popup";
      };
    }
  // Conversion: assessment quiz finished
  | {
      name: "assessment_complete";
      params: {
        score?: number;
        recommended_tier?: "the-blueprint" | "navigator" | "builder" | "not-ready";
      };
    }
  // Engagement: any non-tier CTA click
  | {
      name: "cta_click";
      params: {
        cta_label: string;
        cta_location: string;
        cta_destination?: string;
      };
    }
  // Engagement: top-nav link click
  | {
      name: "nav_click";
      params: {
        nav_label: string;
        nav_destination: string;
        nav_type?: "primary" | "footer" | "mobile";
      };
    }
  // Engagement: hero video play
  | {
      name: "video_play";
      params: {
        video_title: string;
        video_location?: string;
      };
    }
  // Engagement: pricing tier card scrolled into view
  | {
      name: "view_item";
      params: {
        item_id: "the-blueprint" | "navigator" | "builder";
        item_name: string;
        price: number;
        /** Use "placement" — GA4 reserves "page_location" for the full URL. */
        placement?: string;
      };
    }
  // Engagement: any tracked content section scrolled into view
  | {
      name: "view_section";
      params: {
        section_id: string;
        /** Use "placement" — GA4 reserves "page_location" for the full URL. */
        placement?: string;
      };
    };

// ─── Public helpers ─────────────────────────────────────────────────────────

/**
 * Fire a GA4 event with strict typing. Silently no-ops if gtag isn't loaded
 * (e.g., dev without NEXT_PUBLIC_GA4_ID, ad-blockers, or before hydration).
 */
export function track<E extends GA4Event>(name: E["name"], params: E["params"]): void {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", name, params);
}

/**
 * Bulk-track multiple events sequentially. Useful when one user action
 * implies multiple semantic events (e.g., select_item + begin_checkout).
 */
export function trackAll(events: GA4Event[]): void {
  for (const e of events) {
    track(e.name as GA4Event["name"], e.params as never);
  }
}

// ─── Tier registry — single source of truth for ecommerce items ─────────────

export const TIERS = {
  "the-blueprint": {
    item_id: "the-blueprint",
    item_name: "The Blueprint",
    price: 2997,
    item_category: "DIY",
  },
  navigator: {
    item_id: "navigator",
    item_name: "Navigator",
    price: 8500,
    item_category: "Coached",
  },
  builder: {
    item_id: "builder",
    item_name: "Builder",
    price: 29500,
    item_category: "Done-With-You",
  },
} as const satisfies Record<
  "the-blueprint" | "navigator" | "builder",
  Omit<GA4Item, "quantity"> & { item_category: string }
>;

export type TierId = keyof typeof TIERS;
