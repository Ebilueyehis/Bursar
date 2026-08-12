import { describe, it, expect } from "vitest";
import { safeSheetName } from "@/lib/export";

describe("safeSheetName", () => {
  it("keeps an ordinary name unchanged", () => {
    expect(safeSheetName("Payments")).toBe("Payments");
  });

  it("truncates to the 31 character sheet name limit", () => {
    const long = "Payments recorded during the first term";
    expect(safeSheetName(long)).toHaveLength(31);
  });

  it("replaces the characters Excel forbids in a sheet name", () => {
    expect(safeSheetName("Fees / levies [2026]")).toBe("Fees - levies (2026)");
  });

  it("falls back to Sheet when nothing usable is left", () => {
    expect(safeSheetName("   ")).toBe("Sheet");
  });
});
