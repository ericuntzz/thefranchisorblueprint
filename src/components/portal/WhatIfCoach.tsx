"use client";

/**
 * WhatIfCoach — collapsible scenario cards on the Command Center.
 *
 * Surfaces the franchise-specific "what if?" questions Jason has seen
 * play out a hundred times — the ones a brand-new franchisor doesn't
 * know to ask. Each card collapsed shows the question + severity pill;
 * expanded reveals Jason's 2-3 sentence take + a deep-link to the
 * related section.
 *
 * Browse-able. The customer doesn't have to act on these — but they
 * read them once and the brand benefits forever.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, AlertTriangle, Eye, ShieldAlert } from "lucide-react";
import { PHASES, type PhaseId } from "@/lib/memory/phases";
import {
  SCENARIOS,
  type ScenarioDef,
  type ScenarioSeverity,
} from "@/lib/coaching/scenarios";

export function WhatIfCoach() {
  return (
    <section className="bg-white rounded-2xl border border-card-border p-5 sm:p-6 md:p-8">
      <div className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold mb-1">
        Jason&apos;s playbook
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
        What-if coaching
      </h2>
      <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[640px]">
        The franchise-specific edge cases a new franchisor doesn&apos;t know to
        ask about — but Jason has watched play out a hundred times. Worth a
        scroll-through before your first state filing.
      </p>

      <div className="space-y-6">
        {PHASES.map((phase) => {
          const scenarios = SCENARIOS.filter((s) => s.phase === phase.id);
          if (scenarios.length === 0) return null;
          return (
            <PhaseGroup key={phase.id} phaseId={phase.id} title={phase.title} subtitle={phase.subtitle} scenarios={scenarios} />
          );
        })}
      </div>
    </section>
  );
}

function PhaseGroup({
  phaseId,
  title,
  subtitle,
  scenarios,
}: {
  phaseId: PhaseId;
  title: string;
  subtitle: string;
  scenarios: ScenarioDef[];
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-navy font-bold text-sm">{title}</h3>
        <span className="text-grey-3 text-xs">{subtitle}</span>
      </div>
      <ul className="space-y-2">
        {scenarios.map((s) => (
          <ScenarioRow key={s.id} scenario={s} phaseId={phaseId} />
        ))}
      </ul>
    </div>
  );
}

function ScenarioRow({ scenario, phaseId }: { scenario: ScenarioDef; phaseId: PhaseId }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border border-card-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-cream/50 transition-colors"
        aria-expanded={open}
        aria-controls={`scenario-${scenario.id}`}
      >
        <span className="flex-shrink-0 mt-0.5 text-grey-3">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-navy font-semibold text-sm leading-snug">
              {scenario.question}
            </span>
            <SeverityPill severity={scenario.severity} />
          </div>
          {!open && (
            <div className="text-grey-3 text-xs mt-1 leading-snug">{scenario.why}</div>
          )}
        </div>
      </button>
      {open && (
        <div id={`scenario-${scenario.id}`} className="px-4 pb-4 pt-1 border-t border-navy/5 bg-cream/20">
          <p className="text-navy text-sm leading-relaxed mb-3">{scenario.answer}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-grey-3 italic">Why this matters: {scenario.why}</span>
            {scenario.relatedSection && (
              <Link
                href={`/portal/section/${scenario.relatedSection}`}
                className="text-navy hover:underline font-bold uppercase tracking-[0.1em]"
              >
                Open the related section →
              </Link>
            )}
          </div>
          {/* Phase context kept implicit; phaseId reserved for future filtering. */}
          {phaseId && null}
        </div>
      )}
    </li>
  );
}

function SeverityPill({ severity }: { severity: ScenarioSeverity }) {
  if (severity === "critical") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <ShieldAlert size={9} /> Critical
      </span>
    );
  }
  if (severity === "important") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle size={9} /> Important
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-grey-3 bg-grey-1/50 border border-card-border rounded-full px-2 py-0.5">
      <Eye size={9} /> Watch
    </span>
  );
}
