# Setup Task View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a newly onboarded school a self-updating setup checklist (dashboard card + Profile panel + point-of-action soft-blocks) that tracks three auto-derived prerequisites and dismissible nudges.

**Architecture:** A pure derivation function (`deriveSetupTasks`) computes task status + weighted percentage from plain inputs and is unit-tested in isolation. A thin `useSetupTasks()` hook feeds it live repository data. Three presentation surfaces (dashboard `SetupCard`, Profile `SetupPanel`, and the Add-student soft-block) render from that one hook, so they can never disagree. Bank-account details are added as new `schools` columns with a new update policy; nudge dismissal lives in `localStorage`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- **No em-dashes** in any app copy. Use colons or hyphens. (Verbatim rule.)
- **Money is integer kobo.** Never float. Bank account number is free text, not money.
- **Security audit before AND after the build.** Run the full adversarial audit at execution kickoff (before Task 1) and again in the final task (after build). Use the saved audit prompt.
- **RLS is the security boundary.** The new `schools` UPDATE policy must be scoped to `id = auth_school_id()` AND `auth_role() in ('proprietor','bursar')`, update-only (never `for all`). Do **not** add any write policy or grant to `profiles`.
- **Repository parity.** Every interface change is implemented in BOTH `mock.ts` and `supabase-repo.ts`.
- **Setup surfaces are admin-only.** Gate the dashboard card and Profile Setup panel to `can(role, "edit_fees")` (proprietor/bursar). Teachers never see them.
- **Vendors nudge is off** until M4: `includeVendors` defaults to `false`.

---

### Task 1: Bank account data layer

Adds bank fields to the domain, both repositories, the live DB, and the source schema. No UI yet.

**Files:**
- Modify: `src/lib/domain/types.ts` (School interface)
- Modify: `src/lib/data/repository.ts` (interface + input type)
- Modify: `src/lib/data/mock.ts` (SCHOOL fields via seed + method)
- Modify: `src/lib/data/seed.ts` (SCHOOL: leave bank fields unset)
- Modify: `src/lib/data/supabase-repo.ts` (mapSchool + updateBankAccount)
- Modify: `supabase/schema.sql` (columns + update policy)
- Live: apply a Supabase migration to project `pbrirletzhvanmmxithr`
- Test: `src/lib/data/__tests__/bankAccount.test.ts`

**Interfaces:**
- Produces:
  - `School` gains `bankAccountNumber?: string; bankAccountName?: string; bankName?: string;`
  - `interface BankAccountInput { accountNumber: string; accountName: string; bankName: string }`
  - `Repository.updateBankAccount(input: BankAccountInput): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/__tests__/bankAccount.test.ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("updateBankAccount (mock)", () => {
  it("persists all three bank fields onto the school", async () => {
    await mockRepository.updateBankAccount({
      accountNumber: "0123456789",
      accountName: "Tejuosho Group of Schools",
      bankName: "First Bank",
    });
    const school = await mockRepository.getSchool();
    expect(school.bankAccountNumber).toBe("0123456789");
    expect(school.bankAccountName).toBe("Tejuosho Group of Schools");
    expect(school.bankName).toBe("First Bank");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/bankAccount.test.ts`
Expected: FAIL — `updateBankAccount` is not a function / property missing.

- [ ] **Step 3: Add the domain type**

In `src/lib/domain/types.ts`, extend `School` (after `currentTerm`):

```ts
  currentTerm: TermName;
  /** Bank details shown on every invoice and receipt. Filled during setup. */
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankName?: string;
}
```

- [ ] **Step 4: Add the interface method + input type**

In `src/lib/data/repository.ts`, add near the fee-structure methods inside `interface Repository`:

```ts
  /** Save the school's bank account details (shown on invoices/receipts). */
  updateBankAccount(input: BankAccountInput): Promise<void>;
```

And add the input type alongside the other input interfaces:

```ts
export interface BankAccountInput {
  accountNumber: string;
  accountName: string;
  bankName: string;
}
```

- [ ] **Step 5: Implement in the mock repository**

`src/lib/data/seed.ts` — leave `SCHOOL` bank fields unset (they are optional; a fresh school has none). No change needed beyond confirming they are absent.

In `src/lib/data/mock.ts`, add the method (place it after `getSchool`):

```ts
  async updateBankAccount(input): Promise<void> {
    await tick();
    SCHOOL.bankAccountNumber = input.accountNumber.trim();
    SCHOOL.bankAccountName = input.accountName.trim();
    SCHOOL.bankName = input.bankName.trim();
  },
```

