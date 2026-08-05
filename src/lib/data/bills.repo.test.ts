import { describe, it, expect } from "vitest";
import { mockRepository as repo } from "@/lib/data/mock";
import type { BillLineInput } from "@/lib/data/repository";

describe("importFeeStructure (mock)", () => {
  it("groups rows by level and writes each level's items", async () => {
    const res = await repo.importFeeStructure("first", [
      { level: "Creche", name: "School fee", amountKobo: 4000000, optional: false },
      { level: "Creche", name: "Sportswear", amountKobo: 800000, optional: true },
      { level: "JSS 1", name: "School fee", amountKobo: 9000000, optional: false },
    ]);
    expect(res.levelsUpdated).toBe(2);
    expect(res.itemsWritten).toBe(3);

    const items = await repo.listFeeItems("first");
    const creche = items.filter((i) => i.level === "Creche");
    expect(creche.map((i) => i.name).sort()).toEqual(["School fee", "Sportswear"]);
    expect(creche.find((i) => i.name === "Sportswear")?.optional).toBe(true);
  });
});

describe("updateBillLines (mock)", () => {
  it("replaces the bill's lines", async () => {
    const student = await repo.createStudent({
      firstName: "Ada", lastName: "Obi", classId: "cls-0",
      termFeeKobo: 5000000,
      guardianName: "Mr Obi", guardianPhone: "08030000000",
    });
    const lines: BillLineInput[] = [
      { name: "School fee", amountKobo: 6000000 },
      { name: "Books", amountKobo: 1000000 },
    ];
    await repo.updateBillLines(student.id, "first", lines);
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toEqual(
      lines.map((l) => ({ name: l.name, amount: l.amountKobo })),
    );
    expect(acct?.billTotal).toBe(7000000);
  });

  it("blocks a new total below what is already paid", async () => {
    const student = await repo.createStudent({
      firstName: "Uche", lastName: "Eze", classId: "cls-0",
      termFeeKobo: 5000000,
      guardianName: "Mrs Eze", guardianPhone: "08030000001",
    });
    await repo.recordPayment({
      studentId: student.id, term: "first", amount: 4000000,
      method: "cash", recordedByName: "Bursar",
    });
    await expect(
      repo.updateBillLines(student.id, "first", [
        { name: "School fee", amountKobo: 3000000 },
      ]),
    ).rejects.toThrow(/already been paid/);
  });
});

describe("createStudent with billLines + discount (mock)", () => {
  it("uses the chosen lines and records the discount", async () => {
    const student = await repo.createStudent({
      firstName: "Bola", lastName: "Ade", classId: "cls-0",
      termFeeKobo: 0,
      billLines: [
        { name: "School fee", amountKobo: 9000000 },
        { name: "Books", amountKobo: 800000 },
      ],
      discountKobo: 1000000,
      discountReason: "sibling",
      guardianName: "Mr Ade", guardianPhone: "08030000002",
    });
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toHaveLength(2);
    expect(acct?.bill.discount).toBe(1000000);
    expect(acct?.bill.discountReason).toBe("sibling");
    expect(acct?.billTotal).toBe(8800000); // 9.8m - 1m
  });
});
