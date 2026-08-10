# Temporary Registration, Generate Bill & Approval Workflow — Design Spec

**Date:** 2026-08-06
**Status:** Approved (brainstorm), pending implementation plan
**Milestone:** M5 (Polish, continues student records)

## Problem

Schools need to give a provisional bill to prospective parents before the child
is committed as a student, and later convert that pre-registration into a real
active student once payment lands. Separately, a real bug exists today: any
student with no bill for the currently-viewed term makes `getStudentAccount`
return `null`, so the entire student detail page shows "Student not found"
with no way to fix it.

## Goal

- A **Generate Bill** action on any student (existing or pending) that has no
  bill for the current term, replacing the silent 404 with a real fix.
- An **Add Student** flow that supports registering a student as
  **Temporary / Pre-Registered**, immediately producing a printable
  provisional bill.
- An **approval workflow**: once payment lands against the provisional bill,
  the admin converts the pending record into a fully active student with one
  action.
- A safe path for pre-registrations that never convert, so they don't clutter
  the active roster, without ever discarding a receipt.

Out of scope: parent-facing self-registration, a separate `pending_students`
table, auto-expiry of stale pending records.

## Status model

`StudentStatus` gains `"pending"`:

```ts
export type StudentStatus = "active" | "graduated" | "withdrawn" | "pending";
```

One table, one record from day one. A pending student is a normal `Student`
row plus `status: "pending"`; it has a guardian and (usually) a bill exactly
like an active student, so no parallel data model or copy-on-approve step is
needed.

## Add Student: temporary registration

`src/app/students/new/page.tsx` gains a two-way toggle at the top of the form:
**Register now** (today's behavior, `status: "active"`) vs
**Temporary / Pre-registered** (`status: "pending"`). Everything else about
the form (class, bill picker, guardian fields) is identical either way — the
only difference is the `status` passed to `createStudent`. `CreateStudentInput`
gains `status?: StudentStatus` (default `"active"` when omitted, so existing
callers are unaffected).

The bill is generated at creation exactly as it is today (from `billLines`,
falling back to the class fee structure, falling back to a manual amount) —
this is the provisional bill. It can be printed immediately from the resulting
student detail page using the existing `Receipt` print pattern.

## Generate Bill (fixes the 404 gap)

Today, `getStudentAccount(studentId, term)` returns `null` whenever
`billFor(studentId, term)` finds nothing, and the student detail page shows
"Student not found" — indistinguishable from a genuinely missing student.

Fix:

- `getStudentAccount` is extended to also return a **billless** result instead
  of `null` when the student exists but has no bill for the term:
  `interface StudentAccountOrBillless { kind: "account"; account: StudentAccount } | { kind: "billless"; student: Student; className: string; guardian: Guardian }`.
  Genuinely missing students still resolve to `null`.
- The student detail page renders a **"No bill for this term yet"** state
  (student name, class, guardian visible) with a **Generate Bill** button,
  gated `manage_students`, instead of the current "Student not found" state.
- **Generate Bill** calls `repository.generateBill(studentId, term)` (already
  exists) when the class has a fee structure; when it doesn't, it opens the
  same `BillPicker` used at student creation so the admin can type a bill by
  hand, then calls `updateBillLines` (already exists) after an empty bill is
  first generated via a new minimal path: `createBillForTerm(studentId, term, billLines, discountKobo?, discountReason?)`
  on the repository, mirroring the bill-creation half of `createStudent`.
- After either path, the page reloads and shows the normal account view.

## Students page: Active / Pending filter

`listStudentAccounts(term)` has no status filter today and is shared by four
screens: `/students`, `/entry`, `/pay`, `/reports`. It must stay that way for
`/entry` and `/pay` — recording a payment against a pending student's
provisional bill is exactly how their registration gets approved, so those
screens need pending students visible. Adding a repository-level filter would
either break that or require per-caller opt-in plumbing for no real gain.

Instead, `src/app/students/page.tsx` filters the already-fetched
`StudentAccount[]` client-side on `account.student.status`, the same way it
already filters client-side on level and owing/cleared. It gains a segmented
filter, **Active** (default) / **Pending (n)**, mirroring that existing
pattern. No repository signature changes for this part. `getDashboardStats`
already filters its `studentCount` to `status === "active"` — unaffected, no
pending student ever inflates it. `/reports` is not touched by this spec; a
pending student's provisional bill can still count toward its per-class
totals, a pre-existing characteristic of `listStudentAccounts` this feature
does not change.

## Approve / Decline (the pending student's detail page)

On a pending student's detail page, two actions appear (gated
`manage_students`), replacing/alongside the normal payment actions:

