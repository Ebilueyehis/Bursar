import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("income CRUD (mock)", () => {
  it("creates, lists, edits and deletes an income entry", async () => {
    const created = await mockRepository.createIncome({
      source: "Donation",
      description: "PTA fundraiser",
      amountKobo: 50000_00,
      receivedOn: "2026-08-01",
      method: "transfer",
      recordedByName: "Mr. Emeka Okoro",
    });
    expect(created.id).toBeTruthy();

    const list = await mockRepository.listIncome();
    expect(list.find((i) => i.id === created.id)?.amount).toBe(50000_00);

    const edited = await mockRepository.updateIncome(created.id, {
      source: "Donation",
      description: "PTA fundraiser (revised)",
      amountKobo: 60000_00,
      receivedOn: "2026-08-01",
      method: "transfer",
      recordedByName: "Mr. Emeka Okoro",
    });
    expect(edited.amount).toBe(60000_00);

    await mockRepository.deleteIncome(created.id);
    const after = await mockRepository.listIncome();
    expect(after.find((i) => i.id === created.id)).toBeUndefined();
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      mockRepository.createIncome({
        source: "Grant",
        description: "bad",
        amountKobo: 0,
        receivedOn: "2026-08-01",
        method: "cash",
        recordedByName: "X",
      }),
    ).rejects.toThrow();
  });
});
