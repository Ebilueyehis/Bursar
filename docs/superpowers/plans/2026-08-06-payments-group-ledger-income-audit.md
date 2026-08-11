# Payments Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group all money features into a `/payments` hub with Ledger, Income (all money in), Expense, and a trigger-written Audit trail.

**Architecture:** A new `income` table + domain type feeds a merged "money in" view and the shared ledger. An append-only `audit_log`, written by SECURITY DEFINER Postgres triggers on `payments`/`expenses`/`income`, records every money change and is client-read-only. The UI becomes a tabbed hub (Profile-hub pattern) whose tabs are thin views over the repository; the existing Ledger and Expense screens are extracted into reusable views.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS + triggers), Vitest.

## Global Constraints

- **No em-dashes** in any app copy. Use colons or hyphens. (Verbatim rule.)
- **Money is integer kobo.** Never float. Two decimals in display via existing helpers.
- **Security audit before AND after the build.** Full adversarial audit at execution kickoff and again in the final task. Live checks via Supabase MCP (project `pbrirletzhvanmmxithr`).
- **RLS is the security boundary.** `income` write policy is `for all` scoped to `school_id = auth_school_id()` AND `auth_role() in ('proprietor','bursar')` with `WITH CHECK`. `audit_log` has a SELECT-only policy and NO insert/update/delete policy or grant; rows arrive only via the trigger.
- **Trigger function** `log_money_change()` is `SECURITY DEFINER set search_path = public`, EXECUTE revoked from public.
- **Repository parity.** Every interface change is implemented in BOTH `mock.ts` and `supabase-repo.ts`. The mock simulates the audit trail in memory.
- **Permissions.** The whole `/payments` hub is gated to `view_ledger` (proprietor/bursar). Teachers get the existing "for the Proprietor and Bursar" empty state.
- **Dark mode.** No `bg-ink` for always-dark surfaces (it inverts). Use `#16212e` or `--hero-grad` tokens.

---

### Task 1: Income data layer

New `Income` domain type + table + CRUD in both repositories. No ledger/audit wiring yet.

**Files:**
- Modify: `src/lib/domain/types.ts` (Income type; LedgerEntry.kind union)
- Modify: `src/lib/domain/constants.ts` (INCOME_SOURCES)
- Modify: `src/lib/data/repository.ts` (interface + input type)
- Modify: `src/lib/data/mock.ts` (INCOME store + CRUD)
- Modify: `src/lib/data/supabase-repo.ts` (mapIncome + CRUD)
- Modify: `supabase/schema.sql` (income table + RLS + grant)
- Live: apply migration to `pbrirletzhvanmmxithr`
- Test: `src/lib/data/__tests__/income.test.ts`

**Interfaces:**
- Produces:
  - `interface Income { id: string; schoolId: string; source: string; description: string; amount: Kobo; receivedOn: string; method: PaymentMethod; note?: string; recordedByName: string }`
  - `interface CreateIncomeInput { source: string; description: string; amountKobo: number; receivedOn: string; method: PaymentMethod; note?: string; recordedByName: string }`
  - `LedgerEntry["kind"]` becomes `"payment" | "expense" | "income"`
  - `Repository.listIncome(filter?: DateFilter): Promise<Income[]>`
  - `Repository.createIncome(input: CreateIncomeInput): Promise<Income>`
  - `Repository.updateIncome(id: string, patch: CreateIncomeInput): Promise<Income>`
  - `Repository.deleteIncome(id: string): Promise<void>`
  - `INCOME_SOURCES: string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/income.test.ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("income CRUD (mock)", () => {
  it("creates, lists, edits and deletes an income entry", async () => {
    const created = await mockRepository.createIncome({
      source: "Donation",
      description: "PTA fundraiser",
      amountKobo: 50000_00,
      receivedOn: "2026-08-01",
      method: "transfer",
      recordedByName: "Mr. Emeka Okoro",
    });
    expect(created.id).toBeTruthy();

    const list = await mockRepository.listIncome();
    expect(list.find((i) => i.id === created.id)?.amount).toBe(50000_00);

    const edited = await mockRepository.updateIncome(created.id, {
      source: "Donation",
      description: "PTA fundraiser (revised)",
      amountKobo: 60000_00,
      receivedOn: "2026-08-01",
      method: "transfer",
      recordedByName: "Mr. Emeka Okoro",
    });
    expect(edited.amount).toBe(60000_00);

    await mockRepository.deleteIncome(created.id);
    const after = await mockRepository.listIncome();
    expect(after.find((i) => i.id === created.id)).toBeUndefined();
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      mockRepository.createIncome({
        source: "Grant",
        description: "bad",
        amountKobo: 0,
        receivedOn: "2026-08-01",
        method: "cash",
        recordedByName: "X",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/income.test.ts`
Expected: FAIL — `createIncome` is not a function.

- [ ] **Step 3: Add domain type + ledger kind**

In `src/lib/domain/types.ts`, after the `Expense` interface add:

```ts
/** Non-fee money the school takes in: donations, grants, sales, rentals. */
export interface Income {
  id: string;
  schoolId: string;
  source: string;
  description: string;
  amount: Kobo;
  receivedOn: string; // ISO date
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}
```

And change the `LedgerEntry.kind` field from:

```ts
  kind: "payment" | "expense";
```
to:
```ts
  kind: "payment" | "expense" | "income";
```

- [ ] **Step 4: Add the income sources constant**

In `src/lib/domain/constants.ts`, after `EXPENSE_CATEGORIES` add:

```ts
/** Common non-fee income sources for a Nigerian school. Seed only, free text. */
export const INCOME_SOURCES: string[] = [
  "Donation",
  "Grant",
  "Uniform sales",
  "Book sales",
  "Hall rental",
  "PTA",
  "Other",
];
```

- [ ] **Step 5: Add interface methods + input type**

In `src/lib/data/repository.ts`, add inside `interface Repository` (after the expense block):

```ts
  /** Non-fee income entries, newest first, optionally within a date range. */
  listIncome(filter?: DateFilter): Promise<Income[]>;
  createIncome(input: CreateIncomeInput): Promise<Income>;
  updateIncome(id: string, patch: CreateIncomeInput): Promise<Income>;
  deleteIncome(id: string): Promise<void>;
```

