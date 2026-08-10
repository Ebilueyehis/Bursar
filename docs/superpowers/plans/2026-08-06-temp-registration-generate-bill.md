# Temporary Registration, Generate Bill & Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support pre-registering a student with a printable provisional bill, approving them into an active student once paid, declining safely if they never enroll, and fix the existing bug where a student with no bill for the term shows "Student not found".

**Architecture:** `Student.status` gains `"pending"` — one table, no parallel data model. `getStudentAccount` gains a billless return shape instead of `null` so the detail page can offer a **Generate Bill** action. Two new repository methods (`approveRegistration`, `declineRegistration`) do the status flip and the safe-delete-or-soft-withdraw branch, implemented identically in both backends. The Students page filters the already-fetched account list client-side by status, matching its existing filter pattern.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- **No em-dashes** in any app copy. Use colons or hyphens. (Verbatim rule.)
- **Money is integer kobo.** Never float.
- **Security audit before AND after the build.** Full adversarial audit at execution kickoff and again in the final task. Live checks via Supabase MCP (project `pbrirletzhvanmmxithr`).
- **Critical cascade fact:** `payments.student_id` has `ON DELETE CASCADE` in `supabase/schema.sql`. Deleting a student row silently deletes their receipts too — there is no database-level guard against this. The payments-exist check in `declineRegistration` MUST run before any delete call, in both `mock.ts` and `supabase-repo.ts`, with no exceptions. This is the single most important correctness requirement in this plan.
- **Delete order** when a hard delete does happen: delete the student row first, then the guardian row by id. `students.guardian_id` references `guardians(id)` with no cascade, so deleting the guardian first while the student still references it would fail.
- **Permissions.** Every new action (temp registration, Generate Bill, Approve, Decline) is gated `manage_students`, matching all other student writes. No new permission.
- **Repository parity.** Every interface change is implemented in BOTH `mock.ts` and `supabase-repo.ts`.
- **Dark mode.** No `bg-ink` for always-dark surfaces; use `#16212e` or `--hero-grad` tokens.

---

### Task 1: Status type + createStudent(status) + Add Student toggle

`StudentStatus` gains `"pending"`; `createStudent` accepts and stores it; the Add Student form gets the Register now / Temporary toggle.

**Files:**
- Modify: `src/lib/domain/types.ts` (`StudentStatus`)
- Modify: `src/lib/data/repository.ts` (`CreateStudentInput.status?`)
- Modify: `src/lib/data/mock.ts` (`createStudent` honors `input.status`)
- Modify: `src/lib/data/supabase-repo.ts` (`createStudent` honors `input.status`)
- Modify: `supabase/schema.sql` (enum gains `'pending'`)
- Live: apply migration to `pbrirletzhvanmmxithr`
- Modify: `src/app/students/new/page.tsx` (registration-type toggle)
- Test: `src/lib/data/__tests__/registration.test.ts`

**Interfaces:**
- Produces:
  - `StudentStatus = "active" | "graduated" | "withdrawn" | "pending"`
  - `CreateStudentInput.status?: StudentStatus` (omitted defaults to `"active"`)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/registration.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: FAIL — the second case gets `"active"` back regardless of `status: "pending"` (the mock hardcodes `status: "active"`).

- [ ] **Step 3: Widen the status type**

In `src/lib/domain/types.ts`, change:

```ts
export type StudentStatus = "active" | "graduated" | "withdrawn";
```
to:
```ts
export type StudentStatus = "active" | "graduated" | "withdrawn" | "pending";
```

- [ ] **Step 4: Add the input field**

In `src/lib/data/repository.ts`, add to `CreateStudentInput` (after `guardianRelationship?`):

```ts
  /** Defaults to "active" when omitted. Set "pending" for a temporary /
   * pre-registered student with a provisional bill. */
  status?: StudentStatus;
```

Add `StudentStatus` to the domain type import at the top of the file.

- [ ] **Step 5: Honor it in the mock**

In `src/lib/data/mock.ts`, in `createStudent`, change:
```ts
      status: "active",
```
to:
```ts
      status: input.status ?? "active",
```

