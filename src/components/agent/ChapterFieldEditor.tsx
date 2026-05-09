"use client";

/**
 * ChapterFieldEditor — Profound-style structured-fields editor for one
 * chapter of the customer's Franchisor Blueprint.
 *
 * Reads the chapter's schema from `src/lib/memory/schemas.ts`, renders
 * one labeled input per field grouped by category, and tracks edits
 * locally until the customer hits Save.
 *
 * Computed fields (declared with `computed:` on FieldDef) are rendered
 * as read-only with a "calculated from X" tooltip — value is recomputed
 * live as dependencies change. Suggested fields (`suggestedFrom:`) get
 * a small "suggested" badge with the source.
 *
 * Save fires the `saveMemoryFields` server action passed in via prop
 * — the parent ChapterCard handles the round-trip and refreshes the
 * page state.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  type ChapterSchema,
  type FieldDef,
  type FieldType,
} from "@/lib/memory/schemas";
import {
  computeAllFormulas,
  hasCalc,
  hasDerivedDefault,
  type MemoryFieldsMap,
} from "@/lib/calc";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { lookupIndustryValue } from "@/lib/memory/industry-lookup";
import { SchemaFieldInput } from "./SchemaFieldInput";

type FieldValue = string | number | boolean | string[] | null;

/** Trust signals: where each filled field's value came from. Mirrors
 *  the `field_status[name].source` enum on customer_memory. Used to
 *  render a small "From your website / your answer / Jason inferred"
 *  subtext under each input — explainability without overwhelming
 *  the form. */
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
  schema: ChapterSchema;
  initialFields: Record<string, FieldValue>;
  /** Per-field provenance from customer_memory.field_status. Optional
   *  — when a field has no entry we fall back to "no badge". Empty
   *  object on a fresh chapter. */
  fieldStatus?: Record<
    string,
    { source: FieldSource; updated_at?: string; note?: string } | undefined
  >;
  /**
   * Field values from OTHER chapters — needed to compute cross-chapter
   * derivations (e.g. franchisee_profile.minimum_liquid_capital depends
   * on unit_economics.initial_investment_high). Passed in by the parent
   * (ChapterCard's host page) which has the full Memory state available.
   */
  otherChaptersFields: MemoryFieldsMap;
  onSave: (fields: Record<string, FieldValue>) => Promise<void>;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ChapterFieldEditor({
  schema,
  initialFields,
  fieldStatus,
  otherChaptersFields,
  onSave,
}: Props) {
  const [values, setValues] = useState<Record<string, FieldValue>>(initialFields);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Snapshot of what's been persisted to the server. Diffed against
  // `values` to compute the autosave payload, and updated after every
  // successful save so we don't re-send unchanged fields.
  const lastSavedRef = useRef<Record<string, FieldValue>>(initialFields);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Eric: "concerned a user won't see the [advanced] button and won't
  // complete the section." Drop the toggle — render every field
  // up-front so nothing is hidden behind a press.
  const showAdvanced = true;

  // Compute all formula values from current state. Recomputed on every
  // edit so live computed fields (EBITDA margin, payback period, etc.)
  // update as the customer types. Cheap — pure JS, no async.
  const computedValues = useMemo(() => {
    const memory: MemoryFieldsMap = {
      ...otherChaptersFields,
      [schema.slug]: values,
    };
    return computeAllFormulas(memory)[schema.slug] ?? {};
  }, [values, otherChaptersFields, schema.slug]);

  // Group fields by category. Preserve schema order within each group.
  const grouped = useMemo(() => {
    const groups: Array<{ category: string; fields: FieldDef[] }> = [];
    const byCategory = new Map<string, FieldDef[]>();
    for (const f of schema.fields) {
      const cat = f.category ?? "Other";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(f);
    }
    for (const [category, fields] of byCategory) {
      groups.push({ category, fields });
    }
    return groups;
  }, [schema.fields]);


  const update = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  // Autosave: any change to `values` schedules a debounced save 1.5s
  // after the last edit. Computed fields are skipped (server ignores
  // them) and we diff against the last-saved snapshot, not initial
  // fields, so subsequent edits in the same session don't re-send the
  // same data.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const changes: Record<string, FieldValue> = {};
    for (const f of schema.fields) {
      if (hasCalc(schema.slug, f.name)) continue;
      const before = lastSavedRef.current[f.name];
      const after = values[f.name];
      if (!shallowEqual(before, after)) {
        changes[f.name] = after ?? null;
      }
    }
    if (Object.keys(changes).length === 0) return;
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      setError(null);
      try {
        await onSave(changes);
        lastSavedRef.current = { ...lastSavedRef.current, ...changes };
        setSaveStatus("saved");
        // Keep "Saved" visible for ~3s, then fade back to idle.
        if (savedToastRef.current) clearTimeout(savedToastRef.current);
        savedToastRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setSaveStatus("error");
      }
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values, schema.fields, schema.slug, onSave]);

  // Cleanup the saved-toast timer on unmount.
  useEffect(() => {
    return () => {
      if (savedToastRef.current) clearTimeout(savedToastRef.current);
    };
  }, []);

  return (
    <div className="space-y-7">
      {/* Autosave status — pinned to the right edge of the form,
          inline at the top so it's always visible while the user is
          typing. The pill fades in/out smoothly with a small slide
          rather than appearing instantly. */}
      <div
        className="-mt-2 flex justify-end transition-opacity duration-300 ease-out motion-reduce:transition-none"
        style={{ opacity: saveStatus === "idle" ? 0 : 1 }}
        aria-live="polite"
        aria-atomic="true"
        aria-hidden={saveStatus === "idle"}
      >
        {saveStatus === "saving" && (
          <span className="inline-flex items-center gap-1.5 text-grey-3 text-xs font-semibold">
            <Loader2 size={12} className="animate-spin" />
            Saving…
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <Check size={12} />
            Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="inline-flex items-center gap-1.5 text-red-700 text-xs font-semibold" title={error ?? undefined}>
            <X size={12} />
            Couldn&apos;t save — your last edit isn&apos;t persisted
          </span>
        )}
      </div>
      {grouped.map((group) => {
        const visibleFields = group.fields.filter(
          (f) => showAdvanced || !f.advanced,
        );
        if (visibleFields.length === 0) return null;
        return (
          <fieldset key={group.category} className="space-y-4">
            <legend className="text-xs uppercase tracking-[0.12em] text-gold-text font-bold">
              {group.category}
            </legend>
            <div className="space-y-4">
              {visibleFields.map((fd) => {
                // The same registry holds COMPUTED (read-only) and
                // DERIVED_DEFAULT (suggested-but-editable) values; the
                // UI distinguishes them via hasCalc / hasDerivedDefault.
                // Both resolve to number | null per CalcFn.
                const cv = computedValues[fd.name];
                const computedNumber =
                  typeof cv === "number" ? cv : null;
                // Industry-suggested value for fields that declare
                // suggestedFrom: industry_lookup. Pulled fresh from
                // either local values (if we're editing
                // business_overview) or otherChaptersFields. Returns
                // null when industry isn't set or there's no mapping.
                const industryCategory =
                  schema.slug === "business_overview"
                    ? (values["industry_category"] as string | null)
                    : ((otherChaptersFields.business_overview?.[
                        "industry_category"
                      ] as string | null) ?? null);
                const industrySuggestion =
                  fd.suggestedFrom?.kind === "industry_lookup"
                    ? lookupIndustryValue({
                        industryCategory,
                        fieldName: fd.name,
                      })
                    : null;
                return (
                  <FieldInput
                    key={fd.name}
                    fieldDef={fd}
                    slug={schema.slug}
                    value={values[fd.name] ?? null}
                    computedValue={computedNumber}
                    industrySuggestion={industrySuggestion}
                    onChange={(v) => update(fd.name, v)}
                  />
                );
              })}
            </div>
          </fieldset>
        );
      })}

    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldInput — switches on FieldType, renders the right control
// ---------------------------------------------------------------------------

function FieldInput({
  fieldDef,
  slug,
  value,
  computedValue,
  industrySuggestion,
  onChange,
}: {
  fieldDef: FieldDef;
  slug: MemoryFileSlug;
  value: FieldValue;
  computedValue: number | null;
  /** Industry-lookup suggestion (number for currency/percentage,
   *  string for NAICS-like codes). Null when there's no mapping or
   *  the customer hasn't set their industry yet. */
  industrySuggestion: string | number | null;
  onChange: (v: FieldValue) => void;
}) {
  const isComputed = hasCalc(slug, fieldDef.name);
  // Derived-default: editable, but if the customer hasn't typed
  // anything yet, we surface the computed default as a one-click
  // "Use suggested" affordance. Distinct from "Suggested" badges
  // (industry_lookup / from_assessment / from_scrape) because those
  // suggestions come from external lookups, not formulas.
  const hasSuggestedDefault =
    !isComputed &&
    hasDerivedDefault(slug, fieldDef.name) &&
    computedValue != null &&
    (value == null || value === "" || value === 0);

  // SUGGESTED pill is only meaningful when the field is empty — i.e.
  // when we're offering a default. Once the field has a value (whether
  // from accepting the suggestion or typing one), the pill is noise:
  // the value just is what it is.
  const isFieldEmpty = value == null || value === "" || value === 0;

  return (
    <div className="space-y-1">
      <FieldLabel fieldDef={fieldDef} isComputed={isComputed} isFieldEmpty={isFieldEmpty} />
      {isComputed ? (
        <ComputedValueDisplay
          fieldDef={fieldDef}
          value={computedValue}
        />
      ) : (
        <FieldControl
          fieldDef={fieldDef}
          value={value}
          onChange={onChange}
        />
      )}
      {hasSuggestedDefault && computedValue != null && (
        <button
          type="button"
          onClick={() => onChange(computedValue)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5 transition-colors"
        >
          <Sparkles size={10} />
          Use suggested:{" "}
          <span className="tabular-nums">
            {formatNumeric(fieldDef.type, computedValue)}
          </span>
        </button>
      )}
      {/* Industry-lookup suggestion. Same affordance as the derived-
          default pill above but the source is the static industry
          benchmarks (lib/memory/industry-lookup.ts). Only renders
          when the field is currently empty AND we have a value. */}
      {!isComputed &&
        industrySuggestion != null &&
        (value == null || value === "" || value === 0) && (
          <button
            type="button"
            onClick={() => onChange(industrySuggestion as FieldValue)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5 transition-colors"
          >
            <Sparkles size={10} />
            Use industry suggestion:{" "}
            <span className="tabular-nums">
              {typeof industrySuggestion === "number"
                ? formatNumeric(fieldDef.type, industrySuggestion)
                : industrySuggestion}
            </span>
          </button>
        )}
      {/* Per-field source label ("From your website" / "Jason inferred"
          / etc.) removed 2026-05-09 per Eric — the chip stacked under
          every prefilled field added more visual noise than trust value.
          The fieldStatus.source is still recorded server-side for
          provenance + activity feed; we just don't surface it inline. */}
    </div>
  );
}

function FieldLabel({
  fieldDef,
  isComputed,
  isFieldEmpty = false,
}: {
  fieldDef: FieldDef;
  isComputed: boolean;
  isFieldEmpty?: boolean;
}) {
  const showSuggested = fieldDef.suggestedFrom && !isComputed && isFieldEmpty;
  const tooltip = !isComputed ? fieldDef.helpText : undefined;
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-navy">
      <span>
        {fieldDef.label}
        {fieldDef.required && (
          <span className="text-gold-warm ml-1" aria-label="required">
            *
          </span>
        )}
      </span>
      {tooltip && (
        <span
          className="inline-flex items-center text-grey-3 hover:text-navy cursor-help transition-colors"
          title={tooltip}
          aria-label={tooltip}
        >
          <Info size={13} />
        </span>
      )}
      {isComputed && (
        <span
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.06em] font-bold text-white bg-emerald-600 rounded-full px-2 py-0.5 shadow-sm"
          title="Calculated automatically from your other inputs"
        >
          <Calculator size={11} />
          Calculated
        </span>
      )}
      {showSuggested && (
        <span
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.06em] font-bold text-navy bg-gold rounded-full px-2 py-0.5 shadow-sm"
          title={suggestedSourceLabel(fieldDef)}
        >
          <Sparkles size={11} />
          Suggested
        </span>
      )}
    </label>
  );
}

