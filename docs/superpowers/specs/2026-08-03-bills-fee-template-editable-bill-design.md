# Bills: Excel Fee Template + Editable Student Bill

**Status:** Design approved (brainstormed 2026-08-03). Ready for implementation plan.
**Subsystem:** A of the "Bills & Payments" theme. Vendors/Payables is a separate spec.
**Branch:** feature off `develop`.

---

## 1. Summary

Give the admin one place to define what each class is billed, using a
spreadsheet they already know how to edit, and let them tailor any individual
student's bill without breaking the class template.

Two capabilities:

1. **Fee template.** Under Fees, download an Excel template pre-filled with the
   school's classes and starter items, edit it freely (rename items, set
   amounts, add rows), upload it. That becomes the default fee structure used
   when onboarding a student.
2. **Editable student bill.** When adding a student, a bill panel shows their
   class's items as checkboxes. The admin deselects items that do not apply,
   lowers a line's amount, adds a custom line, and can grant a discount with a
   reason. The same editor is available on an existing student's record. Any
   discount is captured under Fees as a scholarship, exactly as today.

## 2. Goals / Non-goals

**Goals**
- Bulk-set the fee structure for every class level from one uploaded sheet.
- Per-student bill customisation: remove item, add item, reduce a line amount.
- Keep discount/scholarship as a distinct, reason-carrying concession that
  reports under Fees.
- Reuse the existing Excel helpers (`exportToXlsx`, `readSheetRows`) and the
  existing snapshot bill model. No new database tables.

**Non-goals (explicitly out of scope for this spec)**
- Vendors / payables / due dates (separate spec, subsystem B).
- Reminders, online payment collection, parent portal.
- Per-section fee differences (fees remain keyed by class **level**, per the
  approved design).

## 3. Grounding in the current model

No schema tables change. Relevant existing types (`src/lib/domain/types.ts`):

- `FeeItem { id, schoolId, sessionId, term, level, name, amount, optional? }`
  is keyed by **level** (e.g. "JSS 1"), per session + term.
- `saveFeeStructure(level, term, items: FeeLineInput[])` already replaces one
  level's structure. `FeeLineInput { name, amountKobo, optional? }`.
- `generateBill(studentId, term)` snapshots the level's items into the
  student's `Bill.lines: BillLine[]` (`{ name, amount }`).
- `Bill { lines, discount, discountReason, ... }`. `StudentAccount.billTotal`
  is derived: `sum(lines) - discount`. No stored total to keep in sync.
- `setStudentDiscount(studentId, term, discountKobo, reason?)` already writes
  the discount onto the bill and surfaces it under Fees.

So Bills = a small amount of new repository surface + UI, sitting on top of what
already exists.

## 4. The Excel template

Long format, keyed by class level, generated from the school's own classes.

**Columns:** `Class | Item | Amount | Optional`

- **Class** — a class level label taken from the school's distinct class levels
  (`listClasses()` → distinct `level`, ordered by `classRank`). Example values:
  Creche, Primary 1, JSS 1, SS 3.
- **Item** — free text (School fee, Sportswear, Books, Computer, a book title).
- **Amount** — whole Naira (not kobo). Converted on import with the existing
  `parseNairaToKobo`.
- **Optional** — `Yes` / `No` (default `No`). Drives `FeeItem.optional`, which
  controls whether the item is unchecked by default in the onboarding picker.
  Every item stays deselectable regardless of this flag.

**Pre-fill on download:** one row per (level, starter item). If a level already
has fee items for the current term, pre-fill those exact names/amounts so the
download doubles as "export current structure to edit". Starter items when a
level has none: `School fee`, `Sportswear`, `Books`.

Example:

```
Class     | Item        | Amount | Optional
Creche    | School fee  | 40000  | No
Creche    | Sportswear  | 8000   | Yes
Primary 1 | School fee  | 55000  | No
Primary 1 | Books       | 12000  | No
JSS 1     | School fee  | 90000  | No
JSS 1     | Computer    | 10000  | Yes
```

## 5. New helpers and repository surface

### 5.1 `src/lib/fees/feeTemplate.ts` (new, pure functions, unit-tested)

