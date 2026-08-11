/**
 * Math and validation for an in-progress bill (the BillPicker's working state).
 * Pure so the totals and guards are unit-tested; the component only renders.
 */

export interface PickerLine {
  name: string;
  amountKobo: number;
  checked: boolean;
}

export interface BillDraft {
  lines: PickerLine[];
  discountKobo: number;
  discountReason: string;
}

/** Included lines: checked, non-blank name, non-negative amount. */
export function checkedLines(
  draft: BillDraft,
): { name: string; amountKobo: number }[] {
  return draft.lines
    .filter((l) => l.checked && l.name.trim() !== "" && l.amountKobo >= 0)
    .map((l) => ({ name: l.name.trim(), amountKobo: l.amountKobo }));
}

export function subtotalKobo(draft: BillDraft): number {
  return checkedLines(draft).reduce((s, l) => s + l.amountKobo, 0);
}

export function billTotalKobo(draft: BillDraft): number {
  return Math.max(0, subtotalKobo(draft) - Math.max(0, draft.discountKobo));
}

/** Null when the draft is valid, otherwise a message safe to show the user. */
export function validateBillDraft(
  draft: BillDraft,
  paidKobo?: number,
): string | null {
  if (checkedLines(draft).length === 0) {
    return "Add at least one item to the bill.";
  }
  if (draft.discountKobo > 0 && draft.discountReason.trim() === "") {
    return "Enter a reason for the discount.";
  }
  if (paidKobo !== undefined && billTotalKobo(draft) < paidKobo) {
    return "New bill total is less than what has already been paid.";
  }
  return null;
}
