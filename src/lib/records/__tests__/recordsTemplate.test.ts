import { describe, it, expect } from "vitest";
import {
  ASSESSMENT_TEMPLATE_HEADERS,
  buildAssessmentTemplateRows,
  parseAssessmentTemplate,
} from "@/lib/records/recordsTemplate";

const students = [
  { id: "s1", admissionNo: "TJH/2024/001", name: "Ada Obi", className: "JSS 1A" },
  { id: "s2", admissionNo: "TJH/2024/002", name: "Bola Eze", className: "JSS 1A" },
];
const subjects = [
  { id: "subj-0", name: "Mathematics" },
  { id: "subj-1", name: "English Language" },
];

describe("assessment template", () => {
  it("builds one row per student per subject with identity filled and scores blank", () => {
    const rows = buildAssessmentTemplateRows(students, subjects);
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual(["TJH/2024/001", "Ada Obi", "JSS 1A", "Mathematics", "", "", ""]);
  });

  it("parses valid rows, matching by admission number + subject name", () => {
    const sheet = [
      { "Admission No": "TJH/2024/001", Student: "Ada Obi", Class: "JSS 1A", Subject: "Mathematics", CA1: "15", CA2: "16", Exam: "50" },
    ];
    const { rows, errors } = parseAssessmentTemplate(sheet, students, subjects);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({ studentId: "s1", subjectId: "subj-0", ca1: 15, ca2: 16, exam: 50 });
  });

  it("skips all-blank score rows and flags unknown ids + out-of-range scores", () => {
    const sheet = [
      { "Admission No": "TJH/2024/001", Student: "Ada", Class: "JSS 1A", Subject: "Mathematics", CA1: "", CA2: "", Exam: "" },
      { "Admission No": "NOPE", Student: "X", Class: "JSS 1A", Subject: "Mathematics", CA1: "5", CA2: "", Exam: "" },
      { "Admission No": "TJH/2024/002", Student: "Bola", Class: "JSS 1A", Subject: "Mathematics", CA1: "99", CA2: "", Exam: "" },
    ];
    const { rows, errors } = parseAssessmentTemplate(sheet, students, subjects);
    expect(rows.length).toBe(0);
    expect(errors.length).toBe(2);
  });

  it("has the documented headers", () => {
    expect(ASSESSMENT_TEMPLATE_HEADERS).toEqual(["Admission No", "Student", "Class", "Subject", "CA1", "CA2", "Exam"]);
  });
});
