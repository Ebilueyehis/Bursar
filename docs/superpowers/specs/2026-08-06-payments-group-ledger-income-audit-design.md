# Payments Group: Ledger, Income, Expense, Audit Trail — Design Spec

**Date:** 2026-08-06
**Status:** Approved (brainstorm), pending implementation plan
**Milestone:** M2 (continues first-run readiness / money hub)

## Problem

Money features are scattered: the Ledger is a top-level nav item, expenses are
logged via the New Entry toggle, and there is no way to record cash-in that is
not a student fee (donations, grants, uniform sales, hall rental). There is also
no accountability record of who changed a money entry. Small schools need one
grouped "Payments" area that logs and reviews every kind of money movement and
keeps an audit trail.

## Goal

A single **Payments** hub grouping four subsections:

- **Ledger** — the combined daily cashbook (all money in and out).
- **Income** — log and review non-fee income.
- **Expense** — log and review expenses (reuses the existing expense flow).
- **Audit trail** — a read-only, append-only record of money-entry changes.

Out of scope: reworking the student fee-payment flow (it keeps its
receipt-issuing home under New Entry / Students), reconciliation, and online
payment (both parked to a future version).

## Navigation / Information architecture

- Replace the flat **Ledger** primary-nav item with **Payments**, routing to
  `/payments`. Same tabbed-panel pattern as the Profile hub (a panel switcher,
  not separate routes), so it works on mobile and keeps the bottom bar to one
  item.
- Tabs, in order: **Ledger** (default), **Income**, **Expense**, **Audit
  trail**.
- The **New Entry** button and `/entry` stay as the fast fee-payment path
  (money-in against a student, issues a receipt). Fee payments still appear in
  the Ledger and Audit trail; they are not re-homed.
- `AppShell` TITLES and PRIMARY_NAV update: `/ledger` route may redirect to
  `/payments` (Ledger tab) or be retired; the nav label becomes "Payments".
- The whole hub is gated to `view_ledger` (proprietor + bursar). Teachers see
  the same "for the Proprietor and Bursar" empty state the ledger shows today.

## Income model (new)

A new domain type and table for non-fee cash-in, not tied to a student.

```ts
export interface Income {
  id: string;
  schoolId: string;
  source: string;        // Donation, Uniform sales, Hall rental, Grant, PTA, Other
  description: string;
  amount: Kobo;
  receivedOn: string;    // ISO date
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}
```

- Seeded `INCOME_SOURCES` list (free text, editable): Donation, Grant, Uniform
  sales, Book sales, Hall rental, PTA, Other.
- Repository methods: `listIncome(filter?: DateFilter)`, `createIncome(input)`,
  `updateIncome(id, patch)`, `deleteIncome(id)` — mirroring the existing expense
  methods so the UI and audit behave consistently. `CreateIncomeInput` mirrors
  `CreateExpenseInput` minus expense-only fields (no category/cadence/staff).
- Income posts to the Ledger as a credit (money in).

## Expense (reuse, relocate)

No model change. The existing expense form (`ExpenseEntry` logic) and the
`/expenses` list move under Payments > Expense. The New Entry expense toggle is
removed once expense logging lives in the hub (New Entry becomes payment-only),
to avoid two doors to the same action.

## Ledger integration

`LedgerEntry.kind` gains `"income"`. `getLedger` includes income entries as
credits (`direction: "in"`) alongside fee payments (in) and expenses (out).
Running-balance, filters, pagination, and Excel export are unchanged in shape;
they simply include income. Income rows link to nothing (no student), expense
rows behave as today.

## Audit trail (accountability)

An append-only `audit_log`, written by **Postgres triggers**, not by
application code, so it cannot be bypassed by a forgotten call.

```
audit_log (
  id          uuid pk,
  school_id   uuid not null,
  actor_id    uuid,            -- auth.uid() at time of change
  actor_name  text,            -- resolved display name for easy reading
  action      text not null,   -- 'created' | 'edited' | 'deleted'
  entity      text not null,   -- 'payment' | 'expense' | 'income'
  entity_id   uuid,
  summary     text not null,   -- human line, e.g. "Expense to PHCN"
  amount_kobo bigint,
  created_at  timestamptz not null default now()
)
```

- A `SECURITY DEFINER` trigger function fires `AFTER INSERT OR UPDATE OR DELETE`
  on `payments`, `expenses`, and `income`. It derives `school_id` from the
  affected row, `actor_id` from `auth.uid()`, `actor_name` by looking up the
  profile, maps TG_OP to the action, and writes a summary + amount.
- RLS: `audit_log` is **read-only to the client** — a select policy for
  `view_ledger` roles in the same school; **no** insert/update/delete policy, so
  the client can neither forge nor erase entries. Rows are inserted only by the
  trigger function (running as definer), never via the API.
- Grants: `select` only to `authenticated`; the table is otherwise closed.
- UI: a read-only tab, newest first, with the same type/date filters and Export
  as the ledger. Columns: When, Who, Action, Entity, Summary, Amount.

**Honest limitation (documented in the UI copy and the plan):** the trigger
records the database actor and the change, giving real accountability for a
single trusted-staff school (who changed what, when). It is not adversarial
anti-fraud forensics; a determined admin with direct database credentials is out
of scope for this control. This matches Bursar's threat model (trusted staff
within one school; RLS as the tenant boundary).

## Data changes

Two new tables: `income`, `audit_log`. One enum value added to the domain
`LedgerEntry.kind` union (TypeScript only).

- `income`: same tenancy + RLS shape as `expenses` — `manage_income` policy
  `for all` scoped to `school_id = auth_school_id()` AND
  `auth_role() in ('proprietor','bursar')`, with `WITH CHECK`. `select, insert,
  update, delete` granted to authenticated (RLS governs rows).
- `audit_log`: select-only policy (see above); trigger function is
  `SECURITY DEFINER set search_path = public`, `EXECUTE` revoked from public.
- Live migration applied to project `pbrirletzhvanmmxithr`; `supabase/schema.sql`
  updated to match (source of truth).

## Repository parity

Every method is implemented in BOTH `mock.ts` and `supabase-repo.ts`:
- `listIncome`, `createIncome`, `updateIncome`, `deleteIncome`
- `listAuditLog(filter?: DateFilter): Promise<AuditEntry[]>`
- `getLedger` extended to include income
- Mock simulates the audit trail in memory: its income/expense/payment mutations
  push an `AuditEntry` to an in-memory log so the Audit tab is populated in the
  mock backend too.

## Testing

- `getLedger` includes income as credits; running balance math with income +
  expenses + payments.
- Income CRUD round-trips in the mock (create, edit reduces/raises, delete
  removes) and each mutation appends the expected audit entry.
- Audit ordering (newest first), filtering by entity and date.
- Live smoke via Supabase MCP: insert/update/delete an income row and confirm
  three matching `audit_log` rows appear with correct action/actor/summary; then
  attempt a client-role insert/update/delete on `audit_log` and confirm RLS
  denies it.

## Voice / style

No em-dashes in app copy (colons or hyphens). Money is integer kobo, two
decimals in display. Audit and income copy follow the Bursar voice: plain,
says what it protects. Dark-mode surfaces follow the permanent-dark token rules
(no `bg-ink` for always-dark surfaces).

## Rollout / flexibility

The hub is thin tabs over existing data hooks plus two new ones. Reordering
tabs, relabeling, or restyling touches the hub file and the shared repository in
one place each. The audit trail is additive (triggers + a read-only view) and
does not change any existing write path's behavior.
