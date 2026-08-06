# Setup Task View — Design Spec

**Date:** 2026-08-06
**Status:** Approved (brainstorm), pending implementation plan
**Milestone:** M2 (First-run readiness)

## Problem

A freshly onboarded school lands on an empty dashboard with no guided path.
Setup is scattered across Profile (fees, bank info) and Students, and a
non-technical bursar has no way to know the correct order or that they are
"done." New schools stall before they ever record a payment.

## Goal

Give a new school one guided, self-updating checklist that:

- names every setup task in the order it should be done,
- shows a live completion percentage,
- soft-blocks the actions that genuinely cannot work without a prerequisite,
  without ever trapping the user,
- disappears once the school is set up.

Explicitly out of scope: installment-plan selection (separate M2 slice),
vendors (arrives with M4), any blocking full-screen wizard.

## Task model

Two tiers.

### Blockers (soft-blocked, auto-derived, ordered)

These gate the app's core job. Order is fixed and sequential — the surfaces
highlight the first incomplete blocker as the next action.

1. **Fee structure** — done when **every class level the school has** carries
   at least one bill item. Not "one class"; all of them. Derived from the
   school's classes (`repository.listClasses`) cross-checked against fee items
   per level.
2. **Student list** — done when at least one student exists.
3. **Bank account information** — done when all three fields are filled:
   account number, account name, bank name.

### Nudges (dismissible, no hard data signal)

Shown below blockers, each with a "Dismiss" control.

- **Staff invites** — a solo bursar can run without this.
- **Vendors** — only appears once M4 ships.

## Completion percentage

Weighted, not a flat count.

- Blocker weight = 3, nudge weight = 1.
- `percentage = doneWeight / shownWeight`, rounded.
- Today (3 blockers + staff nudge): shownWeight = 10, each blocker = 30%,
  staff = 10%. Every blocker is ≥ 15% as required.
- When vendors appears (M4): shownWeight = 11, each blocker ≈ 27%, each nudge
  ≈ 9% — still ≥ 15% per blocker, self-rebalancing. No hardcoded percentages.

The dashboard card treats **only blockers** as the "am I still needed" signal:
it self-hides when all blockers are done, even if a nudge remains dismissible.

## Single source of truth

One hook, `useSetupTasks()`, derives the full task list (status + weight +
next-action link) from live data, so the dashboard card and the Profile setup
panel can never disagree, and the soft-block prompts read the same status.

Shape (illustrative):

```ts
type SetupTaskId = "fees" | "students" | "bank" | "staff" | "vendors";

interface SetupTask {
  id: SetupTaskId;
  title: string;
  why: string;            // one-line rationale
  tier: "blocker" | "nudge";
  done: boolean;          // blockers: derived; nudges: dismissed flag
  weight: number;         // 3 | 1
  href: string;           // page that completes it
  dismissible: boolean;   // nudges only
}

interface SetupState {
  tasks: SetupTask[];
  percentage: number;     // weighted, 0..100
  nextTask: SetupTask | null;   // first incomplete blocker, in order
  allBlockersDone: boolean;     // drives card self-hide
}
```

Derivation inputs (all already available or a thin add):

- Fee structure: existing fee-structure read keyed by level + `listClasses`.
- Students: a count (reuse dashboard stats / a light count query).
- Bank info: new fields on the school record (see Data changes).
- Nudge dismissal: a per-user flag (see Data changes).

## Surfaces

### 1. Dashboard card — "Finish setting up"

- Pinned to the top of the dashboard.
- Weighted percentage bar + the single **next action** as a prominent button
  (deep-links to the fixing page). Remaining tasks summarized compactly.
- Self-hides when `allBlockersDone` is true.
- Only shown to roles that can act on setup (see Permissions).

### 2. Profile > Setup panel

- New panel in the existing Profile panel switcher (`PanelId` gains `"setup"`),
  listed **first**, matching the current account/staff/fees/roles/appearance
  pattern. This is the "page under Profile" the user asked for.
- Large completion percentage bar at the top.
- Ordered list of blockers: each row = title, one-line why, done/pending state,
  and a link/button to act. The first incomplete blocker is emphasized as the
  next step.
- Nudges listed below with a "Dismiss" control; dismissed nudges drop out of
  the percentage.

### 3. Point-of-action soft-block prompts

Not a wall — an inline prompt with a one-tap link, shown only where the missing
prerequisite actually breaks the action:

- **Add student** with no fee structure: replace the empty bill picker with
  "Set up your fee structure first" + link to Profile > Fees.
- **Receipt / invoice** rendered with no bank info: inline prompt to add bank
  details (links to Profile > Account Information).

The same `useSetupTasks()` status drives these, so a prompt disappears the
instant its prerequisite is satisfied.

## Data changes

No new tables.

- **Bank account information** — three text columns on the `schools` table:
  `bank_account_number`, `bank_account_name`, `bank_name`. Surfaced in the
  Account Information panel as a new "Bank Account Information" subsection under
  Basic Information. Required-in-spirit (a blocker) but stored nullable so the
  checklist can detect "not yet filled."
- **Nudge dismissal** — stored in `localStorage`, keyed by user id
  (`bursar-setup-dismissed:<userId>` → JSON array of nudge ids). **Not** a
  `profiles` column: `profiles` is deliberately write-blocked from the client
  (select-only grant, no update policy) to prevent role self-escalation, and
  opening it up to store a cosmetic dismiss flag would weaken that invariant.
  Per-device dismissal is acceptable for an optional nudge that never touches
  money or blockers.

RLS: the bank columns need a new `schools` UPDATE policy — the table currently
has only a `read_same_school` (select) policy, so the client cannot write to it.
Add an update-only policy scoped to the caller's own school and to
`proprietor`/`bursar`:

```sql
create policy manage_school on schools
  for update using (id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (id = auth_school_id() and auth_role() in ('proprietor','bursar'));
```

No `profiles` policy change (dismissal is client-local). No other new policy
surface.

## Permissions

Setup is administrative. Gate the dashboard card and the Setup panel to roles
that can actually complete the tasks — proprietor and bursar (they hold
`edit_fees` + `manage_students`). A teacher never sees the setup card or panel.
The soft-block prompts are shown to whoever can reach the underlying action.

## Bank Account Information subsection (built here)

The bank-info blocker requires the input to exist, so this spec builds it:

- Location: Profile > Account Information panel, new "Bank Account Information"
  subsection.
- Fields: Account number, Account name, Bank name (free text; bank as text, not
  a fixed list — small schools use varied institutions).
- Saved to the new `schools` columns via the repository (both mock and
  Supabase implementations).
- No account numbers or credentials are ever entered by the assistant; this is
  a user-facing form only.

## Testing

- Unit-test `useSetupTasks()` derivation: fee structure done only when **all**
  class levels have items (partial coverage = not done); students threshold;
  bank-info all-three-fields rule; weighted percentage math at each item count
  (3 blockers + staff = 30/30/30/10; + vendors = rebalanced ≥15% each);
  `allBlockersDone` and `nextTask` ordering.
- Repository tests (mock + supabase-repo): bank-info read/write; nudge-dismissal
  read/write.
- Soft-block: Add-student page shows the fee-structure prompt when no structure
  and hides it once present.

## Voice / style

No em-dashes anywhere in app copy (use colons or hyphens). Task titles and
"why" lines follow the Bursar voice: say what it protects, not the mechanism.

## Rollout / flexibility

The layout may need iteration once seen. Keep the card and panel as thin
presentation over `useSetupTasks()`, so reordering, re-weighting, or restyling
touches data in one place and markup in two, with no schema churn.
