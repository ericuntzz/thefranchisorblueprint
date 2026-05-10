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
    }

  // ─── Intake lead-magnet (URL-prefill snapshot flow) ─────────────────
  // Funnel: intake_start → intake_snapshot_view → intake_email_saved
  // (intake_capped + intake_failed are deflection paths that block the funnel)

  // Engagement: visitor submitted a URL to /api/intake/start (kicks off the
  // 8-phase enrichment pipeline). NOT a lead yet — just intent.
  | {
      name: "intake_start";
      params: {
        /** "intake_hero" for the homepage drop-zone, etc. */
        cta_location: string;
      };
    }
  // Engagement: snapshot completed and rendered to the visitor.
  // The "interested but anonymous" milestone — we know it converted them
  // to seeing the product but they haven't given us anything yet.
  | {
      name: "intake_snapshot_view";
      params: {
        /** 0–100 readiness score from the snapshot. */
        readiness_score?: number;
        /** Tier recommended in the snapshot, mirrors `select_item` taxonomy. */
        recommended_tier?: "the-blueprint" | "navigator" | "builder" | "not-ready";
        /** How many expansion markets we generated for them. */
        expansion_markets?: number;
        cta_location?: string;
      };
    }
  // CONVERSION: visitor handed over their email to save the snapshot.
  // This is the actual lead — fire `generate_lead` (Google's native lead
  // event) so it shows up alongside Calendly bookings and contact-form
  // submits in the standard "Lead generation" report.
  | {
      name: "intake_email_saved";
      params: {
        readiness_score?: number;
        recommended_tier?: "the-blueprint" | "navigator" | "builder" | "not-ready";
        cta_location?: string;
      };
    }
  // Deflection: daily $20 cap hit; alternate CTA shown.
  | {
      name: "intake_capped";
      params: {
        cta_location?: string;
      };
    }
  // Deflection: scrape / geocode / pipeline failed; error CTA shown.
  | {
      name: "intake_failed";
      params: {
        /** Short failure reason: "scrape_failed", "no_address", "stream_aborted", etc. */
        failure_reason?: string;
        /** Which phase died, if known: "scrape" | "business" | "geocode" | "demographics" | "expansion" | "competitors" | "score" | "summary". */
        failed_phase?: string;
      };
    }

  // ─── Assessment quiz funnel ─────────────────────────────────────────
  // Funnel: assessment_start → assessment_complete → cta to next step

  // Engagement: visitor clicked "Begin assessment" / first question rendered.
  | {
      name: "assessment_start";
      params: {
        /** Page that hosted the start button — "assessment_page" | "assessment_resume_banner". */
        source?: string;
        /** True if they're resuming a saved session vs. starting fresh. */
        is_resume?: boolean;
      };
    }

  // ─── Portal usage (the actual product) ───────────────────────────────
  // The portal is the $2,997+ deliverable. Every event below answers a
  // product-management question we currently can't answer.

  // Onboarding: paying customer signed in (magic-link confirmed).
  | {
      name: "portal_login";
      params: {
        /** Stripe customer.tier from purchases — "the-blueprint" | "navigator" | "builder". */
        tier?: string;
        /** True if this is the customer's first sign-in ever. */
        first_login?: boolean;
      };
    }
  // Engagement: customer opened one of the 17 blueprint sections.
  | {
      name: "portal_section_open";
      params: {
        /** Slug of the section, e.g. "business_overview". */
        section_slug: string;
        /** Current % completion of THIS section when opened (0–100). */
        section_progress?: number;
      };
    }
  // Progress: customer saved an answer in a section (any field write).
  | {
      name: "portal_section_save";
      params: {
        section_slug: string;
        /** Field key being saved — useful to spot which questions stall. */
        field_key?: string;
        /** Source of the saved value — "human" | "jason_ai" | "intake_prefill". */
        source?: string;
      };
    }
  // Milestone: customer crossed a section's completion threshold (100%).
  | {
      name: "portal_section_complete";
      params: {
        section_slug: string;
        /** % complete across the whole blueprint after this section landed. */
        blueprint_progress?: number;
      };
    }
  // Conversion: customer requested an export of a deliverable (FDD draft,
  // ops manual, financial model, etc).
  | {
      name: "portal_export_request";
      params: {
        /** Slug of the deliverable being exported. */
        deliverable: string;
        /** "pdf" | "docx" | "preview". */
        format?: string;
      };
    }
  // Engagement: customer sent a message to the in-portal Jason AI agent.
  | {
      name: "portal_jason_ai_message";
      params: {
        /** Where in the portal the message was sent from. */
        surface?: string;
        /** True if Jason AI responded with a write to a blueprint field. */
        agent_wrote?: boolean;
      };
    }
  // Conversion: customer clicked to schedule a coaching call.
  | {
      name: "portal_coaching_book";
      params: {
        /** Tier the customer is on — gates which coaching SKU appears. */
        tier?: string;
      };
    }
  // Conversion intent: customer landed on the upgrade page.
  | {
      name: "portal_upgrade_view";
      params: {
        /** Current tier they're upgrading from. */
        from_tier?: string;
      };
    }
  // Conversion: customer initiated an upgrade purchase.
  | {
      name: "portal_upgrade_select";
      params: {
        from_tier?: string;
        to_tier?: string;
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
