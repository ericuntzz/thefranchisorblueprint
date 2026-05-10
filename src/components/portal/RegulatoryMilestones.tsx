"use client";

/**
 * Regulatory Milestone Tracker — Stripe Atlas-style external checklist.
 *
 * Lists every milestone in the catalog grouped by phase. Each row has
 * a status menu (pending / in progress / complete / skipped) the
 * customer can flip inline. Saves via POST /api/milestones; the row
 * shows a faint "Saving…" state during the round-trip and the page
 * revalidates afterward.
 *
 * Different from the DeliverableExplorer (which tracks WORK the
 * franchisor is doing) — these are EXTERNAL events with regulators,
 * law firms, audit firms, and insurance carriers.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleDot, MinusCircle } from "lucide-react";
import {
  MILESTONES,
  PHASE_DEFS,
  type MilestoneDef,
  type MilestoneState,
  type MilestoneStatus,
} from "@/lib/milestones/types";

type Props = {
  states: Record<string, MilestoneState>;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    percentComplete: number;
    nextMilestone: MilestoneDef | null;
  };
};

export function RegulatoryMilestones({ states, summary }: Props) {
  return (
    <section className="bg-white rounded-2xl border border-card-border p-5 sm:p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold">
          Regulatory milestones
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-grey-3 font-bold tabular-nums">
          {summary.completed} of {summary.total} complete
        </span>
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
        Your launch checklist
      </h2>
      <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-4 max-w-[640px]">
        External events that have to happen before you sign your first franchisee.
        Track each one as you complete it. {summary.nextMilestone && (
          <>
            Next up: <strong className="text-navy">{summary.nextMilestone.label}</strong>.
          </>
        )}
      </p>

      <div className="h-2 rounded-full bg-grey-1 overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-gold to-gold-warm transition-all duration-500"
          style={{ width: `${summary.percentComplete}%` }}
        />
      </div>

      <div className="space-y-6">
        {PHASE_DEFS.map((phase) => {
          const phaseMilestones = MILESTONES.filter((m) => m.phase === phase.id).sort(
            (a, b) => a.order - b.order,
          );
          return (
            <div key={phase.id}>
              <div className="flex items-baseline gap-3 mb-2">
                <h3 className="text-navy font-bold text-sm">{phase.label}</h3>
                <span className="text-grey-3 text-xs">{phase.subtitle}</span>
              </div>
              <ul className="space-y-1.5">
                {phaseMilestones.map((m) => (
                  <MilestoneRow
                    key={m.id}
                    milestone={m}
                    state={states[m.id] ?? null}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MilestoneRow({
  milestone,
  state,
}: {
  milestone: MilestoneDef;
  state: MilestoneState | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status: MilestoneStatus = state?.status ?? "pending";

  function setStatus(next: MilestoneStatus) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            milestoneId: milestone.id,
            status: next,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? "Update failed");
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  return (
    <li
      className={`group flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${
        status === "complete"
          ? "border-emerald-200 bg-emerald-50/40"
          : status === "in_progress"
            ? "border-amber-200 bg-amber-50/40"
            : status === "skipped"
              ? "border-grey-2 bg-grey-1/30 opacity-70"
              : "border-navy/10 bg-cream/30 hover:bg-cream/60"
      }`}
    >
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`text-sm font-semibold ${
              status === "complete" ? "text-emerald-900 line-through decoration-emerald-300" : "text-navy"
            }`}
          >
            {milestone.label}
          </span>
          {milestone.relatedSection && (
            <Link
              href={`/portal/section/${milestone.relatedSection}`}
              className="text-[10px] text-grey-3 hover:text-navy uppercase tracking-[0.1em] font-semibold"
            >
              · open section
            </Link>
          )}
        </div>
        <div className="text-xs text-grey-3 leading-snug">
          {milestone.description}
        </div>
        {error && (
          <div className="text-xs text-red-600 mt-1" role="alert">
            {error}
          </div>
        )}
      </div>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
        className="text-xs border border-navy/15 rounded-md px-2 py-1 bg-white text-navy font-semibold disabled:opacity-50"
        aria-label={`Status for ${milestone.label}`}
      >
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="complete">Complete</option>
        <option value="skipped">Not applicable</option>
      </select>
    </li>
  );
}

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === "complete") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-amber-500 flex items-center justify-center text-amber-600">
        <CircleDot size={13} />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-grey-1 flex items-center justify-center text-grey-3">
        <MinusCircle size={13} />
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-navy/15 flex items-center justify-center text-navy/30">
      <Circle size={13} />
    </span>
  );
}
