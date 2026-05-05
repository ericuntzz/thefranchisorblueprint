import type { PlatformHealthSummary } from "./types";

export async function collect(): Promise<PlatformHealthSummary> {
  return { status: "not_configured" };
}
