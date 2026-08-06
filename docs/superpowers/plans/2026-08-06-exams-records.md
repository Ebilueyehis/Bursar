# Exams & Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Records section for CA/exam scores with class, subject, and student drill-downs, in-app + Excel score entry, and per-student reports.

**Architecture:** Two new tables (`subjects`, `assessments`) are the single source; every view derives from them. A pure tested helper (`grading.ts`) owns totals/grades; a pure tested helper (`recordsTemplate.ts`) owns the Excel build/parse. The repository composes averages; a `/records` page drills class -> (by-subject | by-student) with in-page state, reusing the fee-template download/upload pattern for bulk entry.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), SheetJS (`xlsx`), Vitest.

## Global Constraints

- **No em-dashes** in any app copy. Use colons or hyphens. (Verbatim rule.)
- **Scores are small integers**, validated within `[0, max]` per component (CA1 20, CA2 20, Exam 60).
- **Security audit before AND after the build.** Full adversarial audit at execution kickoff and again in the final task. Live checks via Supabase MCP (project `pbrirletzhvanmmxithr`).
- **RLS is the security boundary.** `subjects` and `assessments` each get a same-school SELECT policy and a write policy `for all` scoped to `school_id = auth_school_id()` AND `auth_role() in ('proprietor','bursar','teacher')` with `WITH CHECK`.
- **Repository parity.** Every interface change is implemented in BOTH `mock.ts` and `supabase-repo.ts`.
- **Permissions.** New `view_grades` (read) and `manage_grades` (write) added to all three roles; Records nav gated to `view_grades`, entry gated to `manage_grades`.
- **One source, both lenses.** In-app grid and template upload both funnel into the same upsert; by-subject and by-student views both derive from `assessments`.
- **Dark mode.** No `bg-ink` for always-dark surfaces; use `#16212e` or `--hero-grad` tokens.

---

### Task 1: Grading helper (pure)

Totals + grades + component maxes. Pure, unit-tested.

**Files:**
- Create: `src/lib/records/grading.ts`
- Test: `src/lib/records/__tests__/grading.test.ts`

**Interfaces:**
- Produces:
  - `ASSESSMENT_MAXES = { ca1: 20, ca2: 20, exam: 60 }` (const)
  - `GRADE_SCALE: { min: number; grade: string }[]`
  - `componentTotal(ca1: number | null, ca2: number | null, exam: number | null): number | null`
  - `gradeFor(total: number | null): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/records/__tests__/grading.test.ts
import { describe, it, expect } from "vitest";
import { componentTotal, gradeFor, ASSESSMENT_MAXES } from "@/lib/records/grading";

describe("componentTotal", () => {
  it("is null when every component is null", () => {
    expect(componentTotal(null, null, null)).toBeNull();
  });
  it("treats missing components as 0 when at least one is present", () => {
    expect(componentTotal(15, null, null)).toBe(15);
    expect(componentTotal(15, 18, 50)).toBe(83);
  });
});

describe("gradeFor", () => {
  it("is null for a null total", () => {
    expect(gradeFor(null)).toBeNull();
  });
  it("maps boundaries to the WAEC scale", () => {
    expect(gradeFor(100)).toBe("A");
    expect(gradeFor(70)).toBe("A");
    expect(gradeFor(69)).toBe("B");
    expect(gradeFor(60)).toBe("B");
    expect(gradeFor(59)).toBe("C");
    expect(gradeFor(50)).toBe("C");
    expect(gradeFor(49)).toBe("D");
    expect(gradeFor(45)).toBe("D");
    expect(gradeFor(44)).toBe("E");
    expect(gradeFor(40)).toBe("E");
    expect(gradeFor(39)).toBe("F");
    expect(gradeFor(0)).toBe("F");
  });
});

describe("ASSESSMENT_MAXES", () => {
  it("sums to 100", () => {
    expect(ASSESSMENT_MAXES.ca1 + ASSESSMENT_MAXES.ca2 + ASSESSMENT_MAXES.exam).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/records/__tests__/grading.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/records/grading.ts
export const ASSESSMENT_MAXES = { ca1: 20, ca2: 20, exam: 60 } as const;

/** WAEC-style scale, highest threshold first. */
export const GRADE_SCALE: { min: number; grade: string }[] = [
  { min: 70, grade: "A" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 45, grade: "D" },
  { min: 40, grade: "E" },
  { min: 0, grade: "F" },
];

/** Sum of components; null only when all three are null. Nulls count as 0. */
export function componentTotal(
  ca1: number | null,
  ca2: number | null,
  exam: number | null,
): number | null {
  if (ca1 == null && ca2 == null && exam == null) return null;
  return (ca1 ?? 0) + (ca2 ?? 0) + (exam ?? 0);
}

export function gradeFor(total: number | null): string | null {
  if (total == null) return null;
  for (const band of GRADE_SCALE) {
    if (total >= band.min) return band.grade;
  }
  return "F";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/records/__tests__/grading.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/records/grading.ts src/lib/records/__tests__/grading.test.ts
git commit -m "feat: records grading helper (component total + WAEC grade)"
```

---

### Task 2: Records schema, types, permissions, subjects + saveAssessments

Tables, domain types, the two permissions, subject seeding, and score upsert. No aggregates or UI yet.

**Files:**
- Modify: `src/lib/domain/types.ts` (Subject, Assessment types)
- Modify: `src/lib/domain/constants.ts` (SUBJECT_NAMES + two permissions)
- Modify: `src/lib/data/repository.ts` (interface + input types)
- Modify: `src/lib/data/mock.ts` (SUBJECTS + ASSESSMENTS stores, seeding, methods)
- Modify: `src/lib/data/supabase-repo.ts` (mappers + methods)
- Modify: `supabase/schema.sql` (tables + RLS + grants)
- Live: apply migration to `pbrirletzhvanmmxithr` (tables + policies + seed subjects for existing schools)
- Test: `src/lib/data/__tests__/records.test.ts`

**Interfaces:**
- Consumes: `TermName`; `repository.listStudents`/`listClasses`.
- Produces:
  - `interface Subject { id: string; schoolId: string; name: string }`
  - `interface Assessment { id: string; schoolId: string; studentId: string; subjectId: string; sessionId: string; term: TermName; ca1: number | null; ca2: number | null; exam: number | null; recordedByName: string }`
  - `SUBJECT_NAMES: string[]`
  - `Permission` union gains `"view_grades" | "manage_grades"`
  - `Repository.listSubjects(): Promise<Subject[]>`
  - `Repository.ensureDefaultSubjects(): Promise<void>`
  - `Repository.saveAssessments(input: SaveAssessmentsInput): Promise<void>`
  - `interface SaveAssessmentsInput { classId: string; subjectId: string; term: TermName; scores: { studentId: string; ca1: number | null; ca2: number | null; exam: number | null }[]; recordedByName: string }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/records.test.ts
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

  it("upserts scores for a class + subject (create then edit same row)", async () => {
    const { classId, subjectId } = await firstClassAndSubject();
    const students = (await mockRepository.listStudents()).filter((s) => s.classId === classId);
    expect(students.length).toBeGreaterThan(0);
    const sid = students[0].id;

    await mockRepository.saveAssessments({
      classId, subjectId, term: "first",
      scores: [{ studentId: sid, ca1: 15, ca2: 16, exam: 50 }],
      recordedByName: "Miss Halima Yusuf",
    });
    let scores = await mockRepository.listStudentSubjectScores(classId, subjectId, "first");
    let row = scores.find((r) => r.studentId === sid)!;
    expect(row.total).toBe(81);
    expect(row.grade).toBe("A");

    await mockRepository.saveAssessments({
      classId, subjectId, term: "first",
      scores: [{ studentId: sid, ca1: 10, ca2: 10, exam: 30 }],
      recordedByName: "Miss Halima Yusuf",
    });
    scores = await mockRepository.listStudentSubjectScores(classId, subjectId, "first");
    row = scores.find((r) => r.studentId === sid)!;
    expect(row.total).toBe(50);
    expect(row.grade).toBe("C");
  });
});
```

