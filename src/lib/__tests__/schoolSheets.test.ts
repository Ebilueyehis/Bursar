import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";
import { schoolSheets } from "@/lib/schoolSheets";

describe("schoolSheets", () => {
  it("produces one sheet per collection", async () => {
    const data = await mockRepository.exportSchoolData();
    const names = schoolSheets(data).map((s) => s.name);

    expect(names).toContain("Students");
    expect(names).toContain("Guardians");
    expect(names).toContain("Bills");
    expect(names).toContain("Payments");
    expect(names).toContain("Expenses");
    expect(names).toContain("Income");
    expect(names).toContain("Staff");
    expect(names).toContain("Assessments");
  });

  it("writes money as a number in naira, not a formatted string", async () => {
    const data = await mockRepository.exportSchoolData();
    const payments = schoolSheets(data).find((s) => s.name === "Payments");
    const amountColumn = payments!.headers.indexOf("Amount");

    expect(amountColumn).toBeGreaterThan(-1);
    expect(payments!.rows.length).toBeGreaterThan(0);
    for (const row of payments!.rows) {
      expect(typeof row[amountColumn]).toBe("number");
    }
  });

  it("converts kobo to naira with two decimal places intact", async () => {
    const data = await mockRepository.exportSchoolData();
    data.payments = [
      { ...data.payments[0], amount: 4_500_050 },
    ];
    const payments = schoolSheets(data).find((s) => s.name === "Payments")!;
    const amountColumn = payments.headers.indexOf("Amount");

    expect(payments.rows[0][amountColumn]).toBe(45000.5);
  });

  it("gives every sheet a header for each column it writes", async () => {
    const data = await mockRepository.exportSchoolData();
    for (const sheet of schoolSheets(data)) {
      for (const row of sheet.rows) {
        expect(row).toHaveLength(sheet.headers.length);
      }
    }
  });

  it("resolves the class and guardian a student belongs to", async () => {
    const data = await mockRepository.exportSchoolData();
    const students = schoolSheets(data).find((s) => s.name === "Students")!;
    const classColumn = students.headers.indexOf("Class");
    const guardianColumn = students.headers.indexOf("Guardian");

    // A blank here means an id failed to resolve to a name, which is the
    // failure mode that would silently produce a useless export.
    expect(students.rows.length).toBeGreaterThan(0);
    for (const row of students.rows) {
      expect(row[classColumn]).not.toBe("");
      expect(row[guardianColumn]).not.toBe("");
    }
  });
});
