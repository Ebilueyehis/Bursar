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