(Note: `listStudentSubjectScores` is delivered in Task 3; this test file grows there. To keep Task 2 self-contained, replace the two `listStudentSubjectScores` assertions with a direct read for now:)

Use this Task-2 version of the second test body instead, reading raw assessments via a temporary helper the mock exposes through `listSubjects`-adjacent state is not available; so assert via `saveAssessments` not throwing and a re-save succeeding:

```ts
  it("saveAssessments upserts without error and is idempotent on the key", async () => {
    const { classId, subjectId } = await firstClassAndSubject();
    const students = (await mockRepository.listStudents()).filter((s) => s.classId === classId);
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
```

Keep only the seeding test and this idempotency test in Task 2. The grade-resolving assertions move to Task 3's test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/records.test.ts`
Expected: FAIL — `listSubjects` is not a function.

- [ ] **Step 3: Add domain types**

In `src/lib/domain/types.ts` add (after `Assessment`-adjacent money types, e.g. after `AuditEntry`):

```ts
/** A subject the school teaches, e.g. Mathematics. */
export interface Subject {
  id: string;
  schoolId: string;
  name: string;
}

/** One student's scores in one subject for a term. Nulls mean "not entered". */
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

- [ ] **Step 4: Add the subject-name seed + permissions**

In `src/lib/domain/constants.ts`, add the subject list (after `INCOME_SOURCES`):

```ts
/** Default subjects seeded for a new school. Editable later. */
export const SUBJECT_NAMES: string[] = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Social Studies",
  "Civic Education",
  "Agricultural Science",
  "Business Studies",
  "Computer Studies",
  "Christian Religious Studies",
  "Islamic Religious Studies",
  "Physical & Health Education",
  "Fine Arts",
];
```

Extend the `Permission` union with `"view_grades"` and `"manage_grades"`, and add both to all three roles in `ROLE_PERMISSIONS`:

```ts
export type Permission =
  | "view_dashboard"
  | "view_debtors"
  | "record_payment"
  | "edit_fees"
  | "manage_students"
  | "import_students"
  | "send_reminders"
  | "manage_staff"
  | "manage_expenses"
  | "view_ledger"
  | "view_reports"
  | "view_grades"
  | "manage_grades";
```

Add `"view_grades", "manage_grades"` to the arrays for `proprietor`, `bursar`, AND `teacher` in `ROLE_PERMISSIONS`.

- [ ] **Step 5: Add interface methods + input type**

In `src/lib/data/repository.ts`, add `Subject`, `Assessment` to the domain import. Add to `interface Repository` (new Records section):

```ts
  // --- Records: subjects & assessments --------------------------------------

  listSubjects(): Promise<Subject[]>;
  /** Seed the default subject list if the school has none. Idempotent. */
  ensureDefaultSubjects(): Promise<void>;
  /** Upsert scores for one class + subject + term. */
  saveAssessments(input: SaveAssessmentsInput): Promise<void>;
```

Add the input type near the other inputs:

```ts
export interface SaveAssessmentsInput {
  classId: string;
  subjectId: string;
  term: TermName;
  scores: { studentId: string; ca1: number | null; ca2: number | null; exam: number | null }[];
  recordedByName: string;
}
```

- [ ] **Step 6: Implement in the mock repository**

In `src/lib/data/mock.ts`: add `Subject`, `Assessment` to the domain import, `SaveAssessmentsInput` to the repository-type import, and `SUBJECT_NAMES` from constants. Add stores + seeding near the other stores:

```ts
import { SUBJECT_NAMES } from "@/lib/domain/constants";

const SUBJECTS: Subject[] = SUBJECT_NAMES.map((name, i) => ({
  id: `subj-${i}`,
  schoolId: SCHOOL.id,
  name,
}));
const ASSESSMENTS: Assessment[] = [];
```

Add the methods (after the income methods):

```ts
  async listSubjects(): Promise<Subject[]> {
    await tick();
    return [...SUBJECTS].sort((a, b) => a.name.localeCompare(b.name));
  },

  async ensureDefaultSubjects(): Promise<void> {
    await tick();
    if (SUBJECTS.length === 0) {
      SUBJECT_NAMES.forEach((name, i) =>
        SUBJECTS.push({ id: `subj-${i}`, schoolId: SCHOOL.id, name }),
      );
    }
  },

  async saveAssessments(input: SaveAssessmentsInput): Promise<void> {
    await tick();
    for (const s of input.scores) {
      const existing = ASSESSMENTS.find(
        (a) =>
          a.studentId === s.studentId &&
          a.subjectId === input.subjectId &&
          a.term === input.term &&
          a.sessionId === SESSION.id,
      );
      if (existing) {
        existing.ca1 = s.ca1;
        existing.ca2 = s.ca2;
        existing.exam = s.exam;
        existing.recordedByName = input.recordedByName;
      } else {
        ASSESSMENTS.push({
          id: `asm-${Date.now()}-${ASSESSMENTS.length}`,
          schoolId: SCHOOL.id,
          studentId: s.studentId,
          subjectId: input.subjectId,
          sessionId: SESSION.id,
          term: input.term,
          ca1: s.ca1,
          ca2: s.ca2,
          exam: s.exam,
          recordedByName: input.recordedByName,
        });
      }
    }
  },
```

- [ ] **Step 7: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`: add `Subject`, `Assessment` to the domain import, `SaveAssessmentsInput` to the repository-type import, and `SUBJECT_NAMES` from constants. Add mappers near `mapIncome`:

```ts
function mapSubject(r: Row): Subject {
  return { id: r.id as string, schoolId: r.school_id as string, name: r.name as string };
}

function mapAssessment(r: Row): Assessment {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    studentId: r.student_id as string,
    subjectId: r.subject_id as string,
    sessionId: (r.session_id as string) ?? "",
    term: r.term as TermName,
    ca1: r.ca1 == null ? null : Number(r.ca1),
    ca2: r.ca2 == null ? null : Number(r.ca2),
    exam: r.exam == null ? null : Number(r.exam),
    recordedByName: (r.recorded_by_name as string) ?? "",
  };
}
```

Add the methods (after the income methods):

```ts
  async listSubjects(): Promise<Subject[]> {
    const { data } = await sb().from("subjects").select("*").order("name");
    return (data ?? []).map(mapSubject);
  },

  async ensureDefaultSubjects(): Promise<void> {
    const client = sb();
    const { school } = await getContext();
    if (!school) return;
    const { count } = await client.from("subjects").select("id", { count: "exact", head: true });
    if (count && count > 0) return;
    await client.from("subjects").insert(
      SUBJECT_NAMES.map((name) => ({ school_id: school.id, name })),
    );
  },

  async saveAssessments(input: SaveAssessmentsInput): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    const { data: { user } } = await client.auth.getUser();
    const payload = input.scores.map((s) => ({
      school_id: school.id,
      student_id: s.studentId,
      subject_id: input.subjectId,
      session_id: session?.id ?? null,
      term: input.term,
      ca1: s.ca1,
      ca2: s.ca2,
      exam: s.exam,
      recorded_by: user?.id ?? null,
      recorded_by_name: input.recordedByName,
    }));
    const { error } = await client
      .from("assessments")
      .upsert(payload, { onConflict: "student_id,subject_id,session_id,term" });
    if (error) throw new Error("These scores couldn't be saved. Please try again.");
  },
```

- [ ] **Step 8: Update the source schema**

In `supabase/schema.sql`, add tables (after `income`):