- [ ] **Step 6: Honor it in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, in `createStudent`, change:
```ts
        status: "active",
```
to:
```ts
        status: input.status ?? "active",
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: PASS.

- [ ] **Step 8: Update the source schema + apply the live migration**

In `supabase/schema.sql`, change:
```sql
create type student_status as enum ('active', 'graduated', 'withdrawn');
```
to:
```sql
create type student_status as enum ('active', 'graduated', 'withdrawn', 'pending');
```

Apply via Supabase MCP `apply_migration` (project `pbrirletzhvanmmxithr`, name `add_pending_student_status`). `ALTER TYPE ... ADD VALUE` must be its own statement, not combined with anything that uses the new value in the same migration:

```sql
alter type student_status add value if not exists 'pending';
```

Confirm with `execute_sql`: `select unnest(enum_range(null::student_status))::text as v;`
Expected: four rows including `pending`.

- [ ] **Step 9: Add the registration-type toggle to Add Student**

In `src/app/students/new/page.tsx`, add state near the other form state:

```tsx
  const [registrationType, setRegistrationType] = useState<"active" | "pending">("active");
```

Add the toggle UI right above the "First name / Surname" row (inside the `<div className="space-y-4">`):

```tsx
        <div className="inline-flex rounded-xl border border-border bg-surface-sunken p-1">
          {(["active", "pending"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRegistrationType(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                registrationType === t
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {t === "active" ? "Register now" : "Temporary / Pre-registered"}
            </button>
          ))}
        </div>
```

Add `cn` to the `@/components/ui` import if not already present. In `save()`, add `status: registrationType,` to the `repository.createStudent({...})` call object (any position among the other fields).

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/domain/types.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts supabase/schema.sql src/app/students/new/page.tsx src/lib/data/__tests__/registration.test.ts
git commit -m "feat: pending student status + temporary registration toggle"
```

---

### Task 2: Billless getStudentAccount + Generate Bill (fixes the 404 gap)

Replaces the silent "Student not found" for a student with no bill this term with a real fix path.

**Files:**
- Modify: `src/lib/domain/types.ts` (`StudentAccountOrBillless`)
- Modify: `src/lib/data/repository.ts` (interface + `createBillForTerm`)
- Modify: `src/lib/data/mock.ts` (`getStudentAccount` + `createBillForTerm`)
- Modify: `src/lib/data/supabase-repo.ts` (`getStudentAccount` + `createBillForTerm`)
- Modify: `src/app/students/[id]/page.tsx` (billless state + Generate Bill UI)
- Test: `src/lib/data/__tests__/registration.test.ts` (append)

**Interfaces:**
- Consumes: `BillLineInput` (existing, from `repository.ts`).
- Produces:
  - `type StudentAccountOrBillless = { kind: "account"; account: StudentAccount } | { kind: "billless"; student: Student; className: string; guardian: Guardian }`
  - `Repository.getStudentAccount(studentId: string, term: TermName): Promise<StudentAccountOrBillless | null>` (signature return type changes; `null` still means "no such student")
  - `Repository.createBillForTerm(studentId: string, term: TermName, billLines: BillLineInput[], discountKobo?: number, discountReason?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/data/__tests__/registration.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: FAIL — `getStudentAccount` still returns a bare `StudentAccount | null`, not the `{ kind }` shape; `createBillForTerm` is not a function.

- [ ] **Step 3: Add the billless type**

In `src/lib/domain/types.ts`, add after `StudentAccount`:

```ts
/**
 * The student detail page's read model: either a fully resolved account, or
 * a real student with no bill for the viewed term yet (offer Generate Bill).
 * `getStudentAccount` returns `null` only when the student id itself is
 * unknown — a missing bill is a distinct, recoverable state.
 */
export type StudentAccountOrBillless =
  | { kind: "account"; account: StudentAccount }
  | { kind: "billless"; student: Student; className: string; guardian: Guardian };
```

- [ ] **Step 4: Update the repository interface**

In `src/lib/data/repository.ts`, add `StudentAccountOrBillless` to the domain type import, and change:

```ts
  getStudentAccount(studentId: string, term: TermName): Promise<StudentAccount | null>;
```
to:
```ts
  getStudentAccount(studentId: string, term: TermName): Promise<StudentAccountOrBillless | null>;
```

Add near `updateBillLines`:

```ts
  /** Create the first bill for a student + term (the account was billless). */
  createBillForTerm(
    studentId: string,
    term: TermName,
    billLines: BillLineInput[],
    discountKobo?: number,
    discountReason?: string,
  ): Promise<void>;
```

- [ ] **Step 5: Implement in the mock repository**

In `src/lib/data/mock.ts`, replace `getStudentAccount`:

```ts
  async getStudentAccount(
    studentId: string,
    term: TermName,
  ): Promise<StudentAccountOrBillless | null> {
    await tick();
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) return null;
    const account = buildAccount(student, term);
    if (account) return { kind: "account", account };
    const cls = classById(student.classId);
    const guardian = GUARDIANS.find((g) => g.id === student.guardianId)!;
    return { kind: "billless", student, className: cls?.name ?? "-", guardian };
  },