Add `Income` to the type import at the top of the file, and add the input type near `CreateExpenseInput`:

```ts
export interface CreateIncomeInput {
  source: string;
  description: string;
  amountKobo: number;
  receivedOn: string; // ISO date
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}
```

- [ ] **Step 6: Implement in the mock repository**

In `src/lib/data/mock.ts`, add an income store near the other stores (after `const FEE_ITEMS`):

```ts
const INCOME: Income[] = [];
```

Add `Income` to the domain type import and `CreateIncomeInput` to the repository-type import. Add the methods (place after `deleteExpense`):

```ts
  async listIncome(filter?: DateFilter): Promise<Income[]> {
    await tick();
    return INCOME.filter((i) => inRange(i.receivedOn, filter)).sort((a, b) =>
      b.receivedOn.localeCompare(a.receivedOn),
    );
  },

  async createIncome(input: CreateIncomeInput): Promise<Income> {
    await tick();
    if (input.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const income: Income = {
      id: `inc-new-${Date.now()}`,
      schoolId: SCHOOL.id,
      source: input.source,
      description: input.description,
      amount: input.amountKobo,
      receivedOn: input.receivedOn,
      method: input.method,
      note: input.note,
      recordedByName: input.recordedByName,
    };
    INCOME.push(income);
    return income;
  },

  async updateIncome(id: string, patch: CreateIncomeInput): Promise<Income> {
    await tick();
    if (patch.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const existing = INCOME.find((i) => i.id === id);
    if (!existing) throw new Error("Income entry not found.");
    Object.assign(existing, {
      source: patch.source,
      description: patch.description,
      amount: patch.amountKobo,
      receivedOn: patch.receivedOn,
      method: patch.method,
      note: patch.note,
    });
    return existing;
  },

  async deleteIncome(id: string): Promise<void> {
    await tick();
    const i = INCOME.findIndex((x) => x.id === id);
    if (i >= 0) INCOME.splice(i, 1);
  },
```

- [ ] **Step 7: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, add `Income` to the domain import and `CreateIncomeInput` to the repository-type import. Add a mapper near `mapExpense`:

```ts
function mapIncome(r: Row): Income {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    source: r.source as string,
    description: r.description as string,
    amount: Number(r.amount_kobo),
    receivedOn: r.received_on as string,
    method: r.method as Income["method"],
    note: (r.note as string) ?? undefined,
    recordedByName: r.recorded_by_name as string,
  };
}
```

Add the CRUD methods (after `deleteExpense`), mirroring the expense methods:

```ts
  async listIncome(filter?: DateFilter): Promise<Income[]> {
    const client = sb();
    let q = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) q = q.gte("received_on", filter.from);
    if (filter?.to) q = q.lte("received_on", filter.to);
    const { data } = await q;
    return (data ?? []).map(mapIncome);
  },

  async createIncome(input: CreateIncomeInput): Promise<Income> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    if (input.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data: { user } } = await client.auth.getUser();
    const { data, error } = await client
      .from("income")
      .insert({
        school_id: school.id,
        session_id: session?.id ?? null,
        source: input.source,
        description: input.description,
        amount_kobo: input.amountKobo,
        received_on: input.receivedOn,
        method: input.method,
        recorded_by: user?.id ?? null,
        recorded_by_name: input.recordedByName,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("This income couldn't be saved. Please try again.");
    return mapIncome(data);
  },

  async updateIncome(id: string, patch: CreateIncomeInput): Promise<Income> {
    const client = sb();
    if (patch.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data, error } = await client
      .from("income")
      .update({
        source: patch.source,
        description: patch.description,
        amount_kobo: patch.amountKobo,
        received_on: patch.receivedOn,
        method: patch.method,
        note: patch.note ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error("This income couldn't be updated.");
    return mapIncome(data);
  },

  async deleteIncome(id: string): Promise<void> {
    const { error } = await sb().from("income").delete().eq("id", id);
    if (error) throw new Error("This income couldn't be deleted.");
  },
```

- [ ] **Step 8: Update the source schema**

In `supabase/schema.sql`, add the table after the `expenses` table definition:

```sql
create table income (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  session_id       uuid references sessions(id),
  source           text not null,
  description      text not null,
  amount_kobo      bigint not null check (amount_kobo > 0),
  received_on      date not null,
  method           pay_method not null,
  recorded_by      uuid references profiles(id),
  recorded_by_name text not null,
  note             text,
  created_at       timestamptz not null default now()
);
```

Add to the "Turn on RLS" list: `alter table income enable row level security;`
Add the policies near `manage_expenses`:

```sql
create policy read_same_school on income
  for select using (school_id = auth_school_id());
create policy manage_income on income
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
```

Add `income` to the `grant select, insert, update, delete on table ... to authenticated;` list.

- [ ] **Step 9: Apply the live migration**

Use Supabase MCP `apply_migration` (project `pbrirletzhvanmmxithr`, name `add_income_table`):

```sql
create table if not exists income (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  session_id       uuid references sessions(id),
  source           text not null,
  description      text not null,
  amount_kobo      bigint not null check (amount_kobo > 0),
  received_on      date not null,
  method           pay_method not null,
  recorded_by      uuid references profiles(id),
  recorded_by_name text not null,
  note             text,
  created_at       timestamptz not null default now()
);
alter table income enable row level security;
drop policy if exists read_same_school on income;
create policy read_same_school on income
  for select using (school_id = auth_school_id());
drop policy if exists manage_income on income;
create policy manage_income on income
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
grant select, insert, update, delete on table income to authenticated;
```

Confirm with `execute_sql`: `select policyname, cmd from pg_policies where tablename='income';`
Expected: `read_same_school` (SELECT) and `manage_income` (ALL).

- [ ] **Step 10: Run tests + typecheck**

Run: `npx vitest run src/lib/data/__tests__/income.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/domain/types.ts src/lib/domain/constants.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts supabase/schema.sql src/lib/data/__tests__/income.test.ts
git commit -m "feat: income data layer (table, RLS, CRUD, mock + supabase)"
```