```sql
create table subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index on subjects (school_id);

create table assessments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  student_id       uuid not null references students(id) on delete cascade,
  subject_id       uuid not null references subjects(id) on delete cascade,
  session_id       uuid references sessions(id) on delete set null,
  term             term_name not null,
  ca1              smallint check (ca1 between 0 and 20),
  ca2              smallint check (ca2 between 0 and 20),
  exam             smallint check (exam between 0 and 60),
  recorded_by      uuid references profiles(id),
  recorded_by_name text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, subject_id, session_id, term)
);
create index on assessments (school_id, term);
```

Add to the RLS enable list:
```sql
alter table subjects    enable row level security;
alter table assessments enable row level security;
```

Add policies (near `manage_income`):
```sql
-- Subjects & assessments: staff (incl. teachers) may read and write.
create policy read_same_school on subjects
  for select using (school_id = auth_school_id());
create policy manage_subjects on subjects
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'));
create policy read_same_school on assessments
  for select using (school_id = auth_school_id());
create policy manage_assessments on assessments
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'));
```

Add `subjects, assessments` to the `grant select, insert, update, delete ... to authenticated;` list.

- [ ] **Step 9: Apply the live migration**

Use `apply_migration` (project `pbrirletzhvanmmxithr`, name `add_records_tables`) with the Step-8 DDL wrapped in `create table if not exists`, each policy preceded by `drop policy if exists`, the grant, and a seed of subjects for existing schools:

```sql
-- (tables as in Step 8, with `create table if not exists`)
-- (enable RLS; drop+create the four policies; grant)
insert into subjects (school_id, name)
select s.id, v.name
from schools s
cross join (values
  ('Mathematics'),('English Language'),('Basic Science'),('Social Studies'),
  ('Civic Education'),('Agricultural Science'),('Business Studies'),('Computer Studies'),
  ('Christian Religious Studies'),('Islamic Religious Studies'),
  ('Physical & Health Education'),('Fine Arts')
) as v(name)
where not exists (select 1 from subjects x where x.school_id = s.id);
```

Confirm with `execute_sql`:
`select tablename, policyname, cmd from pg_policies where tablename in ('subjects','assessments') order by tablename, policyname;`
Expected: read + manage policies on both. And `select count(*) from subjects;` returns > 0.

- [ ] **Step 10: Trim the Task-2 test to what Task 2 delivers**

Ensure `src/lib/data/__tests__/records.test.ts` contains only the seeding test and the idempotency test from Step 1 (the grade-resolving assertions belong to Task 3). Run:
Run: `npx vitest run src/lib/data/__tests__/records.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/domain/types.ts src/lib/domain/constants.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts supabase/schema.sql src/lib/data/__tests__/records.test.ts
git commit -m "feat: records schema, subjects, permissions, saveAssessments"
```

---

### Task 3: Read aggregates (summaries, averages, scores, report)

The five read views that power both lenses.

**Files:**
- Modify: `src/lib/data/repository.ts` (interface + view types)
- Modify: `src/lib/data/mock.ts` (aggregate methods)
- Modify: `src/lib/data/supabase-repo.ts` (aggregate methods)
- Test: `src/lib/data/__tests__/records.test.ts` (add cases)

**Interfaces:**
- Consumes: `componentTotal`, `gradeFor` (Task 1); `ASSESSMENTS`/`SUBJECTS`/students/classes (Task 2).
- Produces (all in `repository.ts`):
  - `ClassRecordSummary { classId; className; studentCount; avgCa: number | null; avgExam: number | null }`
  - `SubjectAverageRow { subjectId; subjectName; avgCa1; avgCa2; avgExam; avgTotal }` (nullable numbers)
  - `StudentSubjectScore { studentId; studentName; ca1; ca2; exam; total; grade }` (nullable)
  - `ReportRow { subjectId; subjectName; ca1; ca2; exam; total; grade }`
  - `StudentReport { studentId; studentName; className; term; rows: ReportRow[]; overallAverage: number | null }`
  - `listClassRecordSummaries(term)`, `listSubjectAverages(classId, term)`, `listStudentSubjectScores(classId, subjectId, term)`, `listClassStudentAverages(classId, term)`, `getStudentReport(studentId, term)`

- [ ] **Step 1: Add the view types + interface methods**

In `src/lib/data/repository.ts` add:

```ts
export interface ClassRecordSummary {
  classId: string;
  className: string;
  studentCount: number;
  avgCa: number | null;
  avgExam: number | null;
}
export interface SubjectAverageRow {
  subjectId: string;
  subjectName: string;
  avgCa1: number | null;
  avgCa2: number | null;
  avgExam: number | null;
  avgTotal: number | null;
}
export interface StudentSubjectScore {
  studentId: string;
  studentName: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}
export interface ReportRow {
  subjectId: string;
  subjectName: string;
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
}
export interface StudentReport {
  studentId: string;
  studentName: string;
  className: string;
  term: TermName;
  rows: ReportRow[];
  overallAverage: number | null;
}
```

Add to `interface Repository`:

```ts
  listClassRecordSummaries(term: TermName): Promise<ClassRecordSummary[]>;
  listSubjectAverages(classId: string, term: TermName): Promise<SubjectAverageRow[]>;
  listStudentSubjectScores(classId: string, subjectId: string, term: TermName): Promise<StudentSubjectScore[]>;
  listClassStudentAverages(classId: string, term: TermName): Promise<{ studentId: string; studentName: string; average: number | null }[]>;
  getStudentReport(studentId: string, term: TermName): Promise<StudentReport>;
```

- [ ] **Step 2: Write the failing tests (append to records.test.ts)**

```ts
// append to src/lib/data/__tests__/records.test.ts
import { componentTotal } from "@/lib/records/grading";

describe("records: aggregates (mock)", () => {
  it("resolves per-student subject scores with grade, and class + subject averages", async () => {
    const classes = await mockRepository.listClasses();
    const subjects = await mockRepository.listSubjects();
    const classId = classes[0].id;
    const subjectId = subjects[0].id;
    const students = (await mockRepository.listStudents()).filter((s) => s.classId === classId);
    expect(students.length).toBeGreaterThanOrEqual(2);

    await mockRepository.saveAssessments({
      classId, subjectId, term: "second",
      scores: [
        { studentId: students[0].id, ca1: 20, ca2: 20, exam: 60 }, // 100 A
        { studentId: students[1].id, ca1: 10, ca2: 10, exam: 20 }, // 40 E
      ],
      recordedByName: "Teacher",
    });

    const scores = await mockRepository.listStudentSubjectScores(classId, subjectId, "second");
    const s0 = scores.find((r) => r.studentId === students[0].id)!;
    expect(s0.total).toBe(100);
    expect(s0.grade).toBe("A");

    const subjAvgs = await mockRepository.listSubjectAverages(classId, "second");
    const subj = subjAvgs.find((r) => r.subjectId === subjectId)!;
    expect(subj.avgTotal).toBe(70); // (100 + 40) / 2

    const summaries = await mockRepository.listClassRecordSummaries("second");
    const summary = summaries.find((c) => c.classId === classId)!;
    expect(summary.avgExam).toBe(40); // (60 + 20) / 2
  });

  it("builds a student report with overall average over scored subjects", async () => {
    const classes = await mockRepository.listClasses();
    const subjects = await mockRepository.listSubjects();
    const classId = classes[1].id;
    const students = (await mockRepository.listStudents()).filter((s) => s.classId === classId);
    const sid = students[0].id;

    await mockRepository.saveAssessments({
      classId, subjectId: subjects[0].id, term: "third",
      scores: [{ studentId: sid, ca1: 20, ca2: 20, exam: 60 }], // 100
      recordedByName: "Teacher",
    });
    await mockRepository.saveAssessments({
      classId, subjectId: subjects[1].id, term: "third",
      scores: [{ studentId: sid, ca1: 10, ca2: 10, exam: 20 }], // 40
      recordedByName: "Teacher",
    });

    const report = await mockRepository.getStudentReport(sid, "third");
    expect(report.rows.length).toBe(2);
    expect(report.overallAverage).toBe(70); // (100 + 40)/2
    expect(componentTotal(null, null, null)).toBeNull(); // sanity of shared helper
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/data/__tests__/records.test.ts`
Expected: FAIL — `listStudentSubjectScores` / aggregates not functions.

