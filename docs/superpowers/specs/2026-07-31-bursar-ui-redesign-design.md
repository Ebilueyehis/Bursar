# Bursar UI Redesign — Design Spec (V1.1)

Date: 2026-07-31
Status: Approved for build (interactive mockup signed off)
Reference prototype: `scratchpad/bursar-mockup.html` (published Artifact)

## Goal

Reimagine every screen so Bursar "flows and feels professional" — one intentional
system instead of drifting patterns. Responsive PWA that works across the three
target viewports (mobile 375, tablet 768, desktop 1280+). Emotional brief: **calm,
premium, trust-the-numbers.** Keep the existing "Ledger, not gradient" identity;
rebuild the system around it.

Applies to `develop` and merges to `main` as V1.1.

## Approach

Keep the palette and voice; rebuild the component + layout system. Not a repaint —
a shared shell, token set, and component kit that every screen composes from.

## Design tokens

### Color — unchanged Ledger palette (light)
- Paper `#f2efe6` · Card `#fbfaf5` · Raised `#ffffff` · Sunken `#eae6da`
- Ink Navy `#1b2a3c` · ink-muted `#4a5568` · ink-faint `#54677f`
- Border `#dcd6c4` · strong `#1b2a3c`
- Ledger Green `#2f6f4e` (primary / "accounted for") · hover `#275c41` · tint `#e1ebe3`
- Brass `#a9793a` (attention / partial) · Brick `#9c4234` (owed / error) · Slate `#54677f`

### Color — dark ("night ledger")
- bg `#10161d` · card `#19212b` · raised `#212b36` · sunken `#141b23`
- ink `#eef2f6` · muted `#aab6c2` · faint `#7f8d9c` · border `#2b3742`
- primary `#43946b` · warning `#c99a58` · danger `#cc6555`
- Full token table in prototype `:root[data-theme="dark"]`.

### Hero gradient
- `--hero-grad` navy pulling into ledger green (light `#1b2a3c → #213f2f → #2a5638`,
  dark `#1f2c3b → #234636 → #2d6044`) + a green radial glow. Ties the
  outstanding-balance card to the palette instead of a flat navy block.

### Typography
- **Display (headings + large figures): Bricolage Grotesque** via `next/font`.
- **Body + table numbers: neutral sans** (Inter, current) — clean, open zeros.
- **Money: DROP IBM Plex Mono.** All amounts use sans with `font-variant-numeric:
  tabular-nums`, **two decimals always** (`1,250.00`), open/clean zeros. Big display
  figures may use Bricolage; dense table figures use the neutral sans for legibility.
- Manrope retired from the money role; keep only if reused elsewhere.

### Motion — restrained
Hover feedback + gentle fades/`scaleX` reveals only. No scroll-jacking, no entrance
choreography. Respect `prefers-reduced-motion`. Nothing moves without reason.

## Information architecture / navigation

- **Main nav (sidebar desktop / bottom nav mobile):** Dashboard · Record payment ·
  Student records · Ledger.
- **Fees leaves the main nav** — preset fees live inside Profile & settings.
- **Profile & settings** reached from the profile avatar (top-right on desktop,
  Profile item in bottom nav on mobile). **No gear icon anywhere** — the avatar is
  the entry.

## App shell

- Desktop: fixed dark sidebar (nav + user block that opens settings) + roomy centered
  column (`max-width: 1200px`), sticky translucent topbar.
- Mobile (<900px): sidebar hidden, sticky bottom nav (5 items incl. Profile).
- Topbar: greeting + screen title (left); term selector, New payment, profile avatar
  (right).
- **Term selector** responsive: `Second Term · 2025/26` on desktop, `2nd Term · 25/26`
  (ordinal + short year, calendar icon) on mobile.
- **Payment button:** "New payment" desktop / "Payment" mobile.
- Density tuned so the default 100% desktop view breathes (was cramped): smaller
  display figures, tighter cell padding, wider column.

## Screens

### Dashboard
- Hero: outstanding balance (gradient card) + "N students to follow up".
- Reconciliation card: "% accounted for" with animated bar (received vs expected).
- Stat row (4): received / expected / student records / receipts issued.
- **Outstanding Payments** table (renamed from "Oldest Outstanding"):
  - Filters: **Level** (All / Secondary / Primary) and **Sort** (Oldest ↔ Most recent
    ↔ Highest ↔ Lowest balance).
  - Columns: Student · Guardian · Owed for (pill, `nowrap`) · **Balance** · **Actions**.
  - Header cells vertically centered; pills never wrap to two lines.
  - Export to Excel.
- Quick actions.

### Record payment
- **Two-step: pick Class first, then Student** (student list filters to the class).
- Amount (auto-comma, tabular), method segmented (Cash / Transfer / POS), optional note.
- Live receipt preview updates as fields change.
- Submit → success modal in Bursar voice: "Payment of ₦X received from <student>'s
  guardian. Receipt #NNNN generated." + Print.

