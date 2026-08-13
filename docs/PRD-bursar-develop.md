# Bursar: Product Requirements Document

**Status:** Reflects `develop` as built.
**Last updated:** 2026-08-13
**Prioritisation:** MoSCoW (Must / Should / Could / Won't).
**Mission:** Every naira accounted for.

> **Keeping this current is part of shipping.** A change that adds, removes or
> reshapes a feature updates this file in the same commit. See `CLAUDE.md`.

---

## 1. Product summary

Bursar is a Progressive Web App that gives a Nigerian school one place to keep
student records, bill and collect fees, record spending, track exam results, and
see every naira in and out of the school. It is multi-tenant (each school's data
is isolated), installable on low-end phones, and works from a single sign-in with
Google.

**Primary users**

| Role | What they do |
| --- | --- |
| Proprietor | Full access. Owns the school, grants roles, sees all money in and out. |
| Bursar | Day-to-day money: records payments and expenses, manages students, fees, staff, payroll, ledger. |
| Teacher | Views the dashboard, students, who is owing, and records exam scores. Cannot record money or change fees. |

Access is enforced in the database (Row Level Security), not just hidden in the
UI. The interface only offers a person the actions their role actually holds.

---

## 2. MoSCoW requirements

### 2.1 Must have: the product does not function without these

All implemented and live on `develop`.

- **Authentication and tenancy**
  - Google OAuth sign-in; a signed-out user is always redirected to `/login`
    (middleware fails closed).
  - Onboarding creates the school and hard-codes the first user as Proprietor
    server-side (role cannot be self-assigned).
  - Every record is scoped to one school via RLS helpers (`auth_school_id()`,
    `auth_role()`); no cross-school reads or writes.
- **Role-based access** across three roles, with a permission map driving both
  the UI and the database policies.
- **Student records**: list, add one, bulk import, open a record. A record shows
  the student, guardian, class, admission number, term bill, payments, and
  outstanding balance, organised into **Details / Payments / Receipts** tabs.
- **Fees and bills**: a per-class fee structure generates each student's term
  bill. The bill snapshots its amounts, so correcting the structure later never
  rewrites a bill already issued.
- **Record a payment**: pick class then student, enter amount, method and note; a
  numbered **receipt** is generated and the balance updates. Money is stored as
  integer kobo and shown to two decimals everywhere.
- **Record an expense**: payee, description, category, cadence, amount, date and
  method; a voucher is saved and posted to the ledger.
- **Payments hub** at `/payments`, grouping four sections navigable from the
  sidebar dropdown, the mobile sheet, or the URL (`?tab=`):
  - **Ledger**: every credit and debit with running balance, opening and closing
    figures, date range and type filter.
  - **Income**: all money in, school fees and other income together.
  - **Expense**: money out.
  - **Audit trail**: read-only record of every money change, written by a
    `SECURITY DEFINER` database trigger into a table with no client write
    policy, so entries cannot be forged or erased through the API.
- **Dashboard**: outstanding balance, how much is accounted for, received vs
  expected, student and receipt counts, and who to follow up. The student and
  receipt cards link through to their screens.
- **Term and session context**: the whole app is filtered by the term in view,
  switchable from the top bar.
- **Security posture**: no service keys on the client; sensitive writes go
  through the database with RLS and `WITH CHECK`; user-supplied text is
  HTML-escaped in printable documents. Full adversarial audit before and after
  every build.

### 2.2 Should have: important, and already shipped

- **Exams and Records** at `/records`: CA1, CA2 and exam entry; class averages;
  averages by subject; a full report per student; drill-down by subject or by
  student; a spreadsheet template that downloads populated with the student list
  and uploads back with scores filled in.
- **Temporary registration**: a student can be recorded as `pending` and handed a
  printed provisional bill the same day, then approved once payment is recorded.
  Declining checks for existing payments first and soft-withdraws rather than
  deleting when any receipt exists, because payments cascade from students.
- **Generate Bill** for a student who has none, from the class structure or by
  hand.
- **Discounts and scholarships**: a per-student discount with a reason, applied
  to the term bill (Proprietor and Bursar only).
- **Staff and payroll**: add staff manually or by bulk template upload. Monthly
  wage bill and a payroll run per period.
- **User roles management**: the Proprietor grants each member their role.
- **Export all school records** from the Profile hub: one workbook with a sheet
  per collection (students, guardians, classes, fee items, bills, payments,
  expenses, income, staff, assessments). Money is written as a naira number so
  columns can be summed. Gated on `view_ledger`, because the workbook carries
  every payment, expense and staff salary.
- **Export to Excel** on the individual data screens.
- **Class-first data tables**: Class is its own column and comes first; tables
  sort from Creche to SSS 3 and offer rows per page with pagination.
- **Consistent money-direction language**: money in always uses a down arrow,
  money out always an up arrow.
- **Profile hub**: Setup, Account Information, Staff & Payroll, Fees & Discount,
  User Roles, Your Records, Appearance.

### 2.3 Could have: present, enhances the experience, not core

- **Dark theme** ("night ledger") with a toggle, remembered per device, applied
  before first paint.
- **Fluid type scale**: headings track the viewport rather than rendering
  desktop sizes on a phone.
- **Printable receipts and vouchers**, and a printable provisional bill.
- **Fee reminders**: compose an SMS or WhatsApp reminder to a guardian from a
  student record. See Won't: nothing is actually sent.
- **Live receipt preview** as the entry form is filled.
- **Installable PWA** that opens without a connection.

### 2.4 Won't have yet: known gaps, in priority order

- **Receipt delivery beyond print.** Every receipt path ends at `window.print()`,
  and two of them open a popup with no way back. Designed as workstream B of
  `docs/superpowers/specs/2026-08-12-reliability-receipts-offline-design.md`.
- **Honest behaviour on a weak network.** No idempotency key on money writes, no
  visible pending state, no navigation feedback, and connectivity is judged by
  `navigator.onLine`, which reports "online" on a connection that is not moving.
  Workstream C of the same spec.
- **Offline reading.** The service worker caches the app shell only and skips
  every cross-origin request, and there is no IndexedDB. Offline currently means
  the app opens to empty screens. Workstream D of the same spec.
- **Live SMS and WhatsApp delivery.** The Termii adapter exists at
  `src/lib/messaging/termii.ts`, but the app has **no API routes at all** and no
  code selects a provider, so a composed reminder has nowhere to go.
- **Parent self-registration** (QR code, link, proprietor approval). Its design
  needs revisiting now that temporary registration has shipped and overlaps it.
- **Richer student profile analytics**, for example weeks-owed trends.
- **Configurable assessment maxes.** CA1 20, CA2 20 and Exam 60 are fixed in
  `src/lib/records/grading.ts`. A school that marks differently cannot use
  Records.
- **Printable report-card layout** for Records, deferred by the product owner to
  a future iteration.
- **Offline payment recording** with reserved receipt-number blocks. Designed and
  deliberately deferred; see section 8 of the reliability spec.
- **Online payment collection.** Bursar records money received; it does not
  process transfers, by design.
- **Multi-branch consolidation** beyond a single school tenant.

---

## 3. Non-functional requirements

- **Security:** RLS on every table, least-privilege grants, no client-exposed
  secrets, fail-closed auth, HTML-escaped user data in generated documents.
  Standing rule: full adversarial audit before and after every build.
- **Continuity:** nightly `pg_dump` encrypted to an `age` recipient public key
  and stored in Cloudflare R2, a weekly freshness check that fails loudly, a
  keep-alive that stops the free Supabase project pausing, and a restore drill
  that must be dated in `docs/runbooks/restore.md` before the backup counts as
  real. Setup steps are in `docs/runbooks/backup-setup.md`.
- **Performance and reach:** lean in-repo icon set and system-first fonts for
  low-end phones; installable PWA.
- **Money integrity:** all amounts are integer kobo end to end; display is always
  two decimals with tabular figures so columns cannot be misread. Receipts cannot
  be deleted once issued.
- **Capacity:** about 21,000 rows and 5 to 10 MB per 300-student school year,
  dominated by assessments. Model and the written Pro upgrade trigger are in
  `docs/capacity-and-cost.md`.
- **Voice:** respectful, clear, confident microcopy; no em-dashes anywhere in app
  text. See `voice-guide.md`.
- **Accessibility:** keyboard-operable controls, visible focus states,
  left-aligned tabular data, `prefers-reduced-motion` honoured.

---

## 4. Technology

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
(CSS-first config, no `tailwind.config.js`), Supabase (Postgres 17 + Auth + RLS),
client-side `.xlsx` via SheetJS, GitHub Actions and Cloudflare R2 for backups.

---

## 5. Roadmap

In the order recommended as of the last update:

1. Finish backup setup through the restore drill (operator task, not code).
2. Run the sales kit prompt sequence and recruit pilot schools. No engineering.
3. Workstream B: receipt delivery and the receipt screen.
4. Workstream C: idempotency and network honesty.
5. Workstream D: offline reading.
6. Live reminder delivery via an API route.
7. Parent self-registration, redesigned around temporary registration.
