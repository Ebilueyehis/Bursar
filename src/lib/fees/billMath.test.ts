import { describe, it, expect } from "vitest";
import {
  type BillDraft,
  checkedLines,
  subtotalKobo,
  billTotalKobo,
  validateBillDraft,
} from "@/lib/fees/billMath";

const draft = (over: Partial<BillDraft> = {}): BillDraft => ({
  lines: [
    { name: "School fee", amountKobo: 9000000, checked: true },
    { name: "Computer", amountKobo: 1000000, checked: false },
    { name: "Books", amountKobo: 800000, checked: true },
  ],
  discountKobo: 0,
  discountReason: "",
  ...over,
});

describe("billMath", () => {
  it("counts only checked, valid lines", () => {
    expect(checkedLines(draft())).toEqual([
      { name: "School fee", amountKobo: 9000000 },
      { name: "Books", amountKobo: 800000 },
    ]);
    expect(subtotalKobo(draft())).toBe(9800000);
  });

  it("applies discount, never below zero", () => {
    expect(billTotalKobo(draft({ discountKobo: 1000000 }))).toBe(8800000);
    expect(billTotalKobo(draft({ discountKobo: 99999999 }))).toBe(0);
  });

  it("requires a reason when a discount is set", () => {
    expect(validateBillDraft(draft({ discountKobo: 1000000 }))).toContain("reason");
    expect(
      validateBillDraft(draft({ discountKobo: 1000000, discountReason: "sibling" })),
    ).toBeNull();
  });

  it("blocks a total below what has already been paid", () => {
    expect(validateBillDraft(draft(), 9900000)).toContain("already been paid");
    expect(validateBillDraft(draft(), 9800000)).toBeNull();
  });

  it("requires at least one line", () => {
    expect(validateBillDraft(draft({ lines: [] }))).toContain("at least one");
  });
});
