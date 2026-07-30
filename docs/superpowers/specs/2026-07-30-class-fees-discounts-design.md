# Class Fees + Discounts/Scholarships — Design (Bursar v1.1)

**Date:** 2026-07-30
**Branch:** `develop`
**Status:** Approved to build (user directed: build Fees + debtors, then merge with Money-out to main as v1.1)

## Purpose

Today each student's fee is typed by hand at enrolment as a single "Term fee" line.
Schools actually charge a **fixed structure per class level per term** (Tuition, PTA
levy, etc.), with **discounts/scholarships** for some students. This makes fees
consistent and correct, so the debtors list (already built) reflects real balances.

## Scope

In scope:

1. **Fee structure admin** (`/fees`): for a term, set the fee line items for each
   class **level** — name, amount, optional flag. Proprietor + Bursar only
   (`edit_fees`, already defined).
2. **Bill from structure**: a new student is billed from their class level's
   structure for the current term (lines snapshotted onto the bill so later edits
   don't rewrite history). If the level has no structure yet, fall back to the manual
   term-fee field on the add-student form.
3. **Discount / scholarship**: on a student's page, set a fixed discount amount + a
   reason label (e.g. "Scholarship", "Sibling discount"). It reduces the bill total
   and shows in the breakdown.
4. **Debtors**: unchanged — already sorts by outstanding; benefits automatically.

Out of scope (separate tracks): weeks-owed display (#19); per-section (not per-level)
fee overrides; percentage discounts; parent registration (#21).

## Data model

Reuse existing tables:

- **`fee_items`** (`school_id, session_id, term, level, name, amount_kobo, optional`)
  — the structure template. Currently unused by the app; this wires it up.
- **`bills.discount_kobo`** — the per-student discount. Add **`bills.discount_reason text`**
  (migration) for the scholarship/label.

RLS already correct: `manage_fees` restricts `fee_items`/`bills` writes to
Proprietor+Bursar; grants already include both tables.

## Repository additions

```ts
// Fee structure
listFeeItems(term: TermName): Promise<FeeItem[]>;              // current session, all levels
saveFeeStructure(level: string, term: TermName,
                 items: FeeLineInput[]): Promise<void>;        // replace level+term items

// Per-student billing & discounts
generateBill(studentId: string, term: TermName): Promise<void>;   // create from level structure if missing
setStudentDiscount(studentId: string, term: TermName,
                   discountKobo: number, reason?: string): Promise<void>;
```

`FeeLineInput = { name: string; amountKobo: number; optional?: boolean }`.
`FeeItem` domain type already exists.

`createStudent` change: if the class level has a fee structure for the current term,
snapshot those lines onto the new bill; otherwise use the provided `termFeeKobo`
(kept as a fallback/override on the form).

Both `supabase-repo.ts` and `mock.ts` implement the additions.

## UI / routes

- **`/fees`** — term selector (from viewer) + a list of class levels; pick a level to
  edit its line items (name, amount, optional), Save. Shows the level's total. Empty
  levels prompt "Set fees for this level."
- **Student page** — a Discount/scholarship control (Proprietor+Bursar): set amount +
  reason. Breakdown already renders discount; add the reason label beside it.
- **Add-student** — keep the term-fee field but relabel: auto-applies the class fee
  structure when one exists; the typed amount is used only as a fallback/override.
- **Nav** — add **Fees** to the sidebar's admin group, gated by `edit_fees`.

## Error handling & money safety

- Naira → kobo via `money.ts`; never float.
- Saving a structure never rewrites existing students' bills (history safe).
- Discounts can't exceed the bill total in effect (clamped; outstanding never negative
  — the balance view already `greatest(0, …)`).
- Failed writes show plain-language messages matching the existing voice.

## Testing

- Mock repo: save structure → new student billed from it; discount reduces total;
  generateBill idempotent (no duplicate bill).
- Browser (preview): set a level's fees, add a student in that level → bill matches;
  apply a discount → total drops; debtor amount updates.

## Not changing

Auth, onboarding, Money-out/Ledger, payments (append-only), existing RLS. Additive.
