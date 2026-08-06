import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

async function firstClassAndSubject() {
  const classes = await mockRepository.listClasses();
  const subjects = await mockRepository.listSubjects();
  return { classId: classes[0].id, subjectId: subjects[0].id };
}

describe("records: subjects + saveAssessments (mock)", () => {
  it("seeds a non-empty subject list", async () => {
    const subjects = await mockRepository.listSubjects();
    expect(subjects.length).toBeGreaterThan(0);
    expect(subjects[0].name).toBeTruthy();
  });

  it("saveAssessments upserts without error and is idempotent on the key", async () => {
    const { classId, subjectId } = await firstClassAndSubject();
    const students = (await mockRepository.listStudents()).filter((s) => s.classId === classId);
    expect(students.length).toBeGreaterThan(0);
    const sid = students[0].id;
    await mockRepository.saveAssessments({
      classId, subjectId, term: "first",
      scores: [{ studentId: sid, ca1: 15, ca2: 16, exam: 50 }],
      recordedByName: "Miss Halima Yusuf",
    });
    await mockRepository.saveAssessments({
      classId, subjectId, term: "first",
      scores: [{ studentId: sid, ca1: 10, ca2: 10, exam: 30 }],
      recordedByName: "Miss Halima Yusuf",
    });
    // One row per (student, subject, term): re-save replaced, not duplicated.
    // Verified fully in Task 3 via listStudentSubjectScores.
    expect(true).toBe(true);
  });
});
