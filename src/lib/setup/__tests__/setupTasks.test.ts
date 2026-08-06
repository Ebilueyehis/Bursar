import { describe, it, expect } from "vitest";
import { deriveSetupTasks, isBankComplete } from "@/lib/setup/setupTasks";

const base = {
  classLevels: [] as string[],
  feeLevels: [] as string[],
  studentCount: 0,
  bankComplete: false,
  dismissedNudges: [] as never[],
};

describe("isBankComplete", () => {
  it("is false when any field is missing or blank", () => {
    expect(isBankComplete(null)).toBe(false);
    expect(isBankComplete({ bankAccountNumber: "1", bankAccountName: "", bankName: "GTB" })).toBe(false);
    expect(isBankComplete({ bankAccountNumber: "  ", bankAccountName: "A", bankName: "B" })).toBe(false);
  });
  it("is true when all three are filled", () => {
    expect(isBankComplete({ bankAccountNumber: "1", bankAccountName: "A", bankName: "GTB" })).toBe(true);
  });
});

describe("deriveSetupTasks - fees rule", () => {
  it("fees not done with no fee items at all", () => {
    const s = deriveSetupTasks(base);
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(false);
  });
  it("fees done on any fee item when no classes exist yet", () => {
    const s = deriveSetupTasks({ ...base, feeLevels: ["JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(true);
  });
  it("fees NOT done when a class level lacks fees", () => {
    const s = deriveSetupTasks({ ...base, classLevels: ["JSS 1", "SSS 1"], feeLevels: ["JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(false);
  });
  it("fees done when every class level is covered", () => {
    const s = deriveSetupTasks({ ...base, classLevels: ["JSS 1", "SSS 1"], feeLevels: ["SSS 1", "JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(true);
  });
});

describe("deriveSetupTasks - percentage + ordering", () => {
  it("weights blockers at 30% each and staff nudge at 10%", () => {
    const s = deriveSetupTasks(base);
    expect(s.percentage).toBe(0);
    expect(s.tasks.map((t) => t.id)).toEqual(["fees", "students", "bank", "staff"]);
    expect(s.tasks.find((t) => t.id === "fees")!.weight).toBe(3);
    expect(s.tasks.find((t) => t.id === "staff")!.weight).toBe(1);
  });
  it("all three blockers done reads 90%, blockers-complete flag true", () => {
    const s = deriveSetupTasks({
      classLevels: ["JSS 1"], feeLevels: ["JSS 1"], studentCount: 5, bankComplete: true, dismissedNudges: [],
    });
    expect(s.percentage).toBe(90);
    expect(s.allBlockersDone).toBe(true);
    expect(s.nextTask).toBeNull();
  });
  it("dismissing the staff nudge reaches 100%", () => {
    const s = deriveSetupTasks({
      classLevels: ["JSS 1"], feeLevels: ["JSS 1"], studentCount: 5, bankComplete: true, dismissedNudges: ["staff"],
    });
    expect(s.percentage).toBe(100);
  });
  it("nextTask is the first incomplete blocker in fixed order", () => {
    const s = deriveSetupTasks({ ...base, feeLevels: ["JSS 1"] });
    expect(s.nextTask!.id).toBe("students");
  });
  it("vendors nudge appears and rebalances only when includeVendors is true", () => {
    const off = deriveSetupTasks(base);
    expect(off.tasks.some((t) => t.id === "vendors")).toBe(false);
    const on = deriveSetupTasks({ ...base, includeVendors: true });
    expect(on.tasks.some((t) => t.id === "vendors")).toBe(true);
    expect(on.tasks.find((t) => t.id === "fees")!.weight / 11).toBeGreaterThan(0.15);
  });
});
