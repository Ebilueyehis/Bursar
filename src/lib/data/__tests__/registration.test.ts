import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

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
