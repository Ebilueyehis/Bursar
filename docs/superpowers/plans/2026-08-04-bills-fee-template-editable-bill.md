# Bills: Excel Fee Template + Editable Student Bill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin set every class's fees from one uploaded Excel sheet, and tailor any individual student's bill (remove/add/reduce lines, plus a reason-carrying discount) without breaking the class template.

**Architecture:** Builds on the existing snapshot bill model (`Bill.lines`) and level-keyed `FeeItem`s. Adds pure, unit-tested helpers (`feeTemplate.ts`, `billMath.ts`), two repository methods (`importFeeStructure`, `updateBillLines`) plus a `createStudent` extension, one shared `BillPicker` component, and UI wiring on the Fees panel, the new-student page, and the student record. No new database tables.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, SheetJS (`xlsx`), Supabase (Postgres + RLS). Vitest for unit tests (added in Task 1).

## Global Constraints

- Money is integer **kobo** end to end; display always two decimals via the `Money` component / `formatNaira`. Template `Amount` column is whole Naira; convert on import (`* 100`).
- **No em-dashes** (the `—` character) anywhere in app-facing text. Use colons or hyphens.
- Fees are keyed by class **level** (e.g. "JSS 1"), not section. Sections share their level's fees.
- Bills are **snapshots**: editing a class template never rewrites bills already issued.
- Every new repository write must be added to BOTH `src/lib/data/mock.ts` and `src/lib/data/supabase-repo.ts` (they both implement `Repository`).
- After the build: `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` passes, and a full adversarial security audit before and after (standing project rule).
- Reuse `exportToXlsx` / `readSheetRows` from `src/lib/export.ts`. Do not add a second spreadsheet path.

## File Structure

- Create: `vitest.config.ts` — test runner config with `@` → `src` alias.
- Create: `src/lib/fees/feeTemplate.ts` — build + parse the fee template sheet (pure).
- Create: `src/lib/fees/feeTemplate.test.ts` — unit tests.
- Create: `src/lib/fees/billMath.ts` — subtotal/total/validation for a bill (pure).
- Create: `src/lib/fees/billMath.test.ts` — unit tests.
- Create: `src/lib/data/bills.repo.test.ts` — repository behavior tests against `mockRepository`.
- Create: `src/components/BillPicker.tsx` — the shared bill editor.
- Modify: `src/lib/data/repository.ts` — new types + method signatures + `CreateStudentInput` fields.
- Modify: `src/lib/data/mock.ts` — implement new methods + extend `createStudent`.
- Modify: `src/lib/data/supabase-repo.ts` — mirror the same behavior against Postgres.
- Modify: `src/app/profile/page.tsx` — Fee template card in `FeesPanel`.
- Modify: `src/app/students/new/page.tsx` — use `BillPicker`.
- Modify: `src/app/students/[id]/page.tsx` — add a Bill tab using `BillPicker`.
- Modify: `package.json` — `test` script + Vitest devDeps.

---

### Task 1: Test tooling (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/fees/sanity.test.ts` (temporary, deleted at end of task)

**Interfaces:**
- Produces: an `npm test` script that runs Vitest once (CI mode), resolving the `@/` path alias.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^2`

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 4: Write a sanity test**

`src/lib/fees/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Delete the sanity test and commit**

```bash
rm src/lib/fees/sanity.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add Vitest runner with @ alias"
```

---

### Task 2: `feeTemplate.ts` — build and parse the template

**Files:**
- Create: `src/lib/fees/feeTemplate.ts`
- Create: `src/lib/fees/feeTemplate.test.ts`

**Interfaces:**
- Produces:
  - `FEE_TEMPLATE_HEADERS: readonly ["Class","Item","Amount","Optional"]`
  - `interface FeeTemplateRow { level: string; name: string; amountKobo: number; optional: boolean }`
  - `interface FeeTemplateParse { rows: FeeTemplateRow[]; errors: string[] }`
  - `buildFeeTemplateRows(levels: string[], existingByLevel: Record<string, { name: string; amountKobo: number; optional?: boolean }[]>): (string | number)[][]`
  - `parseFeeTemplate(sheetRows: Record<string, string>[], knownLevels: string[]): FeeTemplateParse`
- Consumes: nothing (pure).

- [ ] **Step 1: Write the failing tests**