Note: `SCHOOL` is imported from seed and is a mutable module object, matching how the mock already mutates arrays.

- [ ] **Step 6: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, extend `mapSchool` return with:

```ts
    currentTerm: (r.current_term as TermName) ?? "first",
    bankAccountNumber: (r.bank_account_number as string) ?? undefined,
    bankAccountName: (r.bank_account_name as string) ?? undefined,
    bankName: (r.bank_name as string) ?? undefined,
  };
```

Add the method to the exported `supabaseRepository` object (near the school reads):

```ts
  async updateBankAccount(input): Promise<void> {
    const { data: school } = await sb().from("schools").select("id").single();
    const { error } = await sb()
      .from("schools")
      .update({
        bank_account_number: input.accountNumber.trim(),
        bank_account_name: input.accountName.trim(),
        bank_name: input.bankName.trim(),
      })
      .eq("id", (school as Row).id as string);
    if (error) throw new Error(error.message);
  },
```

- [ ] **Step 7: Update the source schema**

In `supabase/schema.sql`, add to the `schools` table definition (after `current_term`):

```sql
  current_term       term_name not null default 'first',
  bank_account_number text,
  bank_account_name   text,
  bank_name           text,
```

And add the update policy in the RLS section (right after the `read_same_school on schools` policy):

```sql
-- Bank details and other school settings: only Proprietor/Bursar may update.
-- UPDATE only (no insert/delete from the client); schools are created server-side.
create policy manage_school on schools
  for update using (id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (id = auth_school_id() and auth_role() in ('proprietor','bursar'));
```

- [ ] **Step 8: Apply the live migration**

Use the Supabase MCP `apply_migration` (project `pbrirletzhvanmmxithr`, name `add_school_bank_account`):

```sql
alter table schools
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name   text,
  add column if not exists bank_name           text;

drop policy if exists manage_school on schools;
create policy manage_school on schools
  for update using (id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (id = auth_school_id() and auth_role() in ('proprietor','bursar'));
```

Then confirm with `list_migrations` and a quick `execute_sql`:
`select policyname from pg_policies where tablename = 'schools';`
Expected: includes `read_same_school` and `manage_school`.

- [ ] **Step 9: Run tests + typecheck**

Run: `npx vitest run src/lib/data/__tests__/bankAccount.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/domain/types.ts src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts supabase/schema.sql src/lib/data/__tests__/bankAccount.test.ts
git commit -m "feat: bank account fields on school (+ schools update policy)"
```

---

### Task 2: Setup task derivation (pure logic)

The tested heart. Pure functions, no React, no repository.

**Files:**
- Create: `src/lib/setup/setupTasks.ts`
- Test: `src/lib/setup/__tests__/setupTasks.test.ts`