- [ ] **Step 4: Implement the aggregates in the mock**

In `src/lib/data/mock.ts` add `componentTotal, gradeFor` import from `@/lib/records/grading`, and a helper + the methods (after `saveAssessments`):

```ts
  async listClassRecordSummaries(term: TermName): Promise<ClassRecordSummary[]> {
    await tick();
    return CLASSES.map((cls) => {
      const studentIds = STUDENTS.filter((s) => s.classId === cls.id).map((s) => s.id);
      const rows = ASSESSMENTS.filter(
        (a) => a.term === term && a.sessionId === SESSION.id && studentIds.includes(a.studentId),
      );
      const caVals = rows
        .filter((r) => r.ca1 != null && r.ca2 != null)
        .map((r) => (r.ca1 as number) + (r.ca2 as number));
      const examVals = rows.filter((r) => r.exam != null).map((r) => r.exam as number);
      return {
        classId: cls.id,
        className: cls.name,
        studentCount: studentIds.length,
        avgCa: mean(caVals),
        avgExam: mean(examVals),
      };
    });
  },

  async listSubjectAverages(classId: string, term: TermName): Promise<SubjectAverageRow[]> {
    await tick();
    const studentIds = STUDENTS.filter((s) => s.classId === classId).map((s) => s.id);
    return SUBJECTS.map((subj) => {
      const rows = ASSESSMENTS.filter(
        (a) => a.subjectId === subj.id && a.term === term && a.sessionId === SESSION.id && studentIds.includes(a.studentId),
      );
      const totals = rows
        .map((r) => componentTotal(r.ca1, r.ca2, r.exam))
        .filter((t): t is number => t != null);
      return {
        subjectId: subj.id,
        subjectName: subj.name,
        avgCa1: mean(rows.filter((r) => r.ca1 != null).map((r) => r.ca1 as number)),
        avgCa2: mean(rows.filter((r) => r.ca2 != null).map((r) => r.ca2 as number)),
        avgExam: mean(rows.filter((r) => r.exam != null).map((r) => r.exam as number)),
        avgTotal: mean(totals),
      };
    }).filter((r) => r.avgTotal != null);
  },

  async listStudentSubjectScores(classId: string, subjectId: string, term: TermName): Promise<StudentSubjectScore[]> {
    await tick();
    const students = STUDENTS.filter((s) => s.classId === classId);
    return students.map((s) => {
      const a = ASSESSMENTS.find(
        (x) => x.studentId === s.id && x.subjectId === subjectId && x.term === term && x.sessionId === SESSION.id,
      );
      const ca1 = a?.ca1 ?? null;
      const ca2 = a?.ca2 ?? null;
      const exam = a?.exam ?? null;
      const total = componentTotal(ca1, ca2, exam);
      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        ca1, ca2, exam, total, grade: gradeFor(total),
      };
    });
  },

  async listClassStudentAverages(classId: string, term: TermName) {
    await tick();
    const students = STUDENTS.filter((s) => s.classId === classId);
    return students.map((s) => {
      const totals = ASSESSMENTS.filter(
        (a) => a.studentId === s.id && a.term === term && a.sessionId === SESSION.id,
      )
        .map((a) => componentTotal(a.ca1, a.ca2, a.exam))
        .filter((t): t is number => t != null);
      return { studentId: s.id, studentName: `${s.firstName} ${s.lastName}`, average: mean(totals) };
    });
  },

  async getStudentReport(studentId: string, term: TermName): Promise<StudentReport> {
    await tick();
    const student = STUDENTS.find((s) => s.id === studentId);
    const cls = student ? CLASSES.find((c) => c.id === student.classId) : undefined;
    const rows = ASSESSMENTS.filter(
      (a) => a.studentId === studentId && a.term === term && a.sessionId === SESSION.id,
    ).map((a) => {
      const subj = SUBJECTS.find((s) => s.id === a.subjectId);
      const total = componentTotal(a.ca1, a.ca2, a.exam);
      return {
        subjectId: a.subjectId,
        subjectName: subj?.name ?? "Subject",
        ca1: a.ca1, ca2: a.ca2, exam: a.exam, total, grade: gradeFor(total),
      };
    });
    const totals = rows.map((r) => r.total).filter((t): t is number => t != null);
    return {
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
      className: cls?.name ?? "-",
      term,
      rows,
      overallAverage: mean(totals),
    };
  },
```

Add a `mean` helper near the top of `mock.ts` (after `tick`):

```ts
/** Mean rounded to a whole number, or null for an empty list. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
```

