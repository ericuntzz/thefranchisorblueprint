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

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
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

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  schema: ChapterSchema;
  initialFields: Record<string, FieldValue>;
  /**
   * Field values from OTHER chapters — needed to compute cross-chapter
   * derivations (e.g. franchisee_profile.minimum_liquid_capital depends
   * on unit_economics.initial_investment_high). Passed in by the parent
   * (ChapterCard's host page) which has the full Memory state available.
   */
  otherChaptersFields: MemoryFieldsMap;
  onSave: (fields: Record<string, FieldValue>) => Promise<void>;
  onCancel: () => void;
};

export function ChapterFieldEditor({
  schema,
  initialFields,
  otherChaptersFields,
  onSave,
  onCancel,
}: Props) {
  const [values, setValues] = useState<Record<string, FieldValue>>(initialFields);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const hasAdvanced = useMemo(
    () => schema.fields.some((f) => f.advanced),
    [schema.fields],
  );

  const update = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Only send fields that actually differ from initialFields, plus
      // never send computed fields (server ignores them anyway, but
      // sending them is wasted bandwidth and confuses the audit log).
      const changes: Record<string, FieldValue> = {};
      for (const f of schema.fields) {
        if (hasCalc(schema.slug, f.name)) continue; // skip computed
        const before = initialFields[f.name];
        const after = values[f.name];
        if (!shallowEqual(before, after)) {
          changes[f.name] = after ?? null;
        }
      }
      if (Object.keys(changes).length === 0) {
        // Nothing changed — close without a server hit.
        onCancel();
        return;
      }
      await onSave(changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-7">
      {grouped.map((group) => {
        const visibleFields = group.fields.filter(
          (f) => showAdvanced || !f.advanced,
        );
        if (visibleFields.length === 0) return null;
        return (
          <fieldset key={group.category} className="space-y-4">
            <legend className="text-[11px] uppercase tracking-[0.16em] text-gold-warm font-bold">
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
                return (
                  <FieldInput
                    key={fd.name}
                    fieldDef={fd}
                    slug={schema.slug}
                    value={values[fd.name] ?? null}
                    computedValue={computedNumber}
                    onChange={(v) => update(fd.name, v)}
                  />
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {hasAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-grey-3 hover:text-navy font-semibold transition-colors"
        >
          {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
        </button>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-6 md:-mx-8 -mb-6 md:-mb-8 px-6 md:px-8 py-4 bg-white border-t border-navy/10 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-grey-3 hover:text-navy font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              Save changes <ArrowRight size={12} />
            </>
          )}
        </button>
      </div>
    </form>
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
  onChange,
}: {
  fieldDef: FieldDef;
  slug: MemoryFileSlug;
  value: FieldValue;
  computedValue: number | null;
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

  return (
    <div className="space-y-1">
      <FieldLabel fieldDef={fieldDef} isComputed={isComputed} />
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
      {fieldDef.helpText && !isComputed && (
        <p className="text-xs text-grey-4 leading-relaxed">{fieldDef.helpText}</p>
      )}
    </div>
  );
}

function FieldLabel({
  fieldDef,
  isComputed,
}: {
  fieldDef: FieldDef;
  isComputed: boolean;
}) {
  const showSuggested = fieldDef.suggestedFrom && !isComputed;
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
      {isComputed && (
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
          title="Calculated automatically from your other inputs"
        >
          <Calculator size={10} />
          Calculated
        </span>
      )}
      {showSuggested && (
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
          title={suggestedSourceLabel(fieldDef)}
        >
          <Sparkles size={10} />
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
    <div className="rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-2.5 text-navy">
      <div className="font-bold text-base tabular-nums">
        {formatted ?? <span className="text-grey-4">— (need more inputs)</span>}
      </div>
      {fieldDef.computed?.formula && (
        <div className="mt-1 text-[11px] text-grey-3 italic">
          <Info size={10} className="inline mr-1 -mt-0.5" />
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

    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          required={fieldDef.required}
          className={inputClass}
        />
      );

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
    case "list_long": {
      // For v1 simplicity, both list types use a textarea where each
      // line becomes an array entry. We strip blank lines on save.
      // A more elaborate per-item editor (drag-to-reorder, individual
      // fields) is a v2 enhancement.
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const text = arr.join("\n");
      const isLong = fieldDef.type === "list_long";
      return (
        <textarea
          value={text}
          onChange={(e) => {
            const next = e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            onChange(next.length > 0 ? next : null);
          }}
          placeholder={placeholderFor(fieldDef.placeholder)}
          rows={isLong ? 6 : 3}
          className={`${inputClass} resize-y ${isLong ? "min-h-[140px]" : "min-h-[72px]"}`}
        />
      );
    }
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