```

Add `StudentAccountOrBillless` to the domain type import.

Add `createBillForTerm` after `updateBillLines`:

```ts
  async createBillForTerm(
    studentId: string,
    term: TermName,
    billLines: BillLineInput[],
    discountKobo?: number,
    discountReason?: string,
  ): Promise<void> {
    await tick();
    const clean = billLines
      .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
      .map((l) => ({ name: l.name.trim(), amount: l.amountKobo }));
    if (clean.length === 0) throw new Error("A bill needs at least one item.");
    const existing = BILLS.find((b) => b.studentId === studentId && b.term === term);
    if (existing) {
      existing.lines = clean;
      existing.discount = Math.max(0, discountKobo ?? 0);
      existing.discountReason = discountReason;
      return;
    }
    BILLS.push({
      id: `b-manual-${studentId}-${term}-${Date.now()}`,
      schoolId: SCHOOL.id,
      studentId,
      sessionId: SESSION.id,
      term,
      lines: clean,
      discount: Math.max(0, discountKobo ?? 0),
      discountReason,
      createdOn: new Date().toISOString().slice(0, 10),
    });
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: PASS.

- [ ] **Step 7: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, find `getStudentAccount` (around line 390) and change its return path so that when no bill row is found for the term, it returns the billless shape instead of `null`. Read the existing implementation's student/class/guardian lookups first (it already loads them before checking for a bill), then change the final "no bill" branch from `return null;` to:

```ts
    return {
      kind: "billless",
      student: mapStudent(studentRow),
      className: (studentRow.classes as Row | null)?.name as string ?? "-",
      guardian: {
        id: guardianRow.id as string,
        schoolId: guardianRow.school_id as string,
        fullName: guardianRow.full_name as string,
        phone: guardianRow.phone as string,
        altPhone: (guardianRow.alt_phone as string) ?? undefined,
        email: (guardianRow.email as string) ?? undefined,
        relationship: (guardianRow.relationship as string) ?? undefined,
      },
    };
```

using whatever local variable names the existing function already has for the fetched student row and guardian row (adjust the two property accesses above to match those exact variable names — do not introduce new queries; reuse what the function already fetched before its previous `return null`). Wrap the previously-returned `StudentAccount` case as `{ kind: "account", account: ... }` using the existing return value.

Add `createBillForTerm` (after `updateBillLines`):

```ts
  async createBillForTerm(
    studentId: string,
    term: TermName,
    billLines: BillLineInput[],
    discountKobo?: number,
    discountReason?: string,
  ): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    const clean = billLines
      .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
      .map((l) => ({ name: l.name.trim(), amount_kobo: l.amountKobo }));
    if (clean.length === 0) throw new Error("A bill needs at least one item.");

    const { data: existing } = await client
      .from("bills")
      .select("id")
      .eq("student_id", studentId)
      .eq("term", term)
      .maybeSingle();

    let billId = existing?.id as string | undefined;
    if (billId) {
      await client
        .from("bills")
        .update({
          discount_kobo: Math.max(0, discountKobo ?? 0),
          discount_reason: discountReason ?? null,
        })
        .eq("id", billId);
      await client.from("bill_lines").delete().eq("bill_id", billId);
    } else {
      const { data: bill, error } = await client
        .from("bills")
        .insert({
          school_id: school.id,
          student_id: studentId,
          session_id: session?.id ?? null,
          term,
          discount_kobo: Math.max(0, discountKobo ?? 0),
          discount_reason: discountReason ?? null,
        })
        .select("id")
        .single();
      if (error || !bill) throw new Error("Couldn't create the bill. Please try again.");
      billId = bill.id as string;
    }

    const { error: lineErr } = await client
      .from("bill_lines")
      .insert(clean.map((l) => ({ bill_id: billId, ...l })));
    if (lineErr) throw new Error("Couldn't save the bill items. Please try again.");
  },
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If the `getStudentAccount` edit in Step 7 doesn't compile because the existing function's variable names differ from the placeholders above, read the actual function body and adjust the two property lookups to match — do not change any other part of the function.

- [ ] **Step 9: Update every caller of getStudentAccount**

`getStudentAccount`'s return shape changed. There are exactly four other call
sites besides `students/[id]/page.tsx` (handled in Step 10):

**`src/app/entry/page.tsx`** — around line 145, inside the payment `submit()`
function, change:
```tsx
      const refreshed = await repository.getStudentAccount(account.student.id, term);
      setDone({ payment, account: refreshed ?? account });
```
to:
```tsx
      const refreshed = await repository.getStudentAccount(account.student.id, term);
      setDone({ payment, account: refreshed?.kind === "account" ? refreshed.account : account });
```

**`src/app/pay/page.tsx`** — the `PayForm` component fetches the account once
near the top (around line 150) and uses `account.X` throughout the rest of
the component. Unwrap once, right after the existing not-found guard, so the
remaining ~60 lines of `account.X` usage need no further changes. Change:
```tsx
  const { data: account, loading } = useAsync(
    () => repository.getStudentAccount(studentId, term),
    [studentId, term],
  );

  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading && !account) return <LoadingBlock label="Loading student…" />;
  if (!account)
    return (
      <Card>
        <p className="text-ink">This student has no bill for {termLabel(term)}.</p>
      </Card>
    );