**Interfaces:**
- Consumes: `School` (Task 1) for `isBankComplete`.
- Produces:
  - `type SetupTaskId = "fees" | "students" | "bank" | "staff" | "vendors"`
  - `interface SetupTask { id; title; why; tier: "blocker"|"nudge"; done; weight; href; dismissible }`
  - `interface SetupState { tasks: SetupTask[]; percentage: number; nextTask: SetupTask | null; allBlockersDone: boolean }`
  - `interface DeriveSetupInput { classLevels: string[]; feeLevels: string[]; studentCount: number; bankComplete: boolean; dismissedNudges: SetupTaskId[]; includeVendors?: boolean }`
  - `function deriveSetupTasks(input: DeriveSetupInput): SetupState`
  - `function isBankComplete(school: Pick<School,"bankAccountNumber"|"bankAccountName"|"bankName"> | null): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/setup/__tests__/setupTasks.test.ts
import { describe, it, expect } from "vitest";
import { deriveSetupTasks, isBankComplete } from "@/lib/setup/setupTasks";

const base = {
  classLevels: [] as string[],
  feeLevels: [] as string[],
  studentCount: 0,
  bankComplete: false,
  dismissedNudges: [] as never[],
};

describe("isBankComplete", () => {
  it("is false when any field is missing or blank", () => {
    expect(isBankComplete(null)).toBe(false);
    expect(isBankComplete({ bankAccountNumber: "1", bankAccountName: "", bankName: "GTB" })).toBe(false);
    expect(isBankComplete({ bankAccountNumber: "  ", bankAccountName: "A", bankName: "B" })).toBe(false);
  });
  it("is true when all three are filled", () => {
    expect(isBankComplete({ bankAccountNumber: "1", bankAccountName: "A", bankName: "GTB" })).toBe(true);
  });
});

describe("deriveSetupTasks — fees rule", () => {
  it("fees not done with no fee items at all", () => {
    const s = deriveSetupTasks(base);
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(false);
  });
  it("fees done on any fee item when no classes exist yet", () => {
    const s = deriveSetupTasks({ ...base, feeLevels: ["JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(true);
  });
  it("fees NOT done when a class level lacks fees", () => {
    const s = deriveSetupTasks({ ...base, classLevels: ["JSS 1", "SSS 1"], feeLevels: ["JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(false);
  });
  it("fees done when every class level is covered", () => {
    const s = deriveSetupTasks({ ...base, classLevels: ["JSS 1", "SSS 1"], feeLevels: ["SSS 1", "JSS 1"] });
    expect(s.tasks.find((t) => t.id === "fees")!.done).toBe(true);
  });
});

describe("deriveSetupTasks — percentage + ordering", () => {
  it("weights blockers at 30% each and staff nudge at 10%", () => {
    const s = deriveSetupTasks(base);
    expect(s.percentage).toBe(0);
    expect(s.tasks.map((t) => t.id)).toEqual(["fees", "students", "bank", "staff"]);
    expect(s.tasks.find((t) => t.id === "fees")!.weight).toBe(3);
    expect(s.tasks.find((t) => t.id === "staff")!.weight).toBe(1);
  });
  it("all three blockers done reads 90%, blockers-complete flag true", () => {
    const s = deriveSetupTasks({
      classLevels: ["JSS 1"], feeLevels: ["JSS 1"], studentCount: 5, bankComplete: true, dismissedNudges: [],
    });
    expect(s.percentage).toBe(90);
    expect(s.allBlockersDone).toBe(true);
    expect(s.nextTask).toBeNull();
  });
  it("dismissing the staff nudge reaches 100%", () => {
    const s = deriveSetupTasks({
      classLevels: ["JSS 1"], feeLevels: ["JSS 1"], studentCount: 5, bankComplete: true, dismissedNudges: ["staff"],
    });
    expect(s.percentage).toBe(100);
  });
  it("nextTask is the first incomplete blocker in fixed order", () => {
    const s = deriveSetupTasks({ ...base, feeLevels: ["JSS 1"] }); // fees done, students next
    expect(s.nextTask!.id).toBe("students");
  });
  it("vendors nudge appears and rebalances only when includeVendors is true", () => {
    const off = deriveSetupTasks(base);
    expect(off.tasks.some((t) => t.id === "vendors")).toBe(false);
    const on = deriveSetupTasks({ ...base, includeVendors: true });
    expect(on.tasks.some((t) => t.id === "vendors")).toBe(true);
    // 3*3 + 2*1 = 11 total; each blocker >= 15%
    expect(on.tasks.find((t) => t.id === "fees")!.weight / 11).toBeGreaterThan(0.15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/setup/__tests__/setupTasks.test.ts`
Expected: FAIL — module `@/lib/setup/setupTasks` not found.

- [ ] **Step 3: Implement the pure module**

