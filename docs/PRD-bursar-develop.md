# Bursar — Product Requirements Document

**Status:** Reflects the `develop` branch as built (post UI redesign, slices 1-7).
**Date:** 2026-08-03
**Prioritisation:** MoSCoW (Must / Should / Could / Won't).
**Mission:** Every naira accounted for.

---

## 1. Product summary

Bursar is a Progressive Web App that gives a Nigerian school one place to keep
student records, bill and collect fees, record spending, and see every naira in
and out of the school. It is multi-tenant (each school's data is isolated),
installable on low-end phones, and works from a single sign-in with Google.

**Primary users**

| Role | What they do |
| --- | --- |
| Proprietor | Full access. Owns the school, grants roles, sees all money in and out. |
| Bursar | Day-to-day money: records payments and expenses, manages students, fees, staff, payroll, ledger. |
| Teacher | Views the dashboard, students, and who is owing. Cannot record money or change fees. |

Access is enforced in the database (Row Level Security), not just hidden in the
UI. The interface only offers a person the actions their role actually holds.

---

## 2. MoSCoW requirements

### 2.1 Must have — the product does not function without these

These are implemented and live on `develop`.

- **Authentication and tenancy**
  - Google OAuth sign-in; a signed-out user is always redirected to `/login`
    (middleware fails closed).
  - Onboarding creates the school and hard-codes the first user as Proprietor
    server-side (role cannot be self-assigned).
  - Every record is scoped to one school via RLS helpers (`auth_school_id()`,
    `auth_role()`); no cross-school reads or writes.
- **Role-based access** across three roles with a permission map driving both the
  UI and the database policies.
- **Student records** — list, add one, open a record. A record shows the student,
  guardian, class, admission number, term bill, payments, and outstanding balance,
  organised into **Details / Payments / Receipts** tabs (Details first).
- **Fees and bills** — a per-class fee structure (fee items) generates each
  student's term bill; the bill breakdown is visible on the record.
- **Record a payment** — pick class then student, enter amount, method, and note;
  a numbered **receipt** is generated and the balance updates. Money is stored as
  integer kobo and shown to two decimals everywhere.
- **Record an expense** — payee, description, category, cadence, amount, date, and
  method; a voucher is saved and posted to the ledger.
- **New Entry** — one screen combining **Payment (money In)** and **Expense
  (money Out)** with a live receipt / voucher preview.
- **Ledger** — every credit (money in) and debit (money out) with running balance,
  opening and closing figures, date range, and type filter.
- **Dashboard** — outstanding balance, how much is accounted for, received vs
  expected, student and receipt counts, and who to follow up.
- **Term and session context** — the whole app is filtered by the term in view,
  switchable from the top bar.
- **Security posture** — no service keys on the client; sensitive writes go through
  the database with RLS + `WITH CHECK`; user-supplied text is HTML-escaped in the
  printable receipt. Full adversarial audit run before and after the build.

### 2.2 Should have — important, and already shipped

- **Discounts and scholarships** — a per-student discount with a reason, applied to
  the term bill (Proprietor / Bursar only).
- **Staff and payroll** — add staff manually or by **bulk template upload**
  (download template, fill, upload `.xlsx` / `.csv`). Teaching staff capture the
  **subject** they take. Monthly wage bill and a payroll run per period.
- **User roles management** — the Proprietor grants each member their role from the
  Profile hub.
- **Bulk student import** from a spreadsheet.
- **Export to Excel (`.xlsx`)** on the data screens (Students, Staff, and other
  tabular data) via a shared client-side export utility.
- **Class-first data tables** — Class is its own column and comes first; tables sort
  by class from Creche to SSS 3 (click to flip) and offer **rows per page**
  (10 / 20 / 50 / 100) with pagination.
- **Consistent money-direction language** — money in always uses a down arrow, money
  out always uses an up arrow, across entry, ledger, and dashboard.
- **Profile hub** — a single settings home with Account Information, Staff & Payroll,
  Fees & Discount, User Roles, and Appearance panels.

### 2.3 Could have — present, enhances the experience, not core

- **Dark theme** ("night ledger") with a light / dark toggle, remembered per device,
  applied before first paint (no flash).
- **Offline-friendly PWA** — installable, caches reads so records can be viewed
  without a connection; money-changing actions require connectivity so no receipt is
  ever lost.
- **Printable receipts and vouchers** — each receipt prints on its own; the New Entry
  success screen prints directly.
- **Fee reminders** — compose an SMS or WhatsApp reminder to a guardian from a student
  record (see Won't: live delivery).
- **Subscription-style term badge** and greeting in the top bar.
- **Live preview** of the receipt / voucher as the entry form is filled.

### 2.4 Won't have — out of scope for this release (deferred)

- **Live SMS / WhatsApp delivery.** The reminder composer is wired to a mock provider
  (Termii integration is stubbed); no real messages are sent yet.
- **Parent / guardian self-registration** (QR code + link + proprietor approval).
- **Richer student profile analytics** (for example weeks-owed trends).
- **Online payment collection** (payment gateway / card capture). Bursar records
  money received; it does not process transfers itself, by design.
- **Multi-branch / multi-campus** consolidation beyond a single school tenant.

---

## 3. Non-functional requirements

- **Security:** RLS on every table, least-privilege grants, no client-exposed
  secrets, fail-closed auth, HTML-escaped user data in generated documents. Standing
  rule: full adversarial audit before and after every build.
- **Performance / reach:** lean in-repo icon set and system-first fonts for low-end
  phones; installable PWA; read caching for offline.
- **Money integrity:** all amounts are integer kobo end to end; display is always two
  decimals with tabular figures so columns cannot be misread.
- **Voice:** respectful, clear, confident microcopy; no em-dashes anywhere in app text.
- **Accessibility:** keyboard-operable controls (sortable headers, tabs), visible
  focus states, left-aligned tabular data.

---

## 4. Technology

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4,
Supabase (Postgres + Auth + RLS). Client-side `.xlsx` via SheetJS.

---

## 5. Roadmap (next candidates)

Pulled from the Won't list, in likely order: live reminder delivery (Termii),
parent self-registration with approval, richer student profile analytics.
