"use client";

/**
 * Shared input control for a single schema field. Used by:
 *
 *   - The Question Queue (`/portal/lab/next`) — one question per card.
 *   - The pre-draft modal — inline blocker inputs when Jason refuses
 *     to draft until specific gaps are filled.
 *
 * Distinct from `ChapterFieldEditor`'s internal `FieldControl` because
 * those are in a multi-field form context with derived-default
 * affordances + computed displays + advanced-toggle. This component is
 * the *atomic* unit: one field, one input, one help line. The full-form
 * editor wraps these for its own use; the queue + modal use them
 * one-at-a-time without the surrounding chrome.
 *
 * Brand contract: italicized "e.g." placeholder, gold focus ring,
 * navy text. Same input styling as the field editor — visual
 * continuity matters since the customer is editing the SAME data
 * through different surfaces.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import type { FieldDef } from "@/lib/memory/schemas";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  fieldDef: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  /** When true, lays out compact (smaller padding) for use in modal
   *  blocker rows. Default `false` = full Question Queue card style. */
  compact?: boolean;
  /** Auto-focus on mount. Useful when the queue advances to the next
   *  question — keyboard input lands in the right place automatically. */
  autoFocus?: boolean;
};

const INPUT_BASE =
  "w-full rounded-lg border border-navy/15 bg-white text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition";

export function SchemaFieldInput({
  fieldDef,
  value,
  onChange,
  compact,
  autoFocus,
}: Props) {
  const inputClass = `${INPUT_BASE} ${compact ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2.5 text-[15px]"}`;
  const ph = placeholderFor(fieldDef.placeholder);

  switch (fieldDef.type) {
    case "text":
    case "email":
    case "url":
      return (
        <input
          type={
            fieldDef.type === "email"
              ? "email"
              : fieldDef.type === "url"
                ? "url"
                : "text"
          }
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={ph}
          required={fieldDef.required}
          autoFocus={autoFocus}
          className={inputClass}
        />
      );

    case "textarea":
    case "markdown":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={ph}
          required={fieldDef.required}
          rows={compact ? 3 : 5}
          autoFocus={autoFocus}
          className={`${inputClass} resize-y ${compact ? "min-h-[72px]" : "min-h-[120px]"}`}
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
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={ph}
          required={fieldDef.required}
          autoFocus={autoFocus}
          className={`${inputClass} tabular-nums`}
        />
      );
    }

    case "currency": {
      const v = value as number | null;
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-3 font-semibold">
            $
          </span>
          <input
            type="number"
            value={v ?? ""}
            step="any"
            min={0}
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder={ph}
            required={fieldDef.required}
            autoFocus={autoFocus}
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
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder={ph}
            required={fieldDef.required}
            autoFocus={autoFocus}
            className={`${inputClass} pr-8 tabular-nums`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-3 font-semibold">
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
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={ph}
          required={fieldDef.required}
          autoFocus={autoFocus}
          className={`${inputClass} tabular-nums`}
        />
      );
    }

    case "date": {
      // Cap at today by default — most schema dates ("founded",
      // "first location opened") can't legitimately be in the future.
      // Schemas opt out via `allowFutureDate: true` for forward-
      // looking fields ("planned launch date"). Eric's bug: queue
      // accepted a future founding date.
      const todayIso = new Date().toISOString().slice(0, 10);
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          required={fieldDef.required}
          autoFocus={autoFocus}
          max={fieldDef.allowFutureDate ? undefined : todayIso}
          className={inputClass}
        />
      );
    }

    case "color": {
      const v = (value as string) ?? "#1E3A5F";
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 rounded-lg border border-navy/15 cursor-pointer"
          />
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={ph ?? "#1E3A5F"}
            autoFocus={autoFocus}
            className={`${inputClass} flex-1 font-mono uppercase`}
          />
        </div>
      );
    }

    case "boolean": {
      const v = value === true;
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors border-2 ${
              v
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-white border-navy/15 text-grey-3 hover:border-navy/30"
            }`}
          >
            <CheckCircle2 size={14} /> Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors border-2 ${
              value === false
                ? "bg-navy text-cream border-navy"
                : "bg-white border-navy/15 text-grey-3 hover:border-navy/30"
            }`}
          >
            <X size={14} /> No
          </button>
        </div>
      );
    }

    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          required={fieldDef.required}
          autoFocus={autoFocus}
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
      return (
        <ListTextarea
          fieldDef={fieldDef}
          value={value}
          onChange={onChange}
          placeholder={ph}
          autoFocus={autoFocus}
          inputClass={inputClass}
        />
      );

    case "color_list":
      return (
        <ColorListInput
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
        />
      );
  }
}

