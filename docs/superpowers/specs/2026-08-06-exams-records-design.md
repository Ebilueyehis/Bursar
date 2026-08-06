# Exams & Records — Design Spec

**Date:** 2026-08-06
**Status:** Approved (brainstorm), pending implementation plan
**Milestone:** M6 (Academic records)

## Problem

Bursar tracks money but nothing academic. Schools also need each student's
continuous-assessment and exam scores, class and subject averages, and a
per-student report. There is no scores model, no subject registry, and no place
to enter or review marks.

## Goal

A **Records** section that:

- lists classes with their class-average CA and class-average Exam this term,
- drills into a class two ways: **by subject** (subject rows, CA1/CA2/Exam
  columns of class averages; pick a subject to see every student's scores) and
  **by student** (students with averages; pick one for a full report),
- lets staff enter and edit scores for a class + subject + term,
- shows a per-student report that is the basis for a printable report card
  (print layout deferred to a future iteration).

Out of scope (future iterations): printable report-card layout, class
position/ranking, configurable component maxes, per-class subject assignment,
alternative weighting.

## Assessment structure

Three components per subject, per student, per term: **CA1**, **CA2**, **Exam**.

- Default maximums: CA1 = 20, CA2 = 20, Exam = 60 (sum 100). Held as constants
  (`ASSESSMENT_MAXES`) so they are trivial to change; per-school configurability
  is future work.
- Subject total = CA1 + CA2 + Exam (each may be null until entered; total treats
  nulls as 0 for display but "not entered" is shown distinctly where a component
  is null).
- Letter grade from total via a WAEC-style scale (`GRADE_SCALE`):
  A 70-100, B 60-69, C 50-59, D 45-49, E 40-44, F 0-39.

## Navigation / IA

- New primary-nav item **Records**, route `/records`, gated to `view_grades`
  (all staff). Uses the existing `RecordsIcon` (add one to `icons.tsx`).
- In-page drill state (mirrors the Payments hub pattern), not nested routes:
  `class list` -> `class detail (lens toggle)` -> `subject scores` OR
  `student report`. This keeps the surface small and the state easy to reason
  about; deep-linkable routes are a future refinement if needed.

## Data model

Two new tables. No class-subject mapping table (v1 infers a class's subjects
from which subjects have assessments).

- `subjects`
  - `id uuid pk`, `school_id uuid not null`, `name text not null`,
    `created_at timestamptz`.
  - Seeded from the existing subject list. Editable later; seeding is enough for
    v1.
- `assessments`
  - `id uuid pk`, `school_id uuid not null`, `student_id uuid not null`,
    `subject_id uuid not null`, `session_id uuid`, `term term_name not null`,
    `ca1 smallint`, `ca2 smallint`, `exam smallint`,
    `recorded_by uuid`, `recorded_by_name text`,
    `updated_at timestamptz`, `created_at timestamptz`.
  - Unique on `(student_id, subject_id, session_id, term)` so a student has one
    assessment row per subject per term. Score columns are nullable until
    entered. `check` constraints keep each score within `[0, max]` for its
    component.

### Domain types

```ts
export interface Subject {
  id: string;
  schoolId: string;
  name: string;
}

export interface Assessment {
  id: string;
  schoolId: string;
  studentId: string;
  subjectId: string;
  sessionId: string;
  term: TermName;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
  recordedByName: string;
}
```

### Aggregate/view types (computed by the repository)

```ts
/** A class's headline averages for the term. */
export interface ClassRecordSummary {
  classId: string;
  className: string;
  studentCount: number;
  avgCa: number | null;   // mean of (ca1+ca2) across all entered assessments
  avgExam: number | null; // mean of exam across all entered assessments
}

/** One subject's class averages for a class + term. */
export interface SubjectAverageRow {
  subjectId: string;
  subjectName: string;
  avgCa1: number | null;
  avgCa2: number | null;
  avgExam: number | null;
  avgTotal: number | null;
}

/** One student's score line for a single subject. */
export interface StudentSubjectScore {
  studentId: string;
  studentName: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}

/** One row of a student's report: their score in a subject. */
export interface ReportRow {
  subjectId: string;
  subjectName: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}

/** A student's full report for the term. */
export interface StudentReport {
  studentId: string;
  studentName: string;
  className: string;
  term: TermName;
  rows: ReportRow[];
  overallAverage: number | null; // mean of subject totals with any score
}
```

## Repository interface

Implemented in BOTH `mock.ts` and `supabase-repo.ts`.

```ts
listSubjects(): Promise<Subject[]>;
listClassRecordSummaries(term: TermName): Promise<ClassRecordSummary[]>;
listSubjectAverages(classId: string, term: TermName): Promise<SubjectAverageRow[]>;
listStudentSubjectScores(classId: string, subjectId: string, term: TermName): Promise<StudentSubjectScore[]>;
listClassStudentAverages(classId: string, term: TermName): Promise<{ studentId: string; studentName: string; average: number | null }[]>;
getStudentReport(studentId: string, term: TermName): Promise<StudentReport>;
/** Upsert scores for one class + subject + term. */
saveAssessments(input: SaveAssessmentsInput): Promise<void>;
/** Upsert parsed template rows (any mix of subjects) for a term. */
importAssessments(term: TermName, rows: AssessmentImportRow[], recordedByName: string): Promise<AssessmentImportResult>;
```

```ts
export interface SaveAssessmentsInput {
  classId: string;
  subjectId: string;
  term: TermName;
  scores: { studentId: string; ca1: number | null; ca2: number | null; exam: number | null }[];
  recordedByName: string;
}

/** One validated row from a parsed upload: identity resolved to ids. */
export interface AssessmentImportRow {
  studentId: string;
  subjectId: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
}

export interface AssessmentImportResult {
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
```

Grade/total math lives in a pure, tested helper (`src/lib/records/grading.ts`):
`componentTotal`, `gradeFor(total)`, `ASSESSMENT_MAXES`, `GRADE_SCALE`. The
repository composes averages from raw rows; the pure helper is unit-tested in
isolation.

## Score entry

Two ways to enter scores, both gated to `manage_grades`:

### In-app grid
- From a class detail, an "Enter scores" action opens a grid: choose subject
  (term comes from the app term filter), then a row per student with three
  numeric inputs (CA1, CA2, Exam), each validated against its max. Save calls
  `saveAssessments` (upsert).
- Empty inputs save as null (not entered), not 0.

### Excel template download + upload (bulk)
Mirrors the existing fee-template flow (SheetJS `exportToXlsx` / `readSheetRows`).

- **Download template** (from a class detail): builds a workbook pre-filled with
  the class's students crossed with the school's subjects, so the user just
  types scores. One row per student-per-subject. Columns:
  `ASSESSMENT_TEMPLATE_HEADERS = ["Admission No", "Student", "Class", "Subject", "CA1", "CA2", "Exam"]`.
  The first four columns are pre-filled; CA1/CA2/Exam are blank. `Admission No`
  is the stable match key on upload (names are not unique).
- **Upload template**: parses the sheet, matches each row to a student by
  `Admission No` and a subject by `Subject` name (case-insensitive), validates
  each score against its component max, then upserts. Rows with an unknown
  admission number or subject, or an out-of-range score, are skipped with a
  per-row message; valid rows still save. The parse + validation live in a pure,
  tested helper `src/lib/records/recordsTemplate.ts`
  (`ASSESSMENT_TEMPLATE_HEADERS`, `buildAssessmentTemplateRows(students, subjects, className)`,
  `parseAssessmentTemplate(sheetRows, knownStudents, knownSubjects, term)`).
- Blank score cells parse as null (not entered), not 0. A row with all three
  score cells blank is skipped (nothing to save), not an error.

## The three drill levels

1. `/records` — class list; each row shows className, studentCount, avgCa,
   avgExam (`listClassRecordSummaries`). Loading/empty states as elsewhere.
2. Class picked -> lens toggle:
   - **By subject** -> `listSubjectAverages`: subject rows, columns CA1/CA2/Exam
     (class averages) + total. Pick a subject -> `listStudentSubjectScores`:
     each student's CA1/CA2/Exam/total/grade.
   - **By student** -> `listClassStudentAverages`: students + average. Pick a
     student -> `getStudentReport` full report table.
3. Student report -> the printable artifact. v1 renders the data table + overall
   average and a disabled/"coming soon" note for the formatted print layout.

## Permissions

Two new permissions in `ROLE_PERMISSIONS`:
- `view_grades` — proprietor, bursar, teacher (all read the section).
- `manage_grades` — proprietor, bursar, teacher (all may enter/edit scores;
  teachers own academic data).

RLS mirrors this: read policy for same-school; write policy `for all` scoped to
`school_id = auth_school_id()` AND `auth_role() in ('proprietor','bursar','teacher')`
with `WITH CHECK`, on both `subjects` and `assessments`. `select, insert, update,
delete` granted to authenticated (RLS governs rows).

## Testing

- `grading.ts`: `gradeFor` boundaries (39/40/44/45/49/50/59/60/69/70/100),
  `componentTotal` with nulls.
- Mock repository: `saveAssessments` upsert (create then edit same row),
  `listClassRecordSummaries` averages, `listSubjectAverages`,
  `listStudentSubjectScores` (grade resolved), `getStudentReport` overall
  average with a partially-scored student, `importAssessments` upsert with a
  mix of valid + skipped rows.
- `recordsTemplate.ts`: `buildAssessmentTemplateRows` produces one row per
  student-per-subject with the four identity columns filled and scores blank;
  `parseAssessmentTemplate` matches by admission number + subject name, returns
  per-row errors for unknown student/subject and out-of-range scores, treats
  all-blank rows as skipped, and blank cells as null.
- Live smoke via Supabase MCP: insert an assessment, read it back; confirm
  `subjects`/`assessments` RLS policies exist (read + role-scoped write) and the
  unique constraint blocks a duplicate `(student, subject, session, term)`.

## Voice / style

No em-dashes in app copy (colons or hyphens). Scores are small integers, not
money. Report copy follows the Bursar voice. Dark-mode surfaces follow the
permanent-dark token rules.

## Rollout / flexibility

Averages and grades derive from raw assessment rows through the tested
`grading.ts` helper and repository aggregates, so changing maxes, the grade
scale, or adding weighting later touches one helper. The section is additive:
no existing screen or table changes behaviour.