### Student record
- Header: name, class, guardian, phone, outstanding balance.
- **Tabs in order: Details · Payments · Receipts** (Details first).
- Payments: table (left-aligned) + Export to Excel + Record a payment.
- Receipts: each receipt card has its own **Print receipt** button.

### Ledger
- Structure lifted from user's reference screenshot, skinned to Bursar:
  - Header: **date range** + **branch select** + **Export**.
  - Twin cards: **Opening balance** / **Closing balance** (large centered figures,
    `NGN` unit).
  - Table: No. · **Type (Credit/Debit)** · Amount chip (green ↑ in / red ↓ out) ·
    running Balance · Date & time · Statement · Attachment.
  - Type filter (All / Credit / Debit).
- Wording: **Credit / Debit** (decided 2026-07-31).
- Money in Bursar's 2-decimal kobo format (reference used 3 decimals — not adopted).

### Profile & settings (from avatar)
- **Appearance:** dark / light theme toggle (defaults to system).
- **Your details:** name, role, school, email + Edit.
- **Preset fees:** class fee table (Class · Level · Students · Term fee · Discounts ·
  Expected) + Export + add class / add discount. Class levels:
  **Primary = Creche–Basic 6, Secondary = JSS 1–SSS 3.**

## Cross-cutting rules

- **All table cell values left-aligned** (not right).
- **Export to Excel** on every screen with exportable data/reports (Outstanding,
  Payments, Ledger, Preset fees).
- Dark mode across all screens.
- Every amount: two decimals, tabular, clean zeros.

## Build notes (develop)

- Layer changes onto the existing token file (`globals.css` `@theme inline`) + shell
  components; do not fork the design system.
- Add Bricolage Grotesque + retire Plex Mono for money; update `.money`/`.tabular`
  usages to the sans tabular treatment.
- Excel export: wire real `.xlsx` generation (client-side) per data page.
- Re-run the full security audit before AND after the build (standing rule).

## IA revision (2026-07-31, after screenshot round)

Supersedes the navigation + Record-payment + Settings sections above where they conflict.

- **Primary nav (sidebar / bottom nav): Dashboard · Students · Ledger.** Record
  payment removed from the sidebar.
- **Top nav** carries, always: the **term badge**, the **New entry** button, and the
  **profile avatar** (→ Profile hub).
- **Term display = subscription badge** (SaaS "plan" chip inspo): medallion +
  "Second Term" over "2025 / 2026". Click to switch term.
- **New entry** = one screen with a **Payment (in) | Expense (out)** toggle — the plus
  action covers both money-in and money-out. Label confirmed: **"New entry"**. On
  mobile it's the centre + in the bottom nav.
- **Students** defaults to a **list** (dense table: Student · Guardian · Phone ·
  Balance · Status · Actions, with search, level/status filters, Export, Add, and
  pagination — table-list inspo). Clicking a row opens the record (Details-first
  tabs, printable receipts) with an "All students" back link.
- **Profile hub** = left side-menu + right panel (SaaS account-page inspo). Panels:
  **Account · Appearance (theme toggle) · Fees & discounts · Staff & payroll · User
  roles.**
  - Staff & payroll: **download a template → fill → upload for bulk import**, or add
    one manually. Lists staff with role + salary.
  - User roles: proprietor grants each member a role + record-money rights.
- Dashboard unchanged. Ledger as designed (Credit/Debit).

Reference prototype v2: `scratchpad/bursar-mockup.html` (published Artifact).

## Refinements (2026-07-31, second screenshot round)

Applies on top of the IA revision. Reflected in prototype v3.

- **New Entry casing + icons:** button and screen title read **"New Entry"** (proper
  case). Toggle labels **"Payment (In)"** / **"Expense (Out)"**. Payment icon is a
  **down arrow** (money in), Expense icon is an **up arrow** (money out).
- **Staff & payroll, manual add:** when the selected role is **Teacher**, reveal a
  **"Subject taught"** dropdown (Nigerian subject list). Hidden for other roles.
- **Students list = class-first:** **Class is its own column**, and the list sorts by
  class from **Creche (low) to SSS 3 (high)** by default. The Class header is a sort
  control: click (or Enter/Space) to flip Creche→SSS3 vs SSS3→Creche. Class rank
  order: Creche, Nursery 1-2, KG 1-2, Basic 1-6, JSS 1-3, SSS 1-3.
- **Rows per page:** every high-volume table (Students, Ledger, Outstanding,
  student Payments) gets a **rows-per-page selector: 10 / 20 / 50 / 100** in the
  pagination bar. Default 20.

## Open decisions
1. ~~Ledger wording~~ — **Credit/Debit** (decided 2026-07-31).
2. ~~Excel export approach~~ — **SheetJS (`xlsx`), client-side `.xlsx`** on every
   exportable table (decided 2026-07-31).
3. ~~Where `/debtors`, `/expenses` (list), `/reports` land~~ — **folded** (decided
   2026-07-31): debtors into Dashboard Outstanding table + Students owing-filter;
   expenses into New Entry (Expense) + Ledger; reports into per-page Export. No
   standalone routes retained.