```ts
export const FEE_TEMPLATE_HEADERS = ["Class", "Item", "Amount", "Optional"] as const;

export interface FeeTemplateRow {
  level: string;      // from the Class column
  name: string;       // Item
  amountKobo: number; // Amount (Naira) * 100
  optional: boolean;  // Optional === "Yes"
}

export interface FeeTemplateParse {
  rows: FeeTemplateRow[];
  errors: string[]; // human-readable, one per rejected sheet row
}

/** Build the download rows: one per (level, item), pre-filled from existing items. */
export function buildFeeTemplateRows(
  levels: string[],
  existingByLevel: Record<string, { name: string; amountKobo: number; optional?: boolean }[]>,
): (string | number)[][];

/** Parse the keyed rows returned by readSheetRows() into typed rows + errors. */
export function parseFeeTemplate(
  sheetRows: Record<string, string>[],
  knownLevels: string[],
): FeeTemplateParse;
```

Parse rules (each produces an `errors[]` entry and skips the row):
- Class not in `knownLevels` → `Row N: unknown class "X"`.
- Item blank → `Row N: item name is required`.
- Amount not a non-negative number → `Row N: amount "X" is not valid`.
- Optional present but not Yes/No (case-insensitive, blank = No) →
  `Row N: Optional must be Yes or No`.
- Duplicate (level, item) rows are allowed (two "Books" lines are legal).

### 5.2 Repository additions (`Repository` interface + supabase-repo + mock)

```ts
// Group rows by level, replace each level's structure via saveFeeStructure.
importFeeStructure(
  term: TermName,
  rows: FeeTemplateRow[],
): Promise<FeeStructureImportResult>;

// Replace a student's bill snapshot lines for the term. Discount is untouched.
updateBillLines(
  studentId: string,
  term: TermName,
  lines: BillLineInput[],
): Promise<void>;
```

```ts
export interface BillLineInput { name: string; amountKobo: number }

export interface FeeStructureImportResult {
  levelsUpdated: number;
  itemsWritten: number;
  skipped: number; // rows rejected upstream by parseFeeTemplate
}
```

- `importFeeStructure` groups `rows` by `level`, maps each group to
  `FeeLineInput[]`, and calls the existing `saveFeeStructure(level, term, items)`
  once per level. A level absent from the sheet is left unchanged (import is
  additive/replacing per level present, never a global wipe).
- `updateBillLines` replaces `Bill.lines`. It MUST reject a save whose new line
  total is below the amount already paid on that bill, returning an error
  `New bill total is less than what has already been paid.` (guards a bill being
  edited down after payments). Everything else is derived, so no other writes.

### 5.3 `createStudent` extension

`CreateStudentInput` gains optional fields so onboarding can pass the chosen,
edited bill instead of a single lump term fee:

```ts
billLines?: BillLineInput[];   // chosen + edited lines from the picker
discountKobo?: number;         // 0 when none
discountReason?: string;       // required by the UI when discountKobo > 0
```

Behaviour:
- If `billLines` is provided, the created bill uses exactly those lines, and
  `discountKobo`/`discountReason` are applied via the same path as
  `setStudentDiscount`.
- If `billLines` is omitted, keep today's behaviour: fall back to
  `termFeeKobo` as a single `Term fee` line (backward compatible; used when a
  class has no fee structure).

## 6. UI

### 6.1 Fees section: Fee template card

Location: the existing Fees panel (`src/app/profile/page.tsx`, `FeesPanel`).
Add a card above the current per-level editor:

- **Download template** button → `buildFeeTemplateRows(...)` → `exportToXlsx("Fee template", FEE_TEMPLATE_HEADERS, rows)`.
- **Upload filled template** file input (`.xlsx`/`.csv`) → `readSheetRows(file)`
  → `parseFeeTemplate(rows, knownLevels)` → if `errors.length` show them in a
  `Banner tone="error"` (list, first 10) and still offer to import the valid
  rows → `importFeeStructure(term, parse.rows)` → success `Banner` with
  `levelsUpdated` / `itemsWritten`.
- Copy (voice rule: no em-dashes): title "Fee template", helper
  "Download the template, set each class's items and amounts, then upload it.
  This becomes the default bill for new students."

Permission: gated to roles with fee management (proprietor / bursar), same gate
as the existing fee editor.

### 6.2 `BillPicker` component (new, shared)