```ts
// src/lib/setup/setupTasks.ts
import type { School } from "@/lib/domain/types";

export type SetupTaskId = "fees" | "students" | "bank" | "staff" | "vendors";

export interface SetupTask {
  id: SetupTaskId;
  title: string;
  why: string;
  tier: "blocker" | "nudge";
  done: boolean;
  weight: number;
  href: string;
  dismissible: boolean;
}

export interface SetupState {
  tasks: SetupTask[];
  percentage: number;
  nextTask: SetupTask | null;
  allBlockersDone: boolean;
}

export interface DeriveSetupInput {
  /** Distinct class levels the school currently has (from its classes). */
  classLevels: string[];
  /** Distinct levels that have at least one fee item for the term. */
  feeLevels: string[];
  studentCount: number;
  bankComplete: boolean;
  dismissedNudges: SetupTaskId[];
  /** Vendors nudge only shows once M4 ships. Default off. */
  includeVendors?: boolean;
}

const BLOCKER_WEIGHT = 3;
const NUDGE_WEIGHT = 1;

/** All three bank fields present and non-blank. */
export function isBankComplete(
  school: Pick<School, "bankAccountNumber" | "bankAccountName" | "bankName"> | null,
): boolean {
  if (!school) return false;
  return (
    !!school.bankAccountNumber?.trim() &&
    !!school.bankAccountName?.trim() &&
    !!school.bankName?.trim()
  );
}

/**
 * Fees are "done" when there is a fee structure that covers the school.
 * If the school already has classes, every class level must have fee items.
 * If it has no classes yet, any fee item counts (they set fees before classes).
 */
function feesDone(classLevels: string[], feeLevels: string[]): boolean {
  if (feeLevels.length === 0) return false;
  if (classLevels.length === 0) return true;
  const covered = new Set(feeLevels);
  return classLevels.every((l) => covered.has(l));
}

export function deriveSetupTasks(input: DeriveSetupInput): SetupState {
  const dismissed = new Set(input.dismissedNudges);
  const fees = feesDone(input.classLevels, input.feeLevels);
  const students = input.studentCount > 0;
  const bank = input.bankComplete;

  const tasks: SetupTask[] = [
    {
      id: "fees",
      title: "Set up your fee structure",
      why: "Bills need a fee list for every class.",
      tier: "blocker",
      done: fees,
      weight: BLOCKER_WEIGHT,
      href: "/profile",
      dismissible: false,
    },
    {
      id: "students",
      title: "Add your first student",
      why: "You need at least one student to record a payment.",
      tier: "blocker",
      done: students,
      weight: BLOCKER_WEIGHT,
      href: "/students/new",
      dismissible: false,
    },
    {
      id: "bank",
      title: "Add your bank account details",
      why: "Shown on every invoice and receipt so parents pay the right account.",
      tier: "blocker",
      done: bank,
      weight: BLOCKER_WEIGHT,
      href: "/profile",
      dismissible: false,
    },
    {
      id: "staff",
      title: "Invite your staff",
      why: "Add teachers and bursars if others will help run Bursar.",
      tier: "nudge",
      done: dismissed.has("staff"),
      weight: NUDGE_WEIGHT,
      href: "/profile",
      dismissible: true,
    },
  ];

  if (input.includeVendors) {
    tasks.push({
      id: "vendors",
      title: "Add your vendors",
      why: "Track suppliers and their due dates alongside salaries.",
      tier: "nudge",
      done: dismissed.has("vendors"),
      weight: NUDGE_WEIGHT,
      href: "/expenses",
      dismissible: true,
    });
  }

  const shownWeight = tasks.reduce((s, t) => s + t.weight, 0);
  const doneWeight = tasks.reduce((s, t) => s + (t.done ? t.weight : 0), 0);
  const percentage = Math.round((doneWeight / shownWeight) * 100);

  const blockers = tasks.filter((t) => t.tier === "blocker");
  const nextTask = blockers.find((t) => !t.done) ?? null;
  const allBlockersDone = blockers.every((t) => t.done);

  return { tasks, percentage, nextTask, allBlockersDone };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/setup/__tests__/setupTasks.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup/setupTasks.ts src/lib/setup/__tests__/setupTasks.test.ts
git commit -m "feat: setup task derivation logic with weighted completion"
```

---

### Task 3: Nudge dismissal store + useSetupTasks hook

Pure `localStorage` helpers (tested) plus a thin hook wiring live data into `deriveSetupTasks`.

**Files:**
- Create: `src/lib/setup/dismissal.ts`
- Create: `src/lib/setup/useSetupTasks.ts`
- Test: `src/lib/setup/__tests__/dismissal.test.ts`

**Interfaces:**
- Consumes: `deriveSetupTasks`, `isBankComplete` (Task 2); `repository.listClasses/listFeeItems/listStudents/getSchool`; `useViewer` (role, userId, term).
- Produces:
  - `function dismissalKey(userId: string): string`
  - `function readDismissed(store: StorageLike, userId: string): SetupTaskId[]`
  - `function addDismissed(store: StorageLike, userId: string, id: SetupTaskId): SetupTaskId[]`
  - `type StorageLike = Pick<Storage, "getItem" | "setItem">`
  - `function useSetupTasks(): { state: SetupState | null; loading: boolean; dismiss: (id: SetupTaskId) => void }`

- [ ] **Step 1: Write the failing tests for dismissal**

```ts
// src/lib/setup/__tests__/dismissal.test.ts
import { describe, it, expect } from "vitest";
import { dismissalKey, readDismissed, addDismissed } from "@/lib/setup/dismissal";

function fakeStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

describe("dismissal store", () => {
  it("keys by user id", () => {
    expect(dismissalKey("u-1")).toBe("bursar-setup-dismissed:u-1");
  });
  it("reads empty when nothing stored or JSON is bad", () => {
    expect(readDismissed(fakeStore(), "u-1")).toEqual([]);
    expect(readDismissed(fakeStore({ "bursar-setup-dismissed:u-1": "not json" }), "u-1")).toEqual([]);
  });
  it("adds a nudge id without duplicating and persists it", () => {
    const store = fakeStore();
    const after = addDismissed(store, "u-1", "staff");
    expect(after).toEqual(["staff"]);
    expect(addDismissed(store, "u-1", "staff")).toEqual(["staff"]);
    expect(readDismissed(store, "u-1")).toEqual(["staff"]);
  });
  it("ignores unknown ids read back from storage", () => {
    expect(readDismissed(fakeStore({ "bursar-setup-dismissed:u-1": '["staff","bogus"]' }), "u-1"))
      .toEqual(["staff"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/setup/__tests__/dismissal.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dismissal store**

```ts
// src/lib/setup/dismissal.ts
import type { SetupTaskId } from "@/lib/setup/setupTasks";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const VALID: SetupTaskId[] = ["staff", "vendors"];