/**
 * List textarea — preserves raw text locally so trailing spaces and
 * mid-typing whitespace don't get stripped on every keystroke. Earlier
 * version trimmed every line in the onChange and re-derived the
 * textarea value from the stored array, which made the space bar feel
 * broken (you'd type a space and watch it vanish on the next render).
 *
 * Pattern: local rawText holds what the user typed verbatim. We
 * derive the canonical array (trimmed, blank-line-stripped) and push
 * it to the parent on each keystroke. When the parent's value
 * changes externally (different from our derived array), we resync
 * rawText so the field reflects the new external state.
 */
function ListTextarea({
  fieldDef,
  value,
  onChange,
  placeholder,
  autoFocus,
  inputClass,
}: {
  fieldDef: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  placeholder: string | undefined;
  autoFocus?: boolean;
  inputClass: string;
}) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const isLong = fieldDef.type === "list_long";
  const [rawText, setRawText] = useState<string>(arr.join("\n"));
  const lastDerivedRef = useRef<string[]>(arr);

  // Sync from parent only when the canonical array drifts from what
  // we last derived (e.g. after a server reload or a parent reset).
  // Otherwise we'd clobber the user's in-progress whitespace.
  useEffect(() => {
    const sameMembers =
      arr.length === lastDerivedRef.current.length &&
      arr.every((v, i) => v === lastDerivedRef.current[i]);
    if (!sameMembers) {
      setRawText(arr.join("\n"));
      lastDerivedRef.current = arr;
    }
  }, [arr]);

  return (
    <textarea
      value={rawText}
      onChange={(e) => {
        const text = e.target.value;
        setRawText(text);
        const next = text
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        lastDerivedRef.current = next;
        onChange(next.length > 0 ? next : null);
      }}
      placeholder={placeholder}
      rows={isLong ? 6 : 3}
      autoFocus={autoFocus}
      className={`${inputClass} resize-y ${isLong ? "min-h-[140px]" : "min-h-[88px]"}`}
    />
  );
}

/**
 * Color list input — multiple colors with a "+ Add color" affordance.
 * Each row is a color swatch + hex text input + remove button.
 *
 * Used by brand_voice's `brand_colors` field. Replaces the old
 * single-color "primary" + single-color "secondary" approach with one
 * extensible list — a brand might have a primary, an accent, a dark,
 * a light, and a hover. This handles all of them.
 *
 * Stored as `string[]` of hex codes ("#1F3D2C") for jsonb portability.
 */
function ColorListInput({
  value,
  onChange,
  autoFocus,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  autoFocus?: boolean;
}) {
  const colors = Array.isArray(value) ? (value as string[]) : [];
  // Always show at least one row so the customer has somewhere to
  // start; never auto-prune the last row (the customer would lose
  // their picker on it).
  const rows = colors.length > 0 ? colors : [""];

  function setAt(i: number, hex: string) {
    const next = rows.slice();
    next[i] = hex;
    pushNonEmpty(next);
  }
  function removeAt(i: number) {
    const next = rows.slice();
    next.splice(i, 1);
    pushNonEmpty(next);
  }
  function add() {
    pushNonEmpty([...rows, ""]);
  }
  function pushNonEmpty(next: string[]) {
    const cleaned = next.filter((s) => s.trim().length > 0);
    onChange(cleaned.length > 0 ? cleaned : null);
  }

  return (
    <div className="space-y-2">
      {rows.map((hex, i) => {
        const swatch = /^#[0-9a-f]{6}$/i.test(hex.trim()) ? hex.trim() : "#1F3D2C";
        return (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={swatch}
              onChange={(e) => setAt(i, e.target.value)}
              className="h-10 w-14 rounded-lg border border-navy/15 cursor-pointer flex-shrink-0"
              aria-label={`Color ${i + 1} picker`}
            />
            <input
              type="text"
              value={hex}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder="#1F3D2C"
              autoFocus={autoFocus && i === 0}
              className="flex-1 rounded-lg border border-navy/15 bg-white px-3 py-2 text-[14px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition font-mono uppercase"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="p-2 text-grey-3 hover:text-red-700 transition-colors flex-shrink-0"
                aria-label={`Remove color ${i + 1}`}
                title="Remove color"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-navy hover:text-gold border-2 border-dashed border-navy/20 hover:border-gold rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors"
      >
        <Plus size={12} /> Add another color
      </button>
    </div>
  );
}

/**
 * Prepend "e.g. " to a placeholder so the customer can never mistake
 * an example for a real value. Idempotent — leaves strings already
 * prefixed alone, leaves null/undefined as-is.
 */
function placeholderFor(p: string | undefined): string | undefined {
  if (!p) return p;
  const trimmed = p.trimStart();
  if (/^(e\.?g\.?|ex\.?|example[s:]?|sample:?)\s/i.test(trimmed)) return p;
  return `e.g. ${p}`;
}
