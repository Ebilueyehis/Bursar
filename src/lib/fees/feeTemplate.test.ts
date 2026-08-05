import { describe, it, expect } from "vitest";
import {
  buildFeeTemplateRows,
  parseFeeTemplate,
} from "@/lib/fees/feeTemplate";

describe("buildFeeTemplateRows", () => {
  it("emits existing items as Naira with Yes/No, ordered by the levels given", () => {
    const rows = buildFeeTemplateRows(
      ["Creche", "JSS 1"],
      {
        Creche: [{ name: "School fee", amountKobo: 4000000, optional: false }],
        "JSS 1": [{ name: "Computer", amountKobo: 1000000, optional: true }],
      },
    );
    expect(rows).toEqual([
      ["Creche", "School fee", 40000, "No"],
      ["JSS 1", "Computer", 10000, "Yes"],
    ]);
  });

  it("falls back to starter items for a level with no existing items", () => {
    const rows = buildFeeTemplateRows(["Creche"], {});
    expect(rows).toEqual([
      ["Creche", "School fee", 0, "No"],
      ["Creche", "Sportswear", 0, "No"],
      ["Creche", "Books", 0, "No"],
    ]);
  });
});

describe("parseFeeTemplate", () => {
  const known = ["Creche", "JSS 1"];

  it("parses valid rows into kobo", () => {
    const out = parseFeeTemplate(
      [
        { Class: "Creche", Item: "School fee", Amount: "40000", Optional: "No" },
        { Class: "JSS 1", Item: "Computer", Amount: "10,000", Optional: "Yes" },
      ],
      known,
    );
    expect(out.errors).toEqual([]);
    expect(out.rows).toEqual([
      { level: "Creche", name: "School fee", amountKobo: 4000000, optional: false },
      { level: "JSS 1", name: "Computer", amountKobo: 1000000, optional: true },
    ]);
  });

  it("rejects unknown class, blank item, bad amount, bad optional; keeps valid rows", () => {
    const out = parseFeeTemplate(
      [
        { Class: "SS 9", Item: "X", Amount: "1", Optional: "No" },
        { Class: "Creche", Item: "  ", Amount: "1", Optional: "No" },
        { Class: "Creche", Item: "Books", Amount: "abc", Optional: "No" },
        { Class: "Creche", Item: "Bus", Amount: "-5", Optional: "No" },
        { Class: "Creche", Item: "Lab", Amount: "500", Optional: "maybe" },
        { Class: "Creche", Item: "Tuition", Amount: "5000", Optional: "" },
      ],
      known,
    );
    expect(out.rows).toEqual([
      { level: "Creche", name: "Tuition", amountKobo: 500000, optional: false },
    ]);
    expect(out.errors).toHaveLength(5);
    expect(out.errors[0]).toContain("unknown class");
  });
});
