import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("audit trail (mock)", () => {
  it("records created/edited/deleted for income mutations", async () => {
    const created = await mockRepository.createIncome({
      source: "Grant",
      description: "State grant",
      amountKobo: 100000_00,
      receivedOn: "2026-08-03",
      method: "transfer",
      recordedByName: "Mrs. Adunni Bello",
    });
    await mockRepository.updateIncome(created.id, {
      source: "Grant",
      description: "State grant (revised)",
      amountKobo: 120000_00,
      receivedOn: "2026-08-03",
      method: "transfer",
      recordedByName: "Mrs. Adunni Bello",
    });
    await mockRepository.deleteIncome(created.id);

    const log = await mockRepository.listAuditLog();
    const forEntry = log.filter((a) => a.entity === "income" && a.entityId === created.id);
    expect(forEntry.map((a) => a.action)).toEqual(
      expect.arrayContaining(["created", "edited", "deleted"]),
    );
    const dates = log.map((a) => a.createdAt);
    expect([...dates].sort((x, y) => y.localeCompare(x))).toEqual(dates);
  });

  it("records an audit entry when an expense is created", async () => {
    const before = (await mockRepository.listAuditLog()).length;
    await mockRepository.createExpense({
      payee: "PHCN",
      description: "Electricity",
      category: "Utilities",
      cadence: "monthly",
      amountKobo: 25000_00,
      spentOn: "2026-08-03",
      method: "cash",
      recordedByName: "Bursar",
    });
    const after = await mockRepository.listAuditLog();
    expect(after.length).toBe(before + 1);
    expect(after[0].entity).toBe("expense");
    expect(after[0].action).toBe("created");
  });
});
