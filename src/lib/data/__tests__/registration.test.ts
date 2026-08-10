import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";
import { SCHOOL } from "@/lib/data/seed";

describe("temporary registration (mock)", () => {
  it("createStudent defaults to active when status is omitted", async () => {
    const classes = await mockRepository.listClasses();
    const student = await mockRepository.createStudent({
      firstName: "Tunde",
      lastName: "Bello",
      classId: classes[0].id,
      termFeeKobo: 0,
      guardianName: "Mrs. Bello",
      guardianPhone: "0803 000 1111",
    });
    expect(student.status).toBe("active");
  });

  it("createStudent stores a pending status when requested", async () => {
    const classes = await mockRepository.listClasses();
    const student = await mockRepository.createStudent({
      firstName: "Ngozi",
      lastName: "Eze",
      classId: classes[0].id,
      termFeeKobo: 0,
      guardianName: "Mr. Eze",
      guardianPhone: "0803 000 2222",
      status: "pending",
    });
    expect(student.status).toBe("pending");
  });
});

describe("billless account + Generate Bill (mock)", () => {
  it("returns a billless result for a real student with no bill this term", async () => {
    const classes = await mockRepository.listClasses();
    const student = await mockRepository.createStudent({
      firstName: "Kemi",
      lastName: "Ade",
      classId: classes[0].id,
      termFeeKobo: 0, // no fee structure + no lines + zero fee => no bill created
      guardianName: "Mrs. Ade",
      guardianPhone: "0803 000 3333",
    });
    const result = await mockRepository.getStudentAccount(student.id, "third");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("billless");
    if (result!.kind === "billless") {
      expect(result!.student.id).toBe(student.id);
    }
  });

  it("returns null for a genuinely unknown student id", async () => {
    const result = await mockRepository.getStudentAccount("nope", "first");
    expect(result).toBeNull();
  });

  it("createBillForTerm creates a bill that getStudentAccount then resolves", async () => {
    const classes = await mockRepository.listClasses();
    const student = await mockRepository.createStudent({
      firstName: "Femi",
      lastName: "Alao",
      classId: classes[0].id,
      termFeeKobo: 0,
      guardianName: "Mr. Alao",
      guardianPhone: "0803 000 4444",
    });
    await mockRepository.createBillForTerm(student.id, "third", [
      { name: "Term fee", amountKobo: 5000000 },
    ]);
    const result = await mockRepository.getStudentAccount(student.id, "third");
    expect(result!.kind).toBe("account");
    if (result!.kind === "account") {
      expect(result!.account.billTotal).toBe(5000000);
    }
  });
});

describe("approve / decline registration (mock)", () => {
  async function makePending() {
    const classes = await mockRepository.listClasses();
    return mockRepository.createStudent({
      firstName: "Pending",
      lastName: "Student",
      classId: classes[0].id,
      termFeeKobo: 5000000,
      guardianName: "A Guardian",
      guardianPhone: "0803 000 5555",
      status: "pending",
    });
  }

  it("approveRegistration flips status to active and nothing else", async () => {
    const student = await makePending();
    await mockRepository.approveRegistration(student.id);
    const list = await mockRepository.listStudents();
    const found = list.find((s) => s.id === student.id)!;
    expect(found.status).toBe("active");
  });

  it("declineRegistration hard-deletes a pending student with no payments", async () => {
    const student = await makePending();
    const result = await mockRepository.declineRegistration(student.id);
    expect(result.outcome).toBe("deleted");
    const list = await mockRepository.listStudents();
    expect(list.find((s) => s.id === student.id)).toBeUndefined();
  });

  it("declineRegistration soft-withdraws a pending student with a payment on record", async () => {
    const student = await makePending();
    await mockRepository.recordPayment({
      studentId: student.id,
      term: SCHOOL.currentTerm,
      amount: 100000,
      method: "cash",
      recordedByName: "Bursar",
    });
    const result = await mockRepository.declineRegistration(student.id);
    expect(result.outcome).toBe("withdrawn");
    const list = await mockRepository.listStudents();
    const found = list.find((s) => s.id === student.id)!;
    expect(found.status).toBe("withdrawn");
  });
});