`src/components/BillPicker.tsx` — the one editor used by both onboarding and the
record tab.

Props:
```ts
{
  items: { name: string; amountKobo: number; optional?: boolean }[]; // class defaults or existing bill lines
  value: BillPickerState;
  onChange: (next: BillPickerState) => void;
  paidKobo?: number; // for the "cannot go below paid" guard on edit
}
```

`BillPickerState`:
```ts
{
  lines: { name: string; amountKobo: number; checked: boolean }[]; // editable, removable
  discountKobo: number;
  discountReason: string;
}
```

Renders:
- Each line: checkbox (checked = included), name, amount input (`NairaInput`),
  remove (x). Optional items start unchecked.
- "Add item" button appends a blank checked line.
- Discount row: `NairaInput` + reason `Input`. Reason required when discount > 0.
- Live subtotal (sum of checked lines), discount, and **Bill total**
  (subtotal - discount). All via `Money`, two decimals.
- When `paidKobo` is set and Bill total < paidKobo, show inline error and the
  parent disables save.

The chosen lines a caller reads back = `lines.filter(l => l.checked)` mapped to
`BillLineInput`.

### 6.3 New student page

`src/app/students/new/page.tsx`: replace the single "Term fee" field with
`BillPicker` fed by the selected class level's fee items (`listFeeItems(term)`
filtered to `selectedClass.level`). On save, pass `billLines`, `discountKobo`,
`discountReason` to `createStudent`. When the class has no fee items, the picker
starts empty with a single blank line so a manual bill can still be entered
(preserves the current manual-entry path).

### 6.4 Existing student record: Bill tab

`src/app/students/[id]/page.tsx` `RecordTabs`: add a **Bill** tab (after
Details) holding `BillPicker` seeded from the existing `Bill.lines` and current
discount, with `paidKobo` = amount already paid. Save calls `updateBillLines`
then `setStudentDiscount`. Discount continues to surface under Fees >
Scholarships (unchanged path).

## 7. Edge cases

- **Class with no fee structure:** picker empty + manual add; onboarding still
  works (falls back to manual lines).
- **Upload with unknown class labels / bad amounts:** rejected per-row with
  messages; valid rows still import.
- **Editing a bill below amount paid:** blocked with a clear message.
- **Discount without reason:** save blocked (reason required when discount > 0).
- **Duplicate items in the sheet:** allowed; each becomes its own line.
- **Amounts:** template is whole Naira; everything internal is integer kobo.
- **Bill snapshots stay independent:** re-uploading the template never rewrites
  bills already issued to students (snapshot model preserved).

## 8. Security and money integrity

- All new writes (`importFeeStructure`, `updateBillLines`, extended
  `createStudent`) run through the repository under existing RLS: rows scoped by
  `auth_school_id()`, writes gated to proprietor/bursar with `WITH CHECK`. No new
  tables, no new policies required; verify the existing `fee_items` and `bills`
  policies cover the new call paths.
- Template upload is parsed client-side into typed rows only. No formulas, no
  code execution; strict validation before any write.
- Integer kobo end to end; `Money` renders two decimals. Bill total is derived,
  never a second stored copy that can drift.
- Standing rule: full adversarial security audit before and after the build.

## 9. Testing (TDD, test-first on the math)

Unit (pure, no DB):
- `parseFeeTemplate`: valid rows; unknown class; blank item; bad amount;
  Optional Yes/No/blank/garbage; duplicate lines allowed.
- `buildFeeTemplateRows`: pre-fills from existing items; starter items when a
  level is empty; ordered by `classRank`.
- `BillPicker` state math: subtotal of checked lines only; discount applied;
  total; below-paid guard; reason-required guard.

Repository (mock repo):
- `importFeeStructure`: groups by level, calls `saveFeeStructure` per level,
  returns correct counts; a level absent from the sheet is untouched.
- `updateBillLines`: replaces lines; recomputed `StudentAccount.billTotal`;
  rejects total < paid.
- `createStudent` with `billLines` + discount: bill reflects chosen lines;
  discount visible on the account and under Fees.

## 10. Out of scope / next

Vendors and payables (subsystem B) are specced separately. The Payments-section
IA regroup (Income / Bills / Expenses / Ledger) is a small shared task that can
land alongside this build or with subsystem B.