`src/lib/fees/feeTemplate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  FEE_TEMPLATE_HEADERS,
  buildFeeTemplateRows,
  parseFeeTemplate,
} from "@/lib/fees/feeTemplate";

describe("buildFeeTemplateRows", () => {
  it("emits existing items as Naira with Yes/No, ordered by the levels given", () => {
    const rows = buildFeeTemplateRows(
      ["Creche", "JSS 1"],
      {
        Creche: [{ name: "School fee", amountKobo: 4000000, optional: false }],
        "JSS 1": [{ name: "Computer", amountKobo: 1000000, optional: true }],
      },
    );
    expect(rows).toEqual([
      ["Creche", "School fee", 40000, "No"],
      ["JSS 1", "Computer", 10000, "Yes"],
    ]);
  });

  it("falls back to starter items for a level with no existing items", () => {
    const rows = buildFeeTemplateRows(["Creche"], {});
    expect(rows).toEqual([
      ["Creche", "School fee", 0, "No"],
      ["Creche", "Sportswear", 0, "No"],
      ["Creche", "Books", 0, "No"],
    ]);
  });
});

describe("parseFeeTemplate", () => {
  const known = ["Creche", "JSS 1"];

  it("parses valid rows into kobo", () => {
    const out = parseFeeTemplate(
      [
        { Class: "Creche", Item: "School fee", Amount: "40000", Optional: "No" },
        { Class: "JSS 1", Item: "Computer", Amount: "10,000", Optional: "Yes" },
      ],
      known,
    );
    expect(out.errors).toEqual([]);
    expect(out.rows).toEqual([
      { level: "Creche", name: "School fee", amountKobo: 4000000, optional: false },
      { level: "JSS 1", name: "Computer", amountKobo: 1000000, optional: true },
    ]);
  });

  it("rejects unknown class, blank item, bad amount, bad optional; keeps valid rows", () => {
    const out = parseFeeTemplate(
      [
        { Class: "SS 9", Item: "X", Amount: "1", Optional: "No" },
        { Class: "Creche", Item: "  ", Amount: "1", Optional: "No" },
        { Class: "Creche", Item: "Books", Amount: "abc", Optional: "No" },
        { Class: "Creche", Item: "Bus", Amount: "-5", Optional: "No" },
        { Class: "Creche", Item: "Lab", Amount: "500", Optional: "maybe" },
        { Class: "Creche", Item: "Tuition", Amount: "5000", Optional: "" },
      ],
      known,
    );
    expect(out.rows).toEqual([
      { level: "Creche", name: "Tuition", amountKobo: 500000, optional: false },
    ]);
    expect(out.errors).toHaveLength(5);
    expect(out.errors[0]).toContain("unknown class");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/lib/fees/feeTemplate.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `feeTemplate.ts`**

```ts
export const FEE_TEMPLATE_HEADERS = [
  "Class",
  "Item",
  "Amount",
  "Optional",
] as const;

export interface FeeTemplateRow {
  level: string;
  name: string;
  amountKobo: number;
  optional: boolean;
}

export interface FeeTemplateParse {
  rows: FeeTemplateRow[];
  errors: string[];
}

const STARTER_ITEMS = ["School fee", "Sportswear", "Books"];

export function buildFeeTemplateRows(
  levels: string[],
  existingByLevel: Record<
    string,
    { name: string; amountKobo: number; optional?: boolean }[]
  >,
): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (const level of levels) {
    const items = existingByLevel[level];
    if (items && items.length > 0) {
      for (const it of items) {
        out.push([level, it.name, it.amountKobo / 100, it.optional ? "Yes" : "No"]);
      }
    } else {
      for (const name of STARTER_ITEMS) out.push([level, name, 0, "No"]);
    }
  }
  return out;
}

export function parseFeeTemplate(
  sheetRows: Record<string, string>[],
  knownLevels: string[],
): FeeTemplateParse {
  const rows: FeeTemplateRow[] = [];
  const errors: string[] = [];
  const canon = new Map(knownLevels.map((l) => [l.toLowerCase(), l]));

  sheetRows.forEach((raw, idx) => {
    const rowNo = idx + 2; // header is row 1
    const level = canon.get((raw.Class ?? "").trim().toLowerCase());
    const name = (raw.Item ?? "").trim();
    const amountRaw = (raw.Amount ?? "").replace(/,/g, "").trim();
    const optRaw = (raw.Optional ?? "").trim().toLowerCase();

    if (!level) {
      errors.push(`Row ${rowNo}: unknown class "${raw.Class ?? ""}"`);
      return;
    }
    if (!name) {
      errors.push(`Row ${rowNo}: item name is required`);
      return;
    }
    const amount = Number(amountRaw);
    if (amountRaw === "" || !Number.isFinite(amount) || amount < 0) {
      errors.push(`Row ${rowNo}: amount "${raw.Amount ?? ""}" is not valid`);
      return;
    }
    let optional: boolean;
    if (optRaw === "" || optRaw === "no") optional = false;
    else if (optRaw === "yes") optional = true;
    else {
      errors.push(`Row ${rowNo}: Optional must be Yes or No`);
      return;
    }
    rows.push({ level, name, amountKobo: Math.round(amount * 100), optional });
  });

  return { rows, errors };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/lib/fees/feeTemplate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fees/feeTemplate.ts src/lib/fees/feeTemplate.test.ts
git commit -m "feat: fee template build + parse helpers"
```

---

### Task 3: `billMath.ts` — bill totals and validation

**Files:**
- Create: `src/lib/fees/billMath.ts`
- Create: `src/lib/fees/billMath.test.ts`

**Interfaces:**
- Produces:
  - `interface PickerLine { name: string; amountKobo: number; checked: boolean }`
  - `interface BillDraft { lines: PickerLine[]; discountKobo: number; discountReason: string }`
  - `checkedLines(draft: BillDraft): { name: string; amountKobo: number }[]` — checked, non-blank name, amount >= 0.
  - `subtotalKobo(draft: BillDraft): number`
  - `billTotalKobo(draft: BillDraft): number` — `max(0, subtotal - discount)`.
  - `validateBillDraft(draft: BillDraft, paidKobo?: number): string | null` — returns an error message or null.
- Consumes: nothing (pure).

- [ ] **Step 1: Write the failing tests**

`src/lib/fees/billMath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  type BillDraft,
  checkedLines,
  subtotalKobo,
  billTotalKobo,
  validateBillDraft,
} from "@/lib/fees/billMath";

