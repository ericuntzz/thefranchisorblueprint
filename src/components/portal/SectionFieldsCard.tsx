"use client";

/**
 * SectionFieldsCard — data-entry view for the dashboard's per-section
 * inline editor. Replaces SectionCard in that surface.
 *
 * Mental model split (Eric, May 2026):
 *   - Dashboard `/portal` section row  →  THIS card. Pure structured-
 *     field entry. Autosave, attachments, no prose. The user is in
 *     "fill it in" mode.
 *   - Blueprint `/portal/lab/blueprint`  →  SectionCard. Assembled prose
 *     with section-level "Edit Text" hover. The user is in "read +
 *     polish" mode.
 *
 * Two surfaces, two distinct jobs, no toggling required by the user.
 *
 * Bridge: a small "See how this reads in the Blueprint →" link in
 * the footer takes the user to the Blueprint page anchored to this
 * section, so they can flip between modes without losing context.
 *
 * For sections without a schema (e.g. the few legacy slugs), this
 * card falls back to a stub message that punts the user to the
 * Blueprint page where the prose can still be edited.
 */

import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { SectionFieldEditor } from "@/components/agent/SectionFieldEditor";
import { SectionAttachments } from "@/components/agent/SectionAttachments";
import type {
  SectionAttachment,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import type { SectionSchema } from "@/lib/memory/schemas";
import type { MemoryFieldsMap } from "@/lib/calc";
import type { MemoryFileSlug } from "@/lib/memory/files";

type FieldValue = string | number | boolean | string[] | null;
type FieldSource =
  | "voice_session"
  | "upload"
  | "form"
  | "agent_inference"
  | "research"
  | "scraper"
  | "user_correction"
  | "user_typed";

type Props = {
  slug: MemoryFileSlug;
  title: string;
  schema: SectionSchema | null;
  attachments: SectionAttachment[];
  fields: Record<string, FieldValue>;
  fieldStatus?: Record<
    string,
    {
      source: FieldSource;
      updated_at?: string;
      note?: string;
    }
  >;
  otherSectionsFields: MemoryFieldsMap;
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  /** Provenance is data-entry context (which source filled what); not
   *  surfaced by default but kept in props so future trust-signal UI
   *  has it on hand. */
  provenance?: CustomerMemoryProvenance[];
  /** Increments every time the user clicks the row's Attach button.
   *  Forwarded to SectionAttachments which pops its composer open
   *  whenever this changes. Optional — undefined just means "no
   *  Attach shortcut wired up here." */
  attachOpenSignal?: number;
  saveFields: (args: {
    slug: string;
    changes: Record<string, FieldValue>;
  }) => Promise<void>;
};

export function SectionFieldsCard({
  slug,
  title,
  schema,
  attachments,
  fields,
  fieldStatus,
  otherSectionsFields,
  lastUpdatedBy,
  updatedAt,
  attachOpenSignal,
  saveFields,
}: Props) {
  // No-schema fallback. Most sections will have one; brand_voice and
  // a few others are still being authored. Punt these to the Blueprint
  // page where prose editing is the entry point.
  if (!schema) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold mb-1">{title}</div>
          <p className="text-amber-900/85 leading-relaxed">
            This section doesn&apos;t have a structured questionnaire yet
            — it&apos;s edited as freeform prose.
          </p>
          <Link
            href={`/portal/lab/blueprint#section-${slug}`}
            className="inline-flex items-center gap-1.5 mt-3 text-navy hover:text-navy-light font-bold text-xs uppercase tracking-[0.1em] transition-colors"
          >
            <BookOpen size={12} />
            Edit in the Blueprint
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Description — context for what the customer is filling in.
          The section title lives in the row header above; no need to
          repeat it here. */}
      {schema.description && (
        <p className="text-grey-3 text-sm leading-relaxed max-w-[680px]">
          {schema.description}
        </p>
      )}

      {/* "Compiles into: ..." chip removed 2026-05-09 per Eric — it's
          a metadata line that didn't earn its dashboard real estate.
          Schema field still exists in lib/memory/schemas.ts in case a
          future surface (export preview, audit page) wants to show it. */}

      {/* The actual field editor. Autosaves; no explicit Save/Cancel
          (the row's Close toggle ends the session). */}
      <SectionFieldEditor
        schema={schema}
        initialFields={fields}
        fieldStatus={fieldStatus}
        otherSectionsFields={otherSectionsFields}
        onSave={async (changes) => {
          await saveFields({ slug, changes });
        }}
      />

      {/* Attachments — same component used in the prose-mode card.
          Inputs that influence drafting belong with the data-entry
          surface, not the prose-review one. attachOpenSignal lets
          the row-header Attach button shortcut into the composer. */}
      <SectionAttachments
        slug={slug}
        attachments={attachments}
        openComposerSignal={attachOpenSignal}
      />

      {/* Footer: when the section was last touched + a bridge to the
          Blueprint page where the customer can read what got drafted
          and polish the prose. */}
      <footer className="pt-3 border-t border-card-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-grey-3">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={11} />
          {lastUpdatedBy && updatedAt
            ? `Updated by ${lastUpdatedBy === "scraper" ? "the scraper" : lastUpdatedBy} ${formatRelative(updatedAt)}`
            : "Never updated"}
        </span>
        <Link
          href={`/portal/lab/blueprint#section-${slug}`}
          className="inline-flex items-center gap-1.5 text-navy hover:text-navy-light font-bold uppercase tracking-[0.1em] transition-colors"
        >
          <BookOpen size={12} />
          View drafted prose
          <ArrowRight size={12} />
        </Link>
      </footer>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

