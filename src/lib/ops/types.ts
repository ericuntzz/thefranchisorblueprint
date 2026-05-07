export type RescueResult = {
  firstName: string | null;
  email: string;
  daysIdle: number;
  nextChapter: string;
  sent: boolean;
};

export type NewCustomer = {
  firstName: string | null;
  email: string;
  tier: 1 | 2 | 3;
  tierName: string;
  amountCents: number;
  purchasedAt: string;
};

export type AssessmentLead = {
  email: string;
  firstName: string | null;
  businessName: string | null;
  band: string;
  score: number;
  completedAt: string;
  daysSinceCompletion: number;
};

/**
 * Warm assessment lead (franchise_ready or nearly_there band) who completed
 * the assessment 1-7 days ago and has NOT booked a strategy call NOR
 * purchased anything. Surfaced in the daily ops digest as a watchlist for
 * Jason's personal follow-up.
 */
export type MissedWarmLead = {
  assessmentSessionId: string;
  email: string;
  firstName: string | null;
  businessName: string | null;
  websiteUrl: string | null;
  band: "franchise_ready" | "nearly_there";
  score: number;
  urgency: string | null;
  completedAt: string;
  daysSinceCompletion: number;
};

export type RefundWatchItem = {
  firstName: string | null;
  email: string;
  tier: 1 | 2 | 3;
  tierName: string;
  daysRemaining: number;
  readinessPct: number;
};

export type EmailHealthSummary = {
  sent24h: number;
  failed24h: number;
  failures: Array<{
    recipient: string;
    template: string;
    reason: string | null;
    failedAt: string;
  }>;
};

export type StripeReconciliationSummary = {
  status: "not_configured";
} | {
  status: "ok" | "drift_detected";
  issueCount: number;
};

export type PlatformHealthSummary = {
  status: "not_configured";
} | {
  status: "all_clear" | "incidents";
  incidentCount: number;
};

export type OpsDigestPayload = {
  dateLabel: string;
  rescueResults: RescueResult[];
  newCustomers: NewCustomer[];
  assessmentLeads: AssessmentLead[];
  missedWarmLeads: MissedWarmLead[];
  refundWatchlist: RefundWatchItem[];
  emailHealth: EmailHealthSummary;
  stripeReconciliation: StripeReconciliationSummary;
  platformHealth: PlatformHealthSummary;
  siteUrl: string;
};