- **Approve Registration** — `repository.approveRegistration(studentId)` sets
  `status: "active"`. No other data changes; the bill and any payments already
  recorded carry over untouched, because they were always real rows against a
  real student.
- **Decline** — `repository.declineRegistration(studentId)`, which branches
  server-side (not just in the UI, so it can't be bypassed by stale client
  state):
  - **No payments** ever recorded against the student's bill(s) → hard delete:
    removes the student, their guardian (if not shared — guardians aren't
    currently shared across students in this schema, so always removed), and
    their bill(s). Nothing to preserve.
  - **Any payment** exists → soft path: `status: "withdrawn"`. The student,
    guardian, bill, and payment/receipt/audit rows are all left untouched, so
    the accounting trail (including the audit trail's `deleted`/`edited`
    entries, if the trigger later fires on other tables) is never broken.
    `withdrawn` is the existing status value, so this needs no new status.

## Repository interface additions

```ts
approveRegistration(studentId: string): Promise<void>;
/** Hard-deletes if no payments exist; otherwise sets status to "withdrawn". */
declineRegistration(studentId: string): Promise<{ outcome: "deleted" | "withdrawn" }>;
createBillForTerm(
  studentId: string,
  term: TermName,
  billLines: BillLineInput[],
  discountKobo?: number,
  discountReason?: string,
): Promise<void>;
```

`CreateStudentInput.status?: StudentStatus` is an additive, backward-compatible
change to an existing method's input type.

Implemented in BOTH `mock.ts` and `supabase-repo.ts`.

## Security

- `manage_students` already gates all student writes; Generate Bill, Approve,
  and Decline are all gated the same way — no new permission needed.
- The no-payments-before-delete rule lives in the repository method itself
  (both backends independently check for payments before deleting), so a
  stale or tampered client cannot force a delete that would orphan a receipt.
  In Supabase this is additionally enforced by the existing `payments` table
  having no delete policy — a payment row can never be removed by the client
  regardless of what the student-delete call does, so even a buggy client
  implementation cannot destroy a receipt.
- No new tables, no RLS changes: `students`, `guardians`, `bills` already have
  `manage_students`/`manage_guardians`/`manage_bills` policies scoped to
  `school_id = auth_school_id()` AND role in proprietor/bursar. Full security
  audit before + after, as always.

## Testing

- Mock: `approveRegistration` flips status only, nothing else on the student
  or bill changes; `declineRegistration` hard-deletes when payment-free and
  soft-declines (sets `withdrawn`) when a payment exists, in both cases
  leaving other students untouched; `createBillForTerm` creates exactly one
  bill and is idempotent-safe against being called twice (second call is a
  normal `updateBillLines`-style replace, not a duplicate bill).
- `getStudentAccount` returns the new billless shape for a real student with
  no bill for the term, and still returns `null` for a genuinely unknown id.
- Add-student: `status: "pending"` round-trips through `createStudent` and
  the resulting account's `student.status` is `"pending"`; `status` omitted
  still defaults to `"active"` (regression check on existing behavior).
- Students page: given a mixed list of active and pending accounts from
  `listStudentAccounts`, the Active filter shows only active and the Pending
  filter shows only pending, with the pending count matching the badge.

## Voice / style

No em-dashes in app copy. "Temporary / Pre-registered", "Generate Bill",
"Approve Registration", "Decline" are the exact labels; Decline's confirmation
copy states plainly which path it will take (delete vs withdraw) before the
admin confirms, since one of the two is irreversible.

## Rollout / flexibility

Everything here is additive to the existing `students`/`bills`/`payments`
model; no existing write path changes shape. The billless-account fix is a
narrow addition to `getStudentAccount`'s return type, not a rewrite of the
account-building logic.