---

### Task 2: Ledger + merged money-in view

Income posts to the ledger; a merged "money in" view combines fee payments + income.

**Files:**
- Modify: `src/lib/data/repository.ts` (interface + IncomeRow type)
- Modify: `src/lib/data/mock.ts` (getLedger + listIncomeView)
- Modify: `src/lib/data/supabase-repo.ts` (getLedger + listIncomeView)
- Test: `src/lib/data/__tests__/incomeView.test.ts`

**Interfaces:**
- Consumes: `Income`, `createIncome` (Task 1).
- Produces:
  - `interface IncomeRow { kind: "fee" | "other"; id: string; date: string; source: string; description: string; amount: number; method: PaymentMethod; recordedByName: string; studentId?: string }`
  - `Repository.listIncomeView(filter?: DateFilter): Promise<IncomeRow[]>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/incomeView.test.ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("ledger + income view (mock)", () => {
  it("includes income as a credit in the ledger", async () => {
    await mockRepository.createIncome({
      source: "Hall rental",
      description: "Weekend event",
      amountKobo: 30000_00,
      receivedOn: "2026-08-02",
      method: "cash",
      recordedByName: "Bursar",
    });
    const days = await mockRepository.getLedger();
    const all = days.flatMap((d) => d.entries);
    const incomeEntry = all.find((e) => e.kind === "income");
    expect(incomeEntry).toBeTruthy();
    expect(incomeEntry!.direction).toBe("in");
  });

  it("merges fee payments and other income, newest first", async () => {
    await mockRepository.createIncome({
      source: "Donation",
      description: "Alumni gift",
      amountKobo: 10000_00,
      receivedOn: "2999-01-01", // far future so it sorts first
      method: "transfer",
      recordedByName: "Bursar",
    });
    const rows = await mockRepository.listIncomeView();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].kind).toBe("other");
    expect(rows.some((r) => r.kind === "fee")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/incomeView.test.ts`
Expected: FAIL — `listIncomeView` is not a function (and no income kind in ledger).

- [ ] **Step 3: Add the IncomeRow type + interface method**

In `src/lib/data/repository.ts` add near the other view types:

```ts
export interface IncomeRow {
  kind: "fee" | "other";
  id: string;
  date: string;
  source: string;
  description: string;
  amount: number; // kobo
  method: PaymentMethod;
  recordedByName: string;
  studentId?: string;
}
```

Add to `interface Repository`:

```ts
  /** Merged money-in view: fee payments + non-fee income, newest first. */
  listIncomeView(filter?: DateFilter): Promise<IncomeRow[]>;
```

- [ ] **Step 4: Implement in the mock repository**

In `src/lib/data/mock.ts`, extend `getLedger` to add income entries. After the expenses loop (before `return groupLedger(entries);`):

```ts
    for (const i of INCOME) {
      if (!inRange(i.receivedOn, filter)) continue;
      entries.push({
        id: i.id,
        date: i.receivedOn,
        kind: "income",
        direction: "in",
        title: i.source,
        subtitle: `${i.description} · ${i.method}`,
        amount: i.amount,
        method: i.method,
        reference: i.id,
      });
    }
```

Add `listIncomeView` (place after `listIncome`):

```ts
  async listIncomeView(filter?: DateFilter): Promise<IncomeRow[]> {
    await tick();
    const rows: IncomeRow[] = [];
    for (const p of PAYMENTS) {
      if (!inRange(p.paidOn, filter)) continue;
      rows.push({
        kind: "fee",
        id: p.id,
        date: p.paidOn,
        source: "School fee",
        description: studentName(p.studentId),
        amount: p.amount,
        method: p.method,
        recordedByName: p.recordedByName,
        studentId: p.studentId,
      });
    }
    for (const i of INCOME) {
      if (!inRange(i.receivedOn, filter)) continue;
      rows.push({
        kind: "other",
        id: i.id,
        date: i.receivedOn,
        source: i.source,
        description: i.description,
        amount: i.amount,
        method: i.method,
        recordedByName: i.recordedByName,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },
```

Add `IncomeRow` to the repository-type import in `mock.ts`.

- [ ] **Step 5: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, extend `getLedger` to also query income. After building the expenses query, add an income query and include it in the `Promise.all`, then append income entries:

```ts
    let iq = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) iq = iq.gte("received_on", filter.from);
    if (filter?.to) iq = iq.lte("received_on", filter.to);

    const [{ data: payments }, { data: expenses }, { data: incomeRows }] = await Promise.all([pq, eq, iq]);
```

(Replace the existing two-item destructure with this three-item one.) After the expenses loop, before `return groupLedger(entries);`:

```ts
    for (const row of incomeRows ?? []) {
      const inc = mapIncome(row);
      entries.push({
        id: inc.id,
        date: inc.receivedOn,
        kind: "income",
        direction: "in",
        title: inc.source,
        subtitle: `${inc.description} · ${inc.method}`,
        amount: inc.amount,
        method: inc.method,
        reference: inc.id,
      });
    }
```

Add `listIncomeView` after `listIncome`:

```ts
  async listIncomeView(filter?: DateFilter): Promise<IncomeRow[]> {
    const client = sb();
    let pq = client.from("payments").select("*").order("paid_on", { ascending: false });
    if (filter?.from) pq = pq.gte("paid_on", filter.from);
    if (filter?.to) pq = pq.lte("paid_on", filter.to);
    let iq = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) iq = iq.gte("received_on", filter.from);
    if (filter?.to) iq = iq.lte("received_on", filter.to);
    const [{ data: payments }, { data: incomeRows }] = await Promise.all([pq, iq]);

    const studentIds = [...new Set((payments ?? []).map((p) => p.student_id as string))];
    const nameById = new Map<string, string>();
    if (studentIds.length) {
      const { data: students } = await client
        .from("students")
        .select("id,first_name,last_name")
        .in("id", studentIds);
      (students ?? []).forEach((s) =>
        nameById.set(s.id as string, `${s.first_name} ${s.last_name}`),
      );
    }

    const rows: IncomeRow[] = [];
    for (const p of payments ?? []) {
      const pay = mapPayment(p);
      rows.push({
        kind: "fee",
        id: pay.id,
        date: pay.paidOn,
        source: "School fee",
        description: nameById.get(pay.studentId) ?? "Student",
        amount: pay.amount,
        method: pay.method,
        recordedByName: pay.recordedByName,
        studentId: pay.studentId,
      });
    }
    for (const row of incomeRows ?? []) {
      const inc = mapIncome(row);
      rows.push({
        kind: "other",
        id: inc.id,
        date: inc.receivedOn,
        source: inc.source,
        description: inc.description,
        amount: inc.amount,
        method: inc.method,
        recordedByName: inc.recordedByName,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },
```

