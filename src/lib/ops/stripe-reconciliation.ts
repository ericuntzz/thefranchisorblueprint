import type { StripeReconciliationSummary } from "./types";

export async function collect(): Promise<StripeReconciliationSummary> {
  return { status: "not_configured" };
}
