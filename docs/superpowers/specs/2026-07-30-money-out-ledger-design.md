# Money-out + Ledger — Design (Bursar v1.1)

**Date:** 2026-07-30
**Branch:** `develop`
**Status:** Approved to build (user delegated the decision and said go ahead)

## Purpose

V1 tracks money **in** (fees, payments, debtors). This sub-project adds the other
half of a school's books: money **out** (expenses and staff salaries) and a single
**daily ledger** (cashbook) that shows every transaction — in and out — grouped by
day with running totals. This is the page a bursar looks at every day.

It is deliberately built as **one** sub-project because the ledger's "money out"
side *is* the expense system; splitting them would ship a half-empty ledger.

## Scope

In scope:

1. **Expenses** — record any money out, tagged with a **cadence** (one-off, monthly,
   yearly) and a free-text **category** (Rent, Utilities, Salary, …). Editable and
   deletable by Proprietor/Bursar (a cashbook needs corrections — unlike append-only
   receipts).
2. **Staff register + monthly payroll** — register staff (teaching/non-teaching, with
   the class they take for primary or the subjects for secondary, and a monthly
   salary). A **payroll run** for a chosen month generates one expense row per active
   staff member, guarded against double-running.
3. **Unified daily ledger** — `/ledger` merges payments (money in) and expenses
   (money out), grouped by day, showing per-day In / Out / Net and a running balance.

Out of scope (future): automatic recurring-charge generation (yearly rent reminders,
etc.), expense receipts/attachments, expense approval workflows, bank reconciliation.

## Data model (new tables)

All tables are school-scoped with RLS on, mirroring the existing pattern
(`school_id`, `auth_school_id()`), money as `bigint` kobo.

### `staff`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| school_id | uuid not null → schools | |
| full_name | text not null | |
| title | text | e.g. "Class Teacher", "Accountant" |
| employment_type | enum `staff_type` (`teaching`,`non_teaching`) not null | |
| assignment | text | class name (primary) or subjects (secondary), free text |
| monthly_salary_kobo | bigint not null default 0, check ≥ 0 | |
| phone | text | for future WhatsApp payslips |
| active | boolean not null default true | soft-retire, never hard-delete |
| created_at | timestamptz not null default now() | |

### `expenses` — the single money-out ledger
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| school_id | uuid not null → schools | |
| session_id | uuid → sessions | nullable; the session the spend falls in |
| payee | text not null | vendor / staff name |
| description | text not null | the service / what it was for |
| category | text not null | Rent, Utilities, Salary, Maintenance… (free text) |
| cadence | enum `expense_cadence` (`one_off`,`monthly`,`yearly`) not null default `one_off` | |
| amount_kobo | bigint not null, check > 0 | |
| spent_on | date not null default current_date | date of service/delivery |
| method | enum `pay_method` (reuse existing) not null default `cash` | |
| staff_id | uuid → staff | set when this is a salary payment |
| salary_period | text | `YYYY-MM` when it's a salary payment; else null |
| recorded_by | uuid → profiles | |
| recorded_by_name | text not null | |
| note | text | |
| created_at | timestamptz not null default now() | |

Unique `(staff_id, salary_period)` where both set → a staff member can't be paid
twice for the same month by the payroll run.

Indexes: `expenses (school_id, spent_on)`, `expenses (school_id, category)`,
`staff (school_id, active)`.

## RLS & grants

- **Read/manage staff & expenses:** Proprietor and Bursar only (money handlers).
  Teachers have no access. Policies mirror `manage_fees`:
  `using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))`
  with the same `with check`.
- Expenses **allow** UPDATE/DELETE (Proprietor/Bursar) — corrections are expected.
- Grants: extend the existing `grant … to authenticated` list to include `staff` and
  `expenses`; service_role already has blanket DML via default privileges.

## Repository interface additions

```ts
// Expenses
listExpenses(filter?: { from?: string; to?: string }): Promise<Expense[]>;
createExpense(input: CreateExpenseInput): Promise<Expense>;
updateExpense(id: string, patch: Partial<CreateExpenseInput>): Promise<Expense>;
deleteExpense(id: string): Promise<void>;

// Staff
listStaff(): Promise<Staff[]>;
createStaff(input: CreateStaffInput): Promise<Staff>;
updateStaff(id: string, patch: Partial<CreateStaffInput>): Promise<Staff>;
setStaffActive(id: string, active: boolean): Promise<void>;

// Payroll
previewPayroll(period: string): Promise<PayrollPreview>;   // active staff not yet paid for YYYY-MM
runPayroll(period: string): Promise<{ created: number; skipped: number }>;

// Unified ledger
getLedger(filter?: { from?: string; to?: string }): Promise<LedgerDay[]>;
```

New domain types: `Staff`, `Expense`, `ExpenseCadence`, `LedgerEntry`
(`{ id, date, kind: 'payment'|'expense', direction: 'in'|'out', title, subtitle,
amount, method, reference }`), `LedgerDay`
(`{ date, entries, totalIn, totalOut, net }`).

Both `supabase-repo.ts` and `mock.ts` implement the additions so the mock stays a
drop-in for tests/prototyping.

## UI / routes

- **`/ledger`** — daily cashbook. Date-grouped cards, each entry a mono money row
  (green in / brick out), per-day In/Out/Net header, optional date-range filter.
- **`/expenses`** — list + "Add expense" form (payee, description, category, cadence,
  date, amount, method, note). Entry point to Payroll.
- **`/staff`** — register: add/edit staff (name, teaching/non-teaching, assignment,
  monthly salary), list with active/retired, deactivate.
- **`/payroll`** — pick a month → preview active staff and amounts (flagging any
  already paid) → confirm → generate expense rows; show result summary.

All four gated to Proprietor + Bursar via new permissions `manage_expenses`,
`view_ledger` (add to `constants.ts`; `manage_staff` already exists — extend to
Bursar). Teachers never see these nav items.

**Navigation:** desktop sidebar gains Ledger, Expenses, Staff. Mobile bottom nav is
capped; add **Ledger** to the primary bar and reach Expenses/Staff/Payroll from within
Ledger/Expenses (secondary links) so the bottom bar stays uncluttered.

## Error handling & money safety

- All amounts entered in naira, converted to kobo via existing `money.ts` helpers;
  never float.
- Payroll run is idempotent per `(staff_id, salary_period)` — re-running a month skips
  already-paid staff and reports the count, never double-charges.
- Failed writes surface a plain-language message ("This expense couldn't be saved. No
  money was affected."), matching the payment flow's voice.

## Testing

- Mock repository unit tests: expense CRUD, staff CRUD, payroll idempotency
  (run twice → second run creates 0), ledger merge/ordering and per-day totals.
- Manual verification in the browser preview: add expense → appears in ledger; run
  payroll → salary rows appear; totals reconcile.

## Not changing

Existing fees/debtors/payments code, auth, onboarding, RLS on existing tables. This
sub-project is additive.