```
to:
```tsx
  const { data: result, loading } = useAsync(
    () => repository.getStudentAccount(studentId, term),
    [studentId, term],
  );

  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading && !result) return <LoadingBlock label="Loading student…" />;
  if (!result || result.kind === "billless")
    return (
      <Card>
        <p className="text-ink">This student has no bill for {termLabel(term)}.</p>
      </Card>
    );
  const account = result.account;
```
Then, further down (around line 192), change:
```tsx
      const refreshed = await repository.getStudentAccount(studentId, term);
      onRecorded(payment, refreshed ?? account!);
```
to:
```tsx
      const refreshed = await repository.getStudentAccount(studentId, term);
      onRecorded(payment, refreshed?.kind === "account" ? refreshed.account : account);
```
(the `!` on `account` is no longer needed since `account` is now a definite
`StudentAccount` after the unwrap above, not a possibly-null `useAsync` result).

**`src/lib/data/bills.repo.test.ts`** — both `getStudentAccount` calls (around
lines 34 and 72) assert directly on the old shape. Change each occurrence of:
```ts
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toEqual(
```
to:
```ts
    const result = await repo.getStudentAccount(student.id, "first");
    expect(result?.kind).toBe("account");
    const acct = result?.kind === "account" ? result.account : undefined;
    expect(acct?.bill.lines).toEqual(
```
and the second occurrence's:
```ts
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toHaveLength(2);
```
to:
```ts
    const result = await repo.getStudentAccount(student.id, "first");
    expect(result?.kind).toBe("account");
    const acct = result?.kind === "account" ? result.account : undefined;
    expect(acct?.bill.lines).toHaveLength(2);
```
(leave the rest of each test's `acct?.X` assertions below these lines exactly
as they are — `acct` still resolves to a `StudentAccount | undefined` after
this change, so they continue to compile and run unchanged).

- [ ] **Step 10: Add the billless state + Generate Bill UI**

In `src/app/students/[id]/page.tsx`:

- Import `BillLineInput` type is not needed directly; import `draftFromItems` from `@/components/BillPicker` (already imported) and reuse `BillPicker`.
- Change the `account` destructure: the `useAsync` call now returns `StudentAccountOrBillless | null`. Rename the fetched value and branch:

```tsx
  const { data: result, loading, reload } = useAsync(
    () => repository.getStudentAccount(params.id, term),
    [params.id, term],
  );

  if (loading && !result) return <LoadingBlock label="Loading student…" />;
  if (!result)
    return (
      <div>
        <BackLink />
        <EmptyState title="Student not found" description="This record may have been removed." />
      </div>
    );

  if (result.kind === "billless") {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex items-center gap-3">
          <Avatar first={result.student.firstName} last={result.student.lastName} />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-ink">
              {result.student.firstName} {result.student.lastName}
            </h1>
            <p className="text-sm text-ink-muted">
              {result.className} · {result.student.admissionNo}
            </p>
          </div>
        </div>
        <EmptyState
          title="No bill for this term yet"
          description={`${result.guardian.fullName} · ${result.guardian.phone}`}
        />
        {can(role, "manage_students") && (
          <GenerateBillCard studentId={result.student.id} term={term} onGenerated={reload} />
        )}
      </div>
    );
  }

  const { student, guardian, className, status, outstanding } = result.account;
  const account = result.account;
```

Replace every subsequent reference to the old top-level `account` variable in the rest of the component (the `<RecordTabs account={account} .../>` prop and any other direct uses below this point) so they read `result.account` or the new local `account` const defined above — the local `const account = result.account;` line keeps the rest of the file's existing code (which already references `account.bill`, `account.payments`, etc. inside `RecordTabs` and other places) working unchanged.

Add `GenerateBillCard` (new component in this file, near `BillEditor`):

```tsx
function GenerateBillCard({
  studentId,
  term,
  onGenerated,
}: {
  studentId: string;
  term: TermName;
  onGenerated: () => void;
}) {
  const [draft, setDraft] = useState<BillDraft>({
    lines: [{ name: "", amountKobo: 0, checked: true }],
    discountKobo: 0,
    discountReason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function generateFromStructure() {
    setError(null);
    setSaving(true);
    try {
      await repository.generateBill(studentId, term);
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the bill.");
    } finally {
      setSaving(false);
    }
  }

  async function saveManualBill() {
    setError(null);
    const lines = checkedLines(draft);
    if (lines.length === 0) return setError("Add at least one item to the bill.");
    setSaving(true);
    try {
      await repository.createBillForTerm(
        studentId,
        term,
        lines.map((l) => ({ name: l.name, amountKobo: l.amountKobo })),
        draft.discountKobo,
        draft.discountReason.trim() || undefined,
      );
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-ink">Generate Bill</p>
      <p className="text-sm text-ink-muted">
        Use the class fee structure if one is set, or type the bill by hand.
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button onClick={generateFromStructure} disabled={saving} className="w-full">
        {saving ? "Generating…" : "Generate from class fee structure"}
      </Button>
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-semibold text-ink">Or enter manually</p>
        <BillPicker value={draft} onChange={setDraft} />
        <Button onClick={saveManualBill} disabled={saving} className="mt-3 w-full">
          {saving ? "Saving…" : "Save bill"}
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 11: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors. If `npm run build` fails only on Google Fonts network fetch (unrelated to code), rely on `tsc --noEmit` passing cleanly instead.

- [ ] **Step 12: Commit**

```bash
git add src/lib/domain/types.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts src/app/students/[id]/page.tsx src/app/entry/page.tsx src/app/pay/page.tsx src/lib/data/bills.repo.test.ts src/lib/data/__tests__/registration.test.ts
git commit -m "fix: billless getStudentAccount + Generate Bill action (was silent 404)"
```

---

### Task 3: approveRegistration + declineRegistration

The approval workflow's core write path, including the safe-delete rule.

**Files:**
- Modify: `src/lib/data/repository.ts` (interface + `DeclineResult`)
- Modify: `src/lib/data/mock.ts` (both methods)
- Modify: `src/lib/data/supabase-repo.ts` (both methods)
- Test: `src/lib/data/__tests__/registration.test.ts` (append)

**Interfaces:**
- Produces:
  - `interface DeclineResult { outcome: "deleted" | "withdrawn" }`
  - `Repository.approveRegistration(studentId: string): Promise<void>`
  - `Repository.declineRegistration(studentId: string): Promise<DeclineResult>`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/data/__tests__/registration.test.ts
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
```

Add `SCHOOL` to the test file's import from `@/lib/data/seed` (`import { SCHOOL } from "@/lib/data/seed";`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: FAIL — `approveRegistration`/`declineRegistration` are not functions.

- [ ] **Step 3: Update the repository interface**

In `src/lib/data/repository.ts`, add near the student methods:

```ts
  /** Convert a pending (pre-registered) student into a fully active one. */
  approveRegistration(studentId: string): Promise<void>;
  /**
   * If the student has no payments recorded anywhere, deletes the student,
   * guardian, and bill entirely. If any payment exists, sets status to
   * "withdrawn" instead so the receipt trail is never touched.
   */
  declineRegistration(studentId: string): Promise<DeclineResult>;
```

Add:

```ts
export interface DeclineResult {
  outcome: "deleted" | "withdrawn";
}
```

- [ ] **Step 4: Implement in the mock repository**

In `src/lib/data/mock.ts`, add after `createStudent` (or any student-methods block):

```ts
  async approveRegistration(studentId: string): Promise<void> {
    await tick();
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) throw new Error("Student not found.");
    student.status = "active";
  },

  async declineRegistration(studentId: string): Promise<DeclineResult> {
    await tick();
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) throw new Error("Student not found.");
    const studentBillIds = BILLS.filter((b) => b.studentId === studentId).map((b) => b.id);
    const hasPayments = PAYMENTS.some((p) => studentBillIds.includes(p.billId));
    if (hasPayments) {
      student.status = "withdrawn";
      return { outcome: "withdrawn" };
    }
    // No money trail: safe to remove the student, their bills, and their guardian.
    for (let i = BILLS.length - 1; i >= 0; i--) {
      if (BILLS[i].studentId === studentId) BILLS.splice(i, 1);
    }
    const idx = STUDENTS.findIndex((s) => s.id === studentId);
    if (idx >= 0) STUDENTS.splice(idx, 1);
    const gIdx = GUARDIANS.findIndex((g) => g.id === student.guardianId);
    if (gIdx >= 0) GUARDIANS.splice(gIdx, 1);
    return { outcome: "deleted" };
  },
```

Add `DeclineResult` to the mock's repository-type import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/registration.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, add `DeclineResult` to the repository-type import, then add:

```ts
  async approveRegistration(studentId: string): Promise<void> {
    const { error } = await sb()
      .from("students")
      .update({ status: "active" })
      .eq("id", studentId);
    if (error) throw new Error("Couldn't approve this registration. Please try again.");
  },

  async declineRegistration(studentId: string): Promise<DeclineResult> {
    const client = sb();
    const { data: student, error: sErr } = await client
      .from("students")
      .select("id, guardian_id")
      .eq("id", studentId)
      .maybeSingle();
    if (sErr || !student) throw new Error("Student not found.");

    const { data: bills } = await client
      .from("bills")
      .select("id")
      .eq("student_id", studentId);
    const billIds = (bills ?? []).map((b) => b.id as string);

    let hasPayments = false;
    if (billIds.length > 0) {
      const { count } = await client
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("bill_id", billIds);
      hasPayments = (count ?? 0) > 0;
    }

    if (hasPayments) {
      const { error } = await client
        .from("students")
        .update({ status: "withdrawn" })
        .eq("id", studentId);
      if (error) throw new Error("Couldn't decline this registration. Please try again.");
      return { outcome: "withdrawn" };
    }

    // No payments anywhere for this student: safe to remove entirely.
    // Delete the student first (bills/bill_lines cascade from it), then the
    // guardian, which nothing references once the student row is gone.
    const { error: delErr } = await client.from("students").delete().eq("id", studentId);
    if (delErr) throw new Error("Couldn't remove this record. Please try again.");
    if (student.guardian_id) {
      await client.from("guardians").delete().eq("id", student.guardian_id as string);
    }
    return { outcome: "deleted" };
  },
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Live smoke test the payments guard**

Via Supabase MCP `execute_sql` against project `pbrirletzhvanmmxithr`: confirm the exact cascade fact this task depends on.

```sql
select confdeltype from pg_constraint
where conrelid = 'payments'::regclass and confrelid = 'students'::regclass;
```
Expected: `c` (cascade) — confirming the danger this task's ordering and guard protect against is real, not hypothetical.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts src/lib/data/__tests__/registration.test.ts
git commit -m "feat: approveRegistration + declineRegistration (safe delete-or-withdraw)"
```

---

### Task 4: Students page Active / Pending filter

**Files:**
- Modify: `src/app/students/page.tsx`

**Interfaces:**
- Consumes: `StudentAccount.student.status` (existing field, now can be `"pending"`).

- [ ] **Step 1: Add the status filter state + client-side filter**

In `src/app/students/page.tsx`, add state near the other filters:

```tsx
  const [enrollment, setEnrollment] = useState<"active" | "pending">("active");
```

In the `rows` `useMemo`, add the enrollment check alongside the existing `matchQ`/`matchL`/`matchS` checks:

```tsx
      const matchE = a.student.status === enrollment;
      return matchQ && matchL && matchS && matchE;
```

Add `enrollment` to the `useMemo` dependency array.

- [ ] **Step 2: Compute the pending count and render the tab**

Above the filter row, compute the count from the unfiltered `data`:

```tsx
  const pendingCount = (data ?? []).filter((a) => a.student.status === "pending").length;
```

Add a segmented control before the existing search/level/status filter row:

```tsx
      <div className="mb-3 inline-flex rounded-xl border border-border bg-surface-sunken p-1">
        {(["active", "pending"] as const).map((e) => (
          <button
            key={e}
            onClick={() => resetPage(setEnrollment)(e)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              enrollment === e
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {e === "active" ? "Active" : `Pending (${pendingCount})`}
          </button>
        ))}
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/students/page.tsx
git commit -m "feat: Active/Pending filter on the Students page"
```

---

### Task 5: Approve / Decline UI on the student detail page

**Files:**
- Modify: `src/app/students/[id]/page.tsx`

**Interfaces:**
- Consumes: `repository.approveRegistration`, `repository.declineRegistration` (Task 3).

- [ ] **Step 1: Add the pending-actions card**

In `src/app/students/[id]/page.tsx`, after the `const account = result.account;` line added in Task 2 Step 10, add:

```tsx
  const isPending = student.status === "pending";
```

(`student` is already destructured from `result.account` on the existing `const { student, guardian, className, status, outstanding } = result.account;` line.)

Render a card right after the balance `<Card>` block, before `<RecordTabs .../>`, only when pending and permitted:

```tsx
      {isPending && can(role, "manage_students") && (
        <PendingRegistrationCard
          studentId={student.id}
          studentName={`${student.firstName} ${student.lastName}`}
          onChanged={() => { reload(); router.push("/students"); }}
        />
      )}
```

Add `useRouter` from `next/navigation` and call it near the top of the component (`const router = useRouter();`) if not already present in this file (check the existing imports first; the file already imports `useParams` from `next/navigation`, so add `useRouter` to that same import line).

- [ ] **Step 2: Implement PendingRegistrationCard**

Add this component near `GenerateBillCard`:

```tsx
function PendingRegistrationCard({
  studentId,
  studentName,
  onChanged,
}: {
  studentId: string;
  studentName: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  async function approve() {
    setError(null);
    setBusy(true);
    try {
      await repository.approveRegistration(studentId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve this registration.");
      setBusy(false);
    }
  }

  async function decline() {
    setError(null);
    setBusy(true);
    try {
      const result = await repository.declineRegistration(studentId);
      onChanged();
      void result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't decline this registration.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-warning/40 bg-warning-tint/30">
      <div>
        <p className="text-sm font-semibold text-ink">Pending registration</p>
        <p className="text-sm text-ink-muted">
          {studentName} is temporary until approved. Approve once payment is
          confirmed, or decline if they will not be enrolling.
        </p>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {!confirmingDecline ? (
        <div className="flex gap-3">
          <Button onClick={approve} disabled={busy} className="flex-1">
            {busy ? "Approving…" : "Approve Registration"}
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmingDecline(true)}
            disabled={busy}
          >
            Decline
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-tint p-3">
          <p className="text-sm text-ink">
            If no payment has been recorded, this deletes the record entirely.
            If a payment exists, the record is marked withdrawn and kept for
            accounting. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={decline} disabled={busy} className="flex-1">
              {busy ? "Working…" : "Confirm decline"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDecline(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors (or only the unrelated Google Fonts network failure — rely on `tsc --noEmit` in that case).

- [ ] **Step 3: Commit**

```bash
git add src/app/students/[id]/page.tsx
git commit -m "feat: Approve Registration / Decline actions on pending students"
```

---

### Task 6: Printable provisional bill

Confirm and, if needed, wire a print path for a pending student's bill using the existing receipt-print pattern, so it can be handed to a parent before any payment exists.

**Files:**
- Modify: `src/app/students/[id]/page.tsx`

**Interfaces:**
- Consumes: the existing `printReceipt(p: Payment, account: StudentAccount)` pattern in this file as a model; `esc`, `formatNaira` already imported/defined in this file.

- [ ] **Step 1: Add a bill-only print function**

Add `printBill` near `printReceipt` in `src/app/students/[id]/page.tsx`, following the same window.open + HTML-string pattern (reuse the same inline `<style>` block `printReceipt` uses):

```tsx
function printBill(account: StudentAccount, schoolName: string | undefined) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  const rows = account.bill.lines
    .map((l) => `<tr><td>${esc(l.name)}</td><td>${formatNaira(l.amount)}</td></tr>`)
    .join("");
  const discountRow =
    account.bill.discount > 0
      ? `<tr><td>Discount${account.bill.discountReason ? ` (${esc(account.bill.discountReason)})` : ""}</td><td>-${formatNaira(account.bill.discount)}</td></tr>`
      : "";
  w.document.write(`<!DOCTYPE html><html><head><title>Provisional Bill</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 360px; margin: 20px auto; color: #1b2a3c; }
  h2 { text-align: center; margin: 0 0 4px; font-size: 18px; }
  .sub { text-align: center; color: #4a5568; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 6px 0; border-bottom: 1px solid #dcd6c4; }
  td:last-child { text-align: right; font-weight: 600; font-family: monospace; }
  .total { font-size: 20px; text-align: center; margin: 16px 0; font-weight: 700; font-family: monospace; }
  .footer { text-align: center; font-size: 11px; color: #54677f; margin-top: 20px; }
  @media print { button { display: none; } }
</style></head><body>
<h2>Provisional Bill</h2>
<p class="sub">${esc(schoolName ?? "")} · ${esc(account.className)}</p>
<table>
  <tr><td>Student</td><td>${esc(account.student.firstName)} ${esc(account.student.lastName)}</td></tr>
  ${rows}
  ${discountRow}
</table>
<p class="total">${formatNaira(account.billTotal)}</p>
<p class="footer">This bill is provisional until registration is approved.</p>
<script>window.print()</script>
</body></html>`);
  w.document.close();
}
```

- [ ] **Step 2: Add a Print Bill button on the pending student's balance card**

In the balance `<Card>` block (the one showing "Outstanding" and the "Record payment" button), add a Print Bill button next to it when the student is pending:

```tsx
          {isPending && (
            <Button variant="ghost" onClick={() => printBill(account, school?.name)}>
              <PrintIcon width={18} height={18} />
              Print bill
            </Button>
          )}
```

Place this inside the same flex row as the existing "Record payment" `Link`/`Button`, so both can appear together for a pending student who has not yet paid.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/students/[id]/page.tsx
git commit -m "feat: printable provisional bill for pending students"
```

---

### Task 7: Full verification + security audit + build

**Files:** none (verification only; commit fixes if any).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all Vitest files pass (registration, plus every existing suite).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no type errors. If `npm run build` fails only with Google Fonts "Error while requesting resource" / "module-not-found" for `next/font/google`, that is a network issue unrelated to this feature (observed earlier in this session); treat `tsc --noEmit` passing as the authoritative signal and note the network failure rather than treating it as a regression. If build fails for any other reason, fix it.

- [ ] **Step 3: Post-build security audit**

Run the saved adversarial audit prompt. Live checks via Supabase MCP `get_advisors` (security) for `pbrirletzhvanmmxithr`, and confirm:
- `students` policies unchanged in shape (`manage_students` still `for all`, scoped `school_id = auth_school_id()` AND role in proprietor/bursar, with `WITH CHECK`) — this feature adds no new policy, it relies on the existing one covering UPDATE (approve) and DELETE (decline).
- The `student_status` enum now includes `'pending'` (re-run the `enum_range` query from Task 1).
- Re-confirm the `payments` -> `students` cascade fact from Task 3 Step 8 one more time as a final sanity check, since it is the load-bearing safety fact of this whole feature.
- No new advisor findings beyond the 3 long-accepted WARNs (`auth_role`/`auth_school_id` SECURITY DEFINER, leaked-password protection).

- [ ] **Step 4: Manual reasoning check on the decline path (no live destructive test)**

Do not run a live delete/decline against the production-seeded school in Supabase — the mock tests in Task 3 already prove the logic (hard-delete when payment-free, soft-withdraw when paid). Instead, re-read the `declineRegistration` implementation in `supabase-repo.ts` one more time and confirm by inspection: the payments count check happens strictly before the delete call in every code path, with no branch that reaches `.delete()` without first confirming `hasPayments === false`.

- [ ] **Step 5: Commit any fixes + push**

```bash
git add -A
git commit -m "chore: verify temp registration + generate bill (tests, build, security audit)"
git push origin develop
```

---

## Self-Review

**Spec coverage:**
- `Student.status` gains `"pending"`, one table -> Task 1.
- Add Student temporary-registration toggle -> Task 1.
- Provisional bill generated at creation via existing `createStudent` billLines path (unchanged) -> Task 1 (no code change needed here; already true today, only `status` is new).
- Generate Bill action fixing the 404 gap, billless `getStudentAccount` shape -> Task 2.
- `createBillForTerm` for the manual-entry path -> Task 2.
- `approveRegistration` -> Task 3.
- `declineRegistration` with the payments-first safety rule and correct delete order -> Task 3, reinforced in Task 7.
- Students page Active/Pending filter (client-side, not a repository param, per the corrected spec) -> Task 4.
- Approve/Decline UI with irreversible-action confirmation copy -> Task 5.
- Printable provisional bill -> Task 6.
- Security: no new tables/policies, existing `manage_students` policy covers the new writes, the cascade danger is explicitly guarded and live-verified -> Task 3 Step 8, Task 7 Step 3.
- No em-dashes -> Global Constraints; all copy in this plan uses colons/periods.
- Security audit before + after -> Global Constraints + Task 7.

**Placeholder scan:** Task 2 Step 7 (Supabase `getStudentAccount`) is the one
step whose exact edit depends on reading the existing function's local
variable names first, since the function was not fully transcribed during
planning — the step gives the precise transformation to apply once those
names are read, not a vague "handle it." Step 9's four call sites (`entry`,
`pay`, `bills.repo.test.ts`) were individually read during planning and are
given as complete, exact diffs, not placeholders. No other TBD/vague steps;
every other code step has real, complete code.

**Type consistency:** `StudentStatus`, `CreateStudentInput.status`, `StudentAccountOrBillless`, `DeclineResult`, `approveRegistration`, `declineRegistration`, `createBillForTerm` are used identically across Tasks 1-6. `BillLineInput` (existing type) is reused, not redefined. The `student.status === "pending"` check in Task 5 matches the exact string literal used in Task 1's toggle and Task 4's filter.
