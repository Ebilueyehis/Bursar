import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("updateBankAccount (mock)", () => {
  it("persists all three bank fields onto the school", async () => {
    await mockRepository.updateBankAccount({
      accountNumber: "0123456789",
      accountName: "Tejuosho Group of Schools",
      bankName: "First Bank",
    });
    const school = await mockRepository.getSchool();
    expect(school.bankAccountNumber).toBe("0123456789");
    expect(school.bankAccountName).toBe("Tejuosho Group of Schools");
    expect(school.bankName).toBe("First Bank");
  });
});