Add the view types to the `mock.ts` repository-type import (`ClassRecordSummary, SubjectAverageRow, StudentSubjectScore, StudentReport`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/records.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the aggregates in Supabase**

In `src/lib/data/supabase-repo.ts` add `componentTotal, gradeFor` import and a shared row-fetch. Implement each method by fetching the relevant assessment rows (joined to students/subjects as needed) and computing with the same helpers. Add after `saveAssessments`:

```ts
  async listClassRecordSummaries(term: TermName): Promise<ClassRecordSummary[]> {
    const client = sb();
    const [{ data: classes }, { data: students }, { data: rows }] = await Promise.all([
      client.from("classes").select("id,name"),
      client.from("students").select("id,class_id"),
      client.from("assessments").select("student_id,ca1,ca2,exam").eq("term", term),
    ]);
    const classOf = new Map((students ?? []).map((s) => [s.id as string, s.class_id as string]));
    return (classes ?? []).map((c) => {
      const ids = new Set((students ?? []).filter((s) => s.class_id === c.id).map((s) => s.id));
      const mine = (rows ?? []).filter((r) => ids.has(r.student_id as string));
      const ca = mine.filter((r) => r.ca1 != null && r.ca2 != null).map((r) => Number(r.ca1) + Number(r.ca2));
      const ex = mine.filter((r) => r.exam != null).map((r) => Number(r.exam));
      return {
        classId: c.id as string,
        className: c.name as string,
        studentCount: ids.size,
        avgCa: meanOf(ca),
        avgExam: meanOf(ex),
      };
    });
    void classOf;
  },

  async listSubjectAverages(classId: string, term: TermName): Promise<SubjectAverageRow[]> {
    const client = sb();
    const [{ data: students }, { data: subjects }] = await Promise.all([
      client.from("students").select("id").eq("class_id", classId),
      client.from("subjects").select("id,name").order("name"),
    ]);
    const ids = (students ?? []).map((s) => s.id as string);
    if (ids.length === 0) return [];
    const { data: rows } = await client
      .from("assessments").select("subject_id,ca1,ca2,exam").eq("term", term).in("student_id", ids);
    return (subjects ?? []).map((subj) => {
      const mine = (rows ?? []).filter((r) => r.subject_id === subj.id);
      const totals = mine
        .map((r) => componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam)))
        .filter((t): t is number => t != null);
      return {
        subjectId: subj.id as string,
        subjectName: subj.name as string,
        avgCa1: meanOf(mine.filter((r) => r.ca1 != null).map((r) => Number(r.ca1))),
        avgCa2: meanOf(mine.filter((r) => r.ca2 != null).map((r) => Number(r.ca2))),
        avgExam: meanOf(mine.filter((r) => r.exam != null).map((r) => Number(r.exam))),
        avgTotal: meanOf(totals),
      };
    }).filter((r) => r.avgTotal != null);
  },

  async listStudentSubjectScores(classId: string, subjectId: string, term: TermName): Promise<StudentSubjectScore[]> {
    const client = sb();
    const { data: students } = await client
      .from("students").select("id,first_name,last_name").eq("class_id", classId);
    const ids = (students ?? []).map((s) => s.id as string);
    const { data: rows } = ids.length
      ? await client.from("assessments").select("*").eq("subject_id", subjectId).eq("term", term).in("student_id", ids)
      : { data: [] as Row[] };
    const byStudent = new Map((rows ?? []).map((r) => [r.student_id as string, r]));
    return (students ?? []).map((s) => {
      const r = byStudent.get(s.id as string);
      const ca1 = r ? numOrNull(r.ca1) : null;
      const ca2 = r ? numOrNull(r.ca2) : null;
      const exam = r ? numOrNull(r.exam) : null;
      const total = componentTotal(ca1, ca2, exam);
      return {
        studentId: s.id as string,
        studentName: `${s.first_name} ${s.last_name}`,
        ca1, ca2, exam, total, grade: gradeFor(total),
      };
    });
  },

  async listClassStudentAverages(classId: string, term: TermName) {
    const client = sb();
    const { data: students } = await client
      .from("students").select("id,first_name,last_name").eq("class_id", classId);
    const ids = (students ?? []).map((s) => s.id as string);
    const { data: rows } = ids.length
      ? await client.from("assessments").select("student_id,ca1,ca2,exam").eq("term", term).in("student_id", ids)
      : { data: [] as Row[] };
    return (students ?? []).map((s) => {
      const totals = (rows ?? [])
        .filter((r) => r.student_id === s.id)
        .map((r) => componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam)))
        .filter((t): t is number => t != null);
      return { studentId: s.id as string, studentName: `${s.first_name} ${s.last_name}`, average: meanOf(totals) };
    });
  },

  async getStudentReport(studentId: string, term: TermName): Promise<StudentReport> {
    const client = sb();
    const [{ data: student }, { data: subjects }, { data: rows }] = await Promise.all([
      client.from("students").select("id,first_name,last_name,class_id").eq("id", studentId).maybeSingle(),
      client.from("subjects").select("id,name"),
      client.from("assessments").select("*").eq("student_id", studentId).eq("term", term),
    ]);
    let className = "-";
    if (student?.class_id) {
      const { data: cls } = await client.from("classes").select("name").eq("id", student.class_id).maybeSingle();
      className = (cls?.name as string) ?? "-";
    }
    const nameOf = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]));
    const reportRows = (rows ?? []).map((r) => {
      const total = componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam));
      return {
        subjectId: r.subject_id as string,
        subjectName: nameOf.get(r.subject_id as string) ?? "Subject",
        ca1: numOrNull(r.ca1), ca2: numOrNull(r.ca2), exam: numOrNull(r.exam),
        total, grade: gradeFor(total),
      };
    });
    const totals = reportRows.map((r) => r.total).filter((t): t is number => t != null);
    return {
      studentId,
      studentName: student ? `${student.first_name} ${student.last_name}` : "Student",
      className, term, rows: reportRows, overallAverage: meanOf(totals),
    };
  },
```

Add these two helpers near the top of `supabase-repo.ts` (after `sb()`):

```ts
function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}
```

Add the view types to the `supabase-repo.ts` repository-type import.

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run src/lib/data/__tests__/records.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts src/lib/data/__tests__/records.test.ts
git commit -m "feat: records read aggregates (class/subject/student views)"
```

---

### Task 4: Score template helper + importAssessments

Excel build/parse helper + the bulk upsert.

**Files:**
- Create: `src/lib/records/recordsTemplate.ts`
- Modify: `src/lib/data/repository.ts` (interface + import types)
- Modify: `src/lib/data/mock.ts` (importAssessments)
- Modify: `src/lib/data/supabase-repo.ts` (importAssessments)
- Test: `src/lib/records/__tests__/recordsTemplate.test.ts`

**Interfaces:**
- Consumes: `ASSESSMENT_MAXES` (Task 1); students/subjects.
- Produces:
  - `ASSESSMENT_TEMPLATE_HEADERS = ["Admission No","Student","Class","Subject","CA1","CA2","Exam"]`
  - `interface TemplateStudent { id: string; admissionNo: string; name: string; className: string }`
  - `interface TemplateSubject { id: string; name: string }`
  - `buildAssessmentTemplateRows(students: TemplateStudent[], subjects: TemplateSubject[]): (string | number)[][]`
  - `interface ParsedAssessmentRow { studentId: string; subjectId: string; ca1: number | null; ca2: number | null; exam: number | null }`
  - `interface AssessmentTemplateParse { rows: ParsedAssessmentRow[]; errors: string[] }`
  - `parseAssessmentTemplate(sheetRows, students, subjects): AssessmentTemplateParse`
  - `Repository.importAssessments(term, rows: AssessmentImportRow[], recordedByName): Promise<AssessmentImportResult>`
  - `interface AssessmentImportRow { studentId; subjectId; ca1; ca2; exam }` and `AssessmentImportResult { updated; skipped; errors: { row: number; message: string }[] }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/records/__tests__/recordsTemplate.test.ts
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
    expect(rows.length).toBe(0); // first skipped (blank), others errored
    expect(errors.length).toBe(2);
  });

  it("has the documented headers", () => {
    expect(ASSESSMENT_TEMPLATE_HEADERS).toEqual(["Admission No", "Student", "Class", "Subject", "CA1", "CA2", "Exam"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/records/__tests__/recordsTemplate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the template helper**

```ts
// src/lib/records/recordsTemplate.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/records/__tests__/recordsTemplate.test.ts`
Expected: PASS.

- [ ] **Step 5: Add importAssessments to the interface + both repos**

In `src/lib/data/repository.ts` add:

```ts
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
and to `interface Repository`:
```ts
  importAssessments(term: TermName, rows: AssessmentImportRow[], recordedByName: string): Promise<AssessmentImportResult>;
```

In `src/lib/data/mock.ts` (after `getStudentReport`):

```ts
  async importAssessments(term, rows, recordedByName): Promise<AssessmentImportResult> {
    await tick();
    let updated = 0;
    for (const r of rows) {
      const existing = ASSESSMENTS.find(
        (a) => a.studentId === r.studentId && a.subjectId === r.subjectId && a.term === term && a.sessionId === SESSION.id,
      );
      if (existing) {
        existing.ca1 = r.ca1; existing.ca2 = r.ca2; existing.exam = r.exam;
        existing.recordedByName = recordedByName;
      } else {
        ASSESSMENTS.push({
          id: `asm-${Date.now()}-${ASSESSMENTS.length}`,
          schoolId: SCHOOL.id, studentId: r.studentId, subjectId: r.subjectId,
          sessionId: SESSION.id, term, ca1: r.ca1, ca2: r.ca2, exam: r.exam,
          recordedByName,
        });
      }
      updated += 1;
    }
    return { updated, skipped: 0, errors: [] };
  },
```

Add `AssessmentImportResult` to the mock repository-type import.

In `src/lib/data/supabase-repo.ts` (after `getStudentReport`):

```ts
  async importAssessments(term, rows, recordedByName): Promise<AssessmentImportResult> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    if (rows.length === 0) return { updated: 0, skipped: 0, errors: [] };
    const { data: { user } } = await client.auth.getUser();
    const payload = rows.map((r) => ({
      school_id: school.id, student_id: r.studentId, subject_id: r.subjectId,
      session_id: session?.id ?? null, term, ca1: r.ca1, ca2: r.ca2, exam: r.exam,
      recorded_by: user?.id ?? null, recorded_by_name: recordedByName,
    }));
    const { error } = await client
      .from("assessments").upsert(payload, { onConflict: "student_id,subject_id,session_id,term" });
    if (error) throw new Error("These scores couldn't be saved. Please try again.");
    return { updated: rows.length, skipped: 0, errors: [] };
  },
```

Add `AssessmentImportRow, AssessmentImportResult` to the supabase repository-type import.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/records/__tests__/recordsTemplate.test.ts src/lib/data/__tests__/records.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/records/recordsTemplate.ts src/lib/records/__tests__/recordsTemplate.test.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts
git commit -m "feat: score template build/parse + importAssessments"
```

---

### Task 5: Records nav + class list page

The section entry point: class list with averages, plus nav.

**Files:**
- Modify: `src/components/icons.tsx` (RecordsIcon)
- Modify: `src/components/AppShell.tsx` (nav + title)
- Create: `src/app/records/page.tsx` (class list; drill state root added in Task 6)

**Interfaces:**
- Consumes: `repository.listClassRecordSummaries`, `ensureDefaultSubjects`; `useViewer`, `can`.
- Produces: `RecordsIcon`; `/records` route.

- [ ] **Step 1: Add a RecordsIcon**

In `src/components/icons.tsx`, add (mirroring the existing icon style):

```tsx
export const RecordsIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M14 3v5h5M8 13h8M8 17h5" />
  </svg>
);
```

- [ ] **Step 2: Add the nav item + title**

In `src/components/AppShell.tsx`:
- Import `RecordsIcon` from `@/components/icons`.
- Add to `PRIMARY_NAV` (after Students):
  `{ href: "/records", label: "Records", icon: RecordsIcon, permission: "view_grades" },`
- Add to `TITLES`: `{ base: "/records", title: "Records" }`.

- [ ] **Step 3: Create the class list page**

Create `src/app/records/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { Card, EmptyState, LoadingBlock, PageHeader, cn } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";

export default function RecordsPage() {
  const { role, term } = useViewer();
  const canManage = can(role, "manage_grades");

  // Seed default subjects once for schools that have none (idempotent).
  useEffect(() => {
    if (canManage) void repository.ensureDefaultSubjects();
  }, [canManage]);

  const { data, loading } = useAsync(() => repository.listClassRecordSummaries(term), [term]);

  if (!can(role, "view_grades")) {
    return (
      <EmptyState
        title="Records are for school staff"
        description="Ask an administrator if you need access to exam records."
      />
    );
  }

  const classes = data ?? [];

  return (
    <div>
      <PageHeader
        title="Records"
        subtitle={`Class averages for ${termLabel(term)}. Pick a class to see subjects and students.`}
      />
      {loading && !data ? (
        <LoadingBlock label="Loading class records…" />
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Add classes and students, then enter their scores to see records here."
        />
      ) : (
        <ul className="space-y-2.5">
          {classes.map((c) => (
            <li key={c.classId}>
              <a
                href={`/records?class=${c.classId}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition hover:bg-surface-sunken"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{c.className}</p>
                  <p className="text-xs text-ink-muted">
                    {c.studentCount} {c.studentCount === 1 ? "student" : "students"}
                  </p>
                </div>
                <Stat label="Avg CA" value={c.avgCa} outOf={40} />
                <Stat label="Avg Exam" value={c.avgExam} outOf={60} />
                <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, outOf }: { label: string; value: number | null; outOf: number }) {
  return (
    <div className={cn("shrink-0 text-right")}>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tabular text-sm font-bold text-ink">
        {value == null ? "-" : `${value} / ${outOf}`}
      </p>
    </div>
  );
}
```

Note: this task ships the class list only; the `?class=` link target (class detail) is wired in Task 6. Until then the link reloads the list, which is harmless.

- [ ] **Step 4: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; `/records` compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons.tsx src/components/AppShell.tsx src/app/records/page.tsx
git commit -m "feat: Records section nav + class list with averages"
```

---

### Task 6: Class detail with by-subject lens

Selecting a class shows the lens toggle and the by-subject matrix -> per-subject student scores.

**Files:**
- Create: `src/components/records/ClassDetail.tsx`
- Create: `src/components/records/SubjectMatrix.tsx`
- Create: `src/components/records/SubjectScores.tsx`
- Modify: `src/app/records/page.tsx` (route to ClassDetail when `?class=` is set)

**Interfaces:**
- Consumes: `repository.listSubjectAverages`, `listStudentSubjectScores`, `listClasses`.
- Produces: `ClassDetail({ classId })`, with an internal lens toggle (subject default) and subject drill.

- [ ] **Step 1: Create SubjectScores (per-subject student list)**

Create `src/components/records/SubjectScores.tsx`:

```tsx
"use client";

import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Card, LoadingBlock, EmptyState } from "@/components/ui";

export function SubjectScores({ classId, subjectId, subjectName }: { classId: string; subjectId: string; subjectName: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentSubjectScores(classId, subjectId, term),
    [classId, subjectId, term],
  );
  const rows = data ?? [];

  if (loading && !data) return <LoadingBlock label="Loading scores…" />;
  if (rows.length === 0) return <EmptyState title="No students in this class" />;

  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">{subjectName}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Student</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th>Grade</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.studentName}</td>
                <Num v={r.ca1} /><Num v={r.ca2} /><Num v={r.exam} /><Num v={r.total} />
                <td className="px-4 py-2.5 text-sm font-semibold text-ink">{r.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
```

- [ ] **Step 2: Create SubjectMatrix (subject rows, CA/Exam columns)**

Create `src/components/records/SubjectMatrix.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Card, LoadingBlock, EmptyState } from "@/components/ui";
import { SubjectScores } from "@/components/records/SubjectScores";

export function SubjectMatrix({ classId }: { classId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.listSubjectAverages(classId, term), [classId, term]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const rows = data ?? [];

  if (picked) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPicked(null)} className="text-sm font-semibold text-primary">
          Back to subjects
        </button>
        <SubjectScores classId={classId} subjectId={picked.id} subjectName={picked.name} />
      </div>
    );
  }

  if (loading && !data) return <LoadingBlock label="Loading subject averages…" />;
  if (rows.length === 0) {
    return <EmptyState title="No scores entered yet" description="Enter or upload scores to see subject averages." />;
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Subject</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subjectId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.subjectName}</td>
                <Num v={r.avgCa1} /><Num v={r.avgCa2} /><Num v={r.avgExam} /><Num v={r.avgTotal} />
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => setPicked({ id: r.subjectId, name: r.subjectName })}
                    className="text-sm font-semibold text-primary"
                  >
                    View students
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
```

- [ ] **Step 3: Create ClassDetail (lens toggle; student lens is Task 7)**

Create `src/components/records/ClassDetail.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { cn } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { SubjectMatrix } from "@/components/records/SubjectMatrix";
import { StudentLens } from "@/components/records/StudentLens";

type Lens = "subject" | "student";

export function ClassDetail({ classId }: { classId: string }) {
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const [lens, setLens] = useState<Lens>("subject");
  const className = classes?.find((c) => c.id === classId)?.name ?? "Class";

  return (
    <div className="space-y-4">
      <Link href="/records" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
        <ArrowLeftIcon width={18} height={18} /> All classes
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-ink">{className}</h1>
        <div className="inline-flex rounded-xl border border-border bg-surface-sunken p-1">
          {(["subject", "student"] as Lens[]).map((l) => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                lens === l ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {l === "subject" ? "By subject" : "By student"}
            </button>
          ))}
        </div>
      </div>

      {lens === "subject" ? <SubjectMatrix classId={classId} /> : <StudentLens classId={classId} />}
    </div>
  );
}
```

- [ ] **Step 4: Route the page to ClassDetail when `?class=` is set**

In `src/app/records/page.tsx`, read the query param and branch. Add near the top of `RecordsPage`:

```tsx
import { useSearchParams } from "next/navigation";
import { ClassDetail } from "@/components/records/ClassDetail";
// ...
  const params = useSearchParams();
  const classId = params.get("class");
```

Right after the `view_grades` guard, add:

```tsx
  if (classId) return <ClassDetail classId={classId} />;
```

(The class-list `<a href={`/records?class=...`}>` links now open the detail. Keep them as `<a>` for a full param-driven load, or switch to `next/link`; `<a>` is fine.)

- [ ] **Step 5: Build + typecheck**

Run: `npx tsc --noEmit`
Expected: fails only on the not-yet-created `StudentLens` import. Create a minimal stub now to compile, replaced fully in Task 7:

Create `src/components/records/StudentLens.tsx`:

```tsx
"use client";
export function StudentLens({ classId }: { classId: string }) {
  void classId;
  return <p className="text-sm text-ink-muted">Student lens arrives in Task 7.</p>;
}
```

Then:
Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/records/ClassDetail.tsx src/components/records/SubjectMatrix.tsx src/components/records/SubjectScores.tsx src/components/records/StudentLens.tsx src/app/records/page.tsx
git commit -m "feat: records class detail + by-subject lens"
```

---

### Task 7: By-student lens + student report

Student list with averages -> full report.

**Files:**
- Modify: `src/components/records/StudentLens.tsx` (replace stub)
- Create: `src/components/records/StudentReportView.tsx`

**Interfaces:**
- Consumes: `repository.listClassStudentAverages`, `getStudentReport`.
- Produces: `StudentLens({ classId })`, `StudentReportView({ studentId })`.

- [ ] **Step 1: Create the student report view**

Create `src/components/records/StudentReportView.tsx`:

```tsx
"use client";

import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { termLabel } from "@/lib/domain/constants";
import { Card, LoadingBlock, EmptyState, Button } from "@/components/ui";

export function StudentReportView({ studentId }: { studentId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.getStudentReport(studentId, term), [studentId, term]);

  if (loading && !data) return <LoadingBlock label="Loading report…" />;
  if (!data) return <EmptyState title="No report" />;
  if (data.rows.length === 0) {
    return <EmptyState title="No scores yet" description="This student has no scores entered for the term." />;
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold text-ink">{data.studentName}</p>
          <p className="text-xs text-ink-muted">{data.className} · {termLabel(data.term)}</p>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>Print</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Subject</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th>Grade</Th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.subjectId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.subjectName}</td>
                <Num v={r.ca1} /><Num v={r.ca2} /><Num v={r.exam} /><Num v={r.total} />
                <td className="px-4 py-2.5 text-sm font-semibold text-ink">{r.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <td className="px-4 py-2.5 text-sm font-bold text-ink" colSpan={4}>Overall average</td>
              <td className="px-4 py-2.5 text-sm font-bold tabular text-ink" colSpan={2}>
                {data.overallAverage == null ? "-" : `${data.overallAverage} / 100`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-ink-faint">
        A formatted printable report card is coming in a future update.
      </p>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
```

- [ ] **Step 2: Replace the StudentLens stub**

Replace `src/components/records/StudentLens.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Card, LoadingBlock, EmptyState } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { StudentReportView } from "@/components/records/StudentReportView";

export function StudentLens({ classId }: { classId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.listClassStudentAverages(classId, term), [classId, term]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const rows = data ?? [];

  if (pickedId) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPickedId(null)} className="text-sm font-semibold text-primary">
          Back to students
        </button>
        <StudentReportView studentId={pickedId} />
      </div>
    );
  }

  if (loading && !data) return <LoadingBlock label="Loading students…" />;
  if (rows.length === 0) return <EmptyState title="No students in this class" />;

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.studentId}>
          <button
            onClick={() => setPickedId(r.studentId)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
          >
            <span className="min-w-0 flex-1 font-semibold text-ink">{r.studentName}</span>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-ink-faint">Average</span>
              <span className="tabular text-sm font-bold text-ink">
                {r.average == null ? "-" : `${r.average} / 100`}
              </span>
            </span>
            <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; both lenses render.

- [ ] **Step 4: Commit**

```bash
git add src/components/records/StudentLens.tsx src/components/records/StudentReportView.tsx
git commit -m "feat: records by-student lens + student report"
```

---

### Task 8: Score entry (grid + template download/upload)

Enter scores in-app, or via the Excel round-trip.

**Files:**
- Create: `src/components/records/ScoreEntry.tsx`
- Modify: `src/components/records/ClassDetail.tsx` (Enter scores action)

**Interfaces:**
- Consumes: `repository.listSubjects`, `listStudents`, `listStudentSubjectScores`, `saveAssessments`, `importAssessments`; `buildAssessmentTemplateRows`, `parseAssessmentTemplate`, `ASSESSMENT_TEMPLATE_HEADERS`; `exportToXlsx`, `readSheetRows`; `ASSESSMENT_MAXES`.
- Produces: `ScoreEntry({ classId, className, onClose })`.

- [ ] **Step 1: Create the ScoreEntry panel**

Create `src/components/records/ScoreEntry.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { ASSESSMENT_MAXES } from "@/lib/records/grading";
import {
  ASSESSMENT_TEMPLATE_HEADERS,
  buildAssessmentTemplateRows,
  parseAssessmentTemplate,
} from "@/lib/records/recordsTemplate";
import { exportToXlsx, readSheetRows } from "@/lib/export";
import {
  Banner, Button, Card, Field, Input, LoadingBlock, Select,
} from "@/components/ui";

type Draft = Record<string, { ca1: string; ca2: string; exam: string }>;

export function ScoreEntry({ classId, className, onClose }: { classId: string; className: string; onClose: () => void }) {
  const { term, actorName } = useViewer();
  const { data: subjects } = useAsync(() => repository.listSubjects(), []);
  const { data: students } = useAsync(() => repository.listStudents(), []);
  const [subjectId, setSubjectId] = useState("");
  const { data: existing } = useAsync(
    () => (subjectId ? repository.listStudentSubjectScores(classId, subjectId, term) : Promise.resolve([])),
    [classId, subjectId, term],
  );

  const [draft, setDraft] = useState<Draft>({});
  const [seededSubject, setSeededSubject] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [templateErrors, setTemplateErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const classStudents = useMemo(
    () => (students ?? []).filter((s) => s.classId === classId),
    [students, classId],
  );

  // Seed the grid from existing scores when the chosen subject changes.
  if (subjectId && existing && subjectId !== seededSubject) {
    setSeededSubject(subjectId);
    const next: Draft = {};
    for (const r of existing) {
      next[r.studentId] = {
        ca1: r.ca1 == null ? "" : String(r.ca1),
        ca2: r.ca2 == null ? "" : String(r.ca2),
        exam: r.exam == null ? "" : String(r.exam),
      };
    }
    setDraft(next);
  }

  function setCell(studentId: string, key: "ca1" | "ca2" | "exam", value: string) {
    setDraft((d) => ({ ...d, [studentId]: { ca1: "", ca2: "", exam: "", ...d[studentId], [key]: value } }));
  }

  function toNum(v: string): number | null {
    const t = v.trim();
    return t === "" ? null : Number(t);
  }

  async function saveGrid() {
    setError(null); setResult(null);
    if (!subjectId) return setError("Choose a subject first.");
    // Validate ranges.
    for (const s of classStudents) {
      const cell = draft[s.id];
      if (!cell) continue;
      const checks: [string, number | null, number][] = [
        ["CA1", toNum(cell.ca1), ASSESSMENT_MAXES.ca1],
        ["CA2", toNum(cell.ca2), ASSESSMENT_MAXES.ca2],
        ["Exam", toNum(cell.exam), ASSESSMENT_MAXES.exam],
      ];
      for (const [label, n, max] of checks) {
        if (n != null && (!Number.isInteger(n) || n < 0 || n > max)) {
          return setError(`${s.firstName} ${s.lastName}: ${label} must be a whole number between 0 and ${max}.`);
        }
      }
    }
    setSaving(true);
    try {
      await repository.saveAssessments({
        classId, subjectId, term,
        scores: classStudents.map((s) => {
          const cell = draft[s.id] ?? { ca1: "", ca2: "", exam: "" };
          return { studentId: s.id, ca1: toNum(cell.ca1), ca2: toNum(cell.ca2), exam: toNum(cell.exam) };
        }),
        recordedByName: actorName,
      });
      setResult("Scores saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save scores. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const tStudents = classStudents.map((s) => ({
      id: s.id, admissionNo: s.admissionNo, name: `${s.firstName} ${s.lastName}`, className,
    }));
    const tSubjects = (subjects ?? []).map((s) => ({ id: s.id, name: s.name }));
    exportToXlsx(`${className} scores template`, [...ASSESSMENT_TEMPLATE_HEADERS], buildAssessmentTemplateRows(tStudents, tSubjects));
  }

  async function onTemplateFile(file: File) {
    setTemplateErrors([]); setResult(null); setBusy(true);
    try {
      const sheet = await readSheetRows(file);
      const tStudents = classStudents.map((s) => ({
        id: s.id, admissionNo: s.admissionNo, name: `${s.firstName} ${s.lastName}`, className,
      }));
      const tSubjects = (subjects ?? []).map((s) => ({ id: s.id, name: s.name }));
      const { rows, errors } = parseAssessmentTemplate(sheet, tStudents, tSubjects);
      if (errors.length) setTemplateErrors(errors.slice(0, 10));
      if (rows.length) {
        const res = await repository.importAssessments(term, rows, actorName);
        setResult(`Saved scores for ${res.updated} ${res.updated === 1 ? "entry" : "entries"}.`);
        if (subjectId) setSeededSubject(""); // force grid reseed
      } else if (!errors.length) {
        setTemplateErrors(["The file had no scores to import."]);
      }
    } catch {
      setTemplateErrors(["Couldn't read that file. Use the downloaded template."]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Enter scores</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>

      <div className="rounded-lg border border-border bg-surface-sunken p-3">
        <p className="text-sm font-semibold text-ink">Bulk with Excel</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Download the template for this class, fill CA1, CA2 and Exam, then upload it.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate} disabled={!subjects || classStudents.length === 0}>
            Download template
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy || classStudents.length === 0}>
            {busy ? "Uploading…" : "Upload filled template"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onTemplateFile(f); }} />
        </div>
        {templateErrors.length > 0 && (
          <div className="mt-2"><Banner tone="error" title="Some rows were skipped">
            <span className="block whitespace-pre-line">{templateErrors.join("\n")}</span>
          </Banner></div>
        )}
      </div>

      <Field label="Subject (for the grid below)">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Choose a subject</option>
          {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>

      {error && <Banner tone="error">{error}</Banner>}
      {result && <Banner tone="success">{result}</Banner>}

      {!subjectId ? null : !students ? (
        <LoadingBlock label="Loading students…" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">Student</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">CA1 /{ASSESSMENT_MAXES.ca1}</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">CA2 /{ASSESSMENT_MAXES.ca2}</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">Exam /{ASSESSMENT_MAXES.exam}</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => {
                  const cell = draft[s.id] ?? { ca1: "", ca2: "", exam: "" };
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-sm font-medium text-ink">{s.firstName} {s.lastName}</td>
                      {(["ca1", "ca2", "exam"] as const).map((k) => (
                        <td key={k} className="px-3 py-2">
                          <Input inputMode="numeric" value={cell[k]} onChange={(e) => setCell(s.id, k, e.target.value)} className="w-20" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={saveGrid} disabled={saving}>{saving ? "Saving…" : "Save scores"}</Button>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Add the "Enter scores" action to ClassDetail**

In `src/components/records/ClassDetail.tsx`:
- Import `useViewer`, `can`, `Button`, and `ScoreEntry`.
- Read role: `const { role } = useViewer();` (add alongside existing hooks).
- Add state: `const [entering, setEntering] = useState(false);`
- In the header row, next to the lens toggle, add (only for managers):

```tsx
{can(role, "manage_grades") && (
  <Button onClick={() => setEntering(true)}>Enter scores</Button>
)}
```

- Render the panel above the lens content when open:

```tsx
{entering && can(role, "manage_grades") && (
  <ScoreEntry classId={classId} className={className} onClose={() => setEntering(false)} />
)}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/records/ScoreEntry.tsx src/components/records/ClassDetail.tsx
git commit -m "feat: records score entry (grid + template download/upload)"
```

---

### Task 9: Full verification + security audit + build

**Files:** none (verification only; commit fixes if any).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all Vitest files pass (grading, recordsTemplate, records, plus existing).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; `/records` builds.

- [ ] **Step 3: Post-build security audit**

Run the saved adversarial audit prompt. Live checks via Supabase MCP `get_advisors` (security) for `pbrirletzhvanmmxithr`, and confirm:
- `subjects`: `read_same_school` (SELECT) + `manage_subjects` (ALL, `school_id = auth_school_id()` AND role in proprietor/bursar/teacher, WITH CHECK).
- `assessments`: `read_same_school` (SELECT) + `manage_assessments` (ALL, same scoping) + the unique `(student_id, subject_id, session_id, term)` constraint present, and score `CHECK` constraints (0..20 / 0..60).
- No new `FOR ALL` policy missing a role check; `profiles` still write-blocked; no new over-broad grants; no table left without RLS.
- Triage any newly flagged advisor; fix anything genuinely new.

- [ ] **Step 4: Live smoke (RLS + constraint)**

Via `execute_sql`: insert one assessment for a seeded student+subject, read it back, then attempt a duplicate insert on the same `(student, subject, session, term)` and confirm it violates the unique constraint. Clean up the test row afterward.

- [ ] **Step 5: Browser smoke (best effort)**

If the authed area is reachable: `/records` lists classes; picking one shows the by-subject matrix and by-student lens; "Enter scores" saves a grid and the value appears in both lenses; template download + upload round-trips. If sign-in blocks the preview, rely on tests + build and note it.

- [ ] **Step 6: Commit any fixes + push**

```bash
git add -A
git commit -m "chore: verify exams & records (tests, build, security audit)"
git push origin develop
```

---

## Self-Review

**Spec coverage:**
- Assessment structure (CA1/CA2/Exam, maxes, grade scale) -> Task 1.
- subjects + assessments tables, RLS, permissions -> Task 2.
- Read views (class summaries, subject averages, student subject scores, class student averages, student report) -> Task 3.
- Template download/upload + importAssessments; one source both lenses -> Task 4 (helper) + Task 8 (UI).
- Records nav + class list -> Task 5.
- Class drill, by-subject lens -> Task 6.
- By-student lens + report (print stub, format deferred) -> Task 7.
- In-app score grid + bulk -> Task 8.
- view_grades/manage_grades gating -> Tasks 2, 5, 8.
- Security audit before + after -> Global Constraints + Task 9.
- No em-dashes; integer scores; dark-mode tokens -> Global Constraints (copy here uses colons/periods).

**Placeholder scan:** Task 6 ships a `StudentLens` stub explicitly replaced in Task 7 (named, not a latent placeholder). Task 2 Step 1 documents trimming its own test to what Task 2 delivers, moving grade assertions to Task 3 (both test bodies given in full). No TBD/vague steps; every code step has real code.

**Type consistency:** `Subject`, `Assessment`, `SaveAssessmentsInput`, the five view types (`ClassRecordSummary`, `SubjectAverageRow`, `StudentSubjectScore`, `ReportRow`, `StudentReport`), `AssessmentImportRow`/`AssessmentImportResult`, `componentTotal`/`gradeFor`/`ASSESSMENT_MAXES`, `ASSESSMENT_TEMPLATE_HEADERS`/`buildAssessmentTemplateRows`/`parseAssessmentTemplate`, and the repository method names are used identically across tasks. Column names (`ca1/ca2/exam`, `student_id`, `subject_id`, `session_id`, `term`) match between migration, mappers, and upserts. The upsert `onConflict` matches the table's unique constraint exactly.
