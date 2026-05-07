import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase/server";
import { RegulatoryMilestones } from "@/components/portal/RegulatoryMilestones";
import {
  computeMilestoneSummary,
  indexMilestones,
  readMilestones,
} from "@/lib/milestones/state";
import type { MilestoneState } from "@/lib/milestones/types";

export const metadata: Metadata = {
  title: "Launch Checklist | The Franchisor Blueprint",
};

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login?next=%2Fportal%2Fchecklist");

  const milestoneRows = await readMilestones(user.id);
  const milestoneStates = indexMilestones(milestoneRows);
  const milestoneStatesObj: Record<string, MilestoneState> = Object.fromEntries(
    milestoneStates.entries(),
  );
  const milestoneSummary = computeMilestoneSummary(milestoneStates);

  return (
    <main className="bg-cream-soft min-h-[calc(100vh-200px)] py-10 md:py-14">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 space-y-6">
        <header>
          <div className="text-xs uppercase tracking-[0.18em] text-gold-text font-bold mb-2">
            Launch Checklist
          </div>
          <h1 className="text-navy font-extrabold text-3xl md:text-5xl leading-[1.05] tracking-tight mb-3">
            Everything that has to happen before you can launch.
          </h1>
          <p className="text-grey-3 text-base md:text-lg max-w-[640px] leading-relaxed">
            External milestones with regulators, attorneys, audit firms,
            and insurance carriers. Update each row as it moves —{" "}
            {milestoneSummary.completed} of {milestoneSummary.total} complete
            so far.
          </p>
        </header>

        <RegulatoryMilestones
          states={milestoneStatesObj}
          summary={milestoneSummary}
        />
      </div>
    </main>
  );
}