const draft = (over: Partial<BillDraft> = {}): BillDraft => ({
  lines: [
    { name: "School fee", amountKobo: 9000000, checked: true },
    { name: "Computer", amountKobo: 1000000, checked: false },
    { name: "Books", amountKobo: 800000, checked: true },
  ],
  discountKobo: 0,
  discountReason: "",
  ...over,
});

describe("billMath", () => {
  it("counts only checked, valid lines", () => {
    expect(checkedLines(draft())).toEqual([
      { name: "School fee", amountKobo: 9000000 },
      { name: "Books", amountKobo: 800000 },
    ]);
    expect(subtotalKobo(draft())).toBe(9800000);
  });

  it("applies discount, never below zero", () => {
    expect(billTotalKobo(draft({ discountKobo: 1000000 }))).toBe(8800000);
    expect(billTotalKobo(draft({ discountKobo: 99999999 }))).toBe(0);
  });

  it("requires a reason when a discount is set", () => {
    expect(validateBillDraft(draft({ discountKobo: 1000000 }))).toContain("reason");
    expect(validateBillDraft(draft({ discountKobo: 1000000, discountReason: "sibling" }))).toBeNull();
  });

  it("blocks a total below what has already been paid", () => {
    expect(validateBillDraft(draft(), 9900000)).toContain("already been paid");
    expect(validateBillDraft(draft(), 9800000)).toBeNull();
  });

  it("requires at least one line", () => {
    expect(validateBillDraft(draft({ lines: [] }))).toContain("at least one");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/lib/fees/billMath.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `billMath.ts`**

```ts
export interface PickerLine {
  name: string;
  amountKobo: number;
  checked: boolean;
}

export interface BillDraft {
  lines: PickerLine[];
  discountKobo: number;
  discountReason: string;
}

export function checkedLines(
  draft: BillDraft,
): { name: string; amountKobo: number }[] {
  return draft.lines
    .filter((l) => l.checked && l.name.trim() !== "" && l.amountKobo >= 0)
    .map((l) => ({ name: l.name.trim(), amountKobo: l.amountKobo }));
}

export function subtotalKobo(draft: BillDraft): number {
  return checkedLines(draft).reduce((s, l) => s + l.amountKobo, 0);
}

export function billTotalKobo(draft: BillDraft): number {
  return Math.max(0, subtotalKobo(draft) - Math.max(0, draft.discountKobo));
}

export function validateBillDraft(
  draft: BillDraft,
  paidKobo?: number,
): string | null {
  if (checkedLines(draft).length === 0) {
    return "Add at least one item to the bill.";
  }
  if (draft.discountKobo > 0 && draft.discountReason.trim() === "") {
    return "Enter a reason for the discount.";
  }
  if (paidKobo !== undefined && billTotalKobo(draft) < paidKobo) {
    return "New bill total is less than what has already been paid.";
  }
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/lib/fees/billMath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fees/billMath.ts src/lib/fees/billMath.test.ts
git commit -m "feat: bill draft math + validation helpers"
```

---

### Task 4: Repository interface, types, and `CreateStudentInput` extension

**Files:**
- Modify: `src/lib/data/repository.ts`

**Interfaces:**
- Produces (added to the `Repository` interface and exported types):
  - `interface BillLineInput { name: string; amountKobo: number }`
  - `interface FeeStructureImportResult { levelsUpdated: number; itemsWritten: number; skipped: number }`
  - `importFeeStructure(term: TermName, rows: FeeTemplateRow[]): Promise<FeeStructureImportResult>`
  - `updateBillLines(studentId: string, term: TermName, lines: BillLineInput[]): Promise<void>`
  - `CreateStudentInput` gains: `billLines?: BillLineInput[]; discountKobo?: number; discountReason?: string`
- Consumes: `FeeTemplateRow` from `@/lib/fees/feeTemplate`.

- [ ] **Step 1: Add the import for `FeeTemplateRow`**

At the top of `src/lib/data/repository.ts`, add:

```ts
import type { FeeTemplateRow } from "@/lib/fees/feeTemplate";
```

- [ ] **Step 2: Add the two method signatures**

Inside the `Repository` interface, in the "Fee structure & discounts" section (after `setStudentDiscount`), add:

```ts
  /** Replace fee structure for every class level present in the uploaded rows. */
  importFeeStructure(
    term: TermName,
    rows: FeeTemplateRow[],
  ): Promise<FeeStructureImportResult>;

  /** Replace a student's bill snapshot lines for the term. Discount is untouched. */
  updateBillLines(
    studentId: string,
    term: TermName,
    lines: BillLineInput[],
  ): Promise<void>;
```

- [ ] **Step 3: Add the new exported types**

Near `FeeLineInput`, add:

```ts
export interface BillLineInput {
  name: string;
  amountKobo: number;
}

export interface FeeStructureImportResult {
  levelsUpdated: number;
  itemsWritten: number;
  skipped: number;
}
```

- [ ] **Step 4: Extend `CreateStudentInput`**

Add to the `CreateStudentInput` interface:

```ts
  /** Chosen + edited bill lines from the picker. If omitted, falls back to termFeeKobo. */
  billLines?: BillLineInput[];
  discountKobo?: number;
  discountReason?: string;
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL, only with errors that `mockRepository` and `supabaseRepository` are missing `importFeeStructure` / `updateBillLines` (implemented in the next tasks). No other errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/repository.ts
git commit -m "feat: repository types for fee import + editable bills"
```

---

### Task 5: Mock `importFeeStructure`

**Files:**
- Modify: `src/lib/data/mock.ts`
- Create: `src/lib/data/bills.repo.test.ts`

**Interfaces:**
- Consumes: `FeeTemplateRow` (`@/lib/fees/feeTemplate`), existing `saveFeeStructure`, `listFeeItems`.
- Produces: `mockRepository.importFeeStructure`.

- [ ] **Step 1: Write the failing test**

`src/lib/data/bills.repo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mockRepository as repo } from "@/lib/data/mock";

describe("importFeeStructure (mock)", () => {
  it("groups rows by level and writes each level's items", async () => {
    const res = await repo.importFeeStructure("first", [
      { level: "Creche", name: "School fee", amountKobo: 4000000, optional: false },
      { level: "Creche", name: "Sportswear", amountKobo: 800000, optional: true },
      { level: "JSS 1", name: "School fee", amountKobo: 9000000, optional: false },
    ]);
    expect(res.levelsUpdated).toBe(2);
    expect(res.itemsWritten).toBe(3);

    const items = await repo.listFeeItems("first");
    const creche = items.filter((i) => i.level === "Creche");
    expect(creche.map((i) => i.name).sort()).toEqual(["School fee", "Sportswear"]);
    expect(creche.find((i) => i.name === "Sportswear")?.optional).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/lib/data/bills.repo.test.ts`
Expected: FAIL (`importFeeStructure` is not a function).

- [ ] **Step 3: Implement in `mock.ts`**

Add the `FeeTemplateRow` import to the type imports at the top:

```ts
import type { FeeTemplateRow } from "@/lib/fees/feeTemplate";
```

Also add `FeeStructureImportResult` to the existing `@/lib/data/repository` type import list.

Then, in the "Fee structure & discounts" section (after `saveFeeStructure`), add:

```ts
  async importFeeStructure(
    term: TermName,
    rows: FeeTemplateRow[],
  ): Promise<FeeStructureImportResult> {
    await tick();
    const byLevel = new Map<string, FeeTemplateRow[]>();
    for (const r of rows) {
      const list = byLevel.get(r.level) ?? [];
      list.push(r);
      byLevel.set(r.level, list);
    }
    let itemsWritten = 0;
    for (const [level, items] of byLevel) {
      await this.saveFeeStructure(
        level,
        term,
        items.map((i) => ({
          name: i.name,
          amountKobo: i.amountKobo,
          optional: i.optional,
        })),
      );
      itemsWritten += items.length;
    }
    return { levelsUpdated: byLevel.size, itemsWritten, skipped: 0 };
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/lib/data/bills.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/mock.ts src/lib/data/bills.repo.test.ts
git commit -m "feat: mock importFeeStructure"
```

---

### Task 6: Mock `updateBillLines` (with below-paid guard)

**Files:**
- Modify: `src/lib/data/mock.ts`
- Modify: `src/lib/data/bills.repo.test.ts`

**Interfaces:**
- Consumes: `BillLineInput`, existing `BILLS`, `paymentsFor`.
- Produces: `mockRepository.updateBillLines`.

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/data/bills.repo.test.ts`:

```ts
import type { BillLineInput } from "@/lib/data/repository";

describe("updateBillLines (mock)", () => {
  it("replaces the bill's lines", async () => {
    const student = await repo.createStudent({
      firstName: "Ada", lastName: "Obi", classId: "c1",
      termFeeKobo: 5000000,
      guardianName: "Mr Obi", guardianPhone: "08030000000",
    });
    const lines: BillLineInput[] = [
      { name: "School fee", amountKobo: 6000000 },
      { name: "Books", amountKobo: 1000000 },
    ];
    await repo.updateBillLines(student.id, "first", lines);
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toEqual(lines.map((l) => ({ name: l.name, amount: l.amountKobo })));
    expect(acct?.billTotal).toBe(7000000);
  });

  it("blocks a new total below what is already paid", async () => {
    const student = await repo.createStudent({
      firstName: "Uche", lastName: "Eze", classId: "c1",
      termFeeKobo: 5000000,
      guardianName: "Mrs Eze", guardianPhone: "08030000001",
    });
    await repo.recordPayment({
      studentId: student.id, term: "first", amount: 4000000,
      method: "cash", recordedByName: "Bursar",
    });
    await expect(
      repo.updateBillLines(student.id, "first", [{ name: "School fee", amountKobo: 3000000 }]),
    ).rejects.toThrow(/already been paid/);
  });
});
```

Note: `classId: "c1"` must be a real seeded class id. Before writing the implementation, open `src/lib/data/seed.ts`, read the `CLASSES` array, and replace `"c1"` in both tests with an actual class id from the seed.

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/lib/data/bills.repo.test.ts`
Expected: FAIL (`updateBillLines` is not a function).

- [ ] **Step 3: Implement in `mock.ts`**

Add `BillLineInput` to the `@/lib/data/repository` type import list, then after `setStudentDiscount` add:

```ts
  async updateBillLines(
    studentId: string,
    term: TermName,
    lines: BillLineInput[],
  ): Promise<void> {
    await tick();
    const bill = BILLS.find((b) => b.studentId === studentId && b.term === term);
    if (!bill) throw new Error("This student has no bill for the term yet.");
    const clean = lines
      .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
      .map((l) => ({ name: l.name.trim(), amount: l.amountKobo }));
    if (clean.length === 0) throw new Error("A bill needs at least one item.");
    const newTotal = clean.reduce((s, l) => s + l.amount, 0) - bill.discount;
    const paid = paymentsFor(bill.id).reduce((s, p) => s + p.amount, 0);
    if (newTotal < paid) {
      throw new Error("New bill total is less than what has already been paid.");
    }
    bill.lines = clean;
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test src/lib/data/bills.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/mock.ts src/lib/data/bills.repo.test.ts
git commit -m "feat: mock updateBillLines with below-paid guard"
```

---

### Task 7: Mock `createStudent` extension (billLines + discount)

**Files:**
- Modify: `src/lib/data/mock.ts`
- Modify: `src/lib/data/bills.repo.test.ts`

**Interfaces:**
- Consumes: extended `CreateStudentInput`.
- Produces: `createStudent` honours `billLines`, `discountKobo`, `discountReason`.

- [ ] **Step 1: Add the failing test**

Append to `src/lib/data/bills.repo.test.ts`:

```ts
describe("createStudent with billLines + discount (mock)", () => {
  it("uses the chosen lines and records the discount", async () => {
    const student = await repo.createStudent({
      firstName: "Bola", lastName: "Ade", classId: "c1", // replace c1 with a real seed id
      termFeeKobo: 0,
      billLines: [
        { name: "School fee", amountKobo: 9000000 },
        { name: "Books", amountKobo: 800000 },
      ],
      discountKobo: 1000000,
      discountReason: "sibling",
      guardianName: "Mr Ade", guardianPhone: "08030000002",
    });
    const acct = await repo.getStudentAccount(student.id, "first");
    expect(acct?.bill.lines).toHaveLength(2);
    expect(acct?.bill.discount).toBe(1000000);
    expect(acct?.bill.discountReason).toBe("sibling");
    expect(acct?.billTotal).toBe(8800000); // 9.8m - 1m
  });
});
```

(Use the same real class id as Task 6, and make sure `SCHOOL.currentTerm` is `"first"` in the seed; if not, assert against the seed's current term.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test src/lib/data/bills.repo.test.ts`
Expected: FAIL (bill uses fallback lines / discount is 0).

- [ ] **Step 3: Implement in `mock.ts`**

In `createStudent`, replace the bill-building block (the part that computes `lines` and pushes to `BILLS`) with:

```ts
    // Bill lines: prefer explicitly chosen picker lines, then class structure, then the typed term fee.
    let lines: { name: string; amount: number }[] = [];
    if (input.billLines && input.billLines.length > 0) {
      lines = input.billLines
        .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
        .map((l) => ({ name: l.name.trim(), amount: l.amountKobo }));
    } else if (structure.length > 0) {
      lines = structure.map((f) => ({ name: f.name, amount: f.amount }));
    } else if (input.termFeeKobo > 0) {
      lines = [{ name: "Term fee", amount: input.termFeeKobo }];
    }
    if (lines.length > 0) {
      BILLS.push({
        id: `b-new-${Date.now()}`,
        schoolId: SCHOOL.id,
        studentId: sId,
        sessionId: SESSION.id,
        term: SCHOOL.currentTerm,
        lines,
        discount: Math.max(0, input.discountKobo ?? 0),
        discountReason: input.discountReason,
        createdOn: new Date().toISOString().slice(0, 10),
      });
    }
```

(The existing `const structure = FEE_ITEMS.filter(...)` line stays above this block.)

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/mock.ts src/lib/data/bills.repo.test.ts
git commit -m "feat: mock createStudent honours chosen bill lines + discount"
```

---

### Task 8: Supabase repository — mirror the three changes

**Files:**
- Modify: `src/lib/data/supabase-repo.ts`

**Interfaces:**
- Produces: `supabaseRepository.importFeeStructure`, `.updateBillLines`, and `createStudent` honouring `billLines`/`discount` — same behavior as the mock, against Postgres.

- [ ] **Step 1: Read the existing patterns**

Open `src/lib/data/supabase-repo.ts` and read its `saveFeeStructure`, `setStudentDiscount`, `generateBill`, and `createStudent` implementations. Note the client (`this.supabase` or module client), the table names (`fee_items`, `bills`), and how a bill's `lines` (jsonb) and `discount` are written.

- [ ] **Step 2: Implement `importFeeStructure`**

Mirror the mock: group `rows` by `level`, call the existing `saveFeeStructure(level, term, items)` per group, return `{ levelsUpdated, itemsWritten, skipped: 0 }`. Add the `FeeTemplateRow` / `FeeStructureImportResult` imports.

- [ ] **Step 3: Implement `updateBillLines`**

Load the student's bill row for the term. If none, throw `"This student has no bill for the term yet."`. Clean the lines (non-blank name, amount >= 0); throw if empty. Compute `newTotal = sum(lines) - bill.discount`; load payments for that bill and sum them; if `newTotal < paid` throw `"New bill total is less than what has already been paid."`. Otherwise update the bill row's `lines`.

- [ ] **Step 4: Extend `createStudent`**

Apply the same precedence as the mock (explicit `billLines` first, then class structure, then `termFeeKobo`), and write `discount = max(0, discountKobo ?? 0)` and `discountReason` onto the created bill.

- [ ] **Step 5: Verify typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS (no missing-method errors remain).
Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/supabase-repo.ts
git commit -m "feat: supabase fee import + editable bills + bill lines on create"
```

---

### Task 9: `BillPicker` component

**Files:**
- Create: `src/components/BillPicker.tsx`

**Interfaces:**
- Consumes: `billMath` (`BillDraft`, `subtotalKobo`, `billTotalKobo`, `validateBillDraft`), `Money`, `NairaInput`, `Input`, `Field`, `parseNairaToKobo` (`@/lib/money`).
- Produces: `export function BillPicker({ value, onChange, paidKobo }: { value: BillDraft; onChange: (next: BillDraft) => void; paidKobo?: number })` and a helper `export function draftFromItems(items: { name: string; amountKobo: number; optional?: boolean }[]): BillDraft`.

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import {
  type BillDraft,
  subtotalKobo,
  billTotalKobo,
  validateBillDraft,
} from "@/lib/fees/billMath";
import { parseNairaToKobo, koboToNairaString } from "@/lib/money";
import { Money, NairaInput, Input, Field } from "@/components/ui";

/** Seed a draft from class default items (optional items start unchecked). */
export function draftFromItems(
  items: { name: string; amountKobo: number; optional?: boolean }[],
): BillDraft {
  return {
    lines: items.map((i) => ({
      name: i.name,
      amountKobo: i.amountKobo,
      checked: !i.optional,
    })),
    discountKobo: 0,
    discountReason: "",
  };
}

export function BillPicker({
  value,
  onChange,
  paidKobo,
}: {
  value: BillDraft;
  onChange: (next: BillDraft) => void;
  paidKobo?: number;
}) {
  const setLine = (idx: number, patch: Partial<BillDraft["lines"][number]>) =>
    onChange({
      ...value,
      lines: value.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    });
  const removeLine = (idx: number) =>
    onChange({ ...value, lines: value.lines.filter((_, i) => i !== idx) });
  const addLine = () =>
    onChange({
      ...value,
      lines: [...value.lines, { name: "", amountKobo: 0, checked: true }],
    });

  const error = validateBillDraft(value, paidKobo);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={line.checked}
              onChange={(e) => setLine(idx, { checked: e.target.checked })}
              className="size-4 accent-primary"
              aria-label={`Include ${line.name || "item"}`}
            />
            <Input
              value={line.name}
              onChange={(e) => setLine(idx, { name: e.target.value })}
              placeholder="Item name"
              className="flex-1"
            />
            <NairaInput
              value={koboToNairaString(line.amountKobo)}
              onValueChange={(raw) =>
                setLine(idx, { amountKobo: parseNairaToKobo(raw) ?? 0 })
              }
              className="w-32"
            />
            <button
              type="button"
              onClick={() => removeLine(idx)}
              aria-label="Remove item"
              className="px-2 text-ink-faint hover:text-danger"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="text-sm font-semibold text-primary hover:underline"
      >
        Add item
      </button>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <Field label="Discount">
          <NairaInput
            value={koboToNairaString(value.discountKobo)}
            onValueChange={(raw) =>
              onChange({ ...value, discountKobo: parseNairaToKobo(raw) ?? 0 })
            }
          />
        </Field>
        <Field label="Discount reason">
          <Input
            value={value.discountReason}
            onChange={(e) => onChange({ ...value, discountReason: e.target.value })}
            placeholder="e.g. Sibling, Scholarship"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-ink-muted">Subtotal</span>
        <Money kobo={subtotalKobo(value)} />
      </div>
      <div className="flex items-center justify-between text-base font-semibold">
        <span>Bill total</span>
        <Money kobo={billTotalKobo(value)} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add `koboToNairaString` if missing**

Open `src/lib/money.ts`. If there is no helper that renders kobo as a plain editable Naira string (no currency symbol, e.g. `90000` from `9000000`), add one:

```ts
/** Kobo to a plain Naira string for editable inputs, e.g. 9000000 -> "90000". */
export function koboToNairaString(kobo: number): string {
  return kobo === 0 ? "" : String(kobo / 100);
}
```

If an equivalent already exists, use it instead and adjust the `BillPicker` import.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BillPicker.tsx src/lib/money.ts
git commit -m "feat: shared BillPicker component"
```

---

### Task 10: Fees panel — Fee template download/upload

**Files:**
- Modify: `src/app/profile/page.tsx` (the `FeesPanel`)

**Interfaces:**
- Consumes: `buildFeeTemplateRows`, `parseFeeTemplate`, `FEE_TEMPLATE_HEADERS` (`@/lib/fees/feeTemplate`), `exportToXlsx`, `readSheetRows` (`@/lib/export`), `repository.listClasses`, `repository.listFeeItems`, `repository.importFeeStructure`, `Banner`, `Button`.

- [ ] **Step 1: Add the template card to `FeesPanel`**

Above the existing per-level editor, add a card. Distinct class levels come from `listClasses()` (dedupe `level`, order by `classRank` from `@/lib/classes`). Pre-fill from `listFeeItems(term)` grouped by level into the `existingByLevel` shape.

Download handler:

```ts
function downloadTemplate() {
  const levels = Array.from(new Set(classes.map((c) => c.level)))
    .sort((a, b) => classRank(a) - classRank(b));
  const existingByLevel: Record<string, { name: string; amountKobo: number; optional?: boolean }[]> = {};
  for (const f of feeItems) {
    (existingByLevel[f.level] ??= []).push({ name: f.name, amountKobo: f.amount, optional: f.optional });
  }
  exportToXlsx("Fee template", [...FEE_TEMPLATE_HEADERS], buildFeeTemplateRows(levels, existingByLevel));
}
```

Upload handler:

```ts
async function onTemplateFile(file: File) {
  const levels = Array.from(new Set(classes.map((c) => c.level)));
  const sheet = await readSheetRows(file);
  const { rows, errors } = parseFeeTemplate(sheet, levels);
  if (errors.length) setTemplateErrors(errors.slice(0, 10));
  if (rows.length) {
    const res = await repository.importFeeStructure(term, rows);
    setTemplateResult(res); // show "Updated N levels, wrote M items"
    // refresh feeItems
  }
}
```

Copy (no em-dashes): title "Fee template", helper "Download the template, set each class's items and amounts, then upload it. This becomes the default bill for new students." Show `errors` in `Banner tone="error"` and the success summary in `Banner tone="success"`. Gate the card to the existing fee-management permission used by the panel.

- [ ] **Step 2: Verify in the running app**

Run the app (`preview_start` with the dev server), sign in, go to Profile > Fees. Download the template, confirm it contains the school's levels. Edit an amount, upload, confirm the success banner and that the per-level editor now shows the imported items. Capture a screenshot.

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: fee template download + upload on Fees panel"
```

---

### Task 11: New-student page uses `BillPicker`

**Files:**
- Modify: `src/app/students/new/page.tsx`

**Interfaces:**
- Consumes: `BillPicker`, `draftFromItems`, `billMath` (`checkedLines`, `validateBillDraft`), `repository.listFeeItems`.
- Produces: `createStudent` called with `billLines` + `discountKobo` + `discountReason`.

- [ ] **Step 1: Replace the single term-fee field with `BillPicker`**

Seed the draft from the selected class level's fee items (`feeItems.filter(f => f.level === selectedClass.level)` via `draftFromItems`). Re-seed when the class changes. When the class has no fee items, seed a draft with one blank checked line so a manual bill can still be entered.

On save: run `validateBillDraft(draft)`; if it returns a message, show it and stop. Otherwise pass to `createStudent`:

```ts
const lines = checkedLines(draft);
await repository.createStudent({
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  otherName: form.otherName.trim() || undefined,
  gender: form.gender === "male" ? "male" : form.gender === "female" ? "female" : undefined,
  dateOfBirth: form.dateOfBirth || undefined,
  religion: form.religion.trim() || undefined,
  classId: form.classId,
  termFeeKobo: 0,
  billLines: lines,
  discountKobo: draft.discountKobo,
  discountReason: draft.discountReason.trim() || undefined,
  guardianName: form.guardianName.trim(),
  guardianPhone: form.guardianPhone.trim(),
  guardianRelationship: form.guardianRelationship.trim() || undefined,
});
```

Remove the now-unused `termFee` state and its `NairaInput` field, and the `levelFeeTotal` auto-fill effect.

- [ ] **Step 2: Verify in the app**

Add a student in a class that has a fee structure: confirm the picker shows the class items, deselect one, reduce one amount, add a discount with a reason, save, and confirm the student record shows the tailored bill and the discount under Fees. Screenshot.

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/app/students/new/page.tsx
git commit -m "feat: onboarding uses BillPicker for the student's bill"
```

---

### Task 12: Student record — Bill tab

**Files:**
- Modify: `src/app/students/[id]/page.tsx`

**Interfaces:**
- Consumes: `BillPicker`, `billMath`, `repository.updateBillLines`, `repository.setStudentDiscount`, existing `RecordTabs`.
- Produces: an editable Bill tab that persists via `updateBillLines` then `setStudentDiscount`.

- [ ] **Step 1: Add the Bill tab**

In `RecordTabs`, add a "Bill" tab after Details. Seed a `BillDraft` from the account's `bill.lines` (all `checked: true`) and current `bill.discount` / `bill.discountReason`. Pass `paidKobo={account.paid}`.

Save handler:

```ts
async function saveBill() {
  const err = validateBillDraft(draft, account.paid);
  if (err) return setBillError(err);
  await repository.updateBillLines(account.student.id, term, checkedLines(draft));
  await repository.setStudentDiscount(
    account.student.id, term, draft.discountKobo, draft.discountReason.trim() || undefined,
  );
  // reload the account
}
```

Gate the Bill tab's save to the fee/student-management permission the record already uses for the discount editor.

- [ ] **Step 2: Verify in the app**

Open a student who has paid part of their bill. Try to reduce the bill below the amount paid: confirm it's blocked with the message. Make a valid edit (add a line, change discount reason), save, reload, confirm it persisted and the discount shows under Fees. Screenshot.

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/app/students/[id]/page.tsx
git commit -m "feat: editable Bill tab on the student record"
```

---

### Task 13: Full verification + security audit

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Typecheck, lint, build**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run build`
Expected: all clean / passing across all routes.

- [ ] **Step 3: Post-build security audit**

Run the standing adversarial security audit (see the `security-audit-prompt` memory) against the changed surface. Focus areas: `importFeeStructure` / `updateBillLines` are gated to proprietor/bursar and scoped by `auth_school_id()` with `WITH CHECK`; the template upload is parsed to typed rows only (no formula/code execution); no cross-school write is possible via `studentId` in `updateBillLines`. Fix any critical/high before merge.

- [ ] **Step 4: Final commit (if the audit required changes)**

```bash
git add -A
git commit -m "chore: post-build audit fixes for Bills"
```

---

## Self-Review notes

- **Spec coverage:** template download/upload (Tasks 2, 10); per-student add/remove/reduce lines (Tasks 3, 6, 9, 11, 12); discount with reason captured under Fees (Tasks 7, 12 via `setStudentDiscount`); no new tables (all tasks); reuse of `exportToXlsx`/`readSheetRows` (Task 10); guards for below-paid and reason-required (Tasks 3, 6). Covered.
- **Type consistency:** `BillLineInput { name, amountKobo }` is used identically in `repository.ts`, `mock.ts`, `supabase-repo.ts`, and mapped to `{ name, amount }` on the stored `BillLine` in every write path. `BillDraft`/`PickerLine` live only in `billMath.ts` and `BillPicker`. `FeeTemplateRow` flows feeTemplate -> repository -> mock/supabase unchanged.
- **Known seed dependency:** Tasks 6 and 7 use a placeholder `classId: "c1"`; the first step of Task 6 requires replacing it with a real id read from `src/lib/data/seed.ts`. This is the one lookup the implementer must do; it is called out explicitly rather than guessed.