function suggestedSourceLabel(fieldDef: FieldDef): string {
  const sf = fieldDef.suggestedFrom;
  if (!sf) return "";
  switch (sf.kind) {
    case "industry_lookup":
      return `Suggested from your industry: ${sf.source}`;
    case "derived":
      return `Calculated from: ${sf.formula}`;
    case "from_assessment":
      return `Pulled from your pre-purchase assessment (${sf.field})`;
    case "from_scrape":
      return `Pulled from your website (${sf.field})`;
  }
}

function ComputedValueDisplay({
  fieldDef,
  value,
}: {
  fieldDef: FieldDef;
  value: number | null;
}) {
  const formatted = value == null ? null : formatNumeric(fieldDef.type, value);
  return (
    <div className="rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-3.5 text-navy">
      <div className="font-bold text-lg tabular-nums">
        {formatted ?? <span className="text-grey-3">— (need more inputs)</span>}
      </div>
      {fieldDef.computed?.formula && (
        <div className="mt-1.5 text-xs text-grey-3 italic">
          <Info size={11} className="inline mr-1 -mt-0.5" />
          {fieldDef.computed.formula}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldControl — the actual input by FieldType
// ---------------------------------------------------------------------------

function FieldControl({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  switch (fieldDef.type) {
    case "text":
    case "email":
    case "url":
      return (
        <input
          type={fieldDef.type === "email" ? "email" : fieldDef.type === "url" ? "url" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholderFor(fieldDef.placeholder)}
          required={fieldDef.required}
          className={inputClass}
        />
      );

    case "textarea":
    case "markdown":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholderFor(fieldDef.placeholder)}
          required={fieldDef.required}
          rows={4}
          className={`${inputClass} resize-y min-h-[88px]`}
        />
      );

    case "number":
    case "integer": {
      const v = value as number | null;
      return (
        <input
          type="number"
          value={v ?? ""}
          step={fieldDef.type === "integer" ? 1 : "any"}
          min={fieldDef.min}
          max={fieldDef.max}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={placeholderFor(fieldDef.placeholder)}
          required={fieldDef.required}
          className={inputClass}
        />
      );
    }

    case "currency": {
      const v = value as number | null;
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-3 text-sm font-semibold">
            $
          </span>
          <input
            type="number"
            value={v ?? ""}
            step="any"
            min={0}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            placeholder={placeholderFor(fieldDef.placeholder)}
            required={fieldDef.required}
            className={`${inputClass} pl-7 tabular-nums`}
          />
        </div>
      );
    }

    case "percentage": {
      const v = value as number | null;
      return (
        <div className="relative">
          <input
            type="number"
            value={v ?? ""}
            step="any"
            min={fieldDef.min ?? 0}
            max={fieldDef.max ?? 100}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            placeholder={placeholderFor(fieldDef.placeholder)}
            required={fieldDef.required}
            className={`${inputClass} pr-8 tabular-nums`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-3 text-sm font-semibold">
            %
          </span>
        </div>
      );
    }

    case "year": {
      const v = value as number | null;
      return (
        <input
          type="number"
          value={v ?? ""}
          step={1}
          min={1900}
          max={new Date().getFullYear() + 5}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={placeholderFor(fieldDef.placeholder)}
          required={fieldDef.required}
          className={`${inputClass} tabular-nums`}
        />
      );
    }

    case "date": {
      // Cap at today unless the field opts into future dates (see
      // FieldDef.allowFutureDate). Founding/opening dates etc.
      // shouldn't accept "next year".
      const todayIso = new Date().toISOString().slice(0, 10);
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          required={fieldDef.required}
          max={fieldDef.allowFutureDate ? undefined : todayIso}
          className={inputClass}
        />
      );
    }

    case "color": {
      const v = (value as string) ?? "#000000";
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded-lg border border-navy/15 cursor-pointer"
          />
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={placeholderFor(fieldDef.placeholder) ?? "#1E3A5F"}
            className={`${inputClass} flex-1 font-mono text-sm uppercase`}
          />
        </div>
      );
    }

    case "boolean": {
      const v = value === true;
      return (
        <button
          type="button"
          role="switch"
          aria-checked={v}
          onClick={() => onChange(!v)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors border-2 ${
            v
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-grey-1 border-navy/15 text-grey-3 hover:border-navy/30"
          }`}
        >
          {v ? (
            <>
              <CheckCircle2 size={14} />
              Yes
            </>
          ) : (
            <>
              <X size={14} />
              No
            </>
          )}
        </button>
      );
    }

    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          required={fieldDef.required}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {fieldDef.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "list_short":
    case "list_long":
    case "color_list":
      // List + color-list cases delegate to SchemaFieldInput so the
      // raw-text-preserving + multi-color-with-+button behavior
      // matches the queue exactly. Earlier per-keystroke trim here
      // was the "space bar doesn't work" bug Eric reported.
      return (
        <SchemaFieldInput
          fieldDef={fieldDef}
          value={value}
          onChange={onChange}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// `placeholder:italic` is the visual cue that distinguishes example
// text from real values. Eric's feedback: placeholder strings like
// "Cypress Lane is a small-town third-wave coffee shop…" read like
// populated data and made the editor feel pre-filled when it wasn't.
// Italic + lighter grey + "e.g." prefix (added by `placeholderFor`)
// solves the misread.
const inputClass =
  "w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[14px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition";

/**
 * Prepend "e.g. " to a placeholder string so the customer can never
 * mistake an example for a real value. Idempotent — leaves strings
 * already prefixed with "e.g.", "ex.", "example", etc. alone, and
 * leaves null/undefined as-is.
 */
function placeholderFor(p: string | undefined): string | undefined {
  if (!p) return p;
  const trimmed = p.trimStart();
  // Already prefixed in some form? Don't double-up.
  if (/^(e\.?g\.?|ex\.?|example[s:]?|sample:?)\s/i.test(trimmed)) return p;
  return `e.g. ${p}`;
}

function shallowEqual(a: FieldValue, b: FieldValue): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}

function formatNumeric(type: FieldType, value: number): string {
  switch (type) {
    case "currency":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
    case "percentage":
      return `${value}%`;
    case "integer":
      return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "number":
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "year":
      return String(Math.round(value));
    default:
      return String(value);
  }
}
