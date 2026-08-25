# Working in this repository

Read this before changing anything. Where a rule has a reason, the reason is
given: a rule whose purpose is unclear gets worked around.

## Scope: engineering sessions only

This is the standard operating procedure for **Claude Code sessions working in
this repository**, and for any human contributor doing the same work. It governs
building, changing and shipping Bursar.

It does **not** govern ordinary Claude Chat or Cowork sessions. Asking a question
about the product, drafting sales copy, thinking through pricing, or researching
an option is not a change to this repository: there is no build to keep green, no
commit to attach a document to, and nothing that can go stale. Applying a
definition of done to a conversation would be friction with no payoff.

The line is the repository, not the topic. If any session, on any surface, ends
up committing to this repository, it is doing engineering work and everything
below applies to it. A rule that only some contributors follow is not a
guarantee, it is a habit.

---

## The product in one line

Bursar gives a Nigerian school one place to keep student records, bill and
collect fees, record spending, and see every naira in and out. Mission: every
naira accounted for.

Start with `README.md` for orientation, then `docs/PRD-bursar-develop.md` for
what exists today.

---

## Definition of done

A change is not done when the code works. It is done when all of these are true.

1. `npx tsc --noEmit` is clean.
2. `npm run test` is green.
3. `npm run build` compiles.
4. **The docs that the change invalidates are updated in the same commit.** See
   the next section.
5. The full adversarial security audit has run, before and after the build, when
   the change touches data, auth, or the database. The prompt is in the project
   memory under `security-audit-prompt`.
6. Anything noticed but not fixed is written into `docs/backlog.md` before the
   commit lands. A thought that stays in a chat window is lost.

## Which doc a change invalidates

| If you change | Update |
| --- | --- |
| A feature: added, removed or reshaped | `docs/PRD-bursar-develop.md` |
| How someone runs, builds or navigates the project | `README.md` |
| An operational procedure (backups, restores, deploys) | the relevant file in `docs/runbooks/` |
| The words the product says to a user | `voice-guide.md` if the rule changed |
| Storage, cost, or plan limits | `docs/capacity-and-cost.md` |

The PRD is the one that rots fastest and hurts most, because it is what a new
person and an outside reader are handed. **Treat a stale PRD as a broken
build.** If a feature ships without its PRD line, the change is incomplete.

This one has teeth. `.github/workflows/docs-freshness.yml` runs on every push to
`main` and fails the release when it contains `feat:` commits and no change to
the PRD. It checks the release rather than the commit, because a feature is
normally built across several `feat:` commits with the PRD updated once at the
end. Dry-run against real history, it fails both of the releases that shipped
before this rule existed.

---

## Standing rules

**Money is integer kobo, end to end.** Never a float. Display is always two
decimals with tabular figures, so a column of naira cannot be misread.

**No em-dashes anywhere in text the product or its docs show.** Use a colon or a
comma. This is a house style rule, applied without exception.

**Voice: respectful, clear, confident.** Never blame the user. Always say what is
still safe. Always give a next step. Full guide in `voice-guide.md`. The
vocabulary table there is binding: a receipt is never an invoice, an outstanding
balance is never a debt.

**The database is the security boundary, not the UI.** Every table has RLS.
Queries do not add a `school_id` filter, because RLS already scopes them; adding
one implies the boundary is in the query, which is the wrong mental model.
`profiles` and `audit_log` are deliberately select-only. **Never add a write
policy to `profiles`**: it would let a user grant themselves a role.

**The service-role key is server-only.** It is read in exactly one module,
`src/lib/supabase/admin.ts`. Every file that calls `createAdminClient()` must
gate on something beyond "the caller has a valid session": onboarding gates on
"no profile exists yet for this user"
(`src/app/onboarding/actions.ts`), platform-admin actions gate on the
`platform_admins` allowlist (`src/lib/admin/guard.ts`). A call site with no
such gate is a finding, not a convenience.

**Two repository implementations, one interface.** Any change to
`src/lib/data/repository.ts` must be mirrored in both `mock.ts` and
`supabase-repo.ts`. The mock is not a toy: the test suite runs against it.

**Dark mode inverts `--ink`.** A surface meant to stay dark in both themes must
use `#16212e` or `--hero-grad` directly, never `bg-ink`.

**Deleting a student cascades to their payments.** `payments.student_id` is
`ON DELETE CASCADE` and there is no database-level guard. Any path that deletes a
student must check for existing payments in application code first. This is why
`declineRegistration` soft-withdraws instead of deleting when a receipt exists.

**Git:** work on `develop`, commit as you go, push. Merge to `main` only when
asked. Note that scheduled GitHub Actions only fire from `main`.

---

## How work flows

Four artefacts, in order. Skipping one is how work gets lost or built twice.

```
idea  →  docs/backlog.md
spec  →  docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
plan  →  docs/superpowers/plans/YYYY-MM-DD-<topic>.md
code  →  commits on develop
```

**Backlog.** Every suggestion, tweak, bug and "we should probably" goes into
`docs/backlog.md` the moment it is spoken, with a size and a status. Nothing is
too small. The cost of an unrecorded idea is that it resurfaces months later as a
surprise, or never.

**Spec.** Anything larger than a single obvious change gets a design document
first, and the design gets approved before code is written. A spec must carry a
**Decisions and why** section. That section is the most valuable thing in this
repository: the code says what, the commits say how, and only the spec says why
one option was chosen over another. It is what stops a new person undoing a
deliberate decision because it looked like an oversight.

**Plan.** A spec becomes an ordered, task-by-task plan with real code in it,
written for someone with no context. Each task ends in a testable deliverable and
its own commit.

**Code.** Small commits with bodies that explain the reasoning, not just the
change. The commit history here is genuinely good documentation; keep it that
way.

---

## Commit messages

Subject line: `type: what changed`, lower case, imperative, no trailing period.
Types in use: `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `chore`.

The body explains **why**, and names anything surprising. A future reader wants
to know what you knew. Worked examples are in the log: read
`git log 8291b80 -1` and `git log 553c617 -1`.

---

## Onboarding: read these in this order

1. `README.md`: what it is, how to run it, where things live.
2. `docs/PRD-bursar-develop.md`: what is built and what is deliberately not.
3. `voice-guide.md`: how the product speaks. Read before writing any user-facing
   word.
4. `src/lib/data/repository.ts`: the single interface every screen talks to. The
   fastest way to understand the domain.
5. `supabase/schema.sql`: the tables and every RLS policy.
6. `docs/superpowers/specs/`: why things are the way they are, newest first.
7. `docs/runbooks/`: what to do when something breaks.
8. `docs/backlog.md`: what is coming, and what was considered and rejected.