export function dismissalKey(userId: string): string {
  return `bursar-setup-dismissed:${userId}`;
}

export function readDismissed(store: StorageLike, userId: string): SetupTaskId[] {
  try {
    const raw = store.getItem(dismissalKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is SetupTaskId => VALID.includes(x as SetupTaskId));
  } catch {
    return [];
  }
}

export function addDismissed(
  store: StorageLike,
  userId: string,
  id: SetupTaskId,
): SetupTaskId[] {
  const current = readDismissed(store, userId);
  if (current.includes(id)) return current;
  const next = [...current, id];
  store.setItem(dismissalKey(userId), JSON.stringify(next));
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/setup/__tests__/dismissal.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the hook**

```ts
// src/lib/setup/useSetupTasks.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import {
  deriveSetupTasks,
  isBankComplete,
  type SetupState,
  type SetupTaskId,
} from "@/lib/setup/setupTasks";
import { addDismissed, readDismissed } from "@/lib/setup/dismissal";

/**
 * Single source of truth for the setup checklist. Fetches its own school (not
 * viewer.school) so the bank blocker refreshes when the panel is re-opened
 * after saving. Nudge dismissal is per-user localStorage.
 */
export function useSetupTasks(): {
  state: SetupState | null;
  loading: boolean;
  dismiss: (id: SetupTaskId) => void;
} {
  const { term, userId } = useViewer();
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const { data: feeItems } = useAsync(() => repository.listFeeItems(term), [term]);
  const { data: students } = useAsync(() => repository.listStudents(), []);
  const { data: school } = useAsync(() => repository.getSchool(), []);

  const [dismissed, setDismissed] = useState<SetupTaskId[]>([]);
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    setDismissed(readDismissed(window.localStorage, userId));
  }, [userId]);

  const loading =
    classes == null || feeItems == null || students == null || school == null;

  const state = useMemo<SetupState | null>(() => {
    if (loading) return null;
    const classLevels = Array.from(new Set(classes!.map((c) => c.level)));
    const feeLevels = Array.from(new Set(feeItems!.map((f) => f.level)));
    return deriveSetupTasks({
      classLevels,
      feeLevels,
      studentCount: students!.length,
      bankComplete: isBankComplete(school!),
      dismissedNudges: dismissed,
    });
  }, [loading, classes, feeItems, students, school, dismissed]);

  function dismiss(id: SetupTaskId) {
    if (!userId || typeof window === "undefined") return;
    setDismissed(addDismissed(window.localStorage, userId, id));
  }

  return { state, loading, dismiss };
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/setup/dismissal.ts src/lib/setup/useSetupTasks.ts src/lib/setup/__tests__/dismissal.test.ts
git commit -m "feat: setup dismissal store + useSetupTasks hook"
```

---

### Task 4: Bank Account Information subsection in Profile

Makes the bank blocker completable. Adds an editable subsection to the Account panel.

**Files:**
- Modify: `src/app/profile/page.tsx` (AccountPanel)

**Interfaces:**
- Consumes: `repository.updateBankAccount` (Task 1); existing `Card`, `Field`, `Input`, `Button`, `Banner`, `useAsync`.

- [ ] **Step 1: Add a bank form below the read-only details**

In `src/app/profile/page.tsx`, rewrite `AccountPanel` to fetch the school itself (so it can reload after save) and render the bank subsection. Replace the existing `AccountPanel` function body:

```tsx
function AccountPanel() {
  const { session, actorName, role, term } = useViewer();
  const { data: school, reload } = useAsync(() => repository.getSchool(), []);
  const rows: { k: string; v: string }[] = [
    { k: "Your name", v: actorName || "-" },
    { k: "Your role", v: ROLE_LABELS[role] },
    { k: "School", v: school?.name ?? "-" },
    { k: "School code", v: school?.code ?? "-" },
    { k: "Session", v: session?.name ?? "-" },
    { k: "Current term", v: termLabel(term) },
    { k: "School phone", v: school?.phone ?? "Not set" },
    { k: "Address", v: school?.address ?? "Not set" },
  ];
  return (
    <PanelShell
      title="Account Information"
      subtitle="Your details and the school on record."
    >
      <Card className="p-0">
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-ink-faint">{r.k}</dt>
              <dd className="text-right text-sm font-semibold text-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {can(role, "edit_fees") && (
        <BankAccountCard school={school} onSaved={reload} />
      )}
    </PanelShell>
  );
}

function BankAccountCard({
  school,
  onSaved,
}: {
  school: School | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    accountNumber: school?.bankAccountNumber ?? "",
    accountName: school?.bankAccountName ?? "",
    bankName: school?.bankName ?? "",
  });
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed the form once school data arrives (guarded set-state-during-render).
  if (!seeded && school) {
    setSeeded(true);
    setForm({
      accountNumber: school.bankAccountNumber ?? "",
      accountName: school.bankAccountName ?? "",
      bankName: school.bankName ?? "",
    });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setError(null);
    setResult(null);
    if (!form.accountNumber.trim() || !form.accountName.trim() || !form.bankName.trim()) {
      return setError("Enter the account number, account name and bank name.");
    }
    setSaving(true);
    try {
      await repository.updateBankAccount({
        accountNumber: form.accountNumber,
        accountName: form.accountName,
        bankName: form.bankName,
      });
      setResult("Bank account details saved.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <h3 className="font-display text-lg font-bold text-ink">Bank Account Information</h3>
      <p className="mt-0.5 mb-4 text-sm text-ink-muted">
        Shown on every invoice and receipt so parents pay into the right account.
      </p>
      <div className="space-y-3">
        <Field label="Account number">
          <Input value={form.accountNumber} onChange={set("accountNumber")} inputMode="numeric" placeholder="0123456789" />
        </Field>
        <Field label="Account name">
          <Input value={form.accountName} onChange={set("accountName")} placeholder="Tejuosho Group of Schools" />
        </Field>
        <Field label="Bank name">
          <Input value={form.bankName} onChange={set("bankName")} placeholder="First Bank" />
        </Field>
        {error && <Banner tone="error">{error}</Banner>}
        {result && <Banner tone="success">{result}</Banner>}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save bank details"}
        </Button>
      </div>
    </Card>
  );
}
```

Note: the assistant never enters real account numbers; this is a user-facing form only.

- [ ] **Step 2: Add the `School` import**

Ensure `School` is imported in the file:

```ts
import type { FeeItem, Staff, StaffType, School } from "@/lib/domain/types";
```

(Adjust the existing type import line to include `School`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Start the dev server via preview_start (`{name}` from `.claude/launch.json`; create it if missing per that tool's format). Sign-in is required, so if the authed area is unreachable, verify by confirming `npx tsc --noEmit` passes and the panel renders on the profile route. Check `read_console_messages` for errors after navigating to `/profile`.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: bank account information form on profile"
```

---

### Task 5: Setup panel in Profile

Adds a new "Setup" panel, listed first, rendering the full checklist from the hook.

**Files:**
- Modify: `src/app/profile/page.tsx` (PanelId, PANELS, switch, new SetupPanel)

**Interfaces:**
- Consumes: `useSetupTasks` (Task 3); existing `Card`, `Button`, `EmptyState`, `LoadingBlock`, `cn`, `can`.

- [ ] **Step 1: Register the panel**

In `src/app/profile/page.tsx`:

- Extend the type: `type PanelId = "setup" | "account" | "staff" | "fees" | "roles" | "appearance";`
- Add to `PANELS` as the FIRST entry: `{ id: "setup", label: "Setup" },`
- Default the initial panel to setup: `const [panel, setPanel] = useState<PanelId>("setup");`
- In the panel switch/render, add: `{panel === "setup" && <SetupPanel onGoTo={setPanel} />}`

- [ ] **Step 2: Implement SetupPanel**

Add this component in `src/app/profile/page.tsx`:

```tsx
import { useSetupTasks } from "@/lib/setup/useSetupTasks";
import type { SetupTaskId } from "@/lib/setup/setupTasks";
import Link from "next/link";
// (add these imports at the top of the file alongside the others)

function SetupPanel({ onGoTo }: { onGoTo: (p: PanelId) => void }) {
  const { role } = useViewer();
  const { state, loading, dismiss } = useSetupTasks();

  if (!can(role, "edit_fees")) {
    return (
      <PanelShell title="Setup">
        <EmptyState
          title="Setup is for the Proprietor and Bursar"
          description="Ask an administrator to finish setting up the school."
        />
      </PanelShell>
    );
  }
  if (loading || !state) {
    return (
      <PanelShell title="Setup">
        <LoadingBlock label="Checking your setup…" />
      </PanelShell>
    );
  }

  // Where each task's "fix it" action goes. Fees/bank/staff switch panels
  // in place; students is a route.
  const panelFor: Partial<Record<SetupTaskId, PanelId>> = {
    fees: "fees",
    bank: "account",
    staff: "staff",
  };

  return (
    <PanelShell
      title="Setup"
      subtitle="Finish these to get your school ready to record payments."
    >
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Setup progress</span>
          <span className="money text-sm font-bold text-ink">{state.percentage}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${state.percentage}%` }}
          />
        </div>
      </Card>

      <ul className="mt-4 space-y-2.5">
        {state.tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                t.done ? "bg-success text-white" : "border-[1.5px] border-border text-ink-faint",
              )}
              aria-hidden
            >
              {t.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold", t.done ? "text-ink-faint line-through" : "text-ink")}>
                {t.title}
              </p>
              <p className="text-xs text-ink-muted">{t.why}</p>
            </div>
            {!t.done && (
              panelFor[t.id] ? (
                <Button variant="ghost" onClick={() => onGoTo(panelFor[t.id]!)}>
                  Set up
                </Button>
              ) : (
                <Link
                  href={t.href}
                  className="inline-flex min-h-11 items-center rounded-lg bg-slate-tint px-4 text-sm font-semibold text-ink"
                >
                  Set up
                </Link>
              )
            )}
            {!t.done && t.dismissible && (
              <button
                onClick={() => dismiss(t.id)}
                className="text-xs font-semibold text-ink-faint hover:text-ink"
              >
                Dismiss
              </button>
            )}
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: Setup panel in profile with live checklist"
```

---

### Task 6: Dashboard setup card

Pins a compact card to the top of the dashboard that self-hides when all blockers are done.

**Files:**
- Create: `src/components/SetupCard.tsx`
- Modify: `src/app/page.tsx` (mount card at top)

**Interfaces:**
- Consumes: `useSetupTasks` (Task 3); `useViewer`, `can`; `Card`, `Button` from ui.
- Produces: `export function SetupCard(): JSX.Element | null`

- [ ] **Step 1: Implement the card**

```tsx
// src/components/SetupCard.tsx
"use client";

import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { useSetupTasks } from "@/lib/setup/useSetupTasks";
import { Card } from "@/components/ui";

/**
 * "Finish setting up" prompt on the dashboard. Renders only for admins with
 * outstanding blockers; disappears the moment every blocker is done.
 */
export function SetupCard() {
  const { role } = useViewer();
  const { state, loading } = useSetupTasks();

  if (!can(role, "edit_fees")) return null;
  if (loading || !state) return null;
  if (state.allBlockersDone || !state.nextTask) return null;

  const next = state.nextTask;
  const remaining = state.tasks.filter((t) => t.tier === "blocker" && !t.done).length;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">Finish setting up</p>
          <p className="text-sm text-ink-muted">
            {remaining} {remaining === 1 ? "step" : "steps"} left. Next: {next.title.toLowerCase()}.
          </p>
        </div>
        <span className="money shrink-0 text-lg font-bold text-primary">{state.percentage}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${state.percentage}%` }}
        />
      </div>
      <Link
        href={next.href}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
      >
        {next.title}
      </Link>
    </Card>
  );
}
```

- [ ] **Step 2: Mount it on the dashboard**

In `src/app/page.tsx`, import and render `<SetupCard />` as the first child of the dashboard's returned container (above the hero). Add:

```tsx
import { SetupCard } from "@/components/SetupCard";
```

and place `<SetupCard />` at the top of the main returned JSX block.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds, all routes compile.

- [ ] **Step 4: Verify in the browser**

Reload the dashboard route in the preview. `read_console_messages` for errors. In the mock backend the card should be visible (fee items/bank unset in seed). Screenshot for proof if the dashboard is reachable.

- [ ] **Step 5: Commit**

```bash
git add src/components/SetupCard.tsx src/app/page.tsx
git commit -m "feat: dashboard setup card, self-hides when set up"
```

---

### Task 7: Soft-block prompt on Add student

When the school has no fee structure at all, the Add-student bill area shows a prompt to set up fees first instead of only an empty manual entry.

**Files:**
- Modify: `src/app/students/new/page.tsx`

**Interfaces:**
- Consumes: existing `feeItems` from `useAsync(listFeeItems)`; `Banner` from ui; `Link`.

- [ ] **Step 1: Add the prompt above the bill picker**

In `src/app/students/new/page.tsx`, compute whether the school has any fee structure, and show a prompt when a class is chosen but no fees exist anywhere. Add near the top of the component body (after `feeItems` is destructured):

```tsx
  const hasAnyFeeStructure = (feeItems?.length ?? 0) > 0;
```

Then, inside the `{form.classId && (...)}` block, render a prompt above the `<BillPicker>` when there is no structure. Replace the existing `Field` wrapping the picker with:

```tsx
        {form.classId && (
          <>
            {!hasAnyFeeStructure && (
              <Banner tone="info" title="No fee structure yet">
                You can type this bill by hand now, or set up your class fees
                first so bills load automatically.{" "}
                <Link href="/profile" className="font-semibold text-primary underline">
                  Set up fees
                </Link>
              </Banner>
            )}
            <Field
              label="Bill"
              hint={
                levelItems.length > 0
                  ? `Loaded from the ${selectedClass?.level} fee structure. Untick anything that does not apply.`
                  : "This class has no fee structure yet. Enter the bill items manually."
              }
            >
              <BillPicker value={draft} onChange={setDraft} />
            </Field>
          </>
        )}
```

- [ ] **Step 2: Add the `Banner` import**

Update the ui import line:

```ts
import { Button, Field, Input, Select, LoadingBlock, Banner } from "@/components/ui";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/students/new/page.tsx
git commit -m "feat: soft-block prompt to set up fees on add-student"
```

---

### Task 8: Full verification + security audit + build

Final gate. Runs the whole suite, a production build, and the post-build adversarial security audit (the pre-build audit runs at execution kickoff).

**Files:** none (verification only; commit any fixes found).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all Vitest files pass (bankAccount, setupTasks, dismissal, plus existing).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no type errors; build succeeds for all routes.

- [ ] **Step 3: Post-build security audit**

Run the saved adversarial audit prompt. Include a live-DB check via Supabase MCP `get_advisors` (security) for project `pbrirletzhvanmmxithr`, and confirm:
- `schools` now has exactly two policies: `read_same_school` (select) and `manage_school` (update). No insert/delete policy on schools from the client.
- `profiles` still has NO insert/update policy (unchanged).
- The `manage_school` policy's `USING`/`WITH CHECK` both bind `id = auth_school_id()` and `auth_role() in ('proprietor','bursar')`.

Record the audit result (accepted warnings vs new findings). Fix any new finding before proceeding.

- [ ] **Step 4: Browser smoke check**

In the preview: dashboard shows the setup card with a live percentage; Profile > Setup lists the tasks and the bar matches; saving bank details in Account then reopening Setup shows the bank task checked; dismissing the staff nudge moves the percentage to 100 and the card hides once blockers are done. `read_console_messages` clean.

- [ ] **Step 5: Commit any fixes + push**

```bash
git add -A
git commit -m "chore: verify setup task view (tests, build, security audit)"
git push origin develop
```

---

## Self-Review

**Spec coverage:**
- Hybrid checklist, three blockers, dismissible nudges → Tasks 2, 5, 6.
- Fee-structure = all class levels covered (with no-classes fallback) → Task 2 (`feesDone`), tested.
- Bank info blocker + subsection → Tasks 1, 4.
- Weighted percentage, blockers ≥15%, self-rebalancing vendors → Task 2, tested.
- Single source of truth (`useSetupTasks`) → Task 3, consumed by 5/6/7.
- Dashboard card self-hides on blockers → Task 6.
- Profile Setup panel with percentage → Task 5.
- Point-of-action soft-block → Task 7.
- schools UPDATE policy; no profiles change; localStorage dismissal → Tasks 1, 3; audited in Task 8.
- Permissions gate to proprietor/bursar → Tasks 5, 6.
- No em-dashes → Global Constraints; all copy in this plan uses colons/periods.
- Security audit before + after → Global Constraints + Task 8.

**Placeholder scan:** Task 4 Step 1 contains one deliberate typo (`value={form.accountName ? ...}`) that Step 2 explicitly fixes to `value={form.accountNumber}`; flagged, not a latent placeholder. No TBD/TODO elsewhere.

**Type consistency:** `SetupTaskId`, `SetupTask`, `SetupState`, `DeriveSetupInput`, `deriveSetupTasks`, `isBankComplete`, `StorageLike`, `readDismissed`/`addDismissed`, `useSetupTasks` returning `{ state, loading, dismiss }`, and `BankAccountInput`/`updateBankAccount` are used identically across Tasks 1-7.
