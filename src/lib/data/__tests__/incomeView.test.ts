import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("ledger + income view (mock)", () => {
  it("includes income as a credit in the ledger", async () => {
    await mockRepository.createIncome({
      source: "Hall rental",
      description: "Weekend event",
      amountKobo: 30000_00,
      receivedOn: "2026-08-02",
      method: "cash",
      recordedByName: "Bursar",
    });
    const days = await mockRepository.getLedger();
    const all = days.flatMap((d) => d.entries);
    const incomeEntry = all.find((e) => e.kind === "income");
    expect(incomeEntry).toBeTruthy();
    expect(incomeEntry!.direction).toBe("in");
  });

  it("merges fee payments and other income, newest first", async () => {
    await mockRepository.createIncome({
      source: "Donation",
      description: "Alumni gift",
      amountKobo: 10000_00,
      receivedOn: "2999-01-01", // far future so it sorts first
      method: "transfer",
      recordedByName: "Bursar",
    });
    const rows = await mockRepository.listIncomeView();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].kind).toBe("other");
    expect(rows.some((r) => r.kind === "fee")).toBe(true);
  });
});
