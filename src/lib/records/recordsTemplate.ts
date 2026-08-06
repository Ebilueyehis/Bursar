import { ASSESSMENT_MAXES } from "@/lib/records/grading";

export const ASSESSMENT_TEMPLATE_HEADERS = [
  "Admission No",
  "Student",
  "Class",
  "Subject",
  "CA1",
  "CA2",
  "Exam",
] as const;

export interface TemplateStudent {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
}
export interface TemplateSubject {
  id: string;
  name: string;
}
export interface ParsedAssessmentRow {
  studentId: string;
  subjectId: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
}
export interface AssessmentTemplateParse {
  rows: ParsedAssessmentRow[];
  errors: string[];
}

/** One row per (student, subject), identity pre-filled, scores blank. */
export function buildAssessmentTemplateRows(
  students: TemplateStudent[],
  subjects: TemplateSubject[],
): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (const s of students) {
    for (const subj of subjects) {
      out.push([s.admissionNo, s.name, s.className, subj.name, "", "", ""]);
    }
  }
  return out;
}

function parseScore(
  raw: string,
  max: number,
  label: string,
  rowNo: number,
  errors: string[],
): number | null | "error" {
  const t = (raw ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max || !Number.isInteger(n)) {
    errors.push(`Row ${rowNo}: ${label} "${raw}" must be a whole number between 0 and ${max}`);
    return "error";
  }
  return n;
}

export function parseAssessmentTemplate(
  sheetRows: Record<string, string>[],
  students: TemplateStudent[],
  subjects: TemplateSubject[],
): AssessmentTemplateParse {
  const rows: ParsedAssessmentRow[] = [];
  const errors: string[] = [];
  const studentByAdm = new Map(students.map((s) => [s.admissionNo.trim().toLowerCase(), s]));
  const subjectByName = new Map(subjects.map((s) => [s.name.trim().toLowerCase(), s]));

  sheetRows.forEach((raw, idx) => {
    const rowNo = idx + 2; // header is row 1
    const student = studentByAdm.get((raw["Admission No"] ?? "").trim().toLowerCase());
    const subject = subjectByName.get((raw.Subject ?? "").trim().toLowerCase());
    const ca1s = (raw.CA1 ?? "").trim();
    const ca2s = (raw.CA2 ?? "").trim();
    const exs = (raw.Exam ?? "").trim();

    if (ca1s === "" && ca2s === "" && exs === "") return; // nothing to save

    if (!student) {
      errors.push(`Row ${rowNo}: unknown admission number "${raw["Admission No"] ?? ""}"`);
      return;
    }
    if (!subject) {
      errors.push(`Row ${rowNo}: unknown subject "${raw.Subject ?? ""}"`);
      return;
    }
    const ca1 = parseScore(ca1s, ASSESSMENT_MAXES.ca1, "CA1", rowNo, errors);
    const ca2 = parseScore(ca2s, ASSESSMENT_MAXES.ca2, "CA2", rowNo, errors);
    const exam = parseScore(exs, ASSESSMENT_MAXES.exam, "Exam", rowNo, errors);
    if (ca1 === "error" || ca2 === "error" || exam === "error") return;

    rows.push({ studentId: student.id, subjectId: subject.id, ca1, ca2, exam });
  });

  return { rows, errors };
}