Add `IncomeRow` to the repository-type import in `supabase-repo.ts`.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/data/__tests__/incomeView.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts src/lib/data/__tests__/incomeView.test.ts
git commit -m "feat: income posts to ledger + merged money-in view"
```

---

### Task 3: Audit trail (triggers + read + mock simulation)

Append-only `audit_log` written by DB triggers; a read method; the mock simulates it.

**Files:**
- Modify: `src/lib/domain/types.ts` (AuditEntry type)
- Modify: `src/lib/data/repository.ts` (interface method)
- Modify: `src/lib/data/mock.ts` (AUDIT store, pushAudit, wire into mutations, listAuditLog)
- Modify: `src/lib/data/supabase-repo.ts` (mapAudit + listAuditLog)
- Modify: `supabase/schema.sql` (audit_log table, trigger fn, triggers, RLS, grant)
- Live: apply migration to `pbrirletzhvanmmxithr`
- Test: `src/lib/data/__tests__/audit.test.ts`

**Interfaces:**
- Consumes: income/expense/payment mutations (Tasks 1 + existing).
- Produces:
  - `interface AuditEntry { id: string; actorName: string; action: "created" | "edited" | "deleted"; entity: "payment" | "expense" | "income"; entityId: string; summary: string; amount: number | null; createdAt: string }`
  - `Repository.listAuditLog(filter?: DateFilter): Promise<AuditEntry[]>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/audit.test.ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("audit trail (mock)", () => {
  it("records created/edited/deleted for income mutations", async () => {
    const created = await mockRepository.createIncome({
      source: "Grant",
      description: "State grant",
      amountKobo: 100000_00,
      receivedOn: "2026-08-03",
      method: "transfer",
      recordedByName: "Mrs. Adunni Bello",
    });
    await mockRepository.updateIncome(created.id, {
      source: "Grant",
      description: "State grant (revised)",
      amountKobo: 120000_00,
      receivedOn: "2026-08-03",
      method: "transfer",
      recordedByName: "Mrs. Adunni Bello",
    });
    await mockRepository.deleteIncome(created.id);

    const log = await mockRepository.listAuditLog();
    const forEntry = log.filter((a) => a.entity === "income" && a.entityId === created.id);
    expect(forEntry.map((a) => a.action)).toEqual(
      expect.arrayContaining(["created", "edited", "deleted"]),
    );
    // newest first
    const dates = log.map((a) => a.createdAt);
    expect([...dates].sort((x, y) => y.localeCompare(x))).toEqual(dates);
  });

  it("records an audit entry when an expense is created", async () => {
    const before = (await mockRepository.listAuditLog()).length;
    await mockRepository.createExpense({
      payee: "PHCN",
      description: "Electricity",
      category: "Utilities",
      cadence: "monthly",
      amountKobo: 25000_00,
      spentOn: "2026-08-03",
      method: "cash",
      recordedByName: "Bursar",
    });
    const after = await mockRepository.listAuditLog();
    expect(after.length).toBe(before + 1);
    expect(after[0].entity).toBe("expense");
    expect(after[0].action).toBe("created");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/audit.test.ts`
Expected: FAIL — `listAuditLog` is not a function.

- [ ] **Step 3: Add the AuditEntry type + interface method**

In `src/lib/domain/types.ts` add:

```ts
/** One immutable line in the money audit trail (who changed what, when). */
export interface AuditEntry {
  id: string;
  actorName: string;
  action: "created" | "edited" | "deleted";
  entity: "payment" | "expense" | "income";
  entityId: string;
  summary: string;
  amount: number | null; // kobo
  createdAt: string; // ISO timestamp
}
```

In `src/lib/data/repository.ts`, add `AuditEntry` to the domain import and add to `interface Repository`:

```ts
  /** Read-only money audit trail, newest first. */
  listAuditLog(filter?: DateFilter): Promise<AuditEntry[]>;
```

- [ ] **Step 4: Implement the mock audit simulation**

In `src/lib/data/mock.ts`, add the store + helper near the other stores:

```ts
const AUDIT: AuditEntry[] = [];

function pushAudit(
  action: AuditEntry["action"],
  entity: AuditEntry["entity"],
  entityId: string,
  summary: string,
  amount: number | null,
): void {
  AUDIT.push({
    id: `aud-${Date.now()}-${AUDIT.length}`,
    actorName: "You",
    action,
    entity,
    entityId,
    summary,
    amount,
    createdAt: new Date().toISOString(),
  });
}
```

Add `AuditEntry` to the domain import. Wire `pushAudit` into the income methods from Task 1 (add the call before each `return`):

- in `createIncome`: `pushAudit("created", "income", income.id, \`Income: ${income.source}\`, income.amount);`
- in `updateIncome`: `pushAudit("edited", "income", existing.id, \`Income: ${existing.source}\`, existing.amount);`
- in `deleteIncome`: after the splice, `pushAudit("deleted", "income", id, "Income entry", null);`

Wire into the existing expense + payment methods:
- in `createExpense`, before `return expense;`: `pushAudit("created", "expense", expense.id, \`Expense to ${expense.payee}\`, expense.amount);`
- in `updateExpense`, before `return existing;`: `pushAudit("edited", "expense", existing.id, \`Expense to ${existing.payee}\`, existing.amount);`
- in `deleteExpense`, after the splice: `pushAudit("deleted", "expense", id, "Expense", null);`
- in `recordPayment`, before `return payment;`: `pushAudit("created", "payment", payment.id, \`Payment receipt ${payment.receiptNo}\`, payment.amount);`

Add the read method (after `listIncomeView`):

```ts
  async listAuditLog(filter?: DateFilter): Promise<AuditEntry[]> {
    await tick();
    return AUDIT.filter((a) => inRange(a.createdAt.slice(0, 10), filter)).sort(
      (x, y) => y.createdAt.localeCompare(x.createdAt),
    );
  },
```

- [ ] **Step 5: Run mock tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/audit.test.ts`
Expected: PASS (mock simulation).

- [ ] **Step 6: Implement the Supabase read method**

In `src/lib/data/supabase-repo.ts`, add a mapper near `mapIncome`:

```ts
function mapAudit(r: Row): AuditEntry {
  return {
    id: r.id as string,
    actorName: (r.actor_name as string) ?? "Unknown",
    action: r.action as AuditEntry["action"],
    entity: r.entity as AuditEntry["entity"],
    entityId: (r.entity_id as string) ?? "",
    summary: r.summary as string,
    amount: r.amount_kobo == null ? null : Number(r.amount_kobo),
    createdAt: r.created_at as string,
  };
}
```

Add `AuditEntry` to the domain import and the method (after `listIncomeView`):

```ts
  async listAuditLog(filter?: DateFilter): Promise<AuditEntry[]> {
    const client = sb();
    let q = client.from("audit_log").select("*").order("created_at", { ascending: false });
    if (filter?.from) q = q.gte("created_at", filter.from);
    if (filter?.to) q = q.lte("created_at", `${filter.to}T23:59:59`);
    const { data } = await q;
    return (data ?? []).map(mapAudit);
  },
```

- [ ] **Step 7: Update the source schema**

In `supabase/schema.sql`, add the table (after `income`):

```sql
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  actor_id    uuid,
  actor_name  text,
  action      text not null,   -- created | edited | deleted
  entity      text not null,   -- payment | expense | income
  entity_id   uuid,
  summary     text not null,
  amount_kobo bigint,
  created_at  timestamptz not null default now()
);
```

Add the trigger function + triggers (in the RLS/functions area):

```sql
create or replace function log_money_change() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_row      record;
  v_action   text;
  v_entity   text := TG_ARGV[0];
  v_summary  text;
  v_actor    uuid := auth.uid();
  v_name     text;
begin
  if TG_OP = 'DELETE' then v_row := OLD; v_action := 'deleted';
  elsif TG_OP = 'UPDATE' then v_row := NEW; v_action := 'edited';
  else v_row := NEW; v_action := 'created';
  end if;

  if v_entity = 'payment' then v_summary := 'Payment receipt ' || coalesce(v_row.receipt_no, '');
  elsif v_entity = 'expense' then v_summary := 'Expense to ' || coalesce(v_row.payee, '');
  else v_summary := 'Income: ' || coalesce(v_row.source, '');
  end if;

  select full_name into v_name from profiles where id = v_actor;

  insert into audit_log (school_id, actor_id, actor_name, action, entity, entity_id, summary, amount_kobo)
  values (v_row.school_id, v_actor, v_name, v_action, v_entity, v_row.id, v_summary, v_row.amount_kobo);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

revoke execute on function log_money_change() from public;

create trigger audit_payments after insert or update or delete on payments
  for each row execute function log_money_change('payment');
create trigger audit_expenses after insert or update or delete on expenses
  for each row execute function log_money_change('expense');
create trigger audit_income after insert or update or delete on income
  for each row execute function log_money_change('income');
```

Add RLS + grant (audit_log is read-only to clients):

```sql
alter table audit_log enable row level security;
create policy read_same_school on audit_log
  for select using (school_id = auth_school_id());
grant select on table audit_log to authenticated;   -- no insert/update/delete
```

- [ ] **Step 8: Apply the live migration**

Use `apply_migration` (project `pbrirletzhvanmmxithr`, name `add_audit_log`) with the full SQL from Step 7 (table + function + `revoke` + three triggers + `alter table ... enable row level security` + policy + grant), wrapping the table in `create table if not exists` and each `create trigger` preceded by `drop trigger if exists <name> on <table>;`.

- [ ] **Step 9: Verify the trigger live**

Use `execute_sql` to insert one income row directly for the seeded school, then read the audit rows. Because direct SQL runs as the service/owner role, `auth.uid()` is null (actor_name null) but the trigger still fires:

```sql
-- capture an audit row for a real insert
insert into income (school_id, source, description, amount_kobo, received_on, method, recorded_by_name)
select id, 'Donation', 'trigger smoke test', 500000, current_date, 'cash', 'smoke'
from schools limit 1;

select entity, action, summary, amount_kobo from audit_log
where summary = 'Income: Donation' order by created_at desc limit 1;
```
Expected: one row, `entity='income'`, `action='created'`, `amount_kobo=500000`. Then clean up:
```sql
delete from income where description = 'trigger smoke test';
select entity, action from audit_log where entity_id in
  (select id from income where description = 'trigger smoke test');
```
Expected: the delete produced a `deleted` audit row (and the income row is gone). Confirm `audit_log` has no insert/update/delete policy:
```sql
select cmd from pg_policies where tablename = 'audit_log';
```
Expected: only `SELECT`.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/domain/types.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts supabase/schema.sql src/lib/data/__tests__/audit.test.ts
git commit -m "feat: money audit trail (triggers + read + mock simulation)"
```

---

### Task 4: Payments hub shell + Ledger view extraction + nav

Create `/payments` with a tab switcher; extract the existing ledger screen into a reusable view; repoint nav.

**Files:**
- Create: `src/components/payments/LedgerView.tsx` (extracted from the ledger page)
- Create: `src/app/payments/page.tsx` (hub with tabs)
- Modify: `src/app/ledger/page.tsx` (redirect to `/payments`)
- Modify: `src/components/AppShell.tsx` (nav label + route + TITLES)
- Test: build + typecheck (UI wiring)

**Interfaces:**
- Consumes: existing ledger logic.
- Produces: `export function LedgerView(): JSX.Element`; `/payments` route.

- [ ] **Step 1: Extract the ledger body into a component**

Create `src/components/payments/LedgerView.tsx`. Move the entire body of the current default export in `src/app/ledger/page.tsx` (the `LedgerPage` component and its helper components `LedgerRow`, `BalanceCard`, `Th`, `PagerButton`, `ExportIcon`, plus the `Row`/`RangeKey`/`TypeFilter` types and `RANGES`/`PAGE_SIZES` consts) into this file. Rename the exported component `LedgerPage` to `LedgerView` and `export function LedgerView(...)`. Keep all imports it needs (adjust relative paths: it now lives in `src/components/payments/`, so `@/`-prefixed imports are unchanged). The permission guard stays inside `LedgerView`.

- [ ] **Step 2: Turn the ledger route into a redirect**

Replace the entire contents of `src/app/ledger/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

/** The ledger now lives inside the Payments hub. */
export default function LedgerRedirect() {
  redirect("/payments");
}
```

- [ ] **Step 3: Create the Payments hub**

Create `src/app/payments/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { EmptyState, cn } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { LedgerView } from "@/components/payments/LedgerView";

type TabId = "ledger" | "income" | "expense" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "ledger", label: "Ledger" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "audit", label: "Audit trail" },
];

export default function PaymentsPage() {
  const { role } = useViewer();
  const [tab, setTab] = useState<TabId>("ledger");

  if (!can(role, "view_ledger")) {
    return (
      <EmptyState
        title="Payments are for the Proprietor and Bursar"
        description="Ask an administrator if you need to see the school's money."
      />
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 md:flex-col md:gap-0.5 md:self-start">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition md:w-full",
              tab === t.id
                ? "bg-primary-tint text-primary"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {t.label}
            <ChevronRightIcon
              width={16}
              height={16}
              className={cn("hidden md:block", tab === t.id ? "opacity-100" : "opacity-30")}
            />
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {tab === "ledger" && <LedgerView />}
        {tab === "income" && <IncomePlaceholder />}
        {tab === "expense" && <ExpensePlaceholder />}
        {tab === "audit" && <AuditPlaceholder />}
      </div>
    </div>
  );
}

// Replaced in Tasks 5-7.
function IncomePlaceholder() {
  return <p className="text-sm text-ink-muted">Income view arrives in Task 5.</p>;
}
function ExpensePlaceholder() {
  return <p className="text-sm text-ink-muted">Expense view arrives in Task 6.</p>;
}
function AuditPlaceholder() {
  return <p className="text-sm text-ink-muted">Audit trail arrives in Task 7.</p>;
}
```

Note: the three placeholder components are scaffolding this task legitimately needs to compile and render the shell; Tasks 5-7 replace each with the real view and remove the placeholder.

- [ ] **Step 4: Repoint navigation**

In `src/components/AppShell.tsx`:
- In `PRIMARY_NAV`, change the ledger item to:
  `{ href: "/payments", label: "Payments", icon: LedgerIcon, permission: "view_ledger" },`
- In `TITLES`, replace `{ base: "/ledger", title: "Ledger" }` with `{ base: "/payments", title: "Payments" }`.

- [ ] **Step 5: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no type errors; `/payments` compiles; `/ledger` builds as a redirect.

- [ ] **Step 6: Commit**

```bash
git add src/components/payments/LedgerView.tsx src/app/payments/page.tsx src/app/ledger/page.tsx src/components/AppShell.tsx
git commit -m "feat: Payments hub shell with Ledger tab + nav repoint"
```

---

### Task 5: Income tab

Merged money-in list + a "Log income" form.

**Files:**
- Create: `src/components/payments/IncomeView.tsx`
- Modify: `src/app/payments/page.tsx` (use IncomeView, drop placeholder)
- Test: build + typecheck

**Interfaces:**
- Consumes: `repository.listIncomeView`, `createIncome`, `updateIncome`, `deleteIncome` (Tasks 1-2); `Income`, `IncomeRow`.
- Produces: `export function IncomeView(): JSX.Element`.

- [ ] **Step 1: Create the Income view**

Create `src/components/payments/IncomeView.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { CreateIncomeInput } from "@/lib/data/repository";
import { INCOME_SOURCES, PAY_METHODS } from "@/lib/domain/constants";
import { parseNairaToKobo } from "@/lib/money";
import type { PaymentMethod } from "@/lib/domain/types";
import {
  Banner, Button, Card, EmptyState, Field, Input, LoadingBlock, Money,
  NairaInput, PageHeader, Select, StatusPill, TextArea,
} from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { formatDay } from "@/lib/dates";

export function IncomeView() {
  const { data, loading, reload } = useAsync(() => repository.listIncomeView(), []);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Every naira the school takes in: fees and other income."
        action={
          <Button onClick={() => { setEditingId(null); setShowForm(true); }}>
            <PlusIcon width={18} height={18} /> Log income
          </Button>
        }
      />

      {(showForm || editingId) && (
        <IncomeForm
          editingId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={() => { setShowForm(false); setEditingId(null); reload(); }}
        />
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading income…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No income recorded yet"
          description="Fee payments show here automatically. Use Log income for donations, grants, or sales."
        />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between bg-surface-sunken">
            <span className="text-sm text-ink-muted">
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </span>
            <span className="text-sm text-ink-muted">
              Total in <Money kobo={total} tone="success" />
            </span>
          </Card>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                {r.kind === "fee" ? (
                  <Link
                    href={`/students/${r.studentId}`}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 transition hover:bg-surface-sunken"
                  >
                    <IncomeRowBody r={r} />
                  </Link>
                ) : (
                  <button
                    onClick={() => { setShowForm(false); setEditingId(r.id); }}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
                  >
                    <IncomeRowBody r={r} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function IncomeRowBody({ r }: { r: import("@/lib/data/repository").IncomeRow }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{r.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusPill tone={r.kind === "fee" ? "paid" : "neutral"}>
            {r.kind === "fee" ? "School fee" : r.source}
          </StatusPill>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money kobo={r.amount} tone="success" className="text-sm" />
        <p className="mt-0.5 text-xs text-ink-faint">{formatDay(r.date)}</p>
      </div>
    </>
  );
}

function IncomeForm({
  editingId,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { actorName } = useViewer();
  const online = useOnline();
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = useAsync(
    async () => (editingId ? (await repository.listIncome()).find((i) => i.id === editingId) ?? null : null),
    [editingId],
  );

  const [source, setSource] = useState(INCOME_SOURCES[0]);
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!seeded && existing) {
    setSeeded(true);
    setSource(existing.source);
    setDescription(existing.description);
    setAmountText(String(existing.amount / 100));
    setReceivedOn(existing.receivedOn);
    setMethod(existing.method);
    setNote(existing.note ?? "");
  }

  async function save() {
    setError(null);
    if (!online) return setError("You're offline. Income is saved only when connected. Reconnect and try again.");
    const amountKobo = parseNairaToKobo(amountText);
    if (!description.trim()) return setError("Add a short description.");
    if (amountKobo === null || amountKobo <= 0) return setError("Enter an amount greater than zero.");
    const input: CreateIncomeInput = {
      source: source.trim() || "Other",
      description: description.trim(),
      amountKobo,
      receivedOn,
      method,
      note: note.trim() || undefined,
      recordedByName: actorName,
    };
    setSaving(true);
    try {
      if (editingId) await repository.updateIncome(editingId, input);
      else await repository.createIncome(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This income couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await repository.deleteIncome(editingId);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This income couldn't be deleted.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">{editingId ? "Edit income" : "Log income"}</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>
      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Date received">
          <Input type="date" value={receivedOn} max={today} onChange={(e) => setReceivedOn(e.target.value)} />
        </Field>
      </div>

      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. PTA fundraiser proceeds" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <NairaInput value={amountText} onValueChange={setAmountText} placeholder="e.g. 50,000" />
        </Field>
        <Field label="Received by">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Note (optional)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
      </Field>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !online} className="flex-1">
          {saving ? "Saving…" : editingId ? "Save changes" : "Log income"}
        </Button>
        {editingId && <Button variant="danger" onClick={remove} disabled={saving}>Delete</Button>}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into the hub**

In `src/app/payments/page.tsx`: import `IncomeView`, replace `{tab === "income" && <IncomePlaceholder />}` with `{tab === "income" && <IncomeView />}`, and delete the `IncomePlaceholder` function.

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; `/payments` compiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/IncomeView.tsx src/app/payments/page.tsx
git commit -m "feat: Income tab (merged money-in list + log income form)"
```

---

### Task 6: Expense tab (relocate) + New Entry becomes payment-only

Move the expense screen into a reusable view under the hub; drop the expense toggle from New Entry.

**Files:**
- Create: `src/components/payments/ExpenseView.tsx` (extracted from the expenses page)
- Modify: `src/app/payments/page.tsx` (use ExpenseView, drop placeholder)
- Modify: `src/app/expenses/page.tsx` (redirect to `/payments`)
- Modify: `src/app/entry/page.tsx` (payment-only)
- Test: build + typecheck

**Interfaces:**
- Consumes: existing expense CRUD.
- Produces: `export function ExpenseView(): JSX.Element`.

- [ ] **Step 1: Extract the expenses body into a view**

Create `src/components/payments/ExpenseView.tsx`. Move the body of `src/app/expenses/page.tsx` (`ExpensesPage` + `ExpenseForm` + `cadenceLabel`) into it. Rename `ExpensesPage` to `export function ExpenseView`. Remove the two navigation `Link` buttons block (the "Staff & payroll" / "View daily ledger" row) since the hub provides context now. Keep the permission guard (`manage_expenses`). Keep all other imports.

- [ ] **Step 2: Turn the expenses route into a redirect**

Replace the entire contents of `src/app/expenses/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

/** Expenses now live inside the Payments hub. */
export default function ExpensesRedirect() {
  redirect("/payments");
}
```

- [ ] **Step 3: Wire into the hub**

In `src/app/payments/page.tsx`: import `ExpenseView`, replace `{tab === "expense" && <ExpensePlaceholder />}` with `{tab === "expense" && <ExpenseView />}`, and delete the `ExpensePlaceholder` function.

- [ ] **Step 4: Make New Entry payment-only**

In `src/app/entry/page.tsx`, remove the segment toggle so it records payments only:
- Delete the `Segment` type, the `segment` state, the `SegmentButton` usages, and the `ExpenseEntry`/`ExpenseSuccess` components (they now live under the hub via `ExpenseView`).
- Replace the returned JSX of `EntryPage` so it renders `<PaymentEntry />` directly under a short intro:

```tsx
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-ink-muted">
        Record a fee payment. A receipt is issued and it posts to the ledger. To
        log an expense or other income, use Payments.
      </p>
      <PaymentEntry />
    </div>
  );
```

- Remove now-unused imports (`ArrowUpIcon` if only the expense segment used it, `EXPENSE_CADENCES`, `EXPENSE_CATEGORIES`, `ExpenseCadence`, `Expense`, `CreateExpenseInput`). Keep everything `PaymentEntry` uses. Run `npx tsc --noEmit` and let the unused-import errors guide the exact removals.

- [ ] **Step 5: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; `/payments`, `/expenses` (redirect), `/entry` all compile.

- [ ] **Step 6: Commit**

```bash
git add src/components/payments/ExpenseView.tsx src/app/expenses/page.tsx src/app/payments/page.tsx src/app/entry/page.tsx
git commit -m "feat: Expense tab in Payments hub; New Entry is payment-only"
```

---

### Task 7: Audit trail tab

Read-only audit table with filters + export.

**Files:**
- Create: `src/components/payments/AuditView.tsx`
- Modify: `src/app/payments/page.tsx` (use AuditView, drop placeholder)
- Test: build + typecheck

**Interfaces:**
- Consumes: `repository.listAuditLog` (Task 3); `AuditEntry`.
- Produces: `export function AuditView(): JSX.Element`.

- [ ] **Step 1: Create the Audit view**

Create `src/components/payments/AuditView.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { formatNaira } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { exportToXlsx } from "@/lib/export";
import type { AuditEntry } from "@/lib/domain/types";
import { Card, EmptyState, LoadingBlock, Select, cn } from "@/components/ui";

type EntityFilter = "all" | "payment" | "expense" | "income";

const ACTION_TONE: Record<AuditEntry["action"], string> = {
  created: "text-success",
  edited: "text-warning",
  deleted: "text-danger",
};

export function AuditView() {
  const { data, loading } = useAsync(() => repository.listAuditLog(), []);
  const [entity, setEntity] = useState<EntityFilter>("all");

  const rows = useMemo(
    () => (data ?? []).filter((a) => entity === "all" || a.entity === entity),
    [data, entity],
  );

  function onExport() {
    exportToXlsx(
      "Audit trail",
      ["When", "Who", "Action", "Entity", "Summary", "Amount"],
      rows.map((a) => [
        a.createdAt.slice(0, 16).replace("T", " "),
        a.actorName,
        a.action,
        a.entity,
        a.summary,
        a.amount == null ? "" : a.amount / 100,
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-muted">
          Every money entry recorded, edited, or removed, and who did it.
        </p>
        <Select
          value={entity}
          onChange={(e) => setEntity(e.target.value as EntityFilter)}
          className="ml-auto w-auto"
        >
          <option value="all">All types</option>
          <option value="payment">Fee payments</option>
          <option value="income">Other income</option>
          <option value="expense">Expenses</option>
        </Select>
        <button
          onClick={onExport}
          disabled={rows.length === 0}
          className="rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink-muted transition enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40"
        >
          Export
        </button>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading the audit trail…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="As payments, income, and expenses are recorded or changed, they appear here."
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Entity</Th><Th>Summary</Th><Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-sm tabular text-ink-muted">
                      {formatDay(a.createdAt.slice(0, 10))}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">{a.actorName}</td>
                    <td className={cn("px-4 py-2.5 text-sm font-semibold capitalize", ACTION_TONE[a.action])}>
                      {a.action}
                    </td>
                    <td className="px-4 py-2.5 text-sm capitalize text-ink-muted">{a.entity}</td>
                    <td className="px-4 py-2.5 text-sm text-ink">{a.summary}</td>
                    <td className="px-4 py-2.5 text-sm tabular text-ink">
                      {a.amount == null ? "-" : formatNaira(a.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
```

- [ ] **Step 2: Wire into the hub**

In `src/app/payments/page.tsx`: import `AuditView`, replace `{tab === "audit" && <AuditPlaceholder />}` with `{tab === "audit" && <AuditView />}`, and delete the `AuditPlaceholder` function.

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no errors; all four tabs present.

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/AuditView.tsx src/app/payments/page.tsx
git commit -m "feat: Audit trail tab (read-only, filter + export)"
```

---

### Task 8: Full verification + security audit + build

Final gate: whole suite, production build, post-build adversarial audit (pre-build audit ran at kickoff).

**Files:** none (verification only; commit fixes if any).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all Vitest files pass (income, incomeView, audit, plus existing setupTasks/dismissal/bankAccount).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no type errors; build succeeds for all routes including `/payments`.

- [ ] **Step 3: Post-build security audit**

Run the saved adversarial audit prompt. Live checks via Supabase MCP `get_advisors` (security) for `pbrirletzhvanmmxithr`, and confirm:
- `income` has `read_same_school` (SELECT) + `manage_income` (ALL, role + school bound with `WITH CHECK`).
- `audit_log` has ONLY a SELECT policy; no insert/update/delete policy; grant is `select` only.
- `log_money_change()` is SECURITY DEFINER with `search_path = public` and EXECUTE revoked from public.
- No new `FOR ALL` policy is missing a role check; `profiles` still write-blocked; no new over-broad grants.
- Any newly flagged advisor is triaged: the trigger function may appear under the SECURITY DEFINER lint (expected and required, same accepted class as `auth_role`/`auth_school_id`); record it as accepted with rationale. Fix anything genuinely new.

- [ ] **Step 4: Browser smoke check (best effort)**

If the authed area is reachable, open `/payments` in the preview: all four tabs render, logging an income entry adds it to Income + Ledger + Audit, editing/deleting an expense adds audit rows, teacher role sees the empty state. If sign-in blocks the preview, rely on tests + build and note it.

- [ ] **Step 5: Commit any fixes + push**

```bash
git add -A
git commit -m "chore: verify payments group (tests, build, security audit)"
git push origin develop
```

---

## Self-Review

**Spec coverage:**
- Payments hub with 4 tabs → Tasks 4-7.
- Income = all money in (fees + other), log non-fee only → Task 2 (`listIncomeView`) + Task 5 UI.
- Other-income model + table + CRUD → Task 1.
- Expense relocated; New Entry payment-only → Task 6.
- Ledger includes income → Task 2.
- Audit trail via triggers, client read-only, immutable → Task 3; UI Task 7.
- New tables `income` + `audit_log`; RLS shapes → Tasks 1, 3; audited Task 8.
- Repository parity (mock + supabase, mock simulates audit) → Tasks 1-3.
- Permissions gate to `view_ledger` → Task 4 hub guard.
- Nav Ledger → Payments, `/ledger` + `/expenses` redirect → Tasks 4, 6.
- No em-dashes; kobo money; dark-mode tokens → Global Constraints (all copy here uses colons/periods).
- Security audit before + after → Global Constraints + Task 8.

**Placeholder scan:** Task 4's three `*Placeholder` components are intentional shell scaffolding, each removed by name in Tasks 5-7. No TBD/TODO or vague "handle errors" steps; every code step has real code. Task 6 Step 4 intentionally defers exact unused-import removal to the typechecker, with the mechanism spelled out.

**Type consistency:** `Income`, `CreateIncomeInput`, `IncomeRow`, `AuditEntry`, `listIncome`/`createIncome`/`updateIncome`/`deleteIncome`, `listIncomeView`, `listAuditLog`, `LedgerView`/`IncomeView`/`ExpenseView`/`AuditView`, and `LedgerEntry.kind` including `"income"` are used identically across Tasks 1-7. Column names (`received_on`, `amount_kobo`, `source`, `entity`, `entity_id`, `actor_name`) match between the migrations, the mappers, and the trigger function.
