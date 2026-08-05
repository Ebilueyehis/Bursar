"use client";

import {
  type BillDraft,
  subtotalKobo,
  billTotalKobo,
  validateBillDraft,
} from "@/lib/fees/billMath";
import { parseNairaToKobo, koboToNairaString } from "@/lib/money";
import { Money, NairaInput, Input, Field } from "@/components/ui";

/** Seed a draft from class default items (optional items start unchecked). */
export function draftFromItems(
  items: { name: string; amountKobo: number; optional?: boolean }[],
): BillDraft {
  return {
    lines: items.map((i) => ({
      name: i.name,
      amountKobo: i.amountKobo,
      checked: !i.optional,
    })),
    discountKobo: 0,
    discountReason: "",
  };
}

export function BillPicker({
  value,
  onChange,
  paidKobo,
}: {
  value: BillDraft;
  onChange: (next: BillDraft) => void;
  paidKobo?: number;
}) {
  const setLine = (idx: number, patch: Partial<BillDraft["lines"][number]>) =>
    onChange({
      ...value,
      lines: value.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    });
  const removeLine = (idx: number) =>
    onChange({ ...value, lines: value.lines.filter((_, i) => i !== idx) });
  const addLine = () =>
    onChange({
      ...value,
      lines: [...value.lines, { name: "", amountKobo: 0, checked: true }],
    });

  const error = validateBillDraft(value, paidKobo);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={line.checked}
              onChange={(e) => setLine(idx, { checked: e.target.checked })}
              className="size-4 accent-primary"
              aria-label={`Include ${line.name || "item"}`}
            />
            <Input
              value={line.name}
              onChange={(e) => setLine(idx, { name: e.target.value })}
              placeholder="Item name"
              className="flex-1"
            />
            <NairaInput
              value={koboToNairaString(line.amountKobo)}
              onValueChange={(raw) =>
                setLine(idx, { amountKobo: parseNairaToKobo(raw) ?? 0 })
              }
              className="w-32"
              aria-label={`Amount for ${line.name || "item"}`}
            />
            <button
              type="button"
              onClick={() => removeLine(idx)}
              aria-label={`Remove ${line.name || "item"}`}
              className="px-2 text-lg leading-none text-ink-faint hover:text-danger"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="text-sm font-semibold text-primary hover:underline"
      >
        Add item
      </button>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <Field label="Discount">
          <NairaInput
            value={koboToNairaString(value.discountKobo)}
            onValueChange={(raw) =>
              onChange({ ...value, discountKobo: parseNairaToKobo(raw) ?? 0 })
            }
          />
        </Field>
        <Field label="Discount reason">
          <Input
            value={value.discountReason}
            onChange={(e) => onChange({ ...value, discountReason: e.target.value })}
            placeholder="e.g. Sibling, Scholarship"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-ink-muted">Subtotal</span>
        <Money kobo={subtotalKobo(value)} />
      </div>
      <div className="flex items-center justify-between text-base font-semibold">
        <span>Bill total</span>
        <Money kobo={billTotalKobo(value)} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
