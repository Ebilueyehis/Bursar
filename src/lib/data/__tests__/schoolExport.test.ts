import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("exportSchoolData (mock)", () => {
  it("returns every collection the school owns", async () => {
    const data = await mockRepository.exportSchoolData();

    expect(data.school.name).toBeTruthy();
    expect(data.session.name).toBeTruthy();
    expect(Array.isArray(data.classes)).toBe(true);
    expect(Array.isArray(data.students)).toBe(true);
    expect(Array.isArray(data.guardians)).toBe(true);
    expect(Array.isArray(data.feeItems)).toBe(true);
    expect(Array.isArray(data.bills)).toBe(true);
    expect(Array.isArray(data.payments)).toBe(true);
    expect(Array.isArray(data.expenses)).toBe(true);
    expect(Array.isArray(data.income)).toBe(true);
    expect(Array.isArray(data.staff)).toBe(true);
    expect(Array.isArray(data.subjects)).toBe(true);
    expect(Array.isArray(data.assessments)).toBe(true);
  });

  it("includes every student, not only those in the current term", async () => {
    const students = await mockRepository.listStudents();
    const data = await mockRepository.exportSchoolData();
    expect(data.students).toHaveLength(students.length);
  });

  it("hands out copies, so a caller cannot mutate the store", async () => {
    const first = await mockRepository.exportSchoolData();
    const countBefore = first.students.length;
    first.students.length = 0;

    const second = await mockRepository.exportSchoolData();
    expect(second.students).toHaveLength(countBefore);
  });

  it("includes a payment that was just recorded", async () => {
    const before = await mockRepository.exportSchoolData();
    const accounts = await mockRepository.listStudentAccounts("first");
    const target = accounts.find((a) => a.outstanding > 0) ?? accounts[0];

    await mockRepository.recordPayment({
      studentId: target.student.id,
      term: "first",
      amount: 100_00,
      method: "cash",
      recordedByName: "Test",
    });

    const after = await mockRepository.exportSchoolData();
    expect(after.payments.length).toBe(before.payments.length + 1);
  });
});
